import { describe, expect, it } from 'vitest'

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
    expect(report.ranking.map(item => item.documentId)).toEqual(['doc-target'])
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
      documentId: 'doc-a',
      inboundReferences: 3,
      distinctSourceDocuments: 3,
      lastActiveAt: '20260310120000',
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
    expect(docB?.inboundReferences).toBe(1)
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
