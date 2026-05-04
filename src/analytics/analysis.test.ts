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
  { id: 'doc-d', box: 'box-1', path: '/d.sy', hpath: '/Delta', title: 'Delta Archive', tags: ['archive'], created: '20260101090000', updated: '20260115120000' },
  { id: 'doc-e', box: 'box-2', path: '/e.sy', hpath: '/Bridge', title: 'Bridge Map', tags: ['bridge'], created: '20260204090000', updated: '20260308120000' },
  { id: 'doc-f', box: 'box-2', path: '/f.sy', hpath: '/Focus', title: 'Focus Project', tags: ['project'], created: '20260205090000', updated: '20260301120000' },
  { id: 'doc-g', box: 'box-2', path: '/g.sy', hpath: '/Garden', title: 'Garden Topic', tags: ['project'], created: '20260206090000', updated: '20260310120000' },
  { id: 'doc-h', box: 'box-2', path: '/h.sy', hpath: '/History', title: 'History Review', tags: ['review'], created: '20260207090000', updated: '20260228120000' },
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
  { id: 'ref-9', sourceDocumentId: 'doc-h', sourceBlockId: 'blk-h1', targetDocumentId: 'doc-g', targetBlockId: 'blk-g1', content: '[[Garden Topic]]', sourceUpdated: '20260228120000' },
] as const

describe('analyzeReferenceGraph', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('exposes supported time range options', () => {
    expect(TIME_RANGE_OPTIONS).toEqual(['all', '3d', '7d', '30d', '60d', '90d'])
  })

  it('filters documents by time range while keeping active references', () => {
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

    expect(filtered.map(document => document.id)).toEqual(['doc-new', 'doc-target'])
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
        { id: 'doc-target', box: 'box-1', path: '/target.sy', hpath: '/Target', title: 'Target Doc', tags: ['note'], created: '20250101120000', updated: '20250102120000' },
        { id: 'doc-old', box: 'box-1', path: '/old.sy', hpath: '/Old', title: 'Old Doc', tags: ['archive'], created: '20240101120000', updated: '20240102120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-new', sourceBlockId: 'blk-1', targetDocumentId: 'doc-target', targetBlockId: 'blk-2', content: '[[Target Doc]]', sourceUpdated: '20260310120000' },
      ],
      now,
      timeRange: '7d',
    })

    expect(report.summary.totalDocuments).toBe(2)
    expect(report.ranking.map(item => item.documentId)).toEqual(['doc-target', 'doc-new'])
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
    expect(report.ranking.map(item => item.documentId)).toEqual(['doc-b', 'doc-a'])
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
    expect(report.ranking.map(item => item.documentId)).toEqual(['doc-theme', 'doc-source'])
  })

  it('aggregates ranking, communities, orphan documents, and actionable suggestions', () => {
    const report = analyzeReferenceGraph({
      documents: [...documents],
      references: [...references],
      now,
      timeRange: 'all',
    })

    expect(report.summary.totalDocuments).toBe(8)
    expect(report.summary.totalReferences).toBe(9)
    expect(report.summary.orphanCount).toBe(1)
    expect(report.summary.communityCount).toBe(2)
    expect((report as any).summary.dormantCount).toBe(1)

    expect(report.ranking[0]).toMatchObject({
      documentId: 'doc-b',
      inboundReferences: 2,
      distinctSourceDocuments: 2,
      outboundReferences: 2,
      childDocumentCount: 0,
      lastActiveAt: '20260309120000',
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
    expect(report.evidenceByDocument['doc-a']).toHaveLength(3)

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
      ],
      now,
      timeRange: 'all',
    })

    const docA = report.ranking.find(item => item.documentId === 'doc-a')
    const docB = report.ranking.find(item => item.documentId === 'doc-b')
    const docC = report.ranking.find(item => item.documentId === 'doc-c')

    expect(docA?.inboundReferences).toBe(2)
    expect(docA?.outboundReferences).toBe(2)
    expect(docB?.inboundReferences).toBe(2)
    expect(docB?.distinctSourceDocuments).toBe(1)
    expect(docB?.outboundReferences).toBe(1)
    expect(docC?.inboundReferences).toBe(1)
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
        { id: 'doc-grandchild', box: 'box-1', path: '/parent/child1/grandchild.sy', hpath: '/Parent/Child1/Grandchild', title: 'Grandchild', tags: [], created: '20260104090000', updated: '20260310120000' },
        { id: 'doc-unrelated', box: 'box-1', path: '/other.sy', hpath: '/Other', title: 'Other', tags: [], created: '20260105090000', updated: '20260310120000' },
      ],
      references: [],
      now,
      timeRange: 'all',
    })

    const parent = report.ranking.find(item => item.documentId === 'doc-parent')
    const child1 = report.ranking.find(item => item.documentId === 'doc-child-1')
    const unrelated = report.ranking.find(item => item.documentId === 'doc-unrelated')

    // Parent has 3 direct children: child1, child2, grandchild
    expect(parent?.childDocumentCount).toBe(3)
    // Child1 has 1 direct child: grandchild
    expect(child1?.childDocumentCount).toBe(1)
    // Unrelated has no children
    expect(unrelated).toBeUndefined()
  })

  it('ranks by unified connection score: distinct source docs + outbound refs + child docs', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-hub', box: 'box-1', path: '/hub.sy', hpath: '/Hub', title: 'Hub', tags: [], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-source', box: 'box-1', path: '/source.sy', hpath: '/Source', title: 'Source', tags: [], created: '20260102090000', updated: '20260310120000' },
        { id: 'doc-parent', box: 'box-1', path: '/parent.sy', hpath: '/Parent', title: 'Parent', tags: [], created: '20260103090000', updated: '20260310120000' },
        { id: 'doc-child-a', box: 'box-1', path: '/parent/a.sy', hpath: '/Parent/A', title: 'ChildA', tags: [], created: '20260104090000', updated: '20260310120000' },
        { id: 'doc-child-b', box: 'box-1', path: '/parent/b.sy', hpath: '/Parent/B', title: 'ChildB', tags: [], created: '20260105090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-source', sourceBlockId: 'blk-1', targetDocumentId: 'doc-hub', targetBlockId: 'blk-2', content: '[[Hub]]', sourceUpdated: '20260310120000' },
      ],
      now,
      timeRange: 'all',
    })

    const hub = report.ranking.find(item => item.documentId === 'doc-hub')!
    const parent = report.ranking.find(item => item.documentId === 'doc-parent')!
    const source = report.ranking.find(item => item.documentId === 'doc-source')!

    // Hub: 1 distinct source doc + 0 outbound + 0 children = score 1
    expect(hub.distinctSourceDocuments + hub.outboundReferences + hub.childDocumentCount).toBe(1)
    // Parent: 0 distinct source docs + 0 outbound + 2 children = score 2
    expect(parent.distinctSourceDocuments + parent.outboundReferences + parent.childDocumentCount).toBe(2)
    // Source: 0 distinct source docs + 1 outbound + 0 children = score 1
    expect(source.distinctSourceDocuments + source.outboundReferences + source.childDocumentCount).toBe(1)

    // Parent (score 2) > Hub (score 1, but has inbound tiebreaker) >= Source (score 1)
    expect(report.ranking[0].documentId).toBe('doc-parent')
  })

  it('includes outbound-only documents in ranking even with zero inbound refs', () => {
    const report = analyzeReferenceGraph({
      documents: [
        { id: 'doc-outbound-only', box: 'box-1', path: '/out.sy', hpath: '/Outbound', title: 'Outbound Only', tags: [], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-target', box: 'box-1', path: '/target.sy', hpath: '/Target', title: 'Target', tags: [], created: '20260102090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-outbound-only', sourceBlockId: 'blk-1', targetDocumentId: 'doc-target', targetBlockId: 'blk-2', content: '[[Target]]', sourceUpdated: '20260310120000' },
      ],
      now,
      timeRange: 'all',
    })

    const outboundOnly = report.ranking.find(item => item.documentId === 'doc-outbound-only')
    expect(outboundOnly).toBeDefined()
    expect(outboundOnly?.outboundReferences).toBe(1)
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
        { id: 'doc-target', box: 'box-1', path: '/target.sy', hpath: '/Target', title: 'Target Doc', tags: ['note'], created: '20250101120000', updated: '20250102120000' },
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

    expect(trends.current.referenceCount).toBe(8)
    expect(trends.previous.referenceCount).toBe(0)
    expect(trends.risingDocuments[0]).toMatchObject({
      documentId: 'doc-a',
      delta: 3,
      currentReferences: 3,
      previousReferences: 0,
    })
    expect(trends.fallingDocuments).toEqual([])
    expect((trends as any).connectionChanges).toMatchObject({
      newCount: 7,
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
