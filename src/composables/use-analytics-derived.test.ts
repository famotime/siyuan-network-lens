import { describe, expect, it } from 'vitest'

import {
  buildOrphanDetailItems,
  buildOrphanThemeSuggestionMap,
  buildPathOptions,
  buildTagOptions,
  countSelectedSummaryItems,
} from './use-analytics-derived'

describe('use-analytics-derived', () => {
  it('builds unique sorted tag options from documents', () => {
    const options = buildTagOptions([
      { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/A', title: 'A', tags: ['AI', '知识'] },
      { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/B', title: 'B', tags: '知识,整理 #AI' },
    ])

    expect(options).toEqual(['整理', '知识', 'AI'])
  })

  it('builds focused path options from ranking, bridge and propagation candidates', () => {
    const documentMap = new Map([
      ['doc-a', { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/A', title: 'Alpha' }],
      ['doc-b', { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/B', title: 'Beta' }],
      ['doc-c', { id: 'doc-c', box: 'box-1', path: '/c.sy', hpath: '/C', title: 'Gamma' }],
    ])

    const options = buildPathOptions({
      pathScope: 'focused',
      filteredDocuments: [],
      selectedCommunity: null,
      ranking: [
        { documentId: 'doc-b' },
      ],
      bridgeDocuments: [
        { documentId: 'doc-a' },
      ],
      propagationNodes: [
        { documentId: 'doc-c' },
        { documentId: 'doc-b' },
      ],
      documentMap,
      resolveTitle: documentId => documentMap.get(documentId)?.title ?? documentId,
    })

    expect(options).toEqual([
      { id: 'doc-a', title: 'Alpha' },
      { id: 'doc-b', title: 'Beta' },
      { id: 'doc-c', title: 'Gamma' },
    ])
  })

  it('builds orphan theme suggestions and merges them into orphan detail items', () => {
    const documentMap = new Map([
      ['doc-orphan', { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI 与 机器学习', title: 'AI 与 机器学习', tags: ['AI'], content: '机器学习 AI' }],
    ])
    const orphanThemeSuggestions = buildOrphanThemeSuggestionMap({
      orphans: [
        { documentId: 'doc-orphan' },
      ],
      documentMap,
      themeDocuments: [
        { documentId: 'doc-theme-ai', title: '主题-AI-索引', themeName: 'AI', matchTerms: ['AI', '人工智能'], box: 'box-1', path: '/topics/ai.sy', hpath: '/专题/主题-AI-索引' },
        { documentId: 'doc-theme-ml', title: '主题-机器学习-索引', themeName: '机器学习', matchTerms: ['机器学习'], box: 'box-1', path: '/topics/ml.sy', hpath: '/专题/主题-机器学习-索引' },
      ],
    })

    const items = buildOrphanDetailItems({
      selectedSummaryDetail: {
        key: 'orphans',
        title: '孤立文档详情',
        description: '',
        kind: 'list',
        items: [
          { documentId: 'doc-orphan', title: 'AI 与 机器学习', meta: 'meta' },
        ],
      },
      orphanThemeSuggestions,
    })

    expect(orphanThemeSuggestions.get('doc-orphan')).toEqual([
      expect.objectContaining({ themeName: 'AI', matchCount: 4 }),
      expect.objectContaining({ themeName: '机器学习', matchCount: 3 }),
    ])
    expect(items).toEqual([
      expect.objectContaining({
        documentId: 'doc-orphan',
        themeSuggestions: [
          expect.objectContaining({ themeName: 'AI' }),
          expect.objectContaining({ themeName: '机器学习' }),
        ],
      }),
    ])
  })

  it('includes keyword suggestions from index profiles in orphan detail items', () => {
    const keywordProfiles = new Map([
      ['doc-orphan', {
        documentId: 'doc-orphan',
        sourceUpdatedAt: '20260301120000',
        sourceHash: 'h1',
        title: 'AI 与 机器学习',
        path: '/notes/orphan.sy',
        hpath: '/笔记/AI 与 机器学习',
        tagsJson: '[]',
        positioning: '',
        propositionsJson: '[]',
        keywordsJson: JSON.stringify(['AI', '知识管理', '深度学习']),
        primarySourceBlocksJson: '[]',
        secondarySourceBlocksJson: '[]',
        generatedAt: '2026-04-01T00:00:00.000Z',
      }],
    ])

    const items = buildOrphanDetailItems({
      selectedSummaryDetail: {
        key: 'orphans',
        title: '孤立文档详情',
        description: '',
        kind: 'list',
        items: [
          { documentId: 'doc-orphan', title: 'AI 与 机器学习', meta: 'meta' },
          { documentId: 'doc-no-index', title: '无索引文档', meta: 'meta' },
        ],
      },
      orphanThemeSuggestions: new Map(),
      keywordProfiles,
    })

    expect(items[0].keywordSuggestions).toEqual(['AI', '知识管理', '深度学习'])
    expect(items[1].keywordSuggestions).toEqual([])
  })

  it('enhances theme suggestions with index keyword matches', () => {
    const documentMap = new Map([
      ['doc-orphan', { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/随笔', title: '日常随笔', tags: [], content: '' }],
    ])
    const keywordProfiles = new Map([
      ['doc-orphan', {
        documentId: 'doc-orphan',
        sourceUpdatedAt: '',
        sourceHash: '',
        title: '',
        path: '',
        hpath: '',
        tagsJson: '[]',
        positioning: '',
        propositionsJson: '[]',
        keywordsJson: JSON.stringify(['人工智能', '深度学习']),
        primarySourceBlocksJson: '[]',
        secondarySourceBlocksJson: '[]',
        generatedAt: '',
      }],
    ])

    const withoutKeywords = buildOrphanThemeSuggestionMap({
      orphans: [{ documentId: 'doc-orphan' }],
      documentMap,
      themeDocuments: [
        { documentId: 'doc-theme-ai', title: '主题-AI-索引', themeName: 'AI', matchTerms: ['AI', '人工智能'], box: 'box-1', path: '/topics/ai.sy', hpath: '/专题/主题-AI-索引' },
      ],
    })

    const withKeywords = buildOrphanThemeSuggestionMap({
      orphans: [{ documentId: 'doc-orphan' }],
      documentMap,
      themeDocuments: [
        { documentId: 'doc-theme-ai', title: '主题-AI-索引', themeName: 'AI', matchTerms: ['AI', '人工智能'], box: 'box-1', path: '/topics/ai.sy', hpath: '/专题/主题-AI-索引' },
      ],
      keywordProfiles,
    })

    expect(withoutKeywords.get('doc-orphan')).toBeUndefined()
    expect(withKeywords.get('doc-orphan')).toEqual([
      expect.objectContaining({ themeName: 'AI', matchCount: 1 }),
    ])
  })

  it('counts summary items for each detail section kind', () => {
    expect(countSelectedSummaryItems(null)).toBe(0)
    expect(countSelectedSummaryItems({
      key: 'documents',
      title: '',
      description: '',
      kind: 'list',
      items: [{ documentId: 'doc-a', title: 'A', meta: 'meta' }],
    })).toBe(1)
    expect(countSelectedSummaryItems({
      key: 'ranking',
      title: '',
      description: '',
      kind: 'ranking',
      ranking: [{ documentId: 'doc-a', title: 'A', inboundReferences: 1, distinctSourceDocuments: 1, outboundReferences: 0, lastActiveAt: '20260311120000', tagCount: 0, createdAt: '', updatedAt: '' }],
    })).toBe(1)
    expect(countSelectedSummaryItems({
      key: 'propagation',
      title: '',
      description: '',
      kind: 'propagation',
      items: [{ documentId: 'doc-a', title: 'A', meta: 'meta' }],
    })).toBe(1)
    expect(countSelectedSummaryItems({
      key: 'trends',
      title: '',
      description: '',
      kind: 'trends',
      trends: {
        current: { referenceCount: 0 },
        previous: { referenceCount: 0 },
        risingDocuments: [{ documentId: 'doc-a', title: 'A', currentReferences: 1, previousReferences: 0, delta: 1 }],
        fallingDocuments: [{ documentId: 'doc-b', title: 'B', currentReferences: 0, previousReferences: 1, delta: -1 }],
        connectionChanges: { newCount: 0, brokenCount: 0, newEdges: [], brokenEdges: [] },
        communityTrends: [],
        risingCommunities: [],
        dormantCommunities: [],
      },
    })).toBe(2)
  })
})
