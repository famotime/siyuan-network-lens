import type { ReferenceGraphReport, TrendReport } from './analysis'
import {
  type LargeDocumentCardMode,
  type LargeDocumentSummary,
} from './large-documents'
import type { ReadCardMode } from './read-status'
import type { SummaryCardItem } from './summary-detail-types'
import { t } from '@/i18n/ui'

export function buildSummaryCards(params: {
  report: ReferenceGraphReport
  dormantDays: number
  documentCount?: number
  readDocumentCount?: number
  aiInboxCount?: number
  readCardMode?: ReadCardMode
  trends?: TrendReport | null
  largeDocumentSummary?: LargeDocumentSummary
  largeDocumentCardMode?: LargeDocumentCardMode
}): SummaryCardItem[] {
  const trendCount = params.trends
    ? params.trends.risingDocuments.length + params.trends.fallingDocuments.length
    : 0
  const readCardMode = params.readCardMode ?? 'unread'
  const largeDocumentCardMode = params.largeDocumentCardMode ?? 'words'
  const largeDocumentSummary = params.largeDocumentSummary ?? {
    wordDocumentCount: 0,
    storageDocumentCount: 0,
  }
  const readDocumentCount = params.readDocumentCount ?? 0
  const unreadDocumentCount = Math.max((params.documentCount ?? params.report.summary.totalDocuments) - readDocumentCount, 0)

  return [
    {
      key: 'documents',
      label: t('analytics.summaryCards.docSample'),
      value: (params.documentCount ?? params.report.summary.totalDocuments).toString(),
      hint: t('analytics.summaryCards.docsMatchedByCurrentFilters'),
    },
    {
      key: 'read',
      label: readCardMode === 'read' ? t('analytics.summaryCards.readDocs') : t('analytics.summaryCards.unreadDocs'),
      value: (readCardMode === 'read' ? readDocumentCount : unreadDocumentCount).toString(),
      hint: readCardMode === 'read'
        ? t('analytics.summaryCards.docsMatchedByReadRules')
        : t('analytics.summaryCards.docsNotMatchedByReadRules'),
    },
    {
      key: 'todaySuggestions',
      label: t('analytics.summaryCards.todaySuggestions'),
      value: (params.aiInboxCount ?? 0).toString(),
      hint: t('analytics.summaryCards.aiRankedSuggestionsForToday'),
    },
    {
      key: 'largeDocuments',
      label: largeDocumentCardMode === 'storage' ? t('analytics.summaryCards.largeDocsAssets') : t('analytics.summaryCards.largeDocsText'),
      value: (largeDocumentCardMode === 'storage'
        ? largeDocumentSummary.storageDocumentCount
        : largeDocumentSummary.wordDocumentCount).toString(),
      hint: largeDocumentCardMode === 'storage'
        ? t('analytics.summaryCards.docsLargerThan3Mb')
        : t('analytics.summaryCards.docsLargerThan10000Words'),
    },
    {
      key: 'references',
      label: t('analytics.summaryCards.activeLinks'),
      value: params.report.summary.totalReferences.toString(),
      hint: t('analytics.summaryCards.docLevelReferencesInCurrentWindow'),
    },
    {
      key: 'ranking',
      label: t('analytics.summaryCards.coreDocs'),
      value: params.report.ranking.length.toString(),
      hint: t('analytics.summaryCards.mostReferencedDocsInCurrentWindow'),
    },
    {
      key: 'trends',
      label: t('analytics.summaryCards.trendWatch'),
      value: trendCount.toString(),
      hint: t('analytics.summaryCards.docsWithActivityChanges'),
    },
    {
      key: 'communities',
      label: t('analytics.summaryCards.topicClusters'),
      value: params.report.summary.communityCount.toString(),
      hint: t('analytics.summaryCards.topicClustersSplitByBridgeNodes'),
    },
    {
      key: 'orphans',
      label: t('analytics.summaryCards.orphanDocs'),
      value: params.report.summary.orphanCount.toString(),
      hint: t('analytics.summaryCards.noValidDocLevelLinksInCurrentWindow'),
    },
    {
      key: 'dormant',
      label: t('analytics.summaryCards.dormantDocs'),
      value: params.report.summary.dormantCount.toString(),
      hint: t('analytics.summaryCards.noValidLinksForMoreThanDays', { days: params.dormantDays }),
    },
    {
      key: 'bridges',
      label: t('analytics.summaryCards.bridgeDocs'),
      value: params.report.bridgeDocuments.length.toString(),
      hint: t('analytics.summaryCards.docsWhoseRemovalWeakensConnectivity'),
    },
    {
      key: 'propagation',
      label: t('analytics.summaryCards.propagationNodes'),
      value: params.report.summary.propagationCount.toString(),
      hint: t('analytics.summaryCards.highImpactRelayNodes'),
    },
  ]
}
