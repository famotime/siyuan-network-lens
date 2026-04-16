import {
  type AnalyticsFilters,
  type DocumentRecord,
  type ReferenceGraphReport,
  type ReferenceRecord,
  type TimeRange,
  type TrendReport,
  filterDocumentsByTimeRange,
} from './analysis'
import {
  buildLargeDocumentMeta,
  buildLargeDocumentRankings,
  formatLargeDocumentBadge,
  formatBytes,
  LARGE_DOCUMENT_STORAGE_THRESHOLD_BYTES,
  type LargeDocumentCardMode,
  type LargeDocumentMetric,
} from './large-documents'
import { collectReadMatches, type ReadCardMode } from './read-status'
import { getSuggestionTypeLabels } from './ui-copy'
import {
  compareSiyuanTimestamps as compareTimestamp,
  formatCompactDate,
  isTimestampInTrailingWindow,
  normalizeTags,
  resolveDocumentTitle as resolveTitle,
} from './document-utils'
import type { AiInboxResult } from './ai-inbox'
import type {
  DetailSuggestion,
  SummaryCardKey,
  SummaryDetailItem,
  SummaryDetailSection,
} from './summary-detail-types'
import type { PluginConfig } from '@/types/config'
import { pickUiText } from '@/i18n/ui'

type SuggestionType = ReferenceGraphReport['suggestions'][number]['type']
type SuggestionMap = Map<string, Array<{ type: SuggestionType, suggestion: DetailSuggestion }>>
const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export function buildSummaryDetailSections(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  notebooks?: Array<{ id: string, name: string }>
  report: ReferenceGraphReport
  now: Date
  timeRange: TimeRange
  trends?: TrendReport | null
  filters?: AnalyticsFilters
  themeDocumentIds?: Iterable<string>
  dormantDays: number
  config?: Pick<
    PluginConfig,
    'readTagNames'
    | 'readTitlePrefixes'
    | 'readTitleSuffixes'
    | 'readPaths'
    | 'wikiPageSuffix'
    | 'analysisExcludedPaths'
    | 'analysisExcludedNamePrefixes'
    | 'analysisExcludedNameSuffixes'
  >
  readCardMode?: ReadCardMode
  largeDocumentMetrics?: ReadonlyMap<string, LargeDocumentMetric>
  largeDocumentCardMode?: LargeDocumentCardMode
  aiInboxResult?: AiInboxResult | null
}): Record<SummaryCardKey, SummaryDetailSection> {
  const filteredDocuments = filterDocumentsByTimeRange({
    documents: params.documents,
    references: params.references,
    now: params.now,
    timeRange: params.timeRange,
    filters: params.filters,
    wikiPageSuffix: params.config?.wikiPageSuffix,
    excludedPaths: params.config?.analysisExcludedPaths,
    excludedNamePrefixes: params.config?.analysisExcludedNamePrefixes,
    excludedNameSuffixes: params.config?.analysisExcludedNameSuffixes,
    notebooks: params.notebooks,
  })
  const documentMap = new Map(filteredDocuments.map(document => [document.id, document]))
  const activeReferences = filterActiveReferences({
    references: params.references,
    documentMap,
    now: params.now,
    timeRange: params.timeRange,
  })
  const activeCounts = buildActiveDocumentCounts(activeReferences)
  const suggestionMap = buildSuggestionMap(params.report)
  const themeDocumentIdSet = new Set(params.themeDocumentIds ?? [])
  const readMatches = collectReadMatches({
    documents: filteredDocuments,
    notebooks: params.notebooks,
    config: params.config,
  })
  const readCardMode = params.readCardMode ?? 'unread'
  const largeDocumentCardMode = params.largeDocumentCardMode ?? 'words'
  const readDocumentIdSet = new Set(readMatches.map(item => item.documentId))
  const largeDocumentItems = buildLargeDocumentRankings({
    documents: filteredDocuments,
    metrics: params.largeDocumentMetrics,
    mode: largeDocumentCardMode,
  }).map(item => ({
    documentId: item.documentId,
    title: item.title,
    meta: buildLargeDocumentMeta(largeDocumentCardMode, item, item.updatedAt),
    badge: formatLargeDocumentBadge(largeDocumentCardMode, item),
    isThemeDocument: themeDocumentIdSet.has(item.documentId),
  }))
  const unreadItems = filteredDocuments
    .filter(document => !readDocumentIdSet.has(document.id))
    .sort(compareDocumentsByRecentUpdate)
    .map(document => ({
      documentId: document.id,
      title: resolveTitle(document),
      meta: uiText(`Created ${formatCompactDate(document.created)}`, `创建于 ${formatCompactDate(document.created)}`),
      badge: uiText('Needs review', '待处理'),
      isThemeDocument: themeDocumentIdSet.has(document.id),
      suggestions: buildUnreadSuggestions({
        documentId: document.id,
        suggestionMap,
        largeDocumentMetrics: params.largeDocumentMetrics,
      }),
    }))

  return {
    documents: {
      key: 'documents',
      title: uiText('Doc sample', '文档样本'),
      description: uiText('Docs matched by the current filters.', '当前筛选命中的文档。'),
      kind: 'list',
      items: filteredDocuments
        .sort(compareDocumentsByRecentUpdate)
        .map(document => ({
          documentId: document.id,
          title: resolveTitle(document),
          meta: uiText(`${document.hpath || document.path} · Updated ${formatCompactDate(document.updated)}`, `${document.hpath || document.path} · 更新于 ${formatCompactDate(document.updated)}`),
          isThemeDocument: themeDocumentIdSet.has(document.id),
        })),
    },
    read: {
      key: 'read',
      title: readCardMode === 'read' ? uiText('Read docs', '已读文档') : uiText('Unread docs', '未读文档'),
      description: readCardMode === 'read'
        ? uiText('Docs matched by read paths, tags, or title rules.', '命中已读路径、标签或标题规则的文档。')
        : uiText('Docs not matched by read paths, tags, or title rules.', '未命中已读路径、标签或标题规则的文档。'),
      kind: 'list',
      items: readCardMode === 'read'
        ? readMatches.map(item => ({
            documentId: item.documentId,
            title: item.title,
            meta: buildReadMeta(item),
            badge: buildReadBadge(item),
            isThemeDocument: themeDocumentIdSet.has(item.documentId),
          }))
        : unreadItems,
    },
    todaySuggestions: {
      key: 'todaySuggestions',
      title: uiText('Today suggestions', '今日建议'),
      description: uiText('Suggestions ranked by priority.', '按优先级排序的建议。'),
      kind: 'aiInbox',
      result: params.aiInboxResult ?? null,
    },
    largeDocuments: {
      key: 'largeDocuments',
      title: largeDocumentCardMode === 'storage' ? uiText('Large docs (assets)', '大文档（资源）') : uiText('Large docs (text)', '大文档（正文）'),
      description: largeDocumentCardMode === 'storage'
        ? uiText('Docs larger than 3 MB in total size.', '总大小超过 3 MB 的文档。')
        : uiText('Docs with more than 10,000 words.', '字数超过 10,000 的文档。'),
      kind: 'list',
      items: largeDocumentItems,
    },
    references: {
      key: 'references',
      title: uiText('Active links', '活跃连接'),
      description: uiText('Docs participating in doc-level links in the current window.', '当前窗口内参与文档级连接的文档。'),
      kind: 'list',
      items: [...activeCounts.entries()]
        .map<SummaryDetailItem | null>(([documentId, counts]) => {
          const document = documentMap.get(documentId)
          if (!document) {
            return null
          }
          return {
            documentId,
            title: resolveTitle(document),
            meta: uiText(`Inbound ${counts.inbound} / Outbound ${counts.outbound}`, `入链 ${counts.inbound} / 出链 ${counts.outbound}`),
            badge: uiText(`${counts.inbound + counts.outbound} refs`, `${counts.inbound + counts.outbound} 条引用`),
            isThemeDocument: themeDocumentIdSet.has(documentId),
          }
        })
        .filter((item): item is SummaryDetailItem => item !== null)
        .sort(compareReferenceItemsByParticipation),
    },
    ranking: {
      key: 'ranking',
      title: uiText('Core docs', '核心文档'),
      description: uiText('Most referenced docs.', '被引用最多的文档。'),
      kind: 'ranking',
      ranking: params.report.ranking.map((item) => {
        const document = documentMap.get(item.documentId)
        const isThemeDocument = themeDocumentIdSet.has(item.documentId)
        return {
          ...item,
          tagCount: countDocumentTags(document?.tags),
          createdAt: document?.created ?? '',
          updatedAt: document?.updated ?? '',
          isThemeDocument,
          suggestions: isThemeDocument ? [] : resolveSuggestions(suggestionMap, item.documentId, 'promote-hub'),
        }
      }),
    },
    trends: {
      key: 'trends',
      title: uiText('Trend watch', '趋势观察'),
      description: uiText('Activity changes between the current and previous windows.', '当前窗口与上一窗口之间的活跃变化。'),
      kind: 'trends',
      trends: params.trends ?? {
        current: { referenceCount: 0 },
        previous: { referenceCount: 0 },
        risingDocuments: [],
        fallingDocuments: [],
        connectionChanges: { newCount: 0, brokenCount: 0, newEdges: [], brokenEdges: [] },
        communityTrends: [],
        risingCommunities: [],
        dormantCommunities: [],
      },
    },
    communities: {
      key: 'communities',
      title: uiText('Topic clusters', '主题社区'),
      description: uiText('Docs grouped into topic clusters.', '按主题聚成社区的文档。'),
      kind: 'list',
      items: params.report.communities.flatMap(community => {
        const hasRecognizedThemeDocument = community.documentIds.some(documentId => themeDocumentIdSet.has(documentId))
        return community.documentIds.map((documentId) => ({
          documentId,
          title: documentMap.get(documentId)?.title ?? documentId,
          meta: uiText(`Cluster tags: ${community.topTags.join(' / ') || 'None'} · Cluster size ${community.size}`, `社区标签：${community.topTags.join(' / ') || '无'} · 社区规模 ${community.size}`),
          badge: community.missingTopicPage && !hasRecognizedThemeDocument ? uiText('Missing topic page', '缺少主题页') : undefined,
          isThemeDocument: themeDocumentIdSet.has(documentId),
        }))
      }),
    },
    orphans: {
      key: 'orphans',
      title: uiText('Orphan docs', '孤立文档'),
      description: uiText('Docs with no valid doc-level links in the current window.', '当前窗口内没有有效文档级连接的文档。'),
      kind: 'list',
      items: params.report.orphans.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: uiText(`Updated ${formatCompactDate(item.updatedAt)} · Created ${formatCompactDate(item.createdAt)}`, `更新于 ${formatCompactDate(item.updatedAt)} · 创建于 ${formatCompactDate(item.createdAt)}`),
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'repair-orphan'),
      })),
    },
    dormant: {
      key: 'dormant',
      title: uiText('Dormant docs', '沉没文档'),
      description: uiText(`No valid links for more than ${params.dormantDays} days, with possible historical in/out links.`, `超过 ${params.dormantDays} 天没有有效连接，但可能存在历史入链或出链。`),
      kind: 'list',
      items: params.report.dormantDocuments.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: uiText(`${item.inactivityDays} inactive days · Last linked ${formatCompactDate(item.lastConnectedAt || item.updatedAt)}`, `${item.inactivityDays} 天未活跃 · 最近连接于 ${formatCompactDate(item.lastConnectedAt || item.updatedAt)}`),
        badge: item.hasSparseEvidence ? uiText(`${item.historicalReferenceCount} historical links`, `${item.historicalReferenceCount} 条历史连接`) : undefined,
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'archive-dormant'),
      })),
    },
    bridges: {
      key: 'bridges',
      title: uiText('Bridge docs', '桥接文档'),
      description: uiText('Key docs whose removal weakens community connectivity.', '移除后会削弱社区连通性的关键文档。'),
      kind: 'list',
      items: params.report.bridgeDocuments.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: uiText(`Degree ${item.degree}`, `连接度 ${item.degree}`),
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'maintain-bridge'),
      })),
    },
    propagation: {
      key: 'propagation',
      title: uiText('Propagation nodes', '传播节点'),
      description: uiText('Docs that frequently appear on key shortest paths.', '频繁出现在关键最短路径上的文档。'),
      kind: 'propagation',
      items: params.report.propagationNodes.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: uiText(`Covers ${item.focusDocumentCount} focus docs · Community span ${item.communitySpan || 1}`, `覆盖 ${item.focusDocumentCount} 个焦点文档 · 跨越 ${item.communitySpan || 1} 个社区`),
        badge: uiText(`${item.score} pts`, `${item.score} 分`),
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: [buildPropagationSuggestion(item)],
      })),
    },
  }
}

function compareDocumentsByRecentUpdate(left: DocumentRecord, right: DocumentRecord): number {
  return compareTimestamp(right.updated ?? '', left.updated ?? '') || resolveTitle(left).localeCompare(resolveTitle(right), 'zh-CN')
}

function compareReferenceItemsByParticipation(left: SummaryDetailItem, right: SummaryDetailItem): number {
  return extractBadgeNumber(right.badge) - extractBadgeNumber(left.badge) || left.title.localeCompare(right.title, 'zh-CN')
}

function buildSuggestionMap(report: ReferenceGraphReport): SuggestionMap {
  const map = new Map<string, Array<{ type: SuggestionType, suggestion: DetailSuggestion }>>()
  const suggestionTypeLabels = getSuggestionTypeLabels()
  for (const item of report.suggestions) {
    const suggestions = map.get(item.documentId) ?? []
    suggestions.push({
      type: item.type,
      suggestion: {
        label: suggestionTypeLabels[item.type],
        text: item.reason,
      },
    })
    map.set(item.documentId, suggestions)
  }
  return map
}

function resolveSuggestions(
  suggestionMap: SuggestionMap,
  documentId: string,
  type: SuggestionType,
): DetailSuggestion[] {
  return (suggestionMap.get(documentId) ?? [])
    .filter(item => item.type === type)
    .map(item => item.suggestion)
}

function buildPropagationSuggestion(item: ReferenceGraphReport['propagationNodes'][number]): DetailSuggestion {
  const bridgeHint = item.bridgeRole
    ? uiText(', also acting as a community bridge', '，同时承担社区桥接角色')
    : ''
  return {
    label: uiText('Propagation optimization', '传播优化'),
    text: uiText(
      `Appears on ${item.pathPairCount} key shortest paths, covering ${item.focusDocumentCount} focus docs${bridgeHint}. Add path notes and upstream/downstream navigation.`,
      `出现在 ${item.pathPairCount} 条关键最短路径上，覆盖 ${item.focusDocumentCount} 个焦点文档${bridgeHint}。建议补充路径说明与上下游导航。`,
    ),
  }
}

function buildUnreadSuggestions(params: {
  documentId: string
  suggestionMap: SuggestionMap
  largeDocumentMetrics?: ReadonlyMap<string, LargeDocumentMetric>
}): DetailSuggestion[] {
  const suggestions = resolveSuggestions(params.suggestionMap, params.documentId, 'repair-orphan')
  const metric = params.largeDocumentMetrics?.get(params.documentId)

  if (metric && metric.assetCount > 0 && metric.totalBytes > LARGE_DOCUMENT_STORAGE_THRESHOLD_BYTES) {
    suggestions.push(buildEmbeddedAssetCleanupSuggestion(metric))
  }

  return suggestions
}

function buildEmbeddedAssetCleanupSuggestion(metric: Pick<LargeDocumentMetric, 'assetCount' | 'assetBytes' | 'totalBytes'>): DetailSuggestion {
  return {
    label: uiText('Clean embedded assets', '清理嵌入资源'),
    text: uiText(
      `${metric.assetCount} embedded assets use ${formatBytes(metric.assetBytes)}. Total size is ${formatBytes(metric.totalBytes)}. Remove assets that are no longer needed.`,
      `${metric.assetCount} 个嵌入资源占用 ${formatBytes(metric.assetBytes)}，总大小为 ${formatBytes(metric.totalBytes)}。可清理不再需要的资源。`,
    ),
  }
}

function buildReadMeta(item: ReturnType<typeof collectReadMatches>[number]): string {
  const parts: string[] = []

  if (item.matchedTags.length) {
    parts.push(uiText(`Tags: ${item.matchedTags.join(' / ')}`, `标签：${item.matchedTags.join(' / ')}`))
  }
  if (item.matchedPrefixes.length) {
    parts.push(uiText(`Prefixes: ${item.matchedPrefixes.join(' / ')}`, `前缀：${item.matchedPrefixes.join(' / ')}`))
  }
  if (item.matchedSuffixes.length) {
    parts.push(uiText(`Suffixes: ${item.matchedSuffixes.join(' / ')}`, `后缀：${item.matchedSuffixes.join(' / ')}`))
  }
  if (item.matchedPaths.length) {
    parts.push(uiText(`Paths: ${item.matchedPaths.join(' / ')}`, `路径：${item.matchedPaths.join(' / ')}`))
  }

  return parts.join(' · ')
}

function buildReadBadge(item: ReturnType<typeof collectReadMatches>[number]): string | undefined {
  const badges: string[] = []

  if (item.matchedTags.length) {
    badges.push(uiText('Tag match', '标签命中'))
  }
  if (item.matchedPrefixes.length || item.matchedSuffixes.length) {
    badges.push(uiText('Title match', '标题命中'))
  }
  if (item.matchedPaths.length) {
    badges.push(uiText('Path match', '路径命中'))
  }

  return badges.join(' / ') || undefined
}

function countDocumentTags(tags?: readonly string[] | string): number {
  return normalizeTags(tags).length
}

function filterActiveReferences(params: {
  references: ReferenceRecord[]
  documentMap: Map<string, DocumentRecord>
  now: Date
  timeRange: TimeRange
}): ReferenceRecord[] {
  return params.references.filter((reference) => {
    if (reference.sourceDocumentId === reference.targetDocumentId) {
      return false
    }
    if (!params.documentMap.has(reference.sourceDocumentId) || !params.documentMap.has(reference.targetDocumentId)) {
      return false
    }
    if (params.timeRange === 'all') {
      return true
    }
    const days = Number.parseInt(params.timeRange, 10)
    return isTimestampInTrailingWindow(reference.sourceUpdated ?? '', params.now, days)
  })
}

function buildActiveDocumentCounts(references: ReferenceRecord[]): Map<string, { inbound: number, outbound: number }> {
  const outboundTargets = new Map<string, Set<string>>()
  const inboundSources = new Map<string, Set<string>>()

  for (const reference of references) {
    const outbound = outboundTargets.get(reference.sourceDocumentId) ?? new Set<string>()
    outbound.add(reference.targetDocumentId)
    outboundTargets.set(reference.sourceDocumentId, outbound)

    const inbound = inboundSources.get(reference.targetDocumentId) ?? new Set<string>()
    inbound.add(reference.sourceDocumentId)
    inboundSources.set(reference.targetDocumentId, inbound)
  }

  const counts = new Map<string, { inbound: number, outbound: number }>()
  for (const [documentId, targets] of outboundTargets) {
    counts.set(documentId, { inbound: 0, outbound: targets.size })
  }
  for (const [documentId, sources] of inboundSources) {
    const existing = counts.get(documentId) ?? { inbound: 0, outbound: 0 }
    existing.inbound = sources.size
    counts.set(documentId, existing)
  }

  return counts
}

function extractBadgeNumber(value?: string): number {
  if (!value) {
    return 0
  }
  const match = value.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : 0
}
