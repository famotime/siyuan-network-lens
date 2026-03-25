import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const now = new Date('2026-03-12T00:00:00Z')

const snapshot = {
  documents: [
    { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha AI', tags: ['note'], created: '20260101090000', updated: '20260101120000' },
    { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: ['note'], created: '20260311120000', updated: '20260311120000' },
    { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', name: '人工智能', alias: 'AIGC,智能体', tags: [], created: '20260301090000', updated: '20260311120000' },
    { id: 'doc-theme-ml', box: 'box-1', path: '/topics/theme-ml.sy', hpath: '/专题/主题-机器学习-索引', title: '主题-机器学习-索引', name: '机器学习', alias: 'ML', tags: [], created: '20260301090000', updated: '20260311120000' },
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
  it('reorders summary cards and persists the manual order into config', async () => {
    const config = {
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
    }
    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config,
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

    state.reorderSummaryCard('orphans', 'documents')
    await nextTick()

    expect(state.summaryCards.value.map(card => card.key)).toEqual([
      'read',
      'ranking',
      'orphans',
      'documents',
      'trends',
      'references',
      'communities',
      'propagation',
      'bridges',
      'dormant',
    ])
    expect(config.summaryCardOrder).toEqual(state.summaryCards.value.map(card => card.key))
  })

  it('restores a saved summary card order and supports resetting back to default', async () => {
    const config = {
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
      summaryCardOrder: ['orphans', 'documents', 'read', 'references', 'ranking', 'trends', 'communities', 'dormant', 'bridges', 'propagation'],
      readTagNames: ['note'],
      readTitlePrefixes: '',
      readTitleSuffixes: '',
    }

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config,
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

    expect(state.summaryCards.value.map(card => card.key)).toEqual(config.summaryCardOrder)

    state.resetSummaryCardOrder()
    await nextTick()

    expect(state.summaryCards.value.map(card => card.key)).toEqual([
      'read',
      'orphans',
      'ranking',
      'documents',
      'trends',
      'references',
      'communities',
      'propagation',
      'bridges',
      'dormant',
    ])
    expect(config.summaryCardOrder).toEqual(state.summaryCards.value.map(card => card.key))
  })

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
          readTagNames: ['note'],
          readTitlePrefixes: '',
          readTitleSuffixes: '',
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
    const readCard = state.summaryCards.value.find(card => card.key === 'read')
    expect(documentCard?.value).toBe('7')
    expect(readCard?.label).toBe('未读文档')
    expect(readCard?.value).toBe('5')
    expect(state.report.value?.ranking.map(item => item.documentId)).toEqual(['doc-b'])
    expect(state.selectedEvidenceDocument.value).toBe('doc-b')
    expect(state.themeOptions.value.map(item => item.label)).toEqual(['机器学习', 'AI'])
  })

  it('toggles the read card between unread and read modes', async () => {
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
        readTagNames: ['note'],
        readTitlePrefixes: '',
        readTitleSuffixes: '',
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

    state.selectedSummaryCardKey.value = 'read'
    await nextTick()

    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      title: '未读文档详情',
      kind: 'list',
      items: expect.arrayContaining([
        expect.objectContaining({ documentId: 'doc-theme-ai', badge: '待标记' }),
      ]),
    }))

    state.toggleReadCardMode()
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: '已读文档',
      value: '2',
    }))
    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      title: '已读文档详情',
      kind: 'list',
      items: expect.arrayContaining([
        expect.objectContaining({ documentId: 'doc-a', badge: '标签命中' }),
      ]),
    }))
  })

  it('counts notebook-scoped read paths in the summary card totals', async () => {
    const notebookSnapshot = {
      documents: [
        { id: 'doc-read', box: 'box-clips', path: '/web/inbox/read/article.sy', hpath: '/Web收集箱/已读/文章', title: '文章', tags: [], created: '20260310120000', updated: '20260311120000' },
        { id: 'doc-unread', box: 'box-clips', path: '/web/inbox/todo/article.sy', hpath: '/Web收集箱/待读/文章', title: '待读文章', tags: [], created: '20260310120000', updated: '20260311120000' },
      ],
      references: [],
      notebooks: [
        { id: 'box-clips', name: '剪藏笔记本' },
      ],
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
        themeNotebookId: '',
        themeDocumentPath: '',
        themeNamePrefix: '',
        themeNameSuffix: '',
        readTagNames: [],
        readTitlePrefixes: '',
        readTitleSuffixes: '',
        readPaths: '/剪藏笔记本/Web收集箱/已读',
      },
      loadSnapshot: async () => notebookSnapshot as any,
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

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: '未读文档',
      value: '1',
    }))

    state.toggleReadCardMode()
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: '已读文档',
      value: '1',
    }))
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

  it('filters by selected tags as an OR condition', async () => {
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

    state.selectedTags.value = ['AI', 'note']
    await nextTick()

    expect(state.filteredDocuments.value.map(document => document.id)).toEqual([
      'doc-a',
      'doc-b',
      'doc-orphan',
    ])
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

  it('suggests theme documents for orphans that only match a theme name alias', async () => {
    const aliasSnapshot = {
      ...snapshot,
      documents: [
        ...snapshot.documents,
        { id: 'doc-orphan-alias', box: 'box-1', path: '/notes/agents.sy', hpath: '/笔记/随想', title: '智能体实践', tags: [], created: '20260310120000', updated: '20260311150000' },
      ],
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
      loadSnapshot: async () => aliasSnapshot as any,
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

    expect(state.orphanThemeSuggestions.value.get('doc-orphan-alias')).toEqual([
      expect.objectContaining({ themeName: 'AI', matchCount: 1 }),
    ])
  })

  it('suggests theme documents for orphans that only match in document content', async () => {
    const contentSnapshot = {
      ...snapshot,
      documents: [
        { id: 'doc-theme-skills', box: 'box-1', path: '/topics/theme-skills.sy', hpath: '/专题/主题-Skills-索引', title: '主题-Skills-索引', name: 'skill', alias: 'abc,def', tags: [], created: '20260301090000', updated: '20260311120000' },
        ...snapshot.documents,
        { id: 'doc-orphan-content', box: 'box-1', path: '/notes/content-only.sy', hpath: '/笔记/别名测试', title: '别名测试', content: 'skill abc def', tags: [], created: '20260310120000', updated: '20260311150000' },
      ],
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
      loadSnapshot: async () => contentSnapshot as any,
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

    expect(state.orphanThemeSuggestions.value.get('doc-orphan-content')).toEqual([
      expect.objectContaining({ themeName: 'Skills', matchCount: 3 }),
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
