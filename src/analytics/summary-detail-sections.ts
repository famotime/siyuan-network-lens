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
import { SUGGESTION_TYPE_LABELS } from './ui-copy'
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

type SuggestionType = ReferenceGraphReport['suggestions'][number]['type']
type SuggestionMap = Map<string, Array<{ type: SuggestionType, suggestion: DetailSuggestion }>>

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
      meta: `创建于 ${formatCompactDate(document.created)}`,
      badge: '待标记',
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
      title: '文档样本详情',
      description: '当前筛选条件命中的文档。',
      kind: 'list',
      items: filteredDocuments
        .sort(compareDocumentsByRecentUpdate)
        .map(document => ({
          documentId: document.id,
          title: resolveTitle(document),
          meta: `${document.hpath || document.path} · 最近更新 ${formatCompactDate(document.updated)}`,
          isThemeDocument: themeDocumentIdSet.has(document.id),
        })),
    },
    read: {
      key: 'read',
      title: readCardMode === 'read' ? '已读文档详情' : '未读文档详情',
      description: readCardMode === 'read'
        ? '命中已读目录、标签或标题规则的文档。'
        : '未命中已读目录、标签或标题规则的文档。',
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
      title: '今日建议详情',
      description: '按优先级提供建议',
      kind: 'aiInbox',
      result: params.aiInboxResult ?? null,
    },
    largeDocuments: {
      key: 'largeDocuments',
      title: largeDocumentCardMode === 'storage' ? '大文档详情（按资源）' : '大文档详情（按文字）',
      description: largeDocumentCardMode === 'storage'
        ? '总大小超过 3 MB 的文档'
        : '字数超过 10000 的文档',
      kind: 'list',
      items: largeDocumentItems,
    },
    references: {
      key: 'references',
      title: '活跃关系详情',
      description: '当前时间窗口内参与文档级连接的文档。',
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
            meta: `入链 ${counts.inbound} / 出链 ${counts.outbound}`,
            badge: `${counts.inbound + counts.outbound} 次参与`,
            isThemeDocument: themeDocumentIdSet.has(documentId),
          }
        })
        .filter((item): item is SummaryDetailItem => item !== null)
        .sort(compareReferenceItemsByParticipation),
    },
    ranking: {
      key: 'ranking',
      title: '核心文档详情',
      description: '被引用频次最高的核心文档。',
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
      title: '趋势观察详情',
      description: '当前窗口与前一窗口的活跃变化对比。',
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
      title: '主题社区详情',
      description: '已归入主题社区的文档。',
      kind: 'list',
      items: params.report.communities.flatMap(community => {
        const hasRecognizedThemeDocument = community.documentIds.some(documentId => themeDocumentIdSet.has(documentId))
        return community.documentIds.map((documentId) => ({
          documentId,
          title: documentMap.get(documentId)?.title ?? documentId,
          meta: `社区标签：${community.topTags.join(' / ') || '未提取'} · 社区规模 ${community.size}`,
          badge: community.missingTopicPage && !hasRecognizedThemeDocument ? '缺主题页' : undefined,
          isThemeDocument: themeDocumentIdSet.has(documentId),
        }))
      }),
    },
    orphans: {
      key: 'orphans',
      title: '孤立文档详情',
      description: '当前窗口内没有有效文档级连接的文档。',
      kind: 'list',
      items: params.report.orphans.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: `最近更新 ${formatCompactDate(item.updatedAt)} · 创建于 ${formatCompactDate(item.createdAt)}`,
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'repair-orphan'),
      })),
    },
    dormant: {
      key: 'dormant',
      title: '沉没文档详情',
      description: `超过 ${params.dormantDays} 天未产生有效连接，但可能保留历史入链/出链。`,
      kind: 'list',
      items: params.report.dormantDocuments.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: `${item.inactivityDays} 天未活跃 · 最近连接 ${formatCompactDate(item.lastConnectedAt || item.updatedAt)}`,
        badge: item.hasSparseEvidence ? `${item.historicalReferenceCount} 条历史连接` : undefined,
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'archive-dormant'),
      })),
    },
    bridges: {
      key: 'bridges',
      title: '桥接节点详情',
      description: '断开后会削弱社区连通性的关键文档。',
      kind: 'list',
      items: params.report.bridgeDocuments.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: `连接度 ${item.degree}`,
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'maintain-bridge'),
      })),
    },
    propagation: {
      key: 'propagation',
      title: '传播节点详情',
      description: '高频出现在关键最短路径上的文档。',
      kind: 'propagation',
      items: params.report.propagationNodes.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: `覆盖 ${item.focusDocumentCount} 个焦点文档 · 社区跨度 ${item.communitySpan || 1}`,
        badge: `${item.score} 分`,
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
  for (const item of report.suggestions) {
    const suggestions = map.get(item.documentId) ?? []
    suggestions.push({
      type: item.type,
      suggestion: {
        label: SUGGESTION_TYPE_LABELS[item.type],
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
  const bridgeHint = item.bridgeRole ? '，同时承担社区桥接角色' : ''
  return {
    label: '传播优化',
    text: `位于 ${item.pathPairCount} 条关键最短路径上，覆盖 ${item.focusDocumentCount} 个焦点文档${bridgeHint}，建议补充路径说明与上下游导航。`,
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
    label: '清理内嵌资源',
    text: `内嵌资源 ${metric.assetCount} 个，资源占用 ${formatBytes(metric.assetBytes)}，当前总大小 ${formatBytes(metric.totalBytes)}，建议清理不再需要的内嵌资源。`,
  }
}

function buildReadMeta(item: ReturnType<typeof collectReadMatches>[number]): string {
  const parts: string[] = []

  if (item.matchedTags.length) {
    parts.push(`命中标签：${item.matchedTags.join(' / ')}`)
  }
  if (item.matchedPrefixes.length) {
    parts.push(`命中前缀：${item.matchedPrefixes.join(' / ')}`)
  }
  if (item.matchedSuffixes.length) {
    parts.push(`命中后缀：${item.matchedSuffixes.join(' / ')}`)
  }
  if (item.matchedPaths.length) {
    parts.push(`命中目录：${item.matchedPaths.join(' / ')}`)
  }

  return parts.join(' · ')
}

function buildReadBadge(item: ReturnType<typeof collectReadMatches>[number]): string | undefined {
  const badges: string[] = []

  if (item.matchedTags.length) {
    badges.push('标签命中')
  }
  if (item.matchedPrefixes.length || item.matchedSuffixes.length) {
    badges.push('标题命中')
  }
  if (item.matchedPaths.length) {
    badges.push('目录命中')
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
