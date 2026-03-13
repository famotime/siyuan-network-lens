import { describe, expect, it } from 'vitest'

import { buildSummaryCards, buildSummaryDetailSections } from './summary-details'

const now = new Date('2026-03-12T00:00:00Z')

const documents = [
  { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: ['index'], created: '20260301090000', updated: '20260311120000' },
  { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: ['topic'], created: '20260302090000', updated: '20260310120000' },
  { id: 'doc-c', box: 'box-1', path: '/c.sy', hpath: '/Gamma', title: 'Gamma', tags: ['archive'], created: '20260303090000', updated: '20260301120000' },
] as const

const references = [
  { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a', targetDocumentId: 'doc-b', targetBlockId: 'blk-b', content: '[[Beta]]', sourceUpdated: '20260311120000' },
] as const

const report = {
  summary: {
    totalDocuments: 3,
    analyzedDocuments: 3,
    totalReferences: 1,
    orphanCount: 1,
    communityCount: 1,
    dormantCount: 1,
    sparseEvidenceCount: 0,
    propagationCount: 1,
  },
  ranking: [
    { documentId: 'doc-b', title: 'Beta', inboundReferences: 1, distinctSourceDocuments: 1, outboundReferences: 0, lastActiveAt: '20260311120000' },
  ],
  communities: [
    { id: 'community-doc-a', documentIds: ['doc-a', 'doc-b'], size: 2, hubDocumentIds: ['doc-a'], topTags: ['index', 'topic'], notebookIds: ['box-1'], missingTopicPage: false },
  ],
  bridgeDocuments: [
    { documentId: 'doc-a', title: 'Alpha', degree: 1 },
  ],
  orphans: [
    { documentId: 'doc-c', title: 'Gamma', degree: 0, createdAt: '20260303090000', updatedAt: '20260301120000', historicalReferenceCount: 0, lastHistoricalAt: '', hasSparseEvidence: false },
  ],
  dormantDocuments: [
    { documentId: 'doc-c', title: 'Gamma', degree: 0, createdAt: '20260303090000', updatedAt: '20260301120000', historicalReferenceCount: 0, lastHistoricalAt: '', hasSparseEvidence: false, inactivityDays: 11, lastConnectedAt: '' },
  ],
  propagationNodes: [
    { documentId: 'doc-a', title: 'Alpha', degree: 1, score: 2, pathPairCount: 2, focusDocumentCount: 2, communitySpan: 1, bridgeRole: true },
  ],
  suggestions: [],
  evidenceByDocument: {},
} as const

const trends = {
  current: { referenceCount: 2 },
  previous: { referenceCount: 1 },
  risingDocuments: [
    { documentId: 'doc-a', title: 'Alpha', currentReferences: 2, previousReferences: 0, delta: 2 },
  ],
  fallingDocuments: [
    { documentId: 'doc-b', title: 'Beta', currentReferences: 0, previousReferences: 1, delta: -1 },
  ],
  connectionChanges: {
    newCount: 1,
    brokenCount: 0,
    newEdges: [],
    brokenEdges: [],
  },
  communityTrends: [],
  risingCommunities: [],
  dormantCommunities: [],
} as const

describe('buildSummaryDetailSections', () => {
  it('builds active relationship details from current-window participants', () => {
    const sections = buildSummaryDetailSections({
      documents: [...documents],
      references: [...references],
      report: report as any,
      now,
      timeRange: '7d',
      dormantDays: 30,
    })

    expect(sections.references.items).toEqual([
      expect.objectContaining({ documentId: 'doc-a', badge: '1 次参与' }),
      expect.objectContaining({ documentId: 'doc-b', badge: '1 次参与' }),
    ])
  })

  it('builds card detail sections for orphan, dormant, bridge and propagation docs', () => {
    const sections = buildSummaryDetailSections({
      documents: [...documents],
      references: [...references],
      report: report as any,
      now,
      timeRange: 'all',
      trends: trends as any,
      dormantDays: 30,
    })

    expect(sections.orphans.kind).toBe('list')
    expect(sections.orphans.items).toEqual([
      expect.objectContaining({ documentId: 'doc-c', title: 'Gamma' }),
    ])
    expect(sections.dormant.items).toEqual([
      expect.objectContaining({ documentId: 'doc-c', title: 'Gamma' }),
    ])
    expect(sections.bridges.items).toEqual([
      expect.objectContaining({ documentId: 'doc-a', title: 'Alpha' }),
    ])
    expect(sections.propagation.kind).toBe('propagation')
    expect(sections.propagation.items).toEqual([
      expect.objectContaining({ documentId: 'doc-a', badge: '2 分' }),
    ])

    expect(sections.ranking.kind).toBe('ranking')
    expect(sections.suggestions.kind).toBe('suggestions')
    expect(sections.trends.kind).toBe('trends')
  })

  it('deduplicates inbound and outbound counts by document pairs', () => {
    const duplicateReferences = [
      { id: 'ref-1', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260311120000' },
      { id: 'ref-2', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a2', targetDocumentId: 'doc-b', targetBlockId: 'blk-b2', content: '[[Beta]]', sourceUpdated: '20260311130000' },
      { id: 'ref-3', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a3', targetDocumentId: 'doc-c', targetBlockId: 'blk-c1', content: '[[Gamma]]', sourceUpdated: '20260311140000' },
      { id: 'ref-4', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c2', targetDocumentId: 'doc-b', targetBlockId: 'blk-b3', content: '[[Beta]]', sourceUpdated: '20260311150000' },
      { id: 'ref-5', sourceDocumentId: 'doc-c', sourceBlockId: 'blk-c3', targetDocumentId: 'doc-b', targetBlockId: 'blk-b4', content: '[[Beta]]', sourceUpdated: '20260311160000' },
    ] as const

    const sections = buildSummaryDetailSections({
      documents: [...documents],
      references: [...duplicateReferences],
      report: report as any,
      now,
      timeRange: '7d',
      trends: trends as any,
      dormantDays: 30,
    })

    const docA = sections.references.items.find(item => item.documentId === 'doc-a')
    const docB = sections.references.items.find(item => item.documentId === 'doc-b')
    const docC = sections.references.items.find(item => item.documentId === 'doc-c')

    expect(docA?.meta).toBe('入链 0 / 出链 2')
    expect(docB?.meta).toBe('入链 2 / 出链 0')
    expect(docC?.meta).toBe('入链 1 / 出链 1')
  })
})

describe('buildSummaryCards', () => {
  it('uses provided document count when available', () => {
    const cards = buildSummaryCards({
      report: report as any,
      dormantDays: 30,
      documentCount: 2,
      trends: trends as any,
    })

    const documents = cards.find(card => card.key === 'documents')
    expect(documents?.value).toBe('2')
  })

  it('builds summary cards with tooltip hints', () => {
    const cards = buildSummaryCards({
      report: report as any,
      dormantDays: 45,
      trends: trends as any,
    })

    const dormant = cards.find(card => card.key === 'dormant')

    expect(dormant).toEqual(expect.objectContaining({
      label: '沉没文档',
      value: report.summary.dormantCount.toString(),
      hint: '超过 45 天未产生有效连接',
    }))
  })

  it('adds cards for ranking, suggestions and trends', () => {
    const cards = buildSummaryCards({
      report: report as any,
      dormantDays: 30,
      trends: trends as any,
    })

    expect(cards.find(card => card.key === 'ranking')?.value).toBe('1')
    expect(cards.find(card => card.key === 'suggestions')?.value).toBe('0')
    expect(cards.find(card => card.key === 'trends')?.value).toBe('2')
  })
})
