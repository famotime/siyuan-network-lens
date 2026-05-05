import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createAppFilterController } from './use-app-filters'

describe('createAppFilterController', () => {
  it('filters visible summary cards by config and alpha visibility, and falls back to the first visible key', () => {
    const selectedSummaryCardKey = ref('trends')
    const selectSummaryCard = vi.fn((key: string) => {
      selectedSummaryCardKey.value = key as any
    })

    const controller = createAppFilterController({
      config: {
        showSummaryCards: true,
        showDocuments: true,
        showReferences: false,
      } as any,
      timeRangeOptions: computed(() => []),
      notebookOptions: computed(() => []),
      tagOptions: computed(() => []),
      summaryCards: computed(() => [
        { key: 'documents', label: '文档样本', value: '8' },
        { key: 'references', label: '引用关系', value: '5' },
      ] as any),
      selectedSummaryCardKey,
      isSummaryCardVisible: vi.fn((config: any, key: string) => key !== 'references' || config.showReferences === true),
      isAlphaSummaryCardVisible: vi.fn((key: string) => key !== 'trends'),
      allNotebookLabel: '全部笔记本',
      selectSummaryCard,
    })

    expect(controller.visibleSummaryCards.value.map(card => card.key)).toEqual(['documents'])
    expect(selectSummaryCard).toHaveBeenCalledWith('documents')
    expect(selectedSummaryCardKey.value).toBe('documents')
  })

  it('builds filter option lists and exposes field setters as thin wrappers', () => {
    const orphanSort = ref<'updated-desc' | 'created-desc' | 'title-asc'>('updated-desc')
    const dormantDays = ref(30)
    const pathScope = ref<'focused' | 'all' | 'community'>('focused')
    const maxPathDepth = ref(4)
    const fromDocumentId = ref('doc-a')
    const toDocumentId = ref('doc-b')

    const controller = createAppFilterController({
      config: { showSummaryCards: false } as any,
      timeRangeOptions: computed(() => [
        { value: '7d', label: '最近 7 天' },
        { value: '30d', label: '最近 30 天' },
      ] as any),
      notebookOptions: computed(() => [
        { id: 'box-1', name: '工作台' },
      ]),
      tagOptions: computed(() => ['AI', 'ML']),
      summaryCards: computed(() => []),
      selectedSummaryCardKey: ref('documents'),
      isSummaryCardVisible: vi.fn(() => true),
      isAlphaSummaryCardVisible: vi.fn(() => true),
      allNotebookLabel: '全部笔记本',
      selectSummaryCard: vi.fn(),
      orphanSort,
      dormantDays,
      pathScope,
      maxPathDepth,
      fromDocumentId,
      toDocumentId,
    })

    expect(controller.timeRangeFilterOptions.value).toEqual([
      { value: '7d', label: '最近 7 天' },
      { value: '30d', label: '最近 30 天' },
    ])
    expect(controller.notebookFilterOptions.value).toEqual([
      { value: '', label: '全部笔记本' },
      { value: 'box-1', label: '工作台' },
    ])
    expect(controller.tagFilterOptions.value).toEqual([
      { value: 'AI', label: 'AI', key: 'AI' },
      { value: 'ML', label: 'ML', key: 'ML' },
    ])

    controller.updateOrphanSort('title-asc')
    controller.updateDormantDays(45)
    controller.updatePathScope('community')
    controller.updateMaxPathDepth(6)
    controller.updateFromDocumentId('doc-x')
    controller.updateToDocumentId('doc-y')

    expect(orphanSort.value).toBe('title-asc')
    expect(dormantDays.value).toBe(45)
    expect(pathScope.value).toBe('community')
    expect(maxPathDepth.value).toBe(6)
    expect(fromDocumentId.value).toBe('doc-x')
    expect(toDocumentId.value).toBe('doc-y')
  })
})
