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
import { t } from '@/i18n/ui'

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
      meta: t('analytics.summaryDetailSource.createdDate', { date: formatCompactDate(document.created) }),
      badge: t('analytics.summaryDetailSource.needsReview'),
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
      title: t('analytics.summaryCards.docSample'),
      description: t('analytics.summaryDetailSource.docsMatchedByCurrentFiltersSentence'),
      kind: 'list',
      items: filteredDocuments
        .sort(compareDocumentsByRecentUpdate)
        .map(document => ({
          documentId: document.id,
          title: resolveTitle(document),
          meta: t('analytics.summaryDetailSource.updatedDatePath', {
            path: document.hpath || document.path,
            date: formatCompactDate(document.updated),
          }),
          isThemeDocument: themeDocumentIdSet.has(document.id),
        })),
    },
    read: {
      key: 'read',
      title: readCardMode === 'read' ? t('analytics.summaryCards.readDocs') : t('analytics.summaryCards.unreadDocs'),
      description: readCardMode === 'read'
        ? t('analytics.summaryDetailSource.docsMatchedByReadRulesSentence')
        : t('analytics.summaryDetailSource.docsNotMatchedByReadRulesSentence'),
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
      title: t('analytics.summaryCards.todaySuggestions'),
      description: t('analytics.summaryDetailSource.suggestionsRankedByPriority'),
      kind: 'aiInbox',
      result: params.aiInboxResult ?? null,
    },
    largeDocuments: {
      key: 'largeDocuments',
      title: largeDocumentCardMode === 'storage' ? t('analytics.summaryCards.largeDocsAssets') : t('analytics.summaryCards.largeDocsText'),
      description: largeDocumentCardMode === 'storage'
        ? t('analytics.summaryDetailSource.largeDocsAssetsSentence')
        : t('analytics.summaryDetailSource.largeDocsTextSentence'),
      kind: 'list',
      items: largeDocumentItems,
    },
    references: {
      key: 'references',
      title: t('analytics.summaryCards.activeLinks'),
      description: t('analytics.summaryDetailSource.docsParticipatingInLinks'),
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
            meta: t('analytics.summaryDetailSource.inboundOutbound', counts),
            badge: t('analytics.summaryDetailSource.refsCount', { count: counts.inbound + counts.outbound }),
            isThemeDocument: themeDocumentIdSet.has(documentId),
          }
        })
        .filter((item): item is SummaryDetailItem => item !== null)
        .sort(compareReferenceItemsByParticipation),
    },
    ranking: {
      key: 'ranking',
      title: t('analytics.summaryCards.coreDocs'),
      description: t('analytics.summaryDetailSource.mostReferencedDocsSentence'),
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
      title: t('analytics.summaryCards.trendWatch'),
      description: t('analytics.summaryDetailSource.activityChangesBetweenWindows'),
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
      title: t('analytics.summaryCards.topicClusters'),
      description: t('analytics.summaryDetailSource.docsGroupedIntoClusters'),
      kind: 'list',
      items: params.report.communities.flatMap(community => {
        const hasRecognizedThemeDocument = community.documentIds.some(documentId => themeDocumentIdSet.has(documentId))
        return community.documentIds.map((documentId) => ({
          documentId,
          title: documentMap.get(documentId)?.title ?? documentId,
          meta: t('analytics.summaryDetailSource.clusterTagsAndSize', {
            tags: community.topTags.join(' / ') || t('analytics.summaryDetailSource.none'),
            size: community.size,
          }),
          badge: community.missingTopicPage && !hasRecognizedThemeDocument ? t('analytics.summaryDetailSource.missingTopicPage') : undefined,
          isThemeDocument: themeDocumentIdSet.has(documentId),
        }))
      }),
    },
    orphans: {
      key: 'orphans',
      title: t('analytics.summaryCards.orphanDocs'),
      description: t('analytics.summaryDetailSource.docsWithNoValidLinksSentence'),
      kind: 'list',
      items: params.report.orphans.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: t('analytics.summaryDetailSource.updatedCreated', {
          updated: formatCompactDate(item.updatedAt),
          created: formatCompactDate(item.createdAt),
        }),
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'repair-orphan'),
      })),
    },
    dormant: {
      key: 'dormant',
      title: t('analytics.summaryCards.dormantDocs'),
      description: t('analytics.summaryDetailSource.dormantDescription', { days: params.dormantDays }),
      kind: 'list',
      items: params.report.dormantDocuments.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: t('analytics.summaryDetailSource.inactiveDaysLastLinked', {
          days: item.inactivityDays,
          date: formatCompactDate(item.lastConnectedAt || item.updatedAt),
        }),
        badge: item.hasSparseEvidence ? t('analytics.summaryDetailSource.historicalLinks', { count: item.historicalReferenceCount }) : undefined,
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'archive-dormant'),
      })),
    },
    bridges: {
      key: 'bridges',
      title: t('analytics.summaryCards.bridgeDocs'),
      description: t('analytics.summaryDetailSource.bridgeDescription'),
      kind: 'list',
      items: params.report.bridgeDocuments.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: t('analytics.summaryDetailSource.degree', { value: item.degree }),
        isThemeDocument: themeDocumentIdSet.has(item.documentId),
        suggestions: resolveSuggestions(suggestionMap, item.documentId, 'maintain-bridge'),
      })),
    },
    propagation: {
      key: 'propagation',
      title: t('analytics.summaryCards.propagationNodes'),
      description: t('analytics.summaryDetailSource.propagationDescription'),
      kind: 'propagation',
      items: params.report.propagationNodes.map(item => ({
        documentId: item.documentId,
        title: item.title,
        meta: t('analytics.summaryDetailSource.coversFocusDocsCommunitySpan', {
          focus: item.focusDocumentCount,
          span: item.communitySpan || 1,
        }),
        badge: t('analytics.summaryDetailSource.scorePts', { score: item.score }),
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
    ? t('analytics.summaryDetailSource.bridgeHint')
    : ''
  return {
    label: t('analytics.summaryDetailSource.propagationOptimization'),
    text: t('analytics.summaryDetailSource.propagationOptimizationText', {
      paths: item.pathPairCount,
      focus: item.focusDocumentCount,
      bridgeHint,
    }),
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
    label: t('analytics.summaryDetailSource.cleanEmbeddedAssets'),
    text: t('analytics.summaryDetailSource.cleanEmbeddedAssetsText', {
      assetCount: metric.assetCount,
      assetBytes: formatBytes(metric.assetBytes),
      totalBytes: formatBytes(metric.totalBytes),
    }),
  }
}

function buildReadMeta(item: ReturnType<typeof collectReadMatches>[number]): string {
  const parts: string[] = []

  if (item.matchedTags.length) {
    parts.push(t('analytics.summaryDetailSource.tagsPrefix', { value: item.matchedTags.join(' / ') }))
  }
  if (item.matchedPrefixes.length) {
    parts.push(t('analytics.summaryDetailSource.prefixesPrefix', { value: item.matchedPrefixes.join(' / ') }))
  }
  if (item.matchedSuffixes.length) {
    parts.push(t('analytics.summaryDetailSource.suffixesPrefix', { value: item.matchedSuffixes.join(' / ') }))
  }
  if (item.matchedPaths.length) {
    parts.push(t('analytics.summaryDetailSource.pathsPrefix', { value: item.matchedPaths.join(' / ') }))
  }

  return parts.join(' · ')
}

function buildReadBadge(item: ReturnType<typeof collectReadMatches>[number]): string | undefined {
  const badges: string[] = []

  if (item.matchedTags.length) {
    badges.push(t('analytics.summaryDetailSource.tagMatch'))
  }
  if (item.matchedPrefixes.length || item.matchedSuffixes.length) {
    badges.push(t('analytics.summaryDetailSource.titleMatch'))
  }
  if (item.matchedPaths.length) {
    badges.push(t('analytics.summaryDetailSource.pathMatch'))
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
