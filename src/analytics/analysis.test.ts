import { afterEach, describe, expect, it } from 'vitest'

import {
  analyzeReferenceGraph,
  analyzeTrends,
  filterDocumentsByTimeRange,
  findReferencePath,
  TIME_RANGE_OPTIONS,
} from './analysis'

const now = new Date('2026-03-11T00:00:00Z')

const documents = [
  { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha Index', tags: ['index', 'topic'], created: '20260201090000', updated: '20260310120000' },
  { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta Research', tags: ['research'], created: '20260202090000', updated: '20260310120000' },
  { id: 'doc-c', box: 'box-1', path: '/c.sy', hpath: '/Gamma', title: 'Gamma Notes', tags: ['research'], created: '20260203090000', updated: '20260309120000' },
  { id: 'doc-d', box: 'box-1', path: '/d.sy', hpath: '/Delta', title: 'Delta Archive', tags: ['archive'], created: '20260101090000', updated: '20260201120000' },
  { id: 'doc-e', box: 'box-2', path: '/e.sy', hpath: '/Bridge', title: 'Bridge Map', tags: ['bridge'], created: '20260204090000', updated: '20260308120000' },
  { id: 'doc-f', box: 'box-2', path: '/f.sy', hpath: '/Focus', title: 'Focus Project', tags: ['project'], created: '20260205090000', updated: '20260306120000' },
  { id: 'doc-g', box: 'box-2', path: '/g.sy', hpath: '/Garden', title: 'Garden Topic', tags: ['project'], created: '20260206090000', updated: '20260310120000' },
  { id: 'doc-h', box: 'box-2', path: '/h.sy', hpath: '/History', title: 'History Review', tags: ['review'], created: '20260207090000', updated: '20260306120000' },
] as const

const references = [
  { id: 'ref-1', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b1', targetDocumentId: 'doc-a', targetBlockId: 'blk-a1', content: '[[Alpha Index]]', sourceUpdated: '20260310120000' },
  { id: 'ref-2', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c1', targetDocumentId: 'doc-a', targetBlockId: 'blk-a1', content: '[[Alpha Index]]', sourceUpdated: '20260309120000' },
  { id: 'ref-3', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b2', targetDocumentId: 'doc-c', targetBlockId: 'blk-c1', content: '[[Gamma Notes]]', sourceUpdated: '20260310120000' },
  { id: 'ref-4', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c2', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta Research]]', sourceUpdated: '20260309120000' },
  { id: 'ref-5', sourceDocumentId: 'doc-e', sourceBlockId: 'blk-e1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta Research]]', sourceUpdated: '20260308120000' },
  { id: 'ref-6', sourceDocumentId: 'doc-e', sourceBlockId: 'blk-e2', targetDocumentId: 'doc-f', targetBlockId: 'blk-f1', content: '[[Focus Project]]', sourceUpdated: '20260308120000' },
  { id: 'ref-7', sourceDocumentId: 'doc-g', sourceBlockId: 'blk-g1', targetDocumentId: 'doc-f', targetBlockId: 'blk-f1', content: '[[Focus Project]]', sourceUpdated: '20260310120000' },
  { id: 'ref-8', sourceDocumentId: 'doc-e', sourceBlockId: 'blk-e3', targetDocumentId: 'doc-a', targetBlockId: 'blk-a2', content: '[[Alpha Index]]', sourceUpdated: '20260308120000' },
  { id: 'ref-9', sourceDocumentId: 'doc-h', sourceBlockId: 'blk-h1', targetDocumentId: 'doc-g', targetBlockId: 'blk-g1', content: '[[Garden Topic]]', sourceUpdated: '20260306120000' },
] as const

const extraRankingReferences = [
  { id: 'ref-10', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a3', targetDocumentId: 'doc-c', targetBlockId: 'blk-c2', content: '[[Gamma Notes]]', sourceUpdated: '20260309120000' },
  { id: 'ref-11', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c3', targetDocumentId: 'doc-a', targetBlockId: 'blk-a4', content: '[[Alpha Index]]', sourceUpdated: '20260309120000' },
  { id: 'ref-12', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b3', targetDocumentId: 'doc-a', targetBlockId: 'blk-a5', content: '[[Alpha Index]]', sourceUpdated: '20260310120000' },
  { id: 'ref-13', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a6', targetDocumentId: 'doc-b', targetBlockId: 'blk-b4', content: '[[Beta Research]]', sourceUpdated: '20260310120000' },
  { id: 'ref-14', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b4', targetDocumentId: 'doc-e', targetBlockId: 'blk-e4', content: '[[Bridge Map]]', sourceUpdated: '20260310120000' },
  { id: 'ref-15', sourceDocumentId: 'doc-e', sourceBlockId: 'blk-e4', targetDocumentId: 'doc-b', targetBlockId: 'blk-b5', content: '[[Beta Research]]', sourceUpdated: '20260310120000' },
  { id: 'ref-16', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b5', targetDocumentId: 'doc-e', targetBlockId: 'blk-e5', content: '[[Bridge Map]]', sourceUpdated: '20260310120000' },
  { id: 'ref-17', sourceDocumentId: 'doc-e', sourceBlockId: 'blk-e5', targetDocumentId: 'doc-b', targetBlockId: 'blk-b6', content: '[[Beta Research]]', sourceUpdated: '20260310120000' },
  { id: 'ref-18', sourceDocumentId: 'doc-f', sourceBlockId: 'blk-f2', targetDocumentId: 'doc-g', targetBlockId: 'blk-g2', content: '[[Garden Topic]]', sourceUpdated: '20260310120000' },
  { id: 'ref-19', sourceDocumentId: 'doc-g', sourceBlockId: 'blk-g3', targetDocumentId: 'doc-f', targetBlockId: 'blk-f4', content: '[[Focus Project]]', sourceUpdated: '20260310120000' },
  { id: 'ref-20', sourceDocumentId: 'doc-e', sourceBlockId: 'blk-e6', targetDocumentId: 'doc-a', targetBlockId: 'blk-a7', content: '[[Alpha Index]]', sourceUpdated: '20260310120000' },
  { id: 'ref-21', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c4', targetDocumentId: 'doc-a', targetBlockId: 'blk-a8', content: '[[Alpha Index]]', sourceUpdated: '20260309120000' },
  { id: 'ref-22', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c5', targetDocumentId: 'doc-a', targetBlockId: 'blk-a9', content: '[[Alpha Index]]', sourceUpdated: '20260309120000' },
  { id: 'ref-23', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a10', targetDocumentId: 'doc-c', targetBlockId: 'blk-c6', content: '[[Gamma Notes]]', sourceUpdated: '20260309120000' },
  { id: 'ref-24', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a11', targetDocumentId: 'doc-e', targetBlockId: 'blk-e7', content: '[[Bridge Map]]', sourceUpdated: '20260310120000' },
] as const

describe('analyzeReferenceGraph', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('exposes supported time range options', () => {
    expect(TIME_RANGE_OPTIONS).toEqual(['all', '3d', '7d', '30d', '60d', '90d'])
  })

  it('filters documents strictly by their own timestamps within the time range', () => {
    const filtered = filterDocumentsByTimeRange({
      documents: [
        { id: 'doc-new', box: 'box-1', path: '/new.sy', hpath: '/New', title: 'New Doc', tags: ['note'], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-target', box: 'box-1', path: '/target.sy', hpath: '/Target', title: 'Target Doc', tags: ['note'], created: '20250101120000', updated: '20250102120000' },
        { id: 'doc-old', box: 'box-1', path: '/old.sy', hpath: '/Old', title: 'Old Doc', tags: ['archive'], created: '20240101120000', updated: '20240102120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-new', sourceBlockId: 'blk-1', targetDocumentId: 'doc-target', targetBlockId: 'blk-2', content: '[[Target Doc]]', sourceUpdated: '20260310120000' },
      ],
      now,
      timeRange: '7d',
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-new'])
  })

  it('supports 3d and 60d time ranges', () => {
    const filtered = filterDocumentsByTimeRange({
      documents: [
        { id: 'doc-recent', box: 'box-1', path: '/recent.sy', hpath: '/Recent', title: 'Recent Doc', tags: ['note'], created: '20260310120000', updated: '20260310120000' },
        { id: 'doc-mid', box: 'box-1', path: '/mid.sy', hpath: '/Mid', title: 'Mid Doc', tags: ['note'], created: '20260301120000', updated: '20260301120000' },
      ],
      references: [],
      now,
      timeRange: '3d',
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-recent'])

    const extended = filterDocumentsByTimeRange({
      documents: [
        { id: 'doc-recent', box: 'box-1', path: '/recent.sy', hpath: '/Recent', title: 'Recent Doc', tags: ['note'], created: '20260310120000', updated: '20260310120000' },
        { id: 'doc-mid', box: 'box-1', path: '/mid.sy', hpath: '/Mid', title: 'Mid Doc', tags: ['note'], created: '20260301120000', updated: '20260301120000' },
      ],
      references: [],
      now,
      timeRange: '60d',
    })

    expect(extended.map(document => document.id)).toEqual(['doc-recent', 'doc-mid'])
  })

  it('keeps recently edited disconnected documents in the sample for the current local time window', () => {
    const filtered = filterDocumentsByTimeRange({
      documents: [
        { id: 'doc-local-recent', box: 'box-1', path: '/local-recent.sy', hpath: '/Local Recent', title: 'Local Recent', tags: [], created: '20260201090000', updated: '20260313213430' },
      ],
      references: [],
      now: new Date('2026-03-13T22:02:45+08:00'),
      timeRange: '7d',
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-local-recent'])
  })

  it('matches documents when any selected tag is present', () => {
    const filtered = filterDocumentsByTimeRange({
      documents: [...documents],
      references: [...references],
      now,
      timeRange: 'all',
      filters: {
        tags: ['index', 'research'],
      },
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-a', 'doc-b', 'doc-c'])
  })

  it('excludes documents under configured full paths before building the sample', () => {
    const filtered = filterDocumentsByTimeRange({
      documents: [
        { id: 'doc-keep', box: 'box-1', path: '/notes/keep.sy', hpath: '/笔记/保留', title: '保留', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-excluded', box: 'box-1', path: '/excluded/ignore.sy', hpath: '/排除区/忽略', title: '忽略', tags: [], created: '20260309120000', updated: '20260310120000' },
      ],
      references: [],
      now,
      timeRange: 'all',
      excludedPaths: '/Knowledge Base/排除区',
      notebooks: [
        { id: 'box-1', name: 'Knowledge Base' },
      ],
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-keep'])
  })

  it('excludes descendant documents recursively when their parent path is configured', () => {
    const filtered = filterDocumentsByTimeRange({
      documents: [
        { id: 'doc-keep', box: 'box-1', path: '/notes/keep.sy', hpath: '/笔记/保留', title: '保留', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-excluded-child', box: 'box-1', path: '/excluded/topic/child.sy', hpath: '/排除区/专题/子文档', title: '子文档', tags: [], created: '20260309120000', updated: '20260310120000' },
      ],
      references: [],
      now,
      timeRange: 'all',
      excludedPaths: '/Knowledge Base/排除区',
      notebooks: [
        { id: 'box-1', name: 'Knowledge Base' },
      ],
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-keep'])
  })

  it('excludes only documents whose names match the configured exclusion affixes', () => {
    const filtered = filterDocumentsByTimeRange({
      documents: [
        { id: 'doc-keep', box: 'box-1', path: '/excluded/keep.sy', hpath: '/排除区/普通文档', title: '普通文档', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-drop-prefix', box: 'box-1', path: '/excluded/prefix.sy', hpath: '/排除区/临时-草稿', title: '临时-草稿', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-drop-suffix', box: 'box-1', path: '/excluded/suffix.sy', hpath: '/排除区/记录-忽略', title: '记录-忽略', tags: [], created: '20260309120000', updated: '20260310120000' },
      ],
      references: [],
      now,
      timeRange: 'all',
      excludedPaths: '/Knowledge Base/排除区',
      excludedNamePrefixes: '临时-',
      excludedNameSuffixes: '-忽略',
      notebooks: [
        { id: 'box-1', name: 'Knowledge Base' },
      ],
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-keep'])
  })

  it('uses time range filtered documents for all panel outputs', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-new', box: 'box-1', path: '/new.sy', hpath: '/New', title: 'New Doc', tags: ['note'], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-target', box: 'box-1', path: '/target.sy', hpath: '/Target', title: 'Target Doc', tags: ['note'], created: '20260308120000', updated: '20260309120000' },
        { id: 'doc-old', box: 'box-1', path: '/old.sy', hpath: '/Old', title: 'Old Doc', tags: ['archive'], created: '20240101120000', updated: '20240102120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-new', sourceBlockId: 'blk-1', targetDocumentId: 'doc-target', targetBlockId: 'blk-2', content: '[[Target Doc]]', sourceUpdated: '20260310120000' },
      ],
      now,
      timeRange: '7d',
    })

    expect(report.summary.totalDocuments).toBe(2)
    expect(report.ranking).toEqual([])
  })

  it('excludes wiki pages from filtered samples and graph analysis when a wiki suffix is configured', () => {
    const wikiDocuments = [
      { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: ['topic'], created: '20260309120000', updated: '20260310120000' },
      { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: ['topic'], created: '20260309120000', updated: '20260310120000' },
      { id: 'doc-wiki', box: 'box-1', path: '/wiki.sy', hpath: '/Alpha-llm-wiki', title: 'Alpha-llm-wiki', tags: ['index'], created: '20260309120000', updated: '20260310120000' },
    ]
    const wikiReferences = [
      { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260310120000' },
      { id: 'ref-2', sourceDocumentId: 'doc-wiki', sourceBlockId: 'blk-w1', targetDocumentId: 'doc-a', targetBlockId: 'blk-a2', content: '[[Alpha]]', sourceUpdated: '20260310120000' },
    ]

    const filtered = filterDocumentsByTimeRange({
      documents: wikiDocuments,
      references: wikiReferences,
      now,
      timeRange: '7d',
      wikiPageSuffix: '-llm-wiki',
    })
    const report = analyzeReferenceGraph({
      documents: wikiDocuments,
      references: wikiReferences,
      now,
      timeRange: '7d',
      wikiPageSuffix: '-llm-wiki',
    })

    expect(filtered.map(document => document.id)).toEqual(['doc-a', 'doc-b'])
    expect(report.summary.totalDocuments).toBe(2)
    expect(report.ranking).toEqual([])
  })

  it('removes excluded documents and their edges from graph analysis', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-theme', box: 'box-1', path: '/topics/theme.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-source', box: 'box-1', path: '/notes/source.sy', hpath: '/笔记/来源', title: '来源', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-excluded', box: 'box-1', path: '/excluded/bridge.sy', hpath: '/排除区/桥接草稿', title: '桥接草稿', tags: [], created: '20260309120000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-source', sourceBlockId: 'blk-1', targetDocumentId: 'doc-theme', targetBlockId: 'blk-2', content: '[[主题-AI-索引]]', sourceUpdated: '20260310120000' },
        { id: 'ref-2', sourceDocumentId: 'doc-excluded', sourceBlockId: 'blk-3', targetDocumentId: 'doc-theme', targetBlockId: 'blk-4', content: '[[主题-AI-索引]]', sourceUpdated: '20260310120000' },
      ],
      now,
      timeRange: 'all',
      excludedPaths: '/Knowledge Base/排除区',
      notebooks: [
        { id: 'box-1', name: 'Knowledge Base' },
      ],
    })

    expect(report.summary.totalDocuments).toBe(2)
    expect(report.summary.totalReferences).toBe(1)
    expect(report.ranking).toEqual([])
  })

  it('aggregates ranking, communities, orphan documents, and actionable suggestions', () => {
    const report = analyzeReferenceGraph({
      documents: [...documents],
      references: [...references, ...extraRankingReferences],
      now,
      timeRange: 'all',
    })

    expect(report.summary.totalDocuments).toBe(8)
    expect(report.summary.totalReferences).toBe(14)
    expect(report.summary.orphanCount).toBe(1)
    expect(report.summary.communityCount).toBe(2)
    expect((report as any).summary.dormantCount).toBe(1)

    expect(report.ranking[0]).toMatchObject({
      documentId: 'doc-a',
      inboundReferences: 8,
      distinctSourceDocuments: 3,
      outboundReferences: 3,
      childDocumentCount: 0,
    })

    expect(report.communities.map(community => community.documentIds)).toEqual([
      ['doc-a', 'doc-b', 'doc-c'],
      ['doc-f', 'doc-g', 'doc-h'],
    ])
    expect((report.communities[0] as any).topTags).toEqual(['research', 'index', 'topic'])
    expect((report.communities[0] as any).missingTopicPage).toBe(false)
    expect((report.communities[1] as any).missingTopicPage).toBe(true)

    expect(report.bridgeDocuments.map(document => document.documentId)).toEqual(['doc-e'])
    expect((report as any).propagationNodes.slice(0, 2)).toEqual([
      expect.objectContaining({ documentId: 'doc-e' }),
      expect.objectContaining({ documentId: 'doc-f' }),
    ])
    expect((report as any).propagationNodes[0]).toMatchObject({
      documentId: 'doc-e',
      bridgeRole: true,
      pathPairCount: expect.any(Number),
      score: expect.any(Number),
    })
    expect((report as any).summary.propagationCount).toBeGreaterThan(0)
    expect(report.orphans.map(document => document.documentId)).toEqual(['doc-d'])
    expect((report as any).dormantDocuments.map((document: { documentId: string }) => document.documentId)).toEqual(['doc-d'])
    expect(report.evidenceByDocument['doc-a']).toHaveLength(8)

    expect(report.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'promote-hub', documentId: 'doc-a' }),
        expect.objectContaining({ type: 'repair-orphan', documentId: 'doc-d' }),
        expect.objectContaining({ type: 'maintain-bridge', documentId: 'doc-e' }),
        expect.objectContaining({ type: 'archive-dormant', documentId: 'doc-d' }),
      ]),
    )
  })

  it('treats documents without current-window links as orphans even if they had older links', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: ['topic'], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: ['topic'], created: '20260102090000', updated: '20260310120000' },
        { id: 'doc-c', box: 'box-1', path: '/c.sy', hpath: '/Gamma', title: 'Gamma', tags: ['archive'], created: '20260103090000', updated: '20260310120000' },
        { id: 'doc-d', box: 'box-1', path: '/d.sy', hpath: '/Delta', title: 'Delta', tags: ['archive'], created: '20260104090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-old-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-c', targetBlockId: 'blk-c1', content: '[[Gamma]]', sourceUpdated: '20260105090000' },
        { id: 'ref-old-2', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b1', targetDocumentId: 'doc-a', targetBlockId: 'blk-a2', content: '[[Alpha]]', sourceUpdated: '20260106090000' },
      ],
      now,
      timeRange: '7d',
    })

    expect(report.orphans.map(document => document.documentId)).toEqual(['doc-a', 'doc-b', 'doc-c', 'doc-d'])

    expect(report.summary.sparseEvidenceCount).toBe(3)
  })

  it('localizes orphan suggestion reasons to Chinese when the workspace locale is zh_CN', () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const report = analyzeReferenceGraph({
      documents: [...documents],
      references: [...references],
      now,
      timeRange: 'all',
    })

    expect(report.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'repair-orphan',
        documentId: 'doc-d',
        reason: '当前窗口内没有有效的文档级连接',
      }),
    ]))
  })

  it('deduplicates inbound and outbound counts by document pairs', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: [], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: [], created: '20260102090000', updated: '20260310120000' },
        { id: 'doc-c', box: 'box-1', path: '/c.sy', hpath: '/Gamma', title: 'Gamma', tags: [], created: '20260103090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260310120000' },
        { id: 'ref-2', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a2', targetDocumentId: 'doc-b', targetBlockId: 'blk-b2', content: '[[Beta]]', sourceUpdated: '20260310130000' },
        { id: 'ref-3', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a3', targetDocumentId: 'doc-c', targetBlockId: 'blk-c1', content: '[[Gamma]]', sourceUpdated: '20260310140000' },
        { id: 'ref-4', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b3', targetDocumentId: 'doc-a', targetBlockId: 'blk-a4', content: '[[Alpha]]', sourceUpdated: '20260310150000' },
        { id: 'ref-5', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c2', targetDocumentId: 'doc-a', targetBlockId: 'blk-a5', content: '[[Alpha]]', sourceUpdated: '20260310160000' },
        { id: 'ref-6', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a6', targetDocumentId: 'doc-b', targetBlockId: 'blk-b4', content: '[[Beta]]', sourceUpdated: '20260310170000' },
        { id: 'ref-7', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a7', targetDocumentId: 'doc-c', targetBlockId: 'blk-c3', content: '[[Gamma]]', sourceUpdated: '20260310180000' },
        { id: 'ref-8', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a8', targetDocumentId: 'doc-c', targetBlockId: 'blk-c4', content: '[[Gamma]]', sourceUpdated: '20260310190000' },
        { id: 'ref-9', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b5', targetDocumentId: 'doc-a', targetBlockId: 'blk-a9', content: '[[Alpha]]', sourceUpdated: '20260310200000' },
        { id: 'ref-10', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b6', targetDocumentId: 'doc-c', targetBlockId: 'blk-c5', content: '[[Gamma]]', sourceUpdated: '20260310210000' },
        { id: 'ref-11', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b7', targetDocumentId: 'doc-c', targetBlockId: 'blk-c6', content: '[[Gamma]]', sourceUpdated: '20260310220000' },
        { id: 'ref-12', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c7', targetDocumentId: 'doc-b', targetBlockId: 'blk-b8', content: '[[Beta]]', sourceUpdated: '20260310230000' },
        { id: 'ref-13', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c8', targetDocumentId: 'doc-a', targetBlockId: 'blk-a10', content: '[[Alpha]]', sourceUpdated: '20260311000000' },
        { id: 'ref-14', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c9', targetDocumentId: 'doc-a', targetBlockId: 'blk-a11', content: '[[Alpha]]', sourceUpdated: '20260311010000' },
        { id: 'ref-15', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c10', targetDocumentId: 'doc-a', targetBlockId: 'blk-a12', content: '[[Alpha]]', sourceUpdated: '20260311020000' },
        { id: 'ref-16', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a13', targetDocumentId: 'doc-c', targetBlockId: 'blk-c11', content: '[[Gamma]]', sourceUpdated: '20260311030000' },
        { id: 'ref-17', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c12', targetDocumentId: 'doc-b', targetBlockId: 'blk-b9', content: '[[Beta]]', sourceUpdated: '20260311040000' },
        { id: 'ref-18', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b10', targetDocumentId: 'doc-a', targetBlockId: 'blk-a14', content: '[[Alpha]]', sourceUpdated: '20260311050000' },
      ],
      now,
      timeRange: 'all',
    })

    const docA = report.ranking.find(item => item.documentId === 'doc-a')
    const docB = report.ranking.find(item => item.documentId === 'doc-b')
    const docC = report.ranking.find(item => item.documentId === 'doc-c')

    // doc-a: 7 raw inbound, 2 distinct outbound targets (doc-b, doc-c)
    expect(docA?.inboundReferences).toBe(7)
    expect(docA?.outboundReferences).toBe(2)
    expect(docA?.distinctSourceDocuments).toBe(2)
    // doc-b: 5 raw inbound, 2 distinct outbound targets (doc-a, doc-c)
    expect(docB?.inboundReferences).toBe(5)
    expect(docB?.distinctSourceDocuments).toBe(2)
    expect(docB?.outboundReferences).toBe(2)
    // doc-c: 6 raw inbound, 2 distinct outbound targets (doc-a, doc-b)
    expect(docC?.inboundReferences).toBe(6)
    expect(docC?.distinctSourceDocuments).toBe(2)
    expect(docC?.outboundReferences).toBe(2)
  })

  it('deduplicates historical inbound and outbound counts for dormant evidence', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: [], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: [], created: '20260102090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-old-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260105090000' },
        { id: 'ref-old-2', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a2', targetDocumentId: 'doc-b', targetBlockId: 'blk-b2', content: '[[Beta]]', sourceUpdated: '20260105093000' },
      ],
      now,
      timeRange: '7d',
      dormantDays: 0,
    })

    const dormantBeta = report.dormantDocuments.find(item => item.documentId === 'doc-b')
    expect(dormantBeta?.historicalReferenceCount).toBe(1)
  })

  it('counts child documents by path hierarchy', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-parent', box: 'box-1', path: '/parent.sy', hpath: '/Parent', title: 'Parent', tags: [], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-child-1', box: 'box-1', path: '/parent/child1.sy', hpath: '/Parent/Child1', title: 'Child1', tags: [], created: '20260102090000', updated: '20260310120000' },
        { id: 'doc-child-2', box: 'box-1', path: '/parent/child2.sy', hpath: '/Parent/Child2', title: 'Child2', tags: [], created: '20260103090000', updated: '20260310120000' },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `doc-child-extra-${i}`, box: 'box-1', path: `/parent/extra${i}.sy`, hpath: `/Parent/Extra${i}`, title: `Extra${i}`, tags: [] as string[], created: '20260103090000', updated: '20260310120000',
        })),
        { id: 'doc-grandchild', box: 'box-1', path: '/parent/child1/grandchild.sy', hpath: '/Parent/Child1/Grandchild', title: 'Grandchild', tags: [], created: '20260104090000', updated: '20260310120000' },
        ...Array.from({ length: 9 }, (_, i) => ({
          id: `doc-grandchild-extra-${i}`, box: 'box-1', path: `/parent/child1/gc${i}.sy`, hpath: `/Parent/Child1/GC${i}`, title: `GC${i}`, tags: [] as string[], created: '20260104090000', updated: '20260310120000',
        })),
        { id: 'doc-unrelated', box: 'box-1', path: '/other.sy', hpath: '/Other', title: 'Other', tags: [], created: '20260105090000', updated: '20260310120000' },
      ],
      references: [],
      now,
      timeRange: 'all',
    })

    const parent = report.ranking.find(item => item.documentId === 'doc-parent')
    const child1 = report.ranking.find(item => item.documentId === 'doc-child-1')
    const unrelated = report.ranking.find(item => item.documentId === 'doc-unrelated')

    // Parent has 20 descendant children (all paths starting with /parent/)
    expect(parent?.childDocumentCount).toBe(20)
    // Child1 has 10 direct children: grandchild + 9 extras (all paths starting with /parent/child1/)
    expect(child1?.childDocumentCount).toBe(10)
    // Unrelated has no children
    expect(unrelated).toBeUndefined()
  })

  it('ranks by unified connection score: distinct source docs + outbound refs + child docs', () => {
    const docs = [
      { id: 'doc-hub', box: 'box-1', path: '/hub.sy', hpath: '/Hub', title: 'Hub', tags: [] as string[], created: '20260101090000', updated: '20260310120000' },
      { id: 'doc-source', box: 'box-1', path: '/source.sy', hpath: '/Source', title: 'Source', tags: [] as string[], created: '20260102090000', updated: '20260310120000' },
      { id: 'doc-parent', box: 'box-1', path: '/parent.sy', hpath: '/Parent', title: 'Parent', tags: [] as string[], created: '20260103090000', updated: '20260310120000' },
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `doc-child-${i}`, box: 'box-1', path: `/parent/c${i}.sy`, hpath: `/Parent/C${i}`, title: `Child${i}`, tags: [] as string[], created: '20260104090000', updated: '20260310120000',
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `doc-src-${i}`, box: 'box-1', path: `/src/s${i}.sy`, hpath: `/Src/S${i}`, title: `Src${i}`, tags: [] as string[], created: '20260105090000', updated: '20260310120000',
      })),
    ]
    const refs = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `ref-src-hub-${i}`, sourceDocumentId: `doc-src-${i}`, sourceBlockId: `blk-sh-${i}`, targetDocumentId: 'doc-hub', targetBlockId: 'blk-hub', content: '[[Hub]]', sourceUpdated: '20260310120000',
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `ref-source-out-${i}`, sourceDocumentId: 'doc-source', sourceBlockId: `blk-so-${i}`, targetDocumentId: `doc-src-${i}`, targetBlockId: `blk-st-${i}`, content: '[[Src]]', sourceUpdated: '20260310120000',
      })),
    ]
    const report = analyzeReferenceGraph({
      documents: docs,
      references: refs,
      now,
      timeRange: 'all',
    })

    const hub = report.ranking.find(item => item.documentId === 'doc-hub')!
    const parent = report.ranking.find(item => item.documentId === 'doc-parent')!
    const source = report.ranking.find(item => item.documentId === 'doc-source')!

    // Hub: 10 distinct source docs + 0 outbound + 0 children = score 10
    expect(hub.distinctSourceDocuments).toBe(10)
    expect(hub.outboundReferences).toBe(0)
    // Parent: 0 distinct source docs + 0 outbound + 10 children = score 10
    expect(parent.childDocumentCount).toBe(10)
    // Source: 0 distinct source docs + 10 outbound + 0 children = score 10
    expect(source.outboundReferences).toBe(10)

    // All three have score 10; tiebreaker is inbound references:
    // Hub (10 inbound) > Source (0 inbound, newer) > Parent (0 inbound, older)
    expect(report.ranking[0].documentId).toBe('doc-hub')
  })

  it('includes outbound-only documents in ranking even with zero inbound refs', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-outbound-only', box: 'box-1', path: '/out.sy', hpath: '/Outbound', title: 'Outbound Only', tags: [], created: '20260101090000', updated: '20260310120000' },
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `doc-target-${i}`, box: 'box-1', path: `/target${i}.sy`, hpath: `/Target${i}`, title: `Target${i}`, tags: [] as string[], created: '20260102090000', updated: '20260310120000',
        })),
      ],
      references: Array.from({ length: 10 }, (_, i) => ({
        id: `ref-${i}`, sourceDocumentId: 'doc-outbound-only', sourceBlockId: `blk-${i}`, targetDocumentId: `doc-target-${i}`, targetBlockId: `blk-t-${i}`, content: `[[Target${i}]]`, sourceUpdated: '20260310120000',
      })),
      now,
      timeRange: 'all',
    })

    const outboundOnly = report.ranking.find(item => item.documentId === 'doc-outbound-only')
    expect(outboundOnly).toBeDefined()
    expect(outboundOnly?.outboundReferences).toBe(10)
    expect(outboundOnly?.inboundReferences).toBe(0)
  })

  it('does not count cross-notebook documents as children', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-parent', box: 'box-1', path: '/parent.sy', hpath: '/Parent', title: 'Parent', tags: [], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-other-box-child', box: 'box-2', path: '/parent/child.sy', hpath: '/Parent/Child', title: 'CrossBoxChild', tags: [], created: '20260102090000', updated: '20260310120000' },
      ],
      references: [],
      now,
      timeRange: 'all',
    })

    const parent = report.ranking.find(item => item.documentId === 'doc-parent')
    expect(parent).toBeUndefined()
  })
})

describe('analyzeTrends', () => {
  it('filters communities to the time range document sample', () => {
    const trends = analyzeTrends({
      documents: [
        { id: 'doc-new', box: 'box-1', path: '/new.sy', hpath: '/New', title: 'New Doc', tags: ['note'], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-target', box: 'box-1', path: '/target.sy', hpath: '/Target', title: 'Target Doc', tags: ['note'], created: '20260308120000', updated: '20260309120000' },
        { id: 'doc-old', box: 'box-1', path: '/old.sy', hpath: '/Old', title: 'Old Doc', tags: ['archive'], created: '20240101120000', updated: '20240102120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-new', sourceBlockId: 'blk-1', targetDocumentId: 'doc-target', targetBlockId: 'blk-2', content: '[[Target Doc]]', sourceUpdated: '20260310120000' },
      ],
      now,
      days: 7,
      timeRange: '7d',
    })

    expect(trends.communityTrends).toEqual([
      expect.objectContaining({
        documentIds: ['doc-new', 'doc-target'],
      }),
    ])
  })

  it('excludes documents only active in the previous window', () => {
    const trends = analyzeTrends({
      documents: [
        { id: 'doc-old', box: 'box-1', path: '/old.sy', hpath: '/Old', title: 'Old Doc', tags: ['archive'], created: '20240101120000', updated: '20240102120000' },
        { id: 'doc-target', box: 'box-1', path: '/target.sy', hpath: '/Target', title: 'Target Doc', tags: ['archive'], created: '20240101120000', updated: '20240102120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-old', sourceBlockId: 'blk-1', targetDocumentId: 'doc-target', targetBlockId: 'blk-2', content: '[[Target Doc]]', sourceUpdated: '20260302120000' },
      ],
      now,
      days: 7,
      timeRange: '7d',
    })

    expect(trends.fallingDocuments).toEqual([])
    expect(trends.risingDocuments).toEqual([])
  })

  it('compares the current window with the previous window and highlights rising documents', () => {
    const trends = analyzeTrends({
      documents: [...documents],
      references: [...references],
      now,
      days: 7,
      timeRange: '7d',
    })

    expect(trends.current.referenceCount).toBe(9)
    expect(trends.previous.referenceCount).toBe(0)
    expect(trends.risingDocuments[0]).toMatchObject({
      documentId: 'doc-a',
      delta: 3,
      currentReferences: 3,
      previousReferences: 0,
    })
    expect(trends.fallingDocuments).toEqual([])
    expect((trends as any).connectionChanges).toMatchObject({
      newCount: 8,
      brokenCount: 0,
    })
    expect((trends as any).communityTrends[0]).toMatchObject({
      documentIds: ['doc-a', 'doc-b', 'doc-c'],
      delta: 4,
    })
  })

  it('excludes wiki pages from trend samples when a wiki suffix is configured', () => {
    const trends = analyzeTrends({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-wiki', box: 'box-1', path: '/wiki.sy', hpath: '/Alpha-llm-wiki', title: 'Alpha-llm-wiki', tags: [], created: '20260309120000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260310120000' },
        { id: 'ref-2', sourceDocumentId: 'doc-wiki', sourceBlockId: 'blk-w1', targetDocumentId: 'doc-a', targetBlockId: 'blk-a2', content: '[[Alpha]]', sourceUpdated: '20260310120000' },
      ],
      now,
      days: 7,
      timeRange: '7d',
      wikiPageSuffix: '-llm-wiki',
    })

    expect(trends.current.referenceCount).toBe(1)
    expect(trends.risingDocuments.map(item => item.documentId)).toEqual(['doc-b'])
  })

  it('excludes matching documents from trend samples', () => {
    const trends = analyzeTrends({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/notes/a.sy', hpath: '/笔记/A', title: 'A', tags: [], created: '20260309120000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/excluded/b.sy', hpath: '/排除区/B', title: 'B', tags: [], created: '20260309120000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[B]]', sourceUpdated: '20260310120000' },
      ],
      now,
      days: 7,
      timeRange: 'all',
      excludedPaths: '/Knowledge Base/排除区',
      notebooks: [
        { id: 'box-1', name: 'Knowledge Base' },
      ],
    })

    expect(trends.current.referenceCount).toBe(0)
    expect(trends.risingDocuments).toEqual([])
  })

  it('deduplicates trend counts by document pairs', () => {
    const trends = analyzeTrends({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: [], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: [], created: '20260102090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260310120000' },
        { id: 'ref-2', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a2', targetDocumentId: 'doc-b', targetBlockId: 'blk-b2', content: '[[Beta]]', sourceUpdated: '20260310130000' },
      ],
      now,
      days: 7,
      timeRange: '7d',
    })

    expect(trends.current.referenceCount).toBe(1)
    expect(trends.risingDocuments[0]).toMatchObject({
      documentId: 'doc-b',
      currentReferences: 1,
      previousReferences: 0,
      delta: 1,
    })
  })
})

describe('findReferencePath', () => {
  it('returns the shortest document path through the aggregated network', () => {
    const path = findReferencePath({
      documents: [...documents],
      references: [...references],
      fromDocumentId: 'doc-c',
      toDocumentId: 'doc-g',
      maxDepth: 5,
    })

    expect(path).toEqual(['doc-c', 'doc-a', 'doc-e', 'doc-f', 'doc-g'])
  })

  it('respects time range when building paths', () => {
    const path = findReferencePath({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: [], created: '20240101090000', updated: '20240102120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: [], created: '20240101090000', updated: '20240102120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20240102120000' },
      ],
      fromDocumentId: 'doc-a',
      toDocumentId: 'doc-b',
      maxDepth: 4,
      now,
      timeRange: '7d',
    })

    expect(path).toEqual([])
  })
})
