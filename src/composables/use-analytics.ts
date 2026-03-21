import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  analyzeReferenceGraph,
  analyzeTrends,
  findReferencePath,
  filterDocumentsByTimeRange,
  type AnalyticsFilters,
  type OrphanSort,
  type TimeRange,
} from '@/analytics/analysis'
import { createActiveDocumentSync } from '@/analytics/active-document'
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
  createLinkAssociationInteractions,
  createThemeSuggestionController,
} from './use-analytics-interactions'
import type { PluginConfig } from '@/types/config'

export type { PathScope } from './use-analytics-derived'

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
}

type OpenTabFn = (params: { app: any, doc: { id: string, zoomIn?: boolean } }) => void
type ShowMessageFn = (text: string, timeout?: number, type?: 'info' | 'error') => void
type BlockWriteFn = (dataType: 'markdown' | 'dom', data: string, parentID: string) => Promise<any>
type BlockDeleteFn = (id: string) => Promise<any>
type BlockUpdateFn = (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string }>>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>

type UseAnalyticsParams = {
  plugin: PluginLike
  config: PluginConfig
  loadSnapshot?: () => Promise<AnalyticsSnapshot>
  nowProvider?: () => Date
  createActiveDocumentSync?: typeof createActiveDocumentSync
  showMessage: ShowMessageFn
  openTab: OpenTabFn
  appendBlock: BlockWriteFn
  prependBlock: BlockWriteFn
  deleteBlock: BlockDeleteFn
  updateBlock: BlockUpdateFn
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
}

export function useAnalyticsState(params: UseAnalyticsParams) {
  const loadSnapshot = params.loadSnapshot ?? loadAnalyticsSnapshot
  const nowProvider = params.nowProvider ?? (() => new Date())
  const syncActiveDocument = params.createActiveDocumentSync ?? createActiveDocumentSync
  const notify = params.showMessage
  const openTab = params.openTab
  const appendBlock = params.appendBlock
  const prependBlock = params.prependBlock
  const deleteBlock = params.deleteBlock
  const updateBlock = params.updateBlock
  const getChildBlocks = params.getChildBlocks
  const getBlockKramdown = params.getBlockKramdown

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
  const summaryCardOrder = ref<SummaryCardKey[]>(normalizeSummaryCardOrder(params.config.summaryCardOrder))
  const panelCollapseState = ref<PanelCollapseState<PanelKey>>(buildPanelCollapseState(panelKeys))
  const timeRangeOptions = computed(() => buildTimeRangeOptions())
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
    config: params.config,
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
    })
  })

  const trendDays = computed(() => {
    if (timeRange.value === 'all') {
      return 30
    }
    return Number.parseInt(timeRange.value, 10)
  })

  const trendLabel = computed(() => `对比近 ${trendDays.value} 天与前一窗口`)

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
      config: params.config,
    })
    return buildSummaryCards({
      report: report.value,
      dormantDays: dormantDays.value,
      documentCount: filteredDocuments.value.length,
      readDocumentCount: readMatches.length,
      readCardMode: readCardMode.value,
      trends: trends.value,
    })
  })
  const summaryCards = computed<SummaryCardItem[]>(() => sortSummaryCards(rawSummaryCards.value, summaryCardOrder.value))

  const summaryDetailSections = computed(() => {
    if (!snapshot.value || !report.value) {
      return null
    }

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
      config: params.config,
      readCardMode: readCardMode.value,
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
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(snapshot.value.fetchedAt))
  })

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

  async function refresh() {
    loading.value = true
    errorMessage.value = ''
    analysisNow.value = nowProvider()
    try {
      snapshot.value = await loadSnapshot()
      themeSuggestionController.clearPendingThemeSuggestionBlocks()
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取思源数据失败'
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

  function toggleReadCardMode() {
    readCardMode.value = readCardMode.value === 'read' ? 'unread' : 'read'
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
      return '未知时间'
    }
    return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`
  }

  function formatDelta(delta: number) {
    return delta > 0 ? `+${delta}` : delta.toString()
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
    panelCollapseState,
    filters,
    notebookOptions,
    tagOptions,
    filteredDocuments,
    sampleDocumentIds,
    sampleDocumentMap,
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
    toggleReadCardMode,
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
    formatTimestamp,
    formatDelta,
    toggleOrphanThemeSuggestion: themeSuggestionController.toggleOrphanThemeSuggestion,
    isThemeSuggestionActive: themeSuggestionController.isThemeSuggestionActive,
  }
}
