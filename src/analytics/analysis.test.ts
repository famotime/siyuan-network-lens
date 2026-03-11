import { describe, expect, it } from 'vitest'

import {
  analyzeReferenceGraph,
  analyzeTrends,
  findReferencePath,
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

    expect(report.bridgeDocuments.map(document => document.documentId)).toEqual(['doc-e'])
    expect(report.orphans.map(document => document.documentId)).toEqual(['doc-d'])
    expect(report.evidenceByDocument['doc-a']).toHaveLength(3)

    expect(report.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'promote-hub', documentId: 'doc-a' }),
        expect.objectContaining({ type: 'repair-orphan', documentId: 'doc-d' }),
        expect.objectContaining({ type: 'maintain-bridge', documentId: 'doc-e' }),
      ]),
    )
  })
})

describe('analyzeTrends', () => {
  it('compares the current window with the previous window and highlights rising documents', () => {
    const trends = analyzeTrends({
      documents: [...documents],
      references: [...references],
      now,
      days: 7,
    })

    expect(trends.current.referenceCount).toBe(8)
    expect(trends.previous.referenceCount).toBe(1)
    expect(trends.risingDocuments[0]).toMatchObject({
      documentId: 'doc-a',
      delta: 3,
      currentReferences: 3,
      previousReferences: 0,
    })
    expect(trends.fallingDocuments[0]).toMatchObject({
      documentId: 'doc-g',
      delta: -1,
      currentReferences: 0,
      previousReferences: 1,
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
})
