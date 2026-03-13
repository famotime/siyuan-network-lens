import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const now = new Date('2026-03-12T00:00:00Z')

const snapshot = {
  documents: [
    { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha AI', tags: ['note'], created: '20260101090000', updated: '20260101120000' },
    { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: ['note'], created: '20260311120000', updated: '20260311120000' },
    { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], created: '20260301090000', updated: '20260311120000' },
    { id: 'doc-theme-ml', box: 'box-1', path: '/topics/theme-ml.sy', hpath: '/专题/主题-机器学习-索引', title: '主题-机器学习-索引', tags: [], created: '20260301090000', updated: '20260311120000' },
    { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI 与 机器学习', title: 'AI 与 机器学习 AI', tags: ['AI'], created: '20260310120000', updated: '20260311120000' },
    { id: 'doc-orphan-zeta', box: 'box-1', path: '/notes/zeta.sy', hpath: '/笔记/Zeta', title: 'Zeta', tags: [], created: '20260309120000', updated: '20260310120000' },
    { id: 'doc-orphan-gamma', box: 'box-1', path: '/notes/gamma.sy', hpath: '/笔记/Gamma', title: 'Gamma', tags: [], created: '20260308120000', updated: '20260309120000' },
  ],
  references: [
    { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260311120000' },
  ],
  notebooks: [],
  fetchedAt: '20260312000000',
}

vi.mock('@/analytics/siyuan-data', () => ({
  loadAnalyticsSnapshot: async () => snapshot as any,
}))

import { useAnalyticsState } from './use-analytics'

describe('useAnalyticsState', () => {
  it('refreshes snapshot and updates derived states', async () => {
    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
        config: {
          showSummaryCards: true,
          showRanking: true,
          showCommunities: true,
          showOrphanBridge: true,
          showTrends: true,
          showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
      },
      loadSnapshot: async () => snapshot as any,
      nowProvider: () => now,
      createActiveDocumentSync: () => () => {},
      showMessage: () => {},
      openTab: () => {},
      appendBlock: async () => [],
      prependBlock: async () => [],
      deleteBlock: async () => [],
      updateBlock: async () => [],
      getChildBlocks: async () => [],
      getBlockKramdown: async () => ({ id: '', kramdown: '' }),
    })

    await state.refresh()
    await nextTick()

    const documentCard = state.summaryCards.value.find(card => card.key === 'documents')
    expect(documentCard?.value).toBe('7')
    expect(state.report.value?.ranking.map(item => item.documentId)).toEqual(['doc-b'])
    expect(state.selectedEvidenceDocument.value).toBe('doc-b')
    expect(state.themeOptions.value.map(item => item.label)).toEqual(['机器学习', 'AI'])
  })

  it('uses default snapshot loader when not provided', async () => {
    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
        config: {
          showSummaryCards: true,
          showRanking: true,
          showCommunities: true,
          showOrphanBridge: true,
          showTrends: true,
          showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
      },
      nowProvider: () => now,
      createActiveDocumentSync: () => () => {},
      showMessage: () => {},
      openTab: () => {},
      appendBlock: async () => [],
      prependBlock: async () => [],
      deleteBlock: async () => [],
      updateBlock: async () => [],
      getChildBlocks: async () => [],
      getBlockKramdown: async () => ({ id: '', kramdown: '' }),
    })

    await state.refresh()
    await nextTick()

    expect(state.report.value?.ranking.map(item => item.documentId)).toEqual(['doc-b'])
  })

  it('filters by selected themes and allows toggling orphan theme links before refresh', async () => {
    const deleteBlock = vi.fn().mockResolvedValue([])
    const updateBlock = vi.fn().mockResolvedValue([])
    const openTab = vi.fn()

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
        config: {
          showSummaryCards: true,
          showRanking: true,
          showCommunities: true,
          showOrphanBridge: true,
          showTrends: true,
          showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
      },
      loadSnapshot: async () => snapshot as any,
      nowProvider: () => now,
      createActiveDocumentSync: () => () => {},
      showMessage: () => {},
      openTab,
      appendBlock: async () => [],
      prependBlock: async () => [],
      deleteBlock,
      updateBlock,
      getChildBlocks: async (id: string) => id === 'doc-orphan' ? [{ id: 'blk-orphan-1', type: 'p' }] : [],
      getBlockKramdown: async () => ({ id: 'blk-orphan-1', kramdown: '((doc-existing "Existing"))' }),
    })

    await state.refresh()
    await nextTick()

    state.selectedThemes.value = ['AI']
    await nextTick()

    expect(state.filteredDocuments.value.map(document => document.id)).toEqual([
      'doc-theme-ai',
      'doc-orphan',
    ])

    expect(state.orphanThemeSuggestions.value.get('doc-orphan')).toEqual([
      expect.objectContaining({ themeName: 'AI', matchCount: 4 }),
      expect.objectContaining({ themeName: '机器学习', matchCount: 2 }),
    ])

    await state.toggleOrphanThemeSuggestion('doc-orphan', 'doc-theme-ai')

    expect(updateBlock).toHaveBeenCalledWith('markdown', '((doc-existing "Existing"))\t((doc-theme-ai "主题-AI-索引"))', 'blk-orphan-1')
    expect(state.isThemeSuggestionActive('doc-orphan', 'doc-theme-ai')).toBe(true)

    await state.toggleOrphanThemeSuggestion('doc-orphan', 'doc-theme-ml')

    expect(updateBlock).toHaveBeenLastCalledWith('markdown', '((doc-existing "Existing"))\t((doc-theme-ai "主题-AI-索引"))\t((doc-theme-ml "主题-机器学习-索引"))', 'blk-orphan-1')
    expect(state.isThemeSuggestionActive('doc-orphan', 'doc-theme-ml')).toBe(true)

    await state.toggleOrphanThemeSuggestion('doc-orphan', 'doc-theme-ai')

    expect(updateBlock).toHaveBeenLastCalledWith('markdown', '((doc-existing "Existing"))\t((doc-theme-ml "主题-机器学习-索引"))', 'blk-orphan-1')
    expect(deleteBlock).not.toHaveBeenCalled()
    expect(state.isThemeSuggestionActive('doc-orphan', 'doc-theme-ai')).toBe(false)

    state.openDocument('doc-orphan')
    expect(openTab).toHaveBeenCalledWith({
      app: {},
      doc: {
        id: 'doc-orphan',
      },
    })
  })

  it('re-sorts orphan detail items when orphan sort changes', async () => {
    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
        config: {
          showSummaryCards: true,
          showRanking: true,
          showCommunities: true,
          showOrphanBridge: true,
          showTrends: true,
          showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
      },
      loadSnapshot: async () => snapshot as any,
      nowProvider: () => now,
      createActiveDocumentSync: () => () => {},
      showMessage: () => {},
      openTab: () => {},
      appendBlock: async () => [],
      prependBlock: async () => [],
      deleteBlock: async () => [],
      updateBlock: async () => [],
      getChildBlocks: async () => [],
      getBlockKramdown: async () => ({ id: '', kramdown: '' }),
    })

    await state.refresh()
    await nextTick()

    state.selectedSummaryCardKey.value = 'orphans'
    await nextTick()

    expect(state.orphanDetailItems.value.map(item => item.documentId)).toEqual([
      'doc-orphan',
      'doc-theme-ai',
      'doc-theme-ml',
      'doc-orphan-zeta',
      'doc-orphan-gamma',
    ])

    state.orphanSort.value = 'title-asc'
    await nextTick()

    expect(state.orphanDetailItems.value.map(item => item.documentId)).toEqual([
      'doc-theme-ml',
      'doc-theme-ai',
      'doc-orphan',
      'doc-orphan-gamma',
      'doc-orphan-zeta',
    ])
  })

  it('keeps child documents visible in link associations even when child docs are outside the active time window', async () => {
    const childSnapshot = {
      documents: [
        { id: 'doc-parent', box: 'box-1', path: '/topics/skills.sy', hpath: '/主题笔记/~Skills', title: '~Skills', tags: [], created: '20260215063907', updated: '20260313195129' },
        { id: 'doc-child-old', box: 'box-1', path: '/topics/skills/doc-child-old.sy', hpath: '/主题笔记/~Skills/Claude Skills 编写指南', title: 'Claude Skills 编写指南', tags: [], created: '20260102102024', updated: '20260217120636' },
        { id: 'doc-side', box: 'box-1', path: '/topics/side.sy', hpath: '/主题笔记/Side', title: 'Side', tags: [], created: '20260310120000', updated: '20260311120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-side', sourceBlockId: 'blk-1', targetDocumentId: 'doc-parent', targetBlockId: 'blk-2', content: '[[~Skills]]', sourceUpdated: '20260311120000' },
      ],
      notebooks: [],
      fetchedAt: '20260312000000',
    }

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: {
        showSummaryCards: true,
        showRanking: true,
        showCommunities: true,
        showOrphanBridge: true,
        showTrends: true,
        showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
      },
      loadSnapshot: async () => childSnapshot as any,
      nowProvider: () => now,
      createActiveDocumentSync: () => () => {},
      showMessage: () => {},
      openTab: () => {},
      appendBlock: async () => [],
      prependBlock: async () => [],
      deleteBlock: async () => [],
      updateBlock: async () => [],
      getChildBlocks: async () => [],
      getBlockKramdown: async () => ({ id: '', kramdown: '' }),
    })

    await state.refresh()
    await nextTick()

    expect(state.resolveLinkAssociations('doc-parent').childDocuments.map(item => item.documentId)).toEqual(['doc-child-old'])
  })
})
