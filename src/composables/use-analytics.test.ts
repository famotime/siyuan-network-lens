import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

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
  it('formats the snapshot label with the active workspace locale', async () => {
    ;(globalThis as typeof globalThis & {
      siyuan?: {
        config?: {
          lang?: string
        }
      }
    }).siyuan = {
      config: {
        lang: 'en_US',
      },
    }

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: {
        showSummaryCards: true,
        showRanking: true,
        showLargeDocuments: true,
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

    expect(state.snapshotLabel.value).toBe('03/12, 12:00 AM')

    delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  })

  it('falls back to "--" when snapshot fetchedAt is not a SiYuan timestamp', async () => {
    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: {
        showSummaryCards: true,
        showRanking: true,
        showLargeDocuments: true,
        showCommunities: true,
        showOrphanBridge: true,
        showTrends: true,
        showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
      },
      loadSnapshot: async () => ({
        ...snapshot,
        fetchedAt: '2026-04-18T08:07:38.596Z',
      }) as any,
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

    expect(state.snapshotLabel.value).toBe('--')
  })

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
      'todaySuggestions',
      'ranking',
      'orphans',
      'documents',
      'largeDocuments',
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
      showLargeDocuments: true,
      showCommunities: true,
      showOrphanBridge: true,
      showTrends: true,
      showPropagation: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '主题-',
      themeNameSuffix: '-索引',
      summaryCardOrder: ['orphans', 'documents', 'largeDocuments', 'read', 'todaySuggestions', 'references', 'ranking', 'trends', 'communities', 'dormant', 'bridges', 'propagation'],
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
      'todaySuggestions',
      'orphans',
      'ranking',
      'documents',
      'largeDocuments',
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
          showLargeDocuments: true,
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
    expect(readCard?.label).toBe('Unread docs')
    expect(readCard?.value).toBe('5')
    expect(state.summaryCards.value.find(card => card.key === 'largeDocuments')?.label).toBe('Large docs · text')
    expect(state.summaryCards.value.find(card => card.key === 'largeDocuments')?.value).toBe('0')
    expect(state.report.value?.ranking.map(item => item.documentId)).toEqual(['doc-b', 'doc-a'])
    expect(state.selectedEvidenceDocument.value).toBe('doc-b')
    expect(state.themeOptions.value.map(item => item.label)).toEqual(['机器学习', 'AI'])
  })

  it('applies analysis exclusion settings only after refresh and keeps path matching recursive', async () => {
    const scopedSnapshot = {
      documents: [
        { id: 'doc-keep', box: 'box-1', path: '/notes/keep.sy', hpath: '/笔记/保留', title: '保留', tags: [], created: '20260310120000', updated: '20260311120000' },
        { id: 'doc-excluded-child', box: 'box-1', path: '/excluded/topic/child.sy', hpath: '/排除区/专题/临时-子文档', title: '临时-子文档', tags: [], created: '20260310120000', updated: '20260311120000' },
        { id: 'doc-excluded-keep', box: 'box-1', path: '/excluded/topic/keep.sy', hpath: '/排除区/专题/普通文档', title: '普通文档', tags: [], created: '20260310120000', updated: '20260311120000' },
      ],
      references: [],
      notebooks: [
        { id: 'box-1', name: 'Knowledge Base' },
      ],
      fetchedAt: '20260312000000',
    }
    const config = reactive({
      showSummaryCards: true,
      showRanking: true,
      showLargeDocuments: true,
      showCommunities: true,
      showOrphanBridge: true,
      showTrends: true,
      showPropagation: true,
      themeNotebookId: '',
      themeDocumentPath: '',
      themeNamePrefix: '',
      themeNameSuffix: '',
      analysisExcludedPaths: '',
      analysisExcludedNamePrefixes: '',
      analysisExcludedNameSuffixes: '',
    })

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: config as any,
      loadSnapshot: async () => scopedSnapshot as any,
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

    expect(state.filteredDocuments.value.map(document => document.id)).toEqual([
      'doc-keep',
      'doc-excluded-child',
      'doc-excluded-keep',
    ])

    config.analysisExcludedPaths = '/Knowledge Base/排除区'
    await nextTick()

    expect(state.filteredDocuments.value.map(document => document.id)).toEqual([
      'doc-keep',
      'doc-excluded-child',
      'doc-excluded-keep',
    ])

    await state.refresh()
    await nextTick()

    expect(state.filteredDocuments.value.map(document => document.id)).toEqual(['doc-keep'])

    config.analysisExcludedNamePrefixes = '临时-'
    await nextTick()

    expect(state.filteredDocuments.value.map(document => document.id)).toEqual(['doc-keep'])

    await state.refresh()
    await nextTick()

    expect(state.filteredDocuments.value.map(document => document.id)).toEqual([
      'doc-keep',
      'doc-excluded-keep',
    ])
  })

  it('applies theme document settings only after refresh', async () => {
    const config = reactive({
      showSummaryCards: true,
      showRanking: true,
      showLargeDocuments: true,
      showCommunities: true,
      showOrphanBridge: true,
      showTrends: true,
      showPropagation: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '',
      themeNamePrefix: '',
      themeNameSuffix: '',
    })

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: config as any,
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

    expect(state.themeOptions.value).toEqual([])

    config.themeDocumentPath = '/专题'
    config.themeNamePrefix = '主题-'
    config.themeNameSuffix = '-索引'
    await nextTick()

    expect(state.themeOptions.value).toEqual([])

    await state.refresh()
    await nextTick()

    expect(state.themeOptions.value.map(option => option.label)).toEqual(['机器学习', 'AI'])
  })

  it('applies read rule settings only after refresh', async () => {
    const config = reactive({
      showSummaryCards: true,
      showRanking: true,
      showLargeDocuments: true,
      showCommunities: true,
      showOrphanBridge: true,
      showTrends: true,
      showPropagation: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '主题-',
      themeNameSuffix: '-索引',
      readTagNames: [] as string[],
      readTitlePrefixes: '',
      readTitleSuffixes: '',
      readPaths: '',
    })

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: config as any,
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

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: 'Unread docs',
      value: '7',
    }))

    config.readTagNames = ['note']
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: 'Unread docs',
      value: '7',
    }))

    await state.refresh()
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: 'Unread docs',
      value: '5',
    }))
  })

  it('clears transient AI and wiki state on refresh', async () => {
    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: {
        showSummaryCards: true,
        showRanking: true,
        showLargeDocuments: true,
        showCommunities: true,
        showOrphanBridge: true,
        showTrends: true,
        showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        wikiEnabled: true,
        wikiPageSuffix: '-llm-wiki',
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
    } as any)

    await state.refresh()
    await nextTick()

    ;(state as any).aiInboxError.value = '旧 AI 错误'
    ;(state as any).aiConnectionMessage.value = '旧连接结果'
    ;(state as any).aiInboxResult.value = {
      generatedAt: '2026-03-12T08:00:00.000Z',
      summary: '旧建议',
      items: [],
    }
    ;(state as any).orphanAiSuggestionStates.value = new Map([
      ['doc-orphan', {
        loading: false,
        statusMessage: '',
        error: '',
        result: null,
      }],
    ])
    ;(state as any).wikiError.value = '旧 wiki 错误'
    ;(state as any).wikiPreview.value = {
      generatedAt: '2026-03-12T08:00:00.000Z',
      scope: {
        summary: {
          sourceDocumentCount: 1,
          themeGroupCount: 0,
          unclassifiedDocumentCount: 1,
          excludedWikiDocumentCount: 0,
        },
        descriptionLines: ['- 范围来源：测试'],
      },
      themePages: [],
      unclassifiedDocuments: [],
      excludedWikiDocuments: [],
    }

    await state.refresh()
    await nextTick()

    expect((state as any).aiInboxError.value).toBe('')
    expect((state as any).aiConnectionMessage.value).toBe('')
    expect((state as any).aiInboxResult.value).toBeNull()
    expect((state as any).orphanAiSuggestionStates.value.size).toBe(0)
    expect((state as any).wikiError.value).toBe('')
    expect((state as any).wikiPreview.value).toBeNull()
  })

  it('toggles the read card between unread and read modes', async () => {
    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: {
        showSummaryCards: true,
        showRanking: true,
        showLargeDocuments: true,
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
      loadLargeDocumentMetrics: async () => new Map([
        ['doc-a', { documentId: 'doc-a', wordCount: 10001, documentBytes: 10, assetBytes: 4 * 1024 * 1024, totalBytes: 4 * 1024 * 1024 + 10, assetCount: 2 }],
        ['doc-b', { documentId: 'doc-b', wordCount: 9000, documentBytes: 2 * 1024 * 1024, assetBytes: 0, totalBytes: 2 * 1024 * 1024, assetCount: 0 }],
      ]),
    })

    await state.refresh()
    await nextTick()

    state.selectedSummaryCardKey.value = 'read'
    await nextTick()

    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      title: 'Unread docs',
      kind: 'list',
      items: expect.arrayContaining([
        expect.objectContaining({ documentId: 'doc-theme-ai', badge: 'Needs review' }),
      ]),
    }))

    state.toggleReadCardMode()
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: 'Read docs',
      value: '2',
    }))
    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      title: 'Read docs',
      kind: 'list',
      items: expect.arrayContaining([
        expect.objectContaining({ documentId: 'doc-a', badge: 'Tag match' }),
      ]),
    }))
  })

  it('toggles the large document card between word and storage modes', async () => {
    const largeDocumentSnapshot = {
      ...snapshot,
      documents: snapshot.documents.map(document => (
        document.id === 'doc-a'
          ? { ...document, updated: '20260311120000' }
          : document
      )),
    }

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: {
        showSummaryCards: true,
        showRanking: true,
        showLargeDocuments: true,
        showCommunities: true,
        showOrphanBridge: true,
        showTrends: true,
        showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
      },
      loadSnapshot: async () => largeDocumentSnapshot as any,
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
      loadLargeDocumentMetrics: async () => new Map([
        ['doc-a', { documentId: 'doc-a', wordCount: 10001, documentBytes: 10, assetBytes: 4 * 1024 * 1024, totalBytes: 4 * 1024 * 1024 + 10, assetCount: 2 }],
        ['doc-b', { documentId: 'doc-b', wordCount: 12000, documentBytes: 2 * 1024 * 1024, assetBytes: 0, totalBytes: 2 * 1024 * 1024, assetCount: 0 }],
      ]),
    })

    await state.refresh()
    await nextTick()

    state.selectedSummaryCardKey.value = 'largeDocuments'
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'largeDocuments')).toEqual(expect.objectContaining({
      label: 'Large docs · text',
      value: '2',
    }))
    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      title: 'Large docs · text',
      items: [
        expect.objectContaining({ documentId: 'doc-b', badge: 'Text count 12000' }),
        expect.objectContaining({ documentId: 'doc-a', badge: 'Text count 10001' }),
      ],
    }))

    state.toggleLargeDocumentCardMode()
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'largeDocuments')).toEqual(expect.objectContaining({
      label: 'Large docs · assets',
      value: '1',
    }))
    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      title: 'Large docs · assets',
      items: [
        expect.objectContaining({ documentId: 'doc-a', badge: '4.0 MB' }),
      ],
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
      label: 'Unread docs',
      value: '1',
    }))

    state.toggleReadCardMode()
    await nextTick()

    expect(state.summaryCards.value.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: 'Read docs',
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

    expect(state.report.value?.ranking.map(item => item.documentId)).toEqual(['doc-b', 'doc-a'])
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

  it('exposes AI inbox state and can generate a prioritized inbox from injected AI service', async () => {
    const aiResult = {
      generatedAt: '2026-03-12T08:00:00.000Z',
      summary: '今天先处理断裂风险和孤立补链。',
      items: [
        {
          id: 'task-doc-orphan',
          type: 'document',
          title: 'AI 与 机器学习 AI',
          priority: 'P1',
          action: '补 2 条到主题页的连接。',
          reason: '当前窗口内孤立，但和主题 AI、机器学习都有明显语义相关，能立刻回到主题网络中。',
          documentIds: ['doc-orphan'],
        },
      ],
    }
    const buildPayload = vi.fn(() => ({ focus: [] }))
    const generateInbox = vi.fn().mockResolvedValue(aiResult)
    const testConnection = vi.fn().mockResolvedValue({
      ok: true,
      message: '连接成功',
    })

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
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
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
      forwardProxy: async () => ({
        body: '',
        contentType: 'application/json',
        elapsed: 1,
        headers: {},
        status: 200,
        url: 'https://api.example.com/v1/chat/completions',
      }),
      createAiInboxService: () => ({
        buildPayload,
        generateInbox,
        testConnection,
      }),
    } as any)

    await state.refresh()
    await nextTick()

    expect(typeof (state as any).generateAiInbox).toBe('function')
    expect(typeof (state as any).testAiConnection).toBe('function')
    expect((state as any).aiInboxResult.value).toBeNull()

    const connection = await (state as any).testAiConnection()
    expect(connection).toEqual({
      ok: true,
      message: '连接成功',
    })

    await (state as any).generateAiInbox()
    await nextTick()

    expect(buildPayload).toHaveBeenCalledTimes(1)
    expect(generateInbox).toHaveBeenCalledTimes(1)
    expect((state as any).aiInboxResult.value).toEqual(aiResult)
    expect(state.summaryCards.value.find(card => card.key === 'todaySuggestions')).toEqual(expect.objectContaining({
      label: 'Today suggestions',
      value: '1',
    }))
    expect((state as any).aiInboxError.value).toBe('')
    expect((state as any).aiInboxResult.value.items).toEqual([
      expect.objectContaining({
        id: 'task-doc-orphan',
        type: 'document',
        title: 'AI 与 机器学习 AI',
      }),
    ])
  })

  it('does not auto-generate today suggestions when the card detail is opened', async () => {
    const aiResult = {
      generatedAt: '2026-03-12T08:00:00.000Z',
      summary: '今天先处理断裂风险和孤立补链。',
      items: [
        {
          id: 'task-doc-orphan',
          type: 'document',
          title: 'AI 与 机器学习 AI',
          priority: 'P1',
          action: '补 2 条到主题页的连接。',
          reason: '当前窗口内孤立，但和主题 AI、机器学习都有明显语义相关，能立刻回到主题网络中。',
          documentIds: ['doc-orphan'],
        },
      ],
    }
    const generateInbox = vi.fn().mockResolvedValue(aiResult)

    const state = useAnalyticsState({
      plugin: { eventBus: { on: () => {}, off: () => {} }, app: {} } as any,
      config: {
        showSummaryCards: true,
        showTodaySuggestions: true,
        showRanking: true,
        showCommunities: true,
        showOrphanBridge: true,
        showTrends: true,
        showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
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
      forwardProxy: async () => ({
        body: '',
        contentType: 'application/json',
        elapsed: 1,
        headers: {},
        status: 200,
        url: 'https://api.example.com/v1/chat/completions',
      }),
      createAiInboxService: () => ({
        buildPayload: () => ({ focus: [] }) as any,
        generateInbox,
        testConnection: vi.fn().mockResolvedValue({
          ok: true,
          message: '连接成功',
        }),
      }),
    } as any)

    await state.refresh()
    await nextTick()

    state.selectSummaryCard('todaySuggestions')
    await nextTick()
    await Promise.resolve()
    await nextTick()

    expect(generateInbox).not.toHaveBeenCalled()
    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      key: 'todaySuggestions',
      kind: 'aiInbox',
      result: null,
    }))

    await state.generateAiInbox()

    expect(generateInbox).toHaveBeenCalledTimes(1)
    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      key: 'todaySuggestions',
      kind: 'aiInbox',
      result: expect.objectContaining({
        summary: '今天先处理断裂风险和孤立补链。',
      }),
    }))
  })

  it('persists the latest three today suggestion snapshots and lets the detail switch to a selected history view', async () => {
    const historyStorage = (() => {
      const store = new Map<string, any>()
      return {
        async loadData(storageName: string) {
          return store.get(storageName)
        },
        async saveData(storageName: string, value: any) {
          store.set(storageName, value)
        },
      }
    })()
    let generatedCount = 0
    const generateInbox = vi.fn(async () => {
      generatedCount += 1
      return {
        generatedAt: `2026-03-12T0${generatedCount}:00:00.000Z`,
        summary: `第 ${generatedCount} 次建议`,
        items: [
          {
            id: `task-doc-orphan-${generatedCount}`,
            type: 'document',
            title: `AI 与 机器学习 AI #${generatedCount}`,
            priority: 'P1',
            action: '补 2 条到主题页的连接。',
            reason: '当前窗口内孤立，但和主题 AI、机器学习都有明显语义相关。',
            documentIds: ['doc-orphan'],
          },
        ],
      }
    })

    const state = useAnalyticsState({
      plugin: {
        eventBus: { on: () => {}, off: () => {} },
        app: {},
        ...historyStorage,
      } as any,
      config: {
        showSummaryCards: true,
        showTodaySuggestions: true,
        showRanking: true,
        showCommunities: true,
        showOrphanBridge: true,
        showTrends: true,
        showPropagation: true,
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
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
      forwardProxy: async () => ({
        body: '',
        contentType: 'application/json',
        elapsed: 1,
        headers: {},
        status: 200,
        url: 'https://api.example.com/v1/chat/completions',
      }),
      createAiInboxService: () => ({
        buildPayload: () => ({ focus: [] }) as any,
        generateInbox,
        testConnection: vi.fn().mockResolvedValue({
          ok: true,
          message: '连接成功',
        }),
      }),
    } as any)

    await state.refresh()
    await nextTick()

    await (state as any).generateAiInbox()
    await (state as any).generateAiInbox()
    await (state as any).generateAiInbox()
    await (state as any).generateAiInbox()
    await nextTick()

    expect((state as any).aiInboxHistory.value).toHaveLength(3)
    expect((state as any).aiInboxHistory.value.map((item: any) => item.generatedAt)).toEqual([
      '2026-03-12T04:00:00.000Z',
      '2026-03-12T03:00:00.000Z',
      '2026-03-12T02:00:00.000Z',
    ])

    state.selectSummaryCard('todaySuggestions')
    ;(state as any).selectAiInboxHistory((state as any).aiInboxHistory.value[1].id)
    await nextTick()

    expect((state as any).selectedAiInboxHistoryId.value).toBe((state as any).aiInboxHistory.value[1].id)
    expect(state.selectedSummaryDetail.value).toEqual(expect.objectContaining({
      key: 'todaySuggestions',
      kind: 'aiInbox',
      result: expect.objectContaining({
        generatedAt: '2026-03-12T03:00:00.000Z',
        summary: '第 3 次建议',
      }),
    }))

    await state.refresh()
    await nextTick()

    expect((state as any).aiInboxHistory.value).toHaveLength(3)
    expect((state as any).aiInboxHistory.value[0].generatedAt).toBe('2026-03-12T04:00:00.000Z')
  })

  it('loads orphan AI suggestions on demand and exposes friendly progress state', async () => {
    const aiSuggestionResult = {
      generatedAt: '2026-03-12T08:00:00.000Z',
      summary: '优先补到主题页。',
      suggestions: [
        {
          targetDocumentId: 'doc-theme-ai',
          targetTitle: '主题-AI-索引',
          targetType: 'theme-document',
          confidence: 'high',
          reason: '主题匹配和 embedding 相似度都很高，补链后更容易回到现有主题网络。',
          draftText: '可归入 AI 主题：((doc-theme-ai "主题-AI-索引"))',
          tagSuggestions: [
            { tag: 'AI', source: 'existing', reason: '已有标签，可直接复用。' },
            { tag: 'AI 工具', source: 'new', reason: '更贴合工具实践语义。' },
          ],
        },
      ],
    }
    const suggestForOrphan = vi.fn(async ({ onProgress }: any) => {
      onProgress?.('正在分析文档语义并生成 embedding…')
      onProgress?.('正在基于 embedding 与结构信号召回候选…')
      onProgress?.('AI 正在分析……')
      return aiSuggestionResult
    })

    const state = useAnalyticsState({
      plugin: {
        eventBus: { on: () => {}, off: () => {} },
        app: {},
        loadData: async () => undefined,
        saveData: async () => undefined,
      } as any,
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
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
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
      forwardProxy: async () => ({
        body: '',
        contentType: 'application/json',
        elapsed: 1,
        headers: {},
        status: 200,
        url: 'https://api.example.com/v1',
      }),
      createAiLinkSuggestionService: () => ({
        suggestForOrphan,
      }),
      aiIndexStore: {
        saveDocumentIndex: vi.fn(async () => undefined),
        getFreshDocumentProfile: vi.fn(async () => null),
        getDocumentProfile: vi.fn(async () => null),
        getFreshDocumentSummary: vi.fn(async () => null),
        deleteDocumentIndex: vi.fn(async () => undefined),
      },
    } as any)

    await state.refresh()
    await nextTick()

    await (state as any).generateOrphanAiSuggestion('doc-orphan')
    await nextTick()

    expect(suggestForOrphan).toHaveBeenCalledTimes(1)
    expect(suggestForOrphan).toHaveBeenCalledWith(expect.objectContaining({
      existingTags: ['AI', 'note'],
      themeDocuments: expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc-theme-ai',
          themeName: 'AI',
        }),
      ]),
    }))
    expect(typeof (state as any).generateOrphanAiSuggestion).toBe('function')
    expect((state as any).orphanAiSuggestionStates.value.get('doc-orphan')).toEqual({
      loading: false,
      statusMessage: '',
      error: '',
      result: aiSuggestionResult,
    })
  })

  it('toggles AI link suggestions with the same insertion rules as theme suggestions and applies document tags via block attrs', async () => {
    const updateBlock = vi.fn(async () => [])
    const prependBlock = vi.fn(async () => ([
      {
        doOperations: [
          { id: 'blk-tag-1' },
        ],
      },
    ]))
    const deleteBlock = vi.fn(async () => [])
    const setBlockAttrs = vi.fn(async () => null)
    const getBlockAttrs = vi.fn()
      .mockResolvedValueOnce({ tags: 'AI' })
      .mockResolvedValueOnce({ tags: 'AI,AI工具' })
      .mockResolvedValueOnce({ tags: 'AI' })
    const notify = vi.fn()

    const state = useAnalyticsState({
      plugin: {
        eventBus: { on: () => {}, off: () => {} },
        app: {},
        loadData: async () => undefined,
        saveData: async () => undefined,
      } as any,
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
      showMessage: notify,
      openTab: () => {},
      appendBlock: async () => [],
      prependBlock,
      deleteBlock,
      updateBlock,
      getChildBlocks: async (id: string) => id === 'doc-orphan' ? [{ id: 'blk-orphan-1', type: 'p' }] : [],
      getBlockKramdown: async () => ({ id: 'blk-orphan-1', kramdown: '((doc-existing "Existing"))' }),
      setBlockAttrs,
      getBlockAttrs,
    } as any)

    await state.refresh()
    await nextTick()

    await (state as any).toggleOrphanAiLinkSuggestion('doc-orphan', 'doc-b', 'Beta')

    expect(updateBlock).toHaveBeenCalledWith('markdown', '((doc-existing "Existing"))\t((doc-b "Beta"))', 'blk-orphan-1')
    expect((state as any).isAiLinkSuggestionActive('doc-orphan', 'doc-b')).toBe(true)

    await (state as any).toggleOrphanAiLinkSuggestion('doc-orphan', 'doc-b', 'Beta')

    expect(updateBlock).toHaveBeenLastCalledWith('markdown', '((doc-existing "Existing"))', 'blk-orphan-1')
    expect((state as any).isAiLinkSuggestionActive('doc-orphan', 'doc-b')).toBe(false)

    await (state as any).toggleOrphanAiTagSuggestion('doc-orphan', 'AI工具')

    expect(setBlockAttrs).toHaveBeenLastCalledWith('doc-orphan', { tags: 'AI,AI工具' })
    expect((state as any).isAiTagSuggestionActive('doc-orphan', 'AI工具')).toBe(true)
    expect(state.snapshot.value?.documents.find(document => document.id === 'doc-orphan')?.tags).toEqual(['AI', 'AI工具'])
    expect(state.tagOptions.value).toContain('AI工具')

    await (state as any).toggleOrphanAiTagSuggestion('doc-orphan', 'AI工具')

    expect(setBlockAttrs).toHaveBeenLastCalledWith('doc-orphan', { tags: 'AI' })
    expect((state as any).isAiTagSuggestionActive('doc-orphan', 'AI工具')).toBe(false)
    expect(state.snapshot.value?.documents.find(document => document.id === 'doc-orphan')?.tags).toEqual(['AI'])
    expect(state.tagOptions.value).not.toContain('AI工具')
    expect(notify).toHaveBeenCalled()
  })

  it('builds wiki previews from the current filtered scope and applies generated pages', async () => {
    const diagnoseThemeTemplate = vi.fn(async () => ({
      templateType: 'tech_topic',
      confidence: 'high',
      reason: '测试诊断',
      enabledModules: ['intro', 'highlights', 'core_principles', 'sources'],
      suppressedModules: [],
      evidenceSummary: '测试证据',
    }))
    const planThemePage = vi.fn(async () => ({
      templateType: 'tech_topic',
      confidence: 'high',
      coreSections: ['intro', 'highlights', 'sources'],
      optionalSections: ['core_principles'],
      sectionOrder: ['intro', 'highlights', 'core_principles', 'sources'],
      sectionGoals: {
        intro: '主题概览',
      },
      sectionFormats: {
        intro: 'overview',
        highlights: 'structured',
        core_principles: 'structured',
        sources: 'catalog',
      },
    }))
    const generateThemeSection = vi.fn(async ({ payload, sectionType }: any) => {
      switch (sectionType) {
        case 'intro':
          return {
            sectionType,
            title: `${payload.themeName} 的主题概览`,
            format: 'overview',
            blocks: [{ text: `${payload.themeName} 的主题概览`, sourceRefs: ['doc-a'] }],
            sourceRefs: ['doc-a'],
          }
        case 'highlights':
          return {
            sectionType,
            title: '关键文档',
            format: 'structured',
            blocks: payload.sourceDocuments.length
              ? payload.sourceDocuments.map((item: any) => ({ text: `优先维护 ${item.title}`, sourceRefs: [item.documentId] }))
              : [{ text: '暂无核心文档', sourceRefs: [] }],
            sourceRefs: payload.sourceDocuments.map((item: any) => item.documentId),
          }
        case 'core_principles':
          return {
            sectionType,
            title: '核心原则',
            format: 'structured',
            blocks: payload.templateSignals.propositionCount
              ? [{ text: `当前共有 ${payload.templateSignals.propositionCount} 条主题命题`, sourceRefs: ['doc-a'] }]
              : [{ text: '结构稳定', sourceRefs: [] }],
            sourceRefs: ['doc-a'],
          }
        default:
          return {
            sectionType,
            title: '关系证据',
            format: 'catalog',
            blocks: payload.sourceDocuments.flatMap((item: any) => item.primarySourceBlocks).length
              ? [{ text: payload.sourceDocuments.flatMap((item: any) => item.primarySourceBlocks)[0].text, sourceRefs: ['doc-a'] }]
              : [{ text: '暂无证据', sourceRefs: [] }],
            sourceRefs: ['doc-a'],
          }
      }
    })
    const saveDocumentIndex = vi.fn(async () => undefined)
    const savePageRecord = vi.fn(async () => undefined)
    const openTab = vi.fn()
    const createDocWithMd = vi.fn(async () => 'wiki-ai-page')
    const getIDsByHPath = vi.fn(async () => [])
    const storedProfiles = new Map<string, any>()

    const state = useAnalyticsState({
      plugin: {
        eventBus: { on: () => {}, off: () => {} },
        app: {},
      } as any,
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
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        wikiEnabled: true,
        wikiPageSuffix: '-llm-wiki',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
      },
      loadSnapshot: async () => snapshot as any,
      nowProvider: () => now,
      createActiveDocumentSync: () => () => {},
      showMessage: () => {},
      openTab,
      appendBlock: async () => [],
      prependBlock: async () => [],
      deleteBlock: async () => [],
      updateBlock: async () => [],
      createDocWithMd,
      getIDsByHPath,
      getChildBlocks: async () => [],
      getBlockKramdown: async (id: string) => ({ id, kramdown: '' }),
      getBlockAttrs: async () => ({}),
      setBlockAttrs: async () => null,
      forwardProxy: async (url: string) => ({
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ positioning: '测试定位', propositions: [{ text: '测试命题', sourceBlockIds: [] }], keywords: ['测试'] }) } }] }),
        contentType: 'application/json',
        elapsed: 1,
        headers: {},
        status: 200,
        url,
      }),
      createAiWikiService: () => ({
        diagnoseThemeTemplate,
        planThemePage,
        generateThemeSection,
      }),
      aiIndexStore: {
        getFreshDocumentSummary: vi.fn(async () => null),
        getFreshDocumentProfile: vi.fn(async (documentId: string, sourceUpdatedAt: string) => {
          const profile = storedProfiles.get(documentId) ?? null
          return profile?.sourceUpdatedAt === sourceUpdatedAt ? profile : null
        }),
        getDocumentProfile: vi.fn(async (documentId: string) => storedProfiles.get(documentId) ?? null),
        saveDocumentIndex: vi.fn(async (params: any) => {
          await saveDocumentIndex(params)
          storedProfiles.set(params.sourceDocument.id, {
            documentId: params.sourceDocument.id,
            sourceUpdatedAt: params.sourceDocument.updated ?? '',
            sourceHash: `h-${params.sourceDocument.id}`,
            title: params.sourceDocument.title,
            path: params.sourceDocument.path ?? '',
            hpath: params.sourceDocument.hpath ?? '',
            tagsJson: JSON.stringify(params.sourceDocument.tags ?? []),
            positioning: params.positioning,
            propositionsJson: JSON.stringify(params.propositions),
            keywordsJson: JSON.stringify(params.keywords),
            primarySourceBlocksJson: JSON.stringify(params.primarySourceBlocks),
            secondarySourceBlocksJson: JSON.stringify(params.secondarySourceBlocks),
            generatedAt: params.generatedAt,
          })
        }),
      } as any,
      aiWikiStore: {
        loadSnapshot: vi.fn(async () => ({ schemaVersion: 1, pages: {} })),
        saveSnapshot: vi.fn(async () => undefined),
        getPageRecord: vi.fn(async () => null),
        savePageRecord,
      } as any,
    } as any)

    await state.refresh()
    await nextTick()

    await (state as any).prepareWikiPreview({
      sourceDocumentIds: ['doc-theme-ai', 'doc-a', 'doc-b', 'doc-orphan', 'doc-orphan-zeta', 'doc-orphan-gamma'],
      scopeDescriptionLine: '- 范围来源：主题《AI》关联范围（正链 / 反链 / 子文档）',
      themeDocumentId: 'doc-theme-ai',
    })
    await nextTick()

    expect(diagnoseThemeTemplate).toHaveBeenCalledTimes(1)
    expect(planThemePage).toHaveBeenCalledTimes(1)
    expect(generateThemeSection).toHaveBeenCalledTimes(4)
    expect((state as any).wikiPreview.value).toEqual(expect.objectContaining({
      themePages: expect.arrayContaining([
        expect.objectContaining({
          pageTitle: '主题-AI-索引-llm-wiki',
          themeName: 'AI',
          preview: expect.objectContaining({
            status: 'create',
          }),
        }),
      ]),
      scope: expect.objectContaining({
        summary: expect.objectContaining({
          sourceDocumentCount: 5,
          generatedSectionCount: 4,
        }),
      }),
    }))
    expect(saveDocumentIndex).toHaveBeenCalled()
    expect(savePageRecord).toHaveBeenCalled()

    await (state as any).applyWikiChanges()
    await nextTick()

    expect(createDocWithMd).toHaveBeenCalled()
    expect((state as any).wikiPreview.value.applyResult).toEqual(expect.objectContaining({
      indexPage: expect.objectContaining({
        pageTitle: 'LLM-Wiki-索引',
      }),
      logPage: expect.objectContaining({
        pageTitle: 'LLM-Wiki-维护日志',
      }),
    }))

    ;(state as any).openWikiDocument('wiki-ai-page')
    expect(openTab).toHaveBeenCalledWith({
      app: {},
      doc: {
        id: 'wiki-ai-page',
      },
    })
  })

  it('builds wiki previews from a requested scoped document set instead of the whole sample', async () => {
    const diagnoseThemeTemplate = vi.fn(async () => ({
      templateType: 'tech_topic',
      confidence: 'high',
      reason: '测试诊断',
      enabledModules: ['intro', 'highlights', 'sources'],
      suppressedModules: [],
      evidenceSummary: '测试证据',
    }))
    const planThemePage = vi.fn(async () => ({
      templateType: 'tech_topic',
      confidence: 'high',
      coreSections: ['intro', 'highlights', 'sources'],
      optionalSections: [],
      sectionOrder: ['intro', 'highlights', 'sources'],
      sectionGoals: {
        intro: '主题概览',
      },
      sectionFormats: {
        intro: 'overview',
        highlights: 'structured',
        sources: 'catalog',
      },
    }))
    const generateThemeSection = vi.fn(async ({ payload, sectionType }: any) => {
      switch (sectionType) {
        case 'intro':
          return {
            sectionType,
            title: `${payload.themeName} 的主题概览`,
            format: 'overview',
            blocks: [{ text: `${payload.themeName} 的主题概览`, sourceRefs: ['doc-a'] }],
            sourceRefs: ['doc-a'],
          }
        case 'highlights':
          return {
            sectionType,
            title: '关键文档',
            format: 'structured',
            blocks: payload.sourceDocuments.length
              ? payload.sourceDocuments.map((item: any) => ({ text: `优先维护 ${item.title}`, sourceRefs: [item.documentId] }))
              : [{ text: '暂无核心文档', sourceRefs: [] }],
            sourceRefs: payload.sourceDocuments.map((item: any) => item.documentId),
          }
        default:
          return {
            sectionType,
            title: '关系证据',
            format: 'catalog',
            blocks: payload.sourceDocuments.flatMap((item: any) => item.primarySourceBlocks).length
              ? [{ text: payload.sourceDocuments.flatMap((item: any) => item.primarySourceBlocks)[0].text, sourceRefs: ['doc-a'] }]
              : [{ text: '暂无证据', sourceRefs: [] }],
            sourceRefs: ['doc-a'],
          }
      }
    })
    const storedProfiles = new Map<string, any>()

    const state = useAnalyticsState({
      plugin: {
        eventBus: { on: () => {}, off: () => {} },
        app: {},
      } as any,
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
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        wikiEnabled: true,
        wikiPageSuffix: '-llm-wiki',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
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
      getBlockKramdown: async (id: string) => ({ id, kramdown: '' }),
      getBlockAttrs: async () => ({}),
      setBlockAttrs: async () => null,
      forwardProxy: async (url: string) => ({
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ positioning: '测试定位', propositions: [{ text: '测试命题', sourceBlockIds: [] }], keywords: ['测试'] }) } }] }),
        contentType: 'application/json',
        elapsed: 1,
        headers: {},
        status: 200,
        url,
      }),
      createAiWikiService: () => ({
        diagnoseThemeTemplate,
        planThemePage,
        generateThemeSection,
      }),
      aiIndexStore: {
        getFreshDocumentSummary: vi.fn(async () => null),
        getFreshDocumentProfile: vi.fn(async (documentId: string, sourceUpdatedAt: string) => {
          const profile = storedProfiles.get(documentId) ?? null
          return profile?.sourceUpdatedAt === sourceUpdatedAt ? profile : null
        }),
        getDocumentProfile: vi.fn(async (documentId: string) => storedProfiles.get(documentId) ?? null),
        saveDocumentIndex: vi.fn(async (params: any) => {
          storedProfiles.set(params.sourceDocument.id, {
            documentId: params.sourceDocument.id,
            sourceUpdatedAt: params.sourceDocument.updated ?? '',
            sourceHash: `h-${params.sourceDocument.id}`,
            title: params.sourceDocument.title,
            path: params.sourceDocument.path ?? '',
            hpath: params.sourceDocument.hpath ?? '',
            tagsJson: JSON.stringify(params.sourceDocument.tags ?? []),
            positioning: params.positioning,
            propositionsJson: JSON.stringify(params.propositions),
            keywordsJson: JSON.stringify(params.keywords),
            primarySourceBlocksJson: JSON.stringify(params.primarySourceBlocks),
            secondarySourceBlocksJson: JSON.stringify(params.secondarySourceBlocks),
            generatedAt: params.generatedAt,
          })
        }),
      } as any,
      aiWikiStore: {
        loadSnapshot: vi.fn(async () => ({ schemaVersion: 1, pages: {} })),
        saveSnapshot: vi.fn(async () => undefined),
        getPageRecord: vi.fn(async () => null),
        savePageRecord: vi.fn(async () => undefined),
      } as any,
    } as any)

    await state.refresh()
    await nextTick()

    await (state as any).prepareWikiPreview({
      sourceDocumentIds: ['doc-theme-ai', 'doc-a', 'doc-b', 'doc-a'],
      scopeDescriptionLine: '- 范围来源：核心文档《Beta》关联范围（正链 / 反链 / 子文档）',
      themeDocumentId: 'doc-theme-ai',
    })
    await nextTick()

    expect(diagnoseThemeTemplate).toHaveBeenCalledTimes(1)
    expect(planThemePage).toHaveBeenCalledTimes(1)
    expect(generateThemeSection).toHaveBeenCalledTimes(3)
    expect(diagnoseThemeTemplate).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        sourceDocuments: [
          expect.objectContaining({
            documentId: 'doc-a',
            title: 'Alpha AI',
            positioning: '测试定位',
            propositions: [expect.objectContaining({ text: '测试命题', sourceBlockIds: [] })],
            sourceUpdatedAt: expect.any(String),
            generatedAt: expect.any(String),
          }),
          expect.objectContaining({
            documentId: 'doc-b',
            title: 'Beta',
          }),
        ],
        templateSignals: expect.objectContaining({ propositionCount: 2, sourceDocumentCount: 2 }),
        analysisSignals: expect.objectContaining({ coreDocumentIds: expect.any(Array), relationshipEvidence: expect.any(Array) }),
      }),
    }))
    expect((state as any).wikiPreview.value).toEqual(expect.objectContaining({
      themePages: [
        expect.objectContaining({
          themeDocumentId: 'doc-theme-ai',
          sourceDocumentIds: ['doc-a', 'doc-b'],
        }),
      ],
      scope: expect.objectContaining({
        summary: {
          sourceDocumentCount: 2,
          generatedSectionCount: 3,
          referenceCount: 3,
          manualNotesParagraphCount: 0,
        },
        descriptionLines: expect.arrayContaining(['- 范围来源：核心文档《Beta》关联范围（正链 / 反链 / 子文档）']),
      }),
      unclassifiedDocuments: [],
      excludedWikiDocuments: [],
    }))
  })

  it('surfaces a friendly wiki error when LLM Wiki or AI config is unavailable', async () => {
    const diagnoseThemeTemplate = vi.fn()
    const planThemePage = vi.fn()
    const generateThemeSection = vi.fn()
    const state = useAnalyticsState({
      plugin: {
        eventBus: { on: () => {}, off: () => {} },
        app: {},
      } as any,
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
        aiEnabled: false,
        wikiEnabled: false,
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
      createAiWikiService: () => ({
        diagnoseThemeTemplate,
        planThemePage,
        generateThemeSection,
      }),
    } as any)

    await state.refresh()
    await nextTick()
    await (state as any).prepareWikiPreview()

    expect((state as any).wikiError.value).toContain('LLM Wiki')
    expect((state as any).wikiPreview.value).toBeNull()
    expect(diagnoseThemeTemplate).not.toHaveBeenCalled()
    expect(planThemePage).not.toHaveBeenCalled()
    expect(generateThemeSection).not.toHaveBeenCalled()
  })
})
