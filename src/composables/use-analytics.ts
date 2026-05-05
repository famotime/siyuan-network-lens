import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  analyzeReferenceGraph,
  analyzeTrends,
  findReferencePath,
  filterDocumentsByTimeRange,
  type AnalyticsFilters,
  type DocumentRecord,
  type OrphanSort,
  type TimeRange,
} from '@/analytics/analysis'
import { createActiveDocumentSync } from '@/analytics/active-document'
import {
  buildLargeDocumentSummary,
  loadLargeDocumentMetrics,
  type LargeDocumentCardMode,
  type LargeDocumentMetric,
} from '@/analytics/large-documents'
import { buildPanelCounts } from '@/analytics/panel-counts'
import { collectReadMatches, type ReadCardMode } from '@/analytics/read-status'
import {
  DEFAULT_SUMMARY_CARD_ORDER,
  isSameSummaryCardOrder,
  moveSummaryCardOrder,
  normalizeSummaryCardOrder,
  sortSummaryCards,
} from '@/analytics/summary-card-order'
import { buildSummaryCards, buildSummaryDetailSections, type SummaryCardItem, type SummaryCardKey } from '@/analytics/summary-details'
import { buildThemeOptions, collectThemeDocuments } from '@/analytics/theme-documents'
import { buildTimeRangeOptions } from '@/analytics/time-range'
import { buildPanelCollapseState, togglePanelCollapse, type PanelCollapseState } from '@/analytics/panel-collapse'
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from '@/analytics/siyuan-data'
import {
  buildLinkAssociationMap,
  buildOrphanDetailItems,
  buildOrphanThemeSuggestionMap,
  buildPathOptions,
  buildTagOptions,
  countSelectedSummaryItems,
  type PathScope,
} from './use-analytics-derived'
import {
  createAiSuggestionActions,
  createLinkAssociationInteractions,
  createThemeSuggestionController,
} from './use-analytics-interactions'
import { createAnalyticsAiController } from './use-analytics-ai'
import {
  buildWikiPreviewSummary,
  buildWikiScopeDescriptionLines,
  buildWikiSourceProfileMap,
  resolveAffectedSectionHeadings,
  resolveExistingWikiPage,
  resolveWikiScopeDocuments,
  type WikiPreviewRequest,
  type WikiPreviewState,
  type WikiPreviewThemePageItem,
} from './use-analytics-wiki'
import { createAiInboxService, isAiConfigComplete, type AiInboxResult, type AiInboxService } from '@/analytics/ai-inbox'
import { ensureDocumentIndex } from '@/analytics/ai-document-summary'
import {
  createAiDocumentIndexStoreFromPlugin,
  type AiDocumentIndexStore,
  type DocumentIndexProfile,
} from '@/analytics/ai-index-store'
import {
  createAiLinkRepairStoreFromPlugin,
  type AiLinkRepairStore,
} from '@/analytics/ai-link-repair-store'
import { createAiWikiService, type AiWikiService } from '@/analytics/wiki-ai'
import {
  createAiLinkSuggestionService,
  isAiLinkSuggestionConfigComplete,
  type AiLinkSuggestionService,
  type OrphanAiSuggestionState,
} from '@/analytics/ai-link-suggestions'
import { buildThemeWikiPageTitle } from '@/analytics/wiki-page-model'
import type { WikiThemeBundle } from '@/analytics/wiki-generation'
import { renderThemeWikiDraft } from '@/analytics/wiki-renderer'
import { buildWikiPreview } from '@/analytics/wiki-diff'
import { applyWikiDocuments, buildSiblingDocumentPath } from '@/analytics/wiki-documents'
import {
  buildWikiPageStorageKey,
  createAiWikiStoreFromPlugin,
  type AiWikiStore,
} from '@/analytics/wiki-store'
import {
  createTodaySuggestionHistoryStoreFromPlugin,
  type TodaySuggestionHistoryEntry,
  type TodaySuggestionHistoryStore,
} from '@/analytics/today-suggestion-history-store'
import { normalizeTags, parseSiyuanTimestamp, resolveDocumentTitle } from '@/analytics/document-utils'
import { resolveUiLanguageTag, t } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'
import { createPluginLogger } from '@/utils/plugin-logger'

export type { PathScope } from './use-analytics-derived'
export type { WikiPreviewRequest, WikiPreviewState, WikiPreviewThemePageItem } from './use-analytics-wiki'

const panelKeys = [
  'summary-detail',
] as const

type PanelKey = typeof panelKeys[number]

type EventBusLike = {
  on: (type: string, listener: (event: any) => void) => void
  off: (type: string, listener: (event: any) => void) => void
}

type PluginLike = {
  eventBus: EventBusLike
  app: any
  loadData?: (storageName: string) => Promise<any>
  saveData?: (storageName: string, value: any) => Promise<void> | void
}

type OpenTabFn = (params: { app: any, doc: { id: string, zoomIn?: boolean } }) => void
type ShowMessageFn = (text: string, timeout?: number, type?: 'info' | 'error') => void
type BlockWriteFn = (dataType: 'markdown' | 'dom', data: string, parentID: string) => Promise<any>
type BlockDeleteFn = (id: string) => Promise<any>
type BlockUpdateFn = (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
type CreateDocWithMdFn = (notebook: string, path: string, markdown: string) => Promise<string>
type GetIDsByHPathFn = (notebook: string, path: string) => Promise<string[]>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string }>>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>
type GetBlockAttrsFn = (id: string) => Promise<{ [key: string]: string }>
type SetBlockAttrsFn = (id: string, attrs: { [key: string]: string }) => Promise<any>
type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type UseAnalyticsParams = {
  plugin: PluginLike
  config: PluginConfig
  loadSnapshot?: () => Promise<AnalyticsSnapshot>
  loadLargeDocumentMetrics?: (documents: DocumentRecord[]) => Promise<Map<string, LargeDocumentMetric>>
  nowProvider?: () => Date
  createActiveDocumentSync?: typeof createActiveDocumentSync
  showMessage: ShowMessageFn
  openTab: OpenTabFn
  appendBlock: BlockWriteFn
  prependBlock: BlockWriteFn
  deleteBlock: BlockDeleteFn
  updateBlock: BlockUpdateFn
  createDocWithMd?: CreateDocWithMdFn
  getIDsByHPath?: GetIDsByHPathFn
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
  getBlockAttrs?: GetBlockAttrsFn
  setBlockAttrs?: SetBlockAttrsFn
  forwardProxy?: ForwardProxyFn
  createAiInboxService?: (deps: {
    forwardProxy: ForwardProxyFn
    logger?: Pick<Console, 'info' | 'warn' | 'error'>
  }) => AiInboxService
  createAiWikiService?: (deps: { forwardProxy: ForwardProxyFn }) => AiWikiService
  createAiLinkSuggestionService?: (deps: { forwardProxy: ForwardProxyFn }) => AiLinkSuggestionService
  aiIndexStore?: AiDocumentIndexStore | null
  aiWikiStore?: AiWikiStore | null
  todaySuggestionHistoryStore?: TodaySuggestionHistoryStore | null
}

type AppliedAnalysisConfig = {
  themeNotebookId: string
  themeDocumentPath: string
  themeNamePrefix: string
  themeNameSuffix: string
  excludedPaths: string
  excludedNamePrefixes: string
  excludedNameSuffixes: string
  readTagNames: string[]
  readTitlePrefixes: string
  readTitleSuffixes: string
  readPaths: string
  wikiPageSuffix: string
}

export function useAnalyticsState(params: UseAnalyticsParams) {
  const loadSnapshot = params.loadSnapshot ?? loadAnalyticsSnapshot
  const loadLargeDocumentMetricsFn = params.loadLargeDocumentMetrics ?? (documents => loadLargeDocumentMetrics({ documents }))
  const nowProvider = params.nowProvider ?? (() => new Date())
  const syncActiveDocument = params.createActiveDocumentSync ?? createActiveDocumentSync
  const notify = params.showMessage
  const openTab = params.openTab
  const appendBlock = params.appendBlock
  const prependBlock = params.prependBlock
  const deleteBlock = params.deleteBlock
  const updateBlock = params.updateBlock
  const createDocWithMd = params.createDocWithMd
  const getIDsByHPath = params.getIDsByHPath
  const getChildBlocks = params.getChildBlocks
  const getBlockKramdown = params.getBlockKramdown
  const getBlockAttrs = params.getBlockAttrs
  const setBlockAttrs = params.setBlockAttrs
  const pluginLogger = createPluginLogger(() => params.config.enableConsoleLogging === true)
  const aiInboxService = params.forwardProxy
    ? (params.createAiInboxService?.({
        forwardProxy: params.forwardProxy,
        logger: pluginLogger,
      }) ?? createAiInboxService({
        forwardProxy: params.forwardProxy,
        logger: pluginLogger,
      }))
    : null
  const aiWikiService = params.forwardProxy
    ? (params.createAiWikiService?.({ forwardProxy: params.forwardProxy }) ?? createAiWikiService({ forwardProxy: params.forwardProxy }))
    : null
  const aiLinkSuggestionService = params.forwardProxy
    ? (params.createAiLinkSuggestionService?.({ forwardProxy: params.forwardProxy }) ?? createAiLinkSuggestionService({ forwardProxy: params.forwardProxy }))
    : null
  const aiIndexStore = params.aiIndexStore ?? createAiDocumentIndexStoreFromPlugin(params.plugin)
  const aiLinkRepairStore: AiLinkRepairStore | null = createAiLinkRepairStoreFromPlugin(params.plugin)
  const aiWikiStore = params.aiWikiStore ?? createAiWikiStoreFromPlugin(params.plugin)
  const todaySuggestionHistoryStore = params.todaySuggestionHistoryStore ?? createTodaySuggestionHistoryStoreFromPlugin(params.plugin)

  const loading = ref(false)
  const errorMessage = ref('')
  const snapshot = ref<AnalyticsSnapshot | null>(null)
  const timeRange = ref<TimeRange>('7d')
  const selectedNotebook = ref('')
  const selectedTags = ref<string[]>([])
  const selectedThemes = ref<string[]>([])
  const keyword = ref('')
  const orphanSort = ref<OrphanSort>('updated-desc')
  const dormantDays = ref(30)
  const analysisNow = ref(nowProvider())
  const fromDocumentId = ref('')
  const toDocumentId = ref('')
  const selectedEvidenceDocument = ref('')
  const activeDocumentId = ref('')
  const selectedCommunityId = ref('')
  const pathScope = ref<PathScope>('focused')
  const maxPathDepth = ref(6)
  const selectedSummaryCardKey = ref<SummaryCardKey>('documents')
  const readCardMode = ref<ReadCardMode>('unread')
  const largeDocumentCardMode = ref<LargeDocumentCardMode>('words')
  const summaryCardOrder = ref<SummaryCardKey[]>(normalizeSummaryCardOrder(params.config.summaryCardOrder))
  const panelCollapseState = ref<PanelCollapseState<PanelKey>>(buildPanelCollapseState(panelKeys))
  const largeDocumentMetrics = ref<Map<string, LargeDocumentMetric>>(new Map())
  const aiInboxLoading = ref(false)
  const aiConnectionTesting = ref(false)
  const aiInboxError = ref('')
  const aiConnectionMessage = ref('')
  const aiInboxResult = ref<AiInboxResult | null>(null)
  const aiInboxHistory = ref<TodaySuggestionHistoryEntry[]>([])
  const selectedAiInboxHistoryId = ref('')
  const orphanAiSuggestionStates = ref<Map<string, OrphanAiSuggestionState>>(new Map())
  const wikiPreviewLoading = ref(false)
  const wikiApplyLoading = ref(false)
  const wikiError = ref('')
  const wikiPreview = ref<WikiPreviewState | null>(null)
  const appliedAnalysisConfig = ref(readAppliedAnalysisConfig(params.config))
  const timeRangeOptions = computed(() => buildTimeRangeOptions())
  const appliedConfig = computed(() => buildAppliedAnalysisConfig(params.config, appliedAnalysisConfig.value))
  let disposeActiveDocumentSync: (() => void) | null = null

  const filters = computed<AnalyticsFilters>(() => ({
    notebook: selectedNotebook.value || undefined,
    tags: selectedTags.value.length ? [...selectedTags.value] : undefined,
    themeNames: selectedThemes.value.length ? [...selectedThemes.value] : undefined,
    keyword: keyword.value || undefined,
  }))

  const notebookOptions = computed(() => snapshot.value?.notebooks ?? [])
  const tagOptions = computed(() => buildTagOptions(snapshot.value?.documents ?? []))

  const documentMap = computed(() => {
    return new Map((snapshot.value?.documents ?? []).map(document => [document.id, document]))
  })
  const themeDocuments = computed(() => collectThemeDocuments({
    documents: snapshot.value?.documents ?? [],
    config: appliedConfig.value,
    notebooks: snapshot.value?.notebooks,
  }))
  const themeDocumentIds = computed(() => new Set(themeDocuments.value.map(document => document.documentId)))
  const themeOptions = computed(() => buildThemeOptions(themeDocuments.value))

  const themeSuggestionController = createThemeSuggestionController({
    getThemeDocuments: () => themeDocuments.value,
    notify,
    deleteBlock,
    updateBlock,
    getChildBlocks,
    getBlockKramdown,
    prependBlock,
  })
  const aiSuggestionActions = createAiSuggestionActions({
    notify,
    deleteBlock,
    updateBlock,
    getChildBlocks,
    getBlockKramdown,
    prependBlock,
    getBlockAttrs,
    setBlockAttrs,
    getDocumentById: documentId => documentMap.value.get(documentId),
    onDocumentTagsChanged: (documentId, tags) => {
      if (!snapshot.value) {
        return
      }

      snapshot.value = {
        ...snapshot.value,
        documents: snapshot.value.documents.map(document => document.id === documentId
          ? { ...document, tags: normalizeTags(tags) }
          : document),
      }
    },
    invalidateAiSuggestionCache: async (documentId) => {
      await aiLinkRepairStore?.invalidateSuggestionCache(documentId)
    },
  })

  const filteredDocuments = computed(() => {
    if (!snapshot.value) {
      return []
    }
    return filterDocumentsByTimeRange({
      documents: snapshot.value.documents,
      references: snapshot.value.references,
      now: analysisNow.value,
      timeRange: timeRange.value,
      filters: filters.value,
      wikiPageSuffix: appliedConfig.value.wikiPageSuffix,
      excludedPaths: appliedAnalysisConfig.value.excludedPaths,
      excludedNamePrefixes: appliedAnalysisConfig.value.excludedNamePrefixes,
      excludedNameSuffixes: appliedAnalysisConfig.value.excludedNameSuffixes,
      notebooks: snapshot.value.notebooks,
    })
  })
  const associationDocuments = computed(() => {
    if (!snapshot.value) {
      return []
    }
    return filterDocumentsByTimeRange({
      documents: snapshot.value.documents,
      references: snapshot.value.references,
      now: analysisNow.value,
      timeRange: 'all',
      filters: filters.value,
      wikiPageSuffix: appliedConfig.value.wikiPageSuffix,
      excludedPaths: appliedAnalysisConfig.value.excludedPaths,
      excludedNamePrefixes: appliedAnalysisConfig.value.excludedNamePrefixes,
      excludedNameSuffixes: appliedAnalysisConfig.value.excludedNameSuffixes,
      notebooks: snapshot.value.notebooks,
    })
  })

  const sampleDocumentIds = computed(() => new Set(filteredDocuments.value.map(document => document.id)))
  const sampleDocumentMap = computed(() => new Map(filteredDocuments.value.map(document => [document.id, document])))
  const associationDocumentMap = computed(() => new Map(associationDocuments.value.map(document => [document.id, document])))

  const report = computed(() => {
    if (!snapshot.value) {
      return null
    }
    return analyzeReferenceGraph({
      documents: snapshot.value.documents,
      references: snapshot.value.references,
      now: analysisNow.value,
      timeRange: timeRange.value,
      filters: filters.value,
      orphanSort: orphanSort.value,
      dormantDays: dormantDays.value,
      wikiPageSuffix: appliedConfig.value.wikiPageSuffix,
      excludedPaths: appliedAnalysisConfig.value.excludedPaths,
      excludedNamePrefixes: appliedAnalysisConfig.value.excludedNamePrefixes,
      excludedNameSuffixes: appliedAnalysisConfig.value.excludedNameSuffixes,
      notebooks: snapshot.value.notebooks,
    })
  })

  const trendDays = computed(() => {
    if (timeRange.value === 'all') {
      return 30
    }
    return Number.parseInt(timeRange.value, 10)
  })

  const trendLabel = computed(() => t('analytics.controller.trendCompareLastDays', { days: trendDays.value }))

  const trends = computed(() => {
    if (!snapshot.value) {
      return null
    }
    return analyzeTrends({
      documents: snapshot.value.documents,
      references: snapshot.value.references,
      now: analysisNow.value,
      days: trendDays.value,
      timeRange: timeRange.value,
      filters: filters.value,
      wikiPageSuffix: appliedConfig.value.wikiPageSuffix,
      excludedPaths: appliedAnalysisConfig.value.excludedPaths,
      excludedNamePrefixes: appliedAnalysisConfig.value.excludedNamePrefixes,
      excludedNameSuffixes: appliedAnalysisConfig.value.excludedNameSuffixes,
      notebooks: snapshot.value.notebooks,
    })
  })

  const communityTrendMap = computed(() => {
    return new Map((trends.value?.communityTrends ?? []).map(item => [item.communityId, item]))
  })

  const selectedCommunity = computed(() => {
    if (!report.value?.communities.length) {
      return null
    }
    if (!selectedCommunityId.value) {
      return report.value.communities[0]
    }
    return report.value.communities.find(community => community.id === selectedCommunityId.value) ?? report.value.communities[0]
  })

  const selectedCommunityTrend = computed(() => {
    if (!selectedCommunity.value) {
      return null
    }
    return communityTrendMap.value.get(selectedCommunity.value.id) ?? null
  })

  const rawSummaryCards = computed<SummaryCardItem[]>(() => {
    if (!report.value || !trends.value) {
      return []
    }
    const readMatches = collectReadMatches({
      documents: filteredDocuments.value,
      notebooks: snapshot.value?.notebooks,
      config: appliedConfig.value,
    })
    return buildSummaryCards({
      report: report.value,
      dormantDays: dormantDays.value,
      documentCount: filteredDocuments.value.length,
      readDocumentCount: readMatches.length,
      aiInboxCount: aiInboxResult.value?.items.length ?? 0,
      readCardMode: readCardMode.value,
      trends: trends.value,
      largeDocumentSummary: buildLargeDocumentSummary({
        documents: filteredDocuments.value,
        metrics: largeDocumentMetrics.value,
      }),
      largeDocumentCardMode: largeDocumentCardMode.value,
    })
  })
  const summaryCards = computed<SummaryCardItem[]>(() => sortSummaryCards(rawSummaryCards.value, summaryCardOrder.value))
  const aiConfigReady = computed(() => isAiConfigComplete(params.config))
  const aiLinkSuggestionConfigReady = computed(() => isAiLinkSuggestionConfigComplete(params.config))

  const summaryDetailSections = computed(() => {
    if (!snapshot.value || !report.value) {
      return null
    }

    const selectedAiInboxHistory = aiInboxHistory.value.find(item => item.id === selectedAiInboxHistoryId.value) ?? null

    return buildSummaryDetailSections({
      documents: snapshot.value.documents,
      references: snapshot.value.references,
      notebooks: snapshot.value.notebooks,
      report: report.value,
      now: analysisNow.value,
      timeRange: timeRange.value,
      trends: trends.value,
      filters: filters.value,
      themeDocumentIds: themeDocumentIds.value,
      dormantDays: dormantDays.value,
      config: appliedConfig.value,
      readCardMode: readCardMode.value,
      largeDocumentMetrics: largeDocumentMetrics.value,
      largeDocumentCardMode: largeDocumentCardMode.value,
      aiInboxResult: selectedAiInboxHistory?.result ?? aiInboxResult.value,
    })
  })

  const selectedSummaryDetail = computed(() => {
    return summaryDetailSections.value?.[selectedSummaryCardKey.value] ?? null
  })
  const orphanThemeSuggestions = computed(() => buildOrphanThemeSuggestionMap({
    orphans: report.value?.orphans ?? [],
    documentMap: documentMap.value,
    themeDocuments: themeDocuments.value,
  }))
  const orphanDetailItems = computed(() => buildOrphanDetailItems({
    selectedSummaryDetail: selectedSummaryDetail.value,
    orphanThemeSuggestions: orphanThemeSuggestions.value,
  }))

  const selectedSummaryCount = computed(() => countSelectedSummaryItems(selectedSummaryDetail.value))

  const pathOptions = computed(() => buildPathOptions({
    pathScope: pathScope.value,
    filteredDocuments: filteredDocuments.value,
    selectedCommunity: selectedCommunity.value,
    ranking: report.value?.ranking ?? [],
    bridgeDocuments: report.value?.bridgeDocuments ?? [],
    propagationNodes: report.value?.propagationNodes ?? [],
    documentMap: documentMap.value,
    resolveTitle,
  }))

  const pathChain = computed(() => {
    if (!snapshot.value || !fromDocumentId.value || !toDocumentId.value || fromDocumentId.value === toDocumentId.value) {
      return []
    }
    return findReferencePath({
      documents: snapshot.value.documents,
      references: snapshot.value.references,
      fromDocumentId: fromDocumentId.value,
      toDocumentId: toDocumentId.value,
      maxDepth: maxPathDepth.value,
      filters: filters.value,
      now: analysisNow.value,
      timeRange: timeRange.value,
    })
  })

  const linkAssociationsByDocumentId = computed(() => snapshot.value
    ? buildLinkAssociationMap({
        references: snapshot.value.references,
        ranking: report.value?.ranking ?? [],
        sampleDocumentMap: sampleDocumentMap.value,
        associationDocumentMap: associationDocumentMap.value,
        now: analysisNow.value,
        timeRange: timeRange.value,
      })
    : new Map())

  const panelCounts = computed(() => {
    if (!report.value) {
      return {
        ranking: 0,
        communities: 0,
        orphanBridge: 0,
        trends: 0,
        propagation: 0,
      }
    }
    return buildPanelCounts({
      report: report.value,
      trends: trends.value,
      pathChain: pathChain.value,
    })
  })

  const snapshotLabel = computed(() => {
    if (!snapshot.value) {
      return '--'
    }
    const fetchedAt = parseSiyuanTimestamp(snapshot.value.fetchedAt)
    if (fetchedAt == null) {
      return '--'
    }
    return new Intl.DateTimeFormat(resolveUiLanguageTag(), {
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(fetchedAt))
  })

  const aiController = createAnalyticsAiController({
    config: params.config,
    snapshot,
    report,
    trends,
    summaryCards,
    filters,
    timeRange,
    dormantDays,
    themeDocuments,
    tagOptions,
    aiInboxLoading,
    aiConnectionTesting,
    aiInboxError,
    aiConnectionMessage,
    aiInboxResult,
    orphanAiSuggestionStates,
    aiInboxService,
    aiLinkSuggestionService,
    aiLinkRepairStore,
    notify,
  })
  const { generateAiInbox: generateAiInboxInternal, generateOrphanAiSuggestion, testAiConnection } = aiController

  watch(pathOptions, (options) => {
    if (options.length === 0) {
      fromDocumentId.value = ''
      toDocumentId.value = ''
      return
    }
    if (!options.some(option => option.id === fromDocumentId.value)) {
      fromDocumentId.value = options[0]?.id ?? ''
    }
    if (!options.some(option => option.id === toDocumentId.value) || toDocumentId.value === fromDocumentId.value) {
      toDocumentId.value = options.find(option => option.id !== fromDocumentId.value)?.id ?? ''
    }
  }, { immediate: true })

  watch(report, (nextReport) => {
    if (!nextReport) {
      selectedEvidenceDocument.value = ''
      selectedCommunityId.value = ''
      return
    }

    const preferredDocumentId = nextReport.ranking[0]?.documentId
      ?? nextReport.orphans[0]?.documentId
      ?? nextReport.bridgeDocuments[0]?.documentId
      ?? ''

    if (!preferredDocumentId) {
      selectedEvidenceDocument.value = ''
    } else if (!sampleDocumentIds.value.has(selectedEvidenceDocument.value)) {
      selectedEvidenceDocument.value = preferredDocumentId
    }

    if (!nextReport.communities.some(item => item.id === selectedCommunityId.value)) {
      selectedCommunityId.value = nextReport.communities[0]?.id ?? ''
    }
  }, { immediate: true })

  watch(() => params.config.summaryCardOrder, (savedOrder) => {
    if (isSameSummaryCardOrder(savedOrder, summaryCardOrder.value)) {
      return
    }
    summaryCardOrder.value = normalizeSummaryCardOrder(savedOrder)
  }, { immediate: true })

  watch(summaryCards, (cards) => {
    if (cards.length === 0) {
      return
    }
    if (!cards.some(card => card.key === selectedSummaryCardKey.value)) {
      selectedSummaryCardKey.value = cards[0].key
    }
  }, { immediate: true })

  watch(themeOptions, (options) => {
    const allowedThemes = new Set(options.map(option => option.value))
    selectedThemes.value = selectedThemes.value.filter(themeName => allowedThemes.has(themeName))
  }, { immediate: true })

  watch(tagOptions, (options) => {
    const allowedTags = new Set(options)
    selectedTags.value = selectedTags.value.filter(tag => allowedTags.has(tag))
  }, { immediate: true })

  watch([activeDocumentId, sampleDocumentIds], ([documentId, documentIds]) => {
    if (documentId && documentIds.has(documentId)) {
      selectedEvidenceDocument.value = documentId
      return
    }
    if (selectedEvidenceDocument.value && !documentIds.has(selectedEvidenceDocument.value)) {
      selectedEvidenceDocument.value = ''
    }
  })

  watch([report, selectedEvidenceDocument], ([nextReport, documentId]) => {
    if (!nextReport || !documentId) {
      return
    }
    const community = nextReport.communities.find(item => item.documentIds.includes(documentId))
    if (community) {
      selectedCommunityId.value = community.id
    }
  }, { immediate: true })

  watch(pathScope, (scope) => {
    if (scope === 'community' && !selectedCommunity.value) {
      pathScope.value = 'focused'
    }
  })

  const instance = getCurrentInstance()
  if (instance) {
    onMounted(() => {
      disposeActiveDocumentSync = syncActiveDocument({
        eventBus: params.plugin.eventBus,
        onDocumentId: (documentId) => {
          activeDocumentId.value = documentId
        },
      })
      refresh()
    })

    onBeforeUnmount(() => {
      disposeActiveDocumentSync?.()
      disposeActiveDocumentSync = null
    })
  }

  function resetTransientAsyncState() {
    themeSuggestionController.clearPendingThemeSuggestionBlocks()
    aiSuggestionActions.clearPendingAiSuggestionActions()
    aiInboxError.value = ''
    aiConnectionMessage.value = ''
    aiInboxResult.value = null
    orphanAiSuggestionStates.value = new Map()
    wikiError.value = ''
    wikiPreview.value = null
  }

  async function loadTodaySuggestionHistory() {
    if (!todaySuggestionHistoryStore) {
      aiInboxHistory.value = []
      selectedAiInboxHistoryId.value = ''
      return
    }

    const historySnapshot = await todaySuggestionHistoryStore.loadSnapshot()
    aiInboxHistory.value = historySnapshot.entries

    if (!historySnapshot.entries.some(entry => entry.id === selectedAiInboxHistoryId.value)) {
      selectedAiInboxHistoryId.value = ''
    }
  }

  async function refresh() {
    loading.value = true
    errorMessage.value = ''
    analysisNow.value = nowProvider()
    try {
      await loadTodaySuggestionHistory()
      const nextSnapshot = await loadSnapshot()
      const nextLargeDocumentMetrics = nextSnapshot
        ? await loadLargeDocumentMetricsFn(nextSnapshot.documents)
        : new Map()
      const nextAppliedAnalysisConfig = readAppliedAnalysisConfig(params.config)
      snapshot.value = nextSnapshot
      largeDocumentMetrics.value = snapshot.value
        ? nextLargeDocumentMetrics
        : new Map()
      appliedAnalysisConfig.value = nextAppliedAnalysisConfig
      resetTransientAsyncState()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToReadSiYuanData')
      errorMessage.value = message
      notify(message, 5000, 'error')
    } finally {
      loading.value = false
    }
  }

  function selectEvidence(documentId: string) {
    selectedEvidenceDocument.value = documentId
  }

  function selectCommunity(communityId: string) {
    selectedCommunityId.value = communityId
  }

  function selectSummaryCard(cardKey: SummaryCardKey) {
    selectedSummaryCardKey.value = cardKey
  }

  function selectAiInboxHistory(historyId: string) {
    selectedAiInboxHistoryId.value = selectedAiInboxHistoryId.value === historyId ? '' : historyId
  }

  function toggleReadCardMode() {
    readCardMode.value = readCardMode.value === 'read' ? 'unread' : 'read'
  }

  function toggleLargeDocumentCardMode() {
    largeDocumentCardMode.value = largeDocumentCardMode.value === 'storage' ? 'words' : 'storage'
  }

  function persistSummaryCardOrder(nextOrder: SummaryCardKey[]) {
    if (isSameSummaryCardOrder(params.config.summaryCardOrder, nextOrder)) {
      return
    }
    params.config.summaryCardOrder = [...nextOrder]
  }

  function reorderSummaryCard(draggedKey: SummaryCardKey, targetKey: SummaryCardKey) {
    const nextOrder = moveSummaryCardOrder({
      order: summaryCardOrder.value,
      draggedKey,
      targetKey,
    })
    if (isSameSummaryCardOrder(summaryCardOrder.value, nextOrder)) {
      return
    }
    summaryCardOrder.value = nextOrder
    persistSummaryCardOrder(nextOrder)
  }

  function resetSummaryCardOrder() {
    if (isSameSummaryCardOrder(summaryCardOrder.value, DEFAULT_SUMMARY_CARD_ORDER)) {
      return
    }
    const nextOrder = [...DEFAULT_SUMMARY_CARD_ORDER]
    summaryCardOrder.value = nextOrder
    persistSummaryCardOrder(nextOrder)
  }

  function resolveLinkAssociations(documentId: string) {
    return linkAssociationsByDocumentId.value.get(documentId) ?? { outbound: [], inbound: [], childDocuments: [] }
  }

  function togglePanel(key: PanelKey) {
    panelCollapseState.value = togglePanelCollapse(panelCollapseState.value, key)
  }

  function isPanelExpanded(key: PanelKey) {
    return panelCollapseState.value[key] ?? true
  }

  function resolveTitle(documentId: string) {
    return documentMap.value.get(documentId)?.title || documentId
  }

  function resolveNotebookName(notebookId: string) {
    return notebookOptions.value.find(notebook => notebook.id === notebookId)?.name ?? notebookId
  }

  function openDocument(documentId: string) {
    openTab({
      app: params.plugin.app,
      doc: {
        id: documentId,
      },
    })
  }

  function formatTimestamp(timestamp?: string) {
    if (!timestamp || timestamp.length < 8) {
      return t('analytics.controller.unknownTime')
    }
    return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`
  }

  function formatDelta(delta: number) {
    return delta > 0 ? `+${delta}` : delta.toString()
  }

  async function persistAiInboxHistory(result: AiInboxResult) {
    if (!todaySuggestionHistoryStore) {
      return
    }

    const entry: TodaySuggestionHistoryEntry = {
      id: `ai-inbox:${result.generatedAt}`,
      generatedAt: result.generatedAt,
      timeRange: timeRange.value,
      filters: {
        notebook: filters.value.notebook,
        tags: filters.value.tags ? [...filters.value.tags] : undefined,
        themeNames: filters.value.themeNames ? [...filters.value.themeNames] : undefined,
        keyword: filters.value.keyword,
      },
      summaryCount: result.items.length,
      result,
    }

    const historySnapshot = await todaySuggestionHistoryStore.saveEntry(entry)
    aiInboxHistory.value = historySnapshot.entries
    selectedAiInboxHistoryId.value = ''
  }

  async function generateAiInbox() {
    const result = await generateAiInboxInternal()
    if (result) {
      await persistAiInboxHistory(result)
    }
    return result
  }

  async function prepareWikiPreview(request?: WikiPreviewRequest) {
    wikiPreviewLoading.value = true
    wikiError.value = ''

    try {
      if (!params.config.wikiEnabled) {
        throw new Error(t('analytics.controller.enableWikiFirst'))
      }
      if (!params.config.aiEnabled || !aiConfigReady.value) {
        throw new Error(t('analytics.controller.enableSuggestionsAndAi'))
      }
      if (!snapshot.value || !report.value || !trends.value) {
        throw new Error(t('analytics.controller.analysisNotReady'))
      }
      if (!aiWikiService) {
        throw new Error(t('analytics.controller.aiProxyNotInitialized'))
      }
      if (!aiWikiStore) {
        throw new Error(t('analytics.controller.wikiStorageNotInitialized'))
      }
      if (!request?.themeDocumentId) {
        throw new Error(t('analytics.controller.wikiThemeDocumentRequired'))
      }

      const generatedAt = new Date().toISOString()
      const themeDocument = themeDocuments.value.find(document => document.documentId === request.themeDocumentId)
      if (!themeDocument) {
        throw new Error(t('analytics.controller.wikiThemeDocumentNotFound'))
      }

      const scopedDocuments = resolveWikiScopeDocuments({
        sourceDocumentIds: request?.sourceDocumentIds,
        fallbackDocuments: filteredDocuments.value,
        associationDocumentMap: associationDocumentMap.value,
      })
      const sourceDocuments = scopedDocuments.filter(document => document.id !== themeDocument.documentId)
      const scopeDescriptionLines = buildWikiScopeDescriptionLines({
        timeRange: timeRange.value,
        filters: filters.value,
        resolveNotebookName,
        scopeDescriptionLine: request?.scopeDescriptionLine,
      })
      const sourceProfileMap = await buildWikiSourceProfileMap({
        sourceDocuments,
        config: appliedConfig.value,
        aiIndexStore,
        forwardProxy: params.forwardProxy,
        getChildBlocks,
        getBlockKramdown,
        generatedAt,
      })
      const scopedDocumentMap = new Map(scopedDocuments.map(document => [document.id, document]))
      const payload = buildSingleThemeWikiPayload({
        config: appliedConfig.value,
        themeDocument,
        sourceDocuments,
        report: report.value,
        trends: trends.value,
        documentMap: scopedDocumentMap,
        getDocumentProfile: document => sourceProfileMap.get(document.id) ?? null,
      })

      const diagnosis = await aiWikiService.diagnoseThemeTemplate({
        config: appliedConfig.value,
        payload,
      })
      const pagePlan = await aiWikiService.planThemePage({
        config: appliedConfig.value,
        payload,
        diagnosis,
      })
      const sections = await Promise.all(pagePlan.sectionOrder.map(sectionType => aiWikiService.generateThemeSection({
        config: appliedConfig.value,
        payload,
        diagnosis,
        pagePlan,
        sectionType,
      })))
      const sourceDocumentTitleMap = Object.fromEntries(
        payload.sourceDocuments.map(doc => [doc.documentId, doc.title]),
      )
      const draft = renderThemeWikiDraft({
        pageTitle: payload.pageTitle,
        pairedThemeDocumentId: payload.themeDocumentId,
        pairedThemeTitle: payload.themeDocumentTitle,
        generatedAt,
        model: appliedConfig.value.aiModel?.trim() || 'unknown',
        sourceDocumentCount: payload.sourceDocuments.length,
        diagnosis,
        pagePlan,
        sections,
        sourceDocumentTitleMap,
      })
      const pageKey = buildWikiPageStorageKey({
        pageType: 'theme',
        pageTitle: payload.pageTitle,
        themeDocumentId: payload.themeDocumentId,
      })
      const storedRecord = await aiWikiStore.getPageRecord(pageKey)
      const existingPage = await resolveExistingWikiPage({
        notebook: themeDocument.box,
        pageHPath: buildSiblingDocumentPath(themeDocument.hpath, payload.pageTitle, appliedConfig.value.wikiContainerName),
        storedRecord,
        getIDsByHPath,
        getBlockKramdown,
      })
      const preview = buildWikiPreview({
        pageType: 'theme',
        pageTitle: payload.pageTitle,
        sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
        generatedAt,
        nextDraft: draft,
        existingPage: existingPage?.managedMarkdown
          ? {
              managedMarkdown: existingPage.managedMarkdown,
            }
          : undefined,
        storedRecord: storedRecord ?? undefined,
      })

      const nextRecord: WikiPageSnapshotRecord = {
        pageType: 'theme',
        pageTitle: payload.pageTitle,
        pageId: existingPage?.pageId ?? storedRecord?.pageId,
        themeDocumentId: payload.themeDocumentId,
        themeDocumentTitle: payload.themeDocumentTitle,
        sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
        pageFingerprint: preview.pageFingerprint,
        managedFingerprint: preview.managedFingerprint,
        lastGeneratedAt: generatedAt,
        lastPreview: {
          generatedAt,
          status: preview.status,
          sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
          pageFingerprint: preview.pageFingerprint,
          managedFingerprint: preview.managedFingerprint,
        },
        lastApply: storedRecord?.lastApply,
      }
      await aiWikiStore.savePageRecord(nextRecord)

      const themePage: WikiPreviewThemePageItem = {
        pageTitle: payload.pageTitle,
        themeName: payload.themeName,
        themeDocumentId: payload.themeDocumentId,
        themeDocumentTitle: payload.themeDocumentTitle,
        themeDocumentBox: themeDocument.box,
        themeDocumentHPath: themeDocument.hpath,
        sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
        preview,
        diagnosis,
        pagePlan,
        draft,
        affectedSectionHeadings: resolveAffectedSectionHeadings({
          preview,
          draft,
          existingManagedMarkdown: existingPage?.managedMarkdown,
        }),
        hasManualNotes: existingPage?.hasManualNotes ?? false,
      }

      wikiPreview.value = {
        generatedAt,
        scope: {
          summary: buildWikiPreviewSummary({
            sourceDocumentCount: sourceDocuments.length,
            draft,
            existingFullMarkdown: existingPage?.fullMarkdown,
          }),
          descriptionLines: scopeDescriptionLines,
        },
        themePages: [themePage],
        unclassifiedDocuments: [],
        excludedWikiDocuments: [],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToGenerateWikiPreview')
      wikiError.value = message
      wikiPreview.value = null
      notify(message, 5000, 'error')
    } finally {
      wikiPreviewLoading.value = false
    }
  }

  async function applyWikiChanges(overwriteConflicts = false) {
    wikiApplyLoading.value = true
    wikiError.value = ''

    try {
      if (!wikiPreview.value) {
        throw new Error(t('analytics.controller.noWikiPreviewAvailable'))
      }
      if (!aiWikiStore) {
        throw new Error(t('analytics.controller.wikiStorageNotInitialized'))
      }
      if (!createDocWithMd || !getIDsByHPath || !getBlockAttrs || !setBlockAttrs) {
        throw new Error(t('analytics.controller.wikiWriteCapabilityNotInitialized'))
      }

      const result = await applyWikiDocuments({
        config: {
          themeNotebookId: appliedConfig.value.themeNotebookId,
          themeDocumentPath: appliedConfig.value.themeDocumentPath,
          wikiIndexTitle: appliedConfig.value.wikiIndexTitle ?? 'LLM-Wiki-Index',
          wikiLogTitle: appliedConfig.value.wikiLogTitle ?? 'LLM-Wiki-Maintenance-Log',
          wikiPageSuffix: appliedConfig.value.wikiPageSuffix ?? '-llm-wiki',
          wikiContainerName: appliedConfig.value.wikiContainerName ?? 'LLM Wiki',
        },
        notebooks: snapshot.value?.notebooks,
        generatedAt: new Date().toISOString(),
        scopeSummary: {
          sourceDocumentCount: wikiPreview.value.scope.summary.sourceDocumentCount,
          themeGroupCount: 1,
          unclassifiedDocumentCount: 0,
          excludedWikiDocumentCount: 0,
        },
        scopeDescriptionLines: wikiPreview.value.scope.descriptionLines,
        themePages: wikiPreview.value.themePages.map(page => ({
          pageTitle: page.pageTitle,
          themeName: page.themeName,
          themeDocumentId: page.themeDocumentId,
          themeDocumentTitle: page.themeDocumentTitle,
          themeDocumentBox: page.themeDocumentBox,
          themeDocumentHPath: page.themeDocumentHPath,
          sourceDocumentIds: page.sourceDocumentIds,
          preview: page.preview,
          draft: page.draft,
        })),
        unclassifiedDocuments: wikiPreview.value.unclassifiedDocuments,
        overwriteConflicts,
        store: aiWikiStore,
        api: {
          createDocWithMd,
          getIDsByHPath,
          prependBlock,
          appendBlock,
          updateBlock,
          deleteBlock,
          getChildBlocks,
          getBlockKramdown,
          getBlockAttrs,
          setBlockAttrs,
        },
      })

      wikiPreview.value = {
        ...wikiPreview.value,
        applyResult: result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToWriteWiki')
      wikiError.value = message
      notify(message, 5000, 'error')
    } finally {
      wikiApplyLoading.value = false
    }
  }

  function openWikiDocument(documentId: string) {
    openDocument(documentId)
  }

  async function generateDocIndex(documentId: string): Promise<boolean> {
    const document = documentMap.value.get(documentId)
    if (!document) {
      notify(t('analytics.controller.documentNotFound'), 3000, 'error')
      return false
    }

    if (!aiIndexStore || !params.forwardProxy) {
      notify(t('analytics.docSummary.aiRequired'), 3000, 'error')
      return false
    }

    try {
      const result = await ensureDocumentIndex({
        config: appliedConfig.value,
        sourceDocument: document,
        indexStore: aiIndexStore,
        forwardProxy: params.forwardProxy,
        getChildBlocks,
        getBlockKramdown,
        force: true,
      })
      notify(t('analytics.controller.docIndexGenerated'), 2000)
      return !result.fromCache
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.docIndexGenerateFailed')
      notify(message, 3000, 'error')
      return false
    }
  }

  async function hasDocIndex(documentId: string): Promise<boolean> {
    if (!aiIndexStore) {
      return false
    }
    const profile = await aiIndexStore.getDocumentProfile(documentId)
    return profile !== null && Boolean(profile.positioning)
  }

  async function getDocIndexProfile(documentId: string): Promise<DocumentIndexProfile | null> {
    if (!aiIndexStore) {
      return null
    }
    return aiIndexStore.getDocumentProfile(documentId)
  }

  async function openDocIndex(documentId: string): Promise<void> {
    const profile = await getDocIndexProfile(documentId)
    if (!profile) {
      notify(t('analytics.controller.docIndexNotFound'), 3000, 'error')
      return
    }

    const firstNotebook = notebookOptions.value[0]
    if (!firstNotebook || !createDocWithMd) {
      notify(t('analytics.controller.docIndexCreateFailed'), 3000, 'error')
      return
    }

    const documentTitle = profile.title || documentId
    const title = `📑 ${t('summaryDetail.documentIndex.viewTitle', { title: documentTitle })}`
    const safeName = title.replace(/[/:*?"<>|\\]/g, '_')
    const docPath = `/索引/${safeName}`
    const tags = parseStringArray(profile.tagsJson)
    const keywords = parseStringArray(profile.keywordsJson)
    const propositions = parseObjectArray<{ text: string, sourceBlockIds: string[] }>(profile.propositionsJson)
    const primaryBlocks = parseObjectArray<{ blockId: string, text: string }>(profile.primarySourceBlocksJson)
    const secondaryBlocks = parseObjectArray<{ blockId: string, text: string }>(profile.secondarySourceBlocksJson)

    const blockIndexMap = new Map<string, string>()
    const allBlocks = [...primaryBlocks, ...secondaryBlocks]
    allBlocks.forEach((block, i) => {
      blockIndexMap.set(block.blockId, String(i + 1))
    })

    function formatBlockRef(blockId: string): string {
      const index = blockIndexMap.get(blockId) || blockId
      return `^((${blockId} "${index}"))^`
    }

    const lines: string[] = []
    lines.push(`> ⚠️ ${t('summaryDetail.documentIndex.viewWarning')}`)
    lines.push('')

    lines.push(`## ${t('summaryDetail.documentIndex.viewPositioning')}`)
    lines.push('')
    lines.push(profile.positioning || '-')
    lines.push('')

    if (propositions.length) {
      lines.push(`## ${t('summaryDetail.documentIndex.viewPropositions')}`)
      lines.push('')
      for (const prop of propositions) {
        const refSuffix = prop.sourceBlockIds.length
          ? ' ' + prop.sourceBlockIds.map(id => formatBlockRef(id)).join(' ')
          : ''
        lines.push(`- ${prop.text}${refSuffix}`)
      }
      lines.push('')
    }

    if (tags.length) {
      lines.push('## Tags')
      lines.push('')
      lines.push(tags.map(tag => `\`${tag}\``).join(' '))
      lines.push('')
    }

    if (keywords.length) {
      lines.push(`## ${t('summaryDetail.documentIndex.viewKeywords')}`)
      lines.push('')
      lines.push(keywords.map(kw => `\`${kw}\``).join(' '))
      lines.push('')
    }

    if (primaryBlocks.length) {
      lines.push(`## ${t('summaryDetail.documentIndex.viewPrimarySourceBlocks')}`)
      lines.push('')
      for (const block of primaryBlocks) {
        lines.push(`> ${block.text}`)
        lines.push(`> ${formatBlockRef(block.blockId)}`)
        lines.push('')
      }
    }

    if (secondaryBlocks.length) {
      lines.push(`## ${t('summaryDetail.documentIndex.viewSecondarySourceBlocks')}`)
      lines.push('')
      for (const block of secondaryBlocks) {
        lines.push(`> ${block.text}`)
        lines.push(`> ${formatBlockRef(block.blockId)}`)
        lines.push('')
      }
    }

    lines.push('')

    if (profile.generatedAt) {
      lines.push('---')
      lines.push('')
      lines.push(`*${t('summaryDetail.documentIndex.viewUpdatedAt')}: ${profile.generatedAt}*`)
    }

    const markdown = lines.join('\n')

    try {
      const newDocId = await createDocWithMd(firstNotebook.id, docPath, markdown)
      openDocument(newDocId)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.docIndexCreateFailed')
      notify(message, 3000, 'error')
    }
  }

  async function batchGenerateDocIndex(documentIds: string[], onProgress?: (done: number, total: number) => void): Promise<{ success: number, failed: number }> {
    let success = 0
    let failed = 0
    for (let i = 0; i < documentIds.length; i++) {
      try {
        const result = await generateDocIndex(documentIds[i])
        if (result) {
          success++
        } else {
          failed++
        }
      } catch {
        failed++
      }
      onProgress?.(i + 1, documentIds.length)
    }
    return { success, failed }
  }

  async function batchDeleteDocIndex(documentIds: string[]): Promise<number> {
    if (!aiIndexStore) {
      return 0
    }
    await aiIndexStore.deleteDocumentIndex(documentIds)
    return documentIds.length
  }

  function parseStringArray(value: string): string[] {
    if (!value) {
      return []
    }
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : []
    } catch {
      return []
    }
  }

  function parseObjectArray<T>(value: string): T[] {
    if (!value) {
      return []
    }
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const linkInteractions = createLinkAssociationInteractions({
    resolveTitle,
    appendBlock,
    prependBlock,
    notify,
    refresh,
    onSelectEvidence: selectEvidence,
  })

  const selectedTag = computed({
    get: () => selectedTags.value[0] ?? '',
    set: (value: string) => {
      selectedTags.value = value ? [value] : []
    },
  })

  return {
    loading,
    errorMessage,
    snapshot,
    timeRange,
    timeRangeOptions,
    selectedNotebook,
    selectedTags,
    selectedTag,
    selectedThemes,
    themeOptions,
    keyword,
    orphanSort,
    dormantDays,
    analysisNow,
    fromDocumentId,
    toDocumentId,
    selectedEvidenceDocument,
    activeDocumentId,
    selectedCommunityId,
    pathScope,
    maxPathDepth,
    selectedSummaryCardKey,
    readCardMode,
    largeDocumentCardMode,
    panelCollapseState,
    aiConfigReady,
    aiLinkSuggestionConfigReady,
    aiInboxLoading,
    aiConnectionTesting,
    aiInboxError,
    aiConnectionMessage,
    aiInboxResult,
    aiInboxHistory,
    selectedAiInboxHistoryId,
    orphanAiSuggestionStates,
    wikiPreviewLoading,
    wikiApplyLoading,
    wikiError,
    wikiPreview,
    filters,
    notebookOptions,
    tagOptions,
    filteredDocuments,
    sampleDocumentIds,
    sampleDocumentMap,
    themeDocuments,
    themeDocumentIds,
    report,
    trendDays,
    trendLabel,
    trends,
    communityTrendMap,
    selectedCommunity,
    selectedCommunityTrend,
    summaryCards,
    summaryDetailSections,
    selectedSummaryDetail,
    selectedSummaryCount,
    orphanThemeSuggestions,
    orphanDetailItems,
    pathOptions,
    pathChain,
    linkAssociationsByDocumentId,
    panelCounts,
    snapshotLabel,
    refresh,
    selectEvidence,
    selectCommunity,
    selectSummaryCard,
    selectAiInboxHistory,
    toggleReadCardMode,
    toggleLargeDocumentCardMode,
    reorderSummaryCard,
    resetSummaryCardOrder,
    resolveLinkAssociations,
    toggleLinkPanel: linkInteractions.toggleLinkPanel,
    isLinkPanelExpanded: linkInteractions.isLinkPanelExpanded,
    toggleLinkGroup: linkInteractions.toggleLinkGroup,
    isLinkGroupExpanded: linkInteractions.isLinkGroupExpanded,
    isSyncing: linkInteractions.isSyncing,
    syncAssociation: linkInteractions.syncAssociation,
    togglePanel,
    isPanelExpanded,
    resolveTitle,
    resolveNotebookName,
    openDocument,
    openWikiDocument,
    generateDocIndex,
    hasDocIndex,
    openDocIndex,
    batchGenerateDocIndex,
    batchDeleteDocIndex,
    formatTimestamp,
    formatDelta,
    generateAiInbox,
    prepareWikiPreview,
    applyWikiChanges,
    generateOrphanAiSuggestion,
    testAiConnection,
    toggleOrphanThemeSuggestion: themeSuggestionController.toggleOrphanThemeSuggestion,
    isThemeSuggestionActive: themeSuggestionController.isThemeSuggestionActive,
    toggleOrphanAiLinkSuggestion: aiSuggestionActions.toggleOrphanAiLinkSuggestion,
    isAiLinkSuggestionActive: aiSuggestionActions.isAiLinkSuggestionActive,
    toggleOrphanAiTagSuggestion: aiSuggestionActions.toggleOrphanAiTagSuggestion,
    isAiTagSuggestionActive: aiSuggestionActions.isAiTagSuggestionActive,
  }
}

function readAppliedAnalysisConfig(config: PluginConfig): AppliedAnalysisConfig {
  return {
    themeNotebookId: config.themeNotebookId ?? '',
    themeDocumentPath: config.themeDocumentPath ?? '',
    themeNamePrefix: config.themeNamePrefix ?? '',
    themeNameSuffix: config.themeNameSuffix ?? '',
    excludedPaths: config.analysisExcludedPaths ?? '',
    excludedNamePrefixes: config.analysisExcludedNamePrefixes ?? '',
    excludedNameSuffixes: config.analysisExcludedNameSuffixes ?? '',
    readTagNames: Array.isArray(config.readTagNames) ? [...config.readTagNames] : [],
    readTitlePrefixes: config.readTitlePrefixes ?? '',
    readTitleSuffixes: config.readTitleSuffixes ?? '',
    readPaths: config.readPaths ?? '',
    wikiPageSuffix: config.wikiPageSuffix ?? '',
  }
}

function buildAppliedAnalysisConfig(
  config: PluginConfig,
  appliedAnalysisConfig: AppliedAnalysisConfig,
): PluginConfig {
  return {
    ...config,
    themeNotebookId: appliedAnalysisConfig.themeNotebookId,
    themeDocumentPath: appliedAnalysisConfig.themeDocumentPath,
    themeNamePrefix: appliedAnalysisConfig.themeNamePrefix,
    themeNameSuffix: appliedAnalysisConfig.themeNameSuffix,
    analysisExcludedPaths: appliedAnalysisConfig.excludedPaths,
    analysisExcludedNamePrefixes: appliedAnalysisConfig.excludedNamePrefixes,
    analysisExcludedNameSuffixes: appliedAnalysisConfig.excludedNameSuffixes,
    readTagNames: [...appliedAnalysisConfig.readTagNames],
    readTitlePrefixes: appliedAnalysisConfig.readTitlePrefixes,
    readTitleSuffixes: appliedAnalysisConfig.readTitleSuffixes,
    readPaths: appliedAnalysisConfig.readPaths,
    wikiPageSuffix: appliedAnalysisConfig.wikiPageSuffix,
  }
}

function buildSingleThemeWikiPayload(params: {
  config: Pick<PluginConfig, 'wikiPageSuffix'>
  themeDocument: { documentId: string, title: string, themeName: string }
  sourceDocuments: DocumentRecord[]
  report: NonNullable<ReturnType<typeof analyzeReferenceGraph>>
  trends: NonNullable<ReturnType<typeof analyzeTrends>>
  documentMap: ReadonlyMap<string, DocumentRecord>
  getDocumentProfile: (document: DocumentRecord) => DocumentIndexProfile | null
}): WikiThemeBundle {
  const bundleDocuments = params.sourceDocuments.map((document) => {
    const profile = params.getDocumentProfile(document)
    if (!profile) {
      throw new Error(`Missing document index profile for wiki source document: ${document.id}`)
    }

    const parseJsonArray = <T>(value?: string): T[] => {
      if (!value) {
        return []
      }
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }

    return {
      documentId: document.id,
      title: profile.title || document.title || document.hpath || document.path || document.id,
      positioning: profile.positioning || '',
      propositions: parseJsonArray<any>(profile.propositionsJson)
        .filter((item): item is { text: string, sourceBlockIds?: string[] } => Boolean(item) && typeof item.text === 'string')
        .map(item => ({
          text: item.text.trim(),
          sourceBlockIds: Array.isArray(item.sourceBlockIds) ? item.sourceBlockIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : [],
        }))
        .filter(item => item.text.length > 0),
      keywords: parseJsonArray<unknown>(profile.keywordsJson)
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean),
      primarySourceBlocks: parseJsonArray<any>(profile.primarySourceBlocksJson)
        .filter((item): item is { blockId: string, text: string } => Boolean(item) && typeof item.blockId === 'string' && typeof item.text === 'string')
        .map(item => ({ blockId: item.blockId.trim(), text: item.text.trim() }))
        .filter(item => item.blockId.length > 0 && item.text.length > 0),
      secondarySourceBlocks: parseJsonArray<any>(profile.secondarySourceBlocksJson)
        .filter((item): item is { blockId: string, text: string } => Boolean(item) && typeof item.blockId === 'string' && typeof item.text === 'string')
        .map(item => ({ blockId: item.blockId.trim(), text: item.text.trim() }))
        .filter(item => item.blockId.length > 0 && item.text.length > 0),
      sourceUpdatedAt: profile.sourceUpdatedAt,
      generatedAt: profile.generatedAt,
    }
  })

  const sourceDocumentIds = bundleDocuments.map(item => item.documentId)
  const sourceDocumentIdSet = new Set(sourceDocumentIds)
  const relationshipEvidence: string[] = []

  for (const targetDocumentId of sourceDocumentIds) {
    const refs = params.report.evidenceByDocument[targetDocumentId] ?? []
    for (const ref of refs) {
      if (!sourceDocumentIdSet.has(ref.sourceDocumentId)) {
        continue
      }
      const sourceTitle = resolveDocumentTitle(params.documentMap.get(ref.sourceDocumentId) as any)
      const targetTitle = resolveDocumentTitle(params.documentMap.get(targetDocumentId) as any)
      relationshipEvidence.push(`${sourceTitle} -> ${targetTitle}：${ref.content}`)
    }
  }

  return {
    themeName: params.themeDocument.themeName,
    pageTitle: buildThemeWikiPageTitle(params.themeDocument.title, params.config.wikiPageSuffix ?? ''),
    themeDocumentId: params.themeDocument.documentId,
    themeDocumentTitle: params.themeDocument.title,
    sourceDocuments: bundleDocuments,
    templateSignals: {
      sourceDocumentCount: bundleDocuments.length,
      propositionCount: bundleDocuments.reduce((sum, item) => sum + item.propositions.length, 0),
      primarySourceBlockCount: bundleDocuments.reduce((sum, item) => sum + item.primarySourceBlocks.length, 0),
      secondarySourceBlockCount: bundleDocuments.reduce((sum, item) => sum + item.secondarySourceBlocks.length, 0),
    },
    analysisSignals: {
      coreDocumentIds: params.report.ranking.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      bridgeDocumentIds: params.report.bridgeDocuments.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      propagationDocumentIds: params.report.propagationNodes.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      orphanDocumentIds: params.report.orphans.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      risingDocumentIds: params.trends.risingDocuments.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      fallingDocumentIds: params.trends.fallingDocuments.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      relationshipEvidence,
    },
  }
}
