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
import { buildLinkAssociations } from '@/analytics/link-associations'
import {
  addThemeLinkToDocumentChange,
  applyThemeLinkToOrphanDocument,
  removeThemeLinkFromDocumentChange,
  type AppliedThemeLinkChange,
} from '@/analytics/orphan-theme-links'
import { syncAssociation as syncAssociationCore } from '@/analytics/link-sync'
import { buildPanelCounts } from '@/analytics/panel-counts'
import { buildSummaryCards, buildSummaryDetailSections, type SummaryCardItem, type SummaryCardKey } from '@/analytics/summary-details'
import { buildThemeOptions, collectThemeDocuments, countThemeMatchesForDocument } from '@/analytics/theme-documents'
import { buildTimeRangeOptions } from '@/analytics/time-range'
import { buildPanelCollapseState, togglePanelCollapse, type PanelCollapseState } from '@/analytics/panel-collapse'
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from '@/analytics/siyuan-data'
import type { PluginConfig } from '@/types/config'

export type PathScope = 'focused' | 'all' | 'community'

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
  const selectedTag = ref('')
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
  const panelCollapseState = ref<PanelCollapseState<PanelKey>>(buildPanelCollapseState(panelKeys))
  const expandedLinkPanels = ref(new Set<string>())
  const expandedLinkGroups = ref(new Set<string>())
  const syncInProgress = ref(new Set<string>())
  const pendingThemeSuggestionBlocks = ref(new Map<string, AppliedThemeLinkChange>())
  const timeRangeOptions = computed(() => buildTimeRangeOptions())
  let disposeActiveDocumentSync: (() => void) | null = null

  const filters = computed<AnalyticsFilters>(() => ({
    notebook: selectedNotebook.value || undefined,
    tag: selectedTag.value || undefined,
    themeNames: selectedThemes.value.length ? [...selectedThemes.value] : undefined,
    keyword: keyword.value || undefined,
  }))

  const notebookOptions = computed(() => snapshot.value?.notebooks ?? [])
  const tagOptions = computed(() => {
    const tagSet = new Set<string>()
    for (const document of snapshot.value?.documents ?? []) {
      for (const tag of normalizeTags(document.tags)) {
        tagSet.add(tag)
      }
    }
    return [...tagSet].sort((left, right) => left.localeCompare(right, 'zh-CN'))
  })

  const documentMap = computed(() => {
    return new Map((snapshot.value?.documents ?? []).map(document => [document.id, document]))
  })
  const themeDocuments = computed(() => collectThemeDocuments({
    documents: snapshot.value?.documents ?? [],
    config: params.config,
  }))
  const themeOptions = computed(() => buildThemeOptions(themeDocuments.value))

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

  const sampleDocumentIds = computed(() => new Set(filteredDocuments.value.map(document => document.id)))
  const sampleDocumentMap = computed(() => new Map(filteredDocuments.value.map(document => [document.id, document])))

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

  const summaryCards = computed<SummaryCardItem[]>(() => {
    if (!report.value || !trends.value) {
      return []
    }
    return buildSummaryCards({
      report: report.value,
      dormantDays: dormantDays.value,
      documentCount: filteredDocuments.value.length,
      trends: trends.value,
    })
  })

  const summaryDetailSections = computed(() => {
    if (!snapshot.value || !report.value) {
      return null
    }

    return buildSummaryDetailSections({
      documents: snapshot.value.documents,
      references: snapshot.value.references,
      report: report.value,
      now: analysisNow.value,
      timeRange: timeRange.value,
      trends: trends.value,
      filters: filters.value,
      dormantDays: dormantDays.value,
    })
  })

  const selectedSummaryDetail = computed(() => {
    return summaryDetailSections.value?.[selectedSummaryCardKey.value] ?? null
  })
  const orphanThemeSuggestions = computed(() => {
    const suggestions = new Map<string, ReturnType<typeof countThemeMatchesForDocument>>()

    if (!report.value) {
      return suggestions
    }

    for (const orphan of report.value.orphans) {
      const document = documentMap.value.get(orphan.documentId)
      if (!document) {
        continue
      }
      const matches = countThemeMatchesForDocument({
        document,
        themeDocuments: themeDocuments.value,
      })
      if (matches.length) {
        suggestions.set(orphan.documentId, matches)
      }
    }

    return suggestions
  })
  const orphanDetailItems = computed(() => {
    if (selectedSummaryDetail.value?.key !== 'orphans' || selectedSummaryDetail.value.kind !== 'list') {
      return []
    }

    return selectedSummaryDetail.value.items.map(item => ({
      ...item,
      themeSuggestions: orphanThemeSuggestions.value.get(item.documentId) ?? [],
    }))
  })

  const selectedSummaryCount = computed(() => {
    const detail = selectedSummaryDetail.value
    if (!detail) {
      return 0
    }
    if (detail.kind === 'list') {
      return detail.items.length
    }
    if (detail.kind === 'ranking') {
      return detail.ranking.length
    }
    if (detail.kind === 'suggestions') {
      return detail.suggestions.length
    }
    return detail.trends.risingDocuments.length + detail.trends.fallingDocuments.length
  })

  const pathOptions = computed(() => {
    const ids = new Set<string>()

    if (pathScope.value === 'all') {
      for (const document of filteredDocuments.value) {
        ids.add(document.id)
      }
    } else if (pathScope.value === 'community') {
      for (const documentId of selectedCommunity.value?.documentIds ?? []) {
        ids.add(documentId)
      }
    } else {
      for (const item of report.value?.ranking ?? []) {
        ids.add(item.documentId)
      }
      for (const item of report.value?.bridgeDocuments ?? []) {
        ids.add(item.documentId)
      }
      for (const item of report.value?.propagationNodes ?? []) {
        ids.add(item.documentId)
      }
    }

    return [...ids]
      .map((id) => {
        const document = documentMap.value.get(id)
        return document
          ? {
              id,
              title: resolveTitle(id),
            }
          : null
      })
      .filter((item): item is { id: string, title: string } => item !== null)
      .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
  })

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

  const linkAssociationsByDocumentId = computed(() => {
    const map = new Map<string, ReturnType<typeof buildLinkAssociations>>()
    if (!snapshot.value) {
      return map
    }
    for (const item of report.value?.ranking ?? []) {
      map.set(item.documentId, buildLinkAssociations({
        documentId: item.documentId,
        references: snapshot.value.references,
        documentMap: sampleDocumentMap.value,
        now: analysisNow.value,
        timeRange: timeRange.value,
      }))
    }
    return map
  })

  const panelCounts = computed(() => {
    if (!report.value) {
      return {
        ranking: 0,
        suggestions: 0,
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
      pendingThemeSuggestionBlocks.value.clear()
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

  function resolveLinkAssociations(documentId: string) {
    return linkAssociationsByDocumentId.value.get(documentId) ?? { outbound: [], inbound: [] }
  }

  function toggleLinkPanel(documentId: string) {
    if (expandedLinkPanels.value.has(documentId)) {
      expandedLinkPanels.value.delete(documentId)
      return
    }
    expandedLinkPanels.value.add(documentId)
    selectEvidence(documentId)
  }

  function isLinkPanelExpanded(documentId: string) {
    return expandedLinkPanels.value.has(documentId)
  }

  function buildLinkGroupKey(documentId: string, direction: 'outbound' | 'inbound') {
    return `${documentId}:${direction}`
  }

  function toggleLinkGroup(documentId: string, direction: 'outbound' | 'inbound') {
    const key = buildLinkGroupKey(documentId, direction)
    if (expandedLinkGroups.value.has(key)) {
      expandedLinkGroups.value.delete(key)
      return
    }
    expandedLinkGroups.value.add(key)
  }

  function isLinkGroupExpanded(documentId: string, direction: 'outbound' | 'inbound') {
    return expandedLinkGroups.value.has(buildLinkGroupKey(documentId, direction))
  }

  function buildSyncKey(coreDocumentId: string, targetDocumentId: string, direction: 'outbound' | 'inbound') {
    return `${coreDocumentId}:${targetDocumentId}:${direction}`
  }

  function isSyncing(coreDocumentId: string, targetDocumentId: string, direction: 'outbound' | 'inbound') {
    return syncInProgress.value.has(buildSyncKey(coreDocumentId, targetDocumentId, direction))
  }

  async function syncAssociation(coreDocumentId: string, targetDocumentId: string, direction: 'outbound' | 'inbound') {
    const key = buildSyncKey(coreDocumentId, targetDocumentId, direction)
    if (syncInProgress.value.has(key)) {
      return
    }
    syncInProgress.value.add(key)
    try {
      await syncAssociationCore({
        coreDocumentId,
        targetDocumentId,
        direction,
        resolveTitle,
        appendBlock,
        prependBlock,
      })
      notify('已同步关联链接', 3000, 'info')
      await refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步失败'
      notify(message, 5000, 'error')
    } finally {
      syncInProgress.value.delete(key)
    }
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

  function isThemeSuggestionActive(orphanDocumentId: string, themeDocumentId: string) {
    return pendingThemeSuggestionBlocks.value.get(orphanDocumentId)?.links.some(item => item.themeDocumentId === themeDocumentId) ?? false
  }

  async function toggleOrphanThemeSuggestion(orphanDocumentId: string, themeDocumentId: string) {
    const existingChange = pendingThemeSuggestionBlocks.value.get(orphanDocumentId)

    if (existingChange?.links.some(item => item.themeDocumentId === themeDocumentId)) {
      try {
        const nextChange = await removeThemeLinkFromDocumentChange({
          change: existingChange,
          themeDocumentId,
          deleteBlock,
          updateBlock,
        })
        if (nextChange) {
          pendingThemeSuggestionBlocks.value.set(orphanDocumentId, nextChange)
        } else {
          pendingThemeSuggestionBlocks.value.delete(orphanDocumentId)
        }
        notify('已撤销主题链接建议', 3000, 'info')
      } catch (error) {
        const message = error instanceof Error ? error.message : '撤销主题链接失败'
        notify(message, 5000, 'error')
      }
      return
    }

    const themeDocument = themeDocuments.value.find(item => item.documentId === themeDocumentId)
    if (!themeDocument) {
      notify('未找到对应的主题文档', 5000, 'error')
      return
    }

    try {
      const change = existingChange
        ? await addThemeLinkToDocumentChange({
            change: existingChange,
            themeDocumentId: themeDocument.documentId,
            themeDocumentTitle: themeDocument.title,
            updateBlock,
          })
        : await applyThemeLinkToOrphanDocument({
            orphanDocumentId,
            themeDocumentId: themeDocument.documentId,
            themeDocumentTitle: themeDocument.title,
            getChildBlocks,
            getBlockKramdown,
            updateBlock,
            prependBlock,
          })
      pendingThemeSuggestionBlocks.value.set(orphanDocumentId, change)
      notify('已插入主题链接，刷新分析后将重新判断孤立状态', 3000, 'info')
    } catch (error) {
      const message = error instanceof Error ? error.message : '插入主题链接失败'
      notify(message, 5000, 'error')
    }
  }

  function normalizeTags(tags?: readonly string[] | string) {
    if (!tags) {
      return []
    }
    if (Array.isArray(tags) || typeof tags !== 'string') {
      return tags
    }
    return tags
      .split(/[\,\s#]+/)
      .map(tag => tag.trim())
      .filter(Boolean)
  }

  return {
    loading,
    errorMessage,
    snapshot,
    timeRange,
    timeRangeOptions,
    selectedNotebook,
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
    panelCollapseState,
    filters,
    notebookOptions,
    tagOptions,
    filteredDocuments,
    sampleDocumentIds,
    sampleDocumentMap,
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
    resolveLinkAssociations,
    toggleLinkPanel,
    isLinkPanelExpanded,
    toggleLinkGroup,
    isLinkGroupExpanded,
    isSyncing,
    syncAssociation,
    togglePanel,
    isPanelExpanded,
    resolveTitle,
    resolveNotebookName,
    openDocument,
    formatTimestamp,
    formatDelta,
    toggleOrphanThemeSuggestion,
    isThemeSuggestionActive,
  }
}
