import { computed, watch, type ComputedRef, type Ref } from 'vue'

import type { SummaryCardItem, SummaryCardKey } from '@/analytics/summary-details'

export function createAppFilterController(params: {
  config: { showSummaryCards?: boolean }
  timeRangeOptions: ComputedRef<Array<{ value: string, label: string }>>
  notebookOptions: ComputedRef<Array<{ id: string, name: string }>>
  tagOptions: ComputedRef<string[]>
  summaryCards: ComputedRef<SummaryCardItem[]>
  selectedSummaryCardKey: Ref<SummaryCardKey>
  isSummaryCardVisible: (config: any, key: SummaryCardKey) => boolean
  isAlphaSummaryCardVisible: (key: SummaryCardKey) => boolean
  allNotebookLabel: string
  selectSummaryCard: (cardKey: SummaryCardKey) => void
  orphanSort?: Ref<'updated-desc' | 'created-desc' | 'title-asc'>
  dormantDays?: Ref<number>
  pathScope?: Ref<'focused' | 'all' | 'community'>
  maxPathDepth?: Ref<number>
  fromDocumentId?: Ref<string>
  toDocumentId?: Ref<string>
}) {
  const visibleSummaryCards = computed(() => {
    if (!params.config.showSummaryCards) {
      return []
    }

    return params.summaryCards.value.filter(card => (
      params.isSummaryCardVisible(params.config, card.key)
      && params.isAlphaSummaryCardVisible(card.key)
    ))
  })

  const timeRangeFilterOptions = computed(() => params.timeRangeOptions.value.map(option => ({
    value: option.value,
    label: option.label,
  })))

  const notebookFilterOptions = computed(() => [
    { value: '', label: params.allNotebookLabel },
    ...params.notebookOptions.value.map(notebook => ({
      value: notebook.id,
      label: notebook.name,
    })),
  ])

  const tagFilterOptions = computed(() => params.tagOptions.value.map(tag => ({
    value: tag,
    label: tag,
    key: tag,
  })))

  watch(visibleSummaryCards, (cards) => {
    if (cards.length === 0) {
      return
    }
    if (!cards.some(card => card.key === params.selectedSummaryCardKey.value)) {
      params.selectSummaryCard(cards[0].key)
    }
  }, { immediate: true })

  function updateOrphanSort(value: 'updated-desc' | 'created-desc' | 'title-asc') {
    if (params.orphanSort) {
      params.orphanSort.value = value
    }
  }

  function updateDormantDays(value: number) {
    if (params.dormantDays) {
      params.dormantDays.value = value
    }
  }

  function updatePathScope(value: 'focused' | 'all' | 'community') {
    if (params.pathScope) {
      params.pathScope.value = value
    }
  }

  function updateMaxPathDepth(value: number) {
    if (params.maxPathDepth) {
      params.maxPathDepth.value = value
    }
  }

  function updateFromDocumentId(value: string) {
    if (params.fromDocumentId) {
      params.fromDocumentId.value = value
    }
  }

  function updateToDocumentId(value: string) {
    if (params.toDocumentId) {
      params.toDocumentId.value = value
    }
  }

  return {
    visibleSummaryCards,
    timeRangeFilterOptions,
    notebookFilterOptions,
    tagFilterOptions,
    updateOrphanSort,
    updateDormantDays,
    updatePathScope,
    updateMaxPathDepth,
    updateFromDocumentId,
    updateToDocumentId,
  }
}
