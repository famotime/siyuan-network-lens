import { describe, expect, it } from 'vitest'

import { buildPanelCounts } from './panel-counts'

describe('buildPanelCounts', () => {
  it('returns counts without evidence panel', () => {
    const counts = buildPanelCounts({
      report: {
        summary: {
          totalDocuments: 0,
          analyzedDocuments: 0,
          totalReferences: 0,
          orphanCount: 0,
          communityCount: 0,
          dormantCount: 0,
          sparseEvidenceCount: 0,
          propagationCount: 0,
        },
        ranking: [],
        communities: [],
        bridgeDocuments: [],
        orphans: [],
        dormantDocuments: [],
        propagationNodes: [],
        suggestions: [],
        evidenceByDocument: {},
      } as any,
      trends: null,
      pathChain: [],
    })

    expect(Object.keys(counts).sort()).toEqual([
      'communities',
      'orphanBridge',
      'propagation',
      'ranking',
      'suggestions',
      'trends',
    ])
  })

  it('counts visible documents per panel with panel limits', () => {
    const report = {
      summary: {
        totalDocuments: 0,
        analyzedDocuments: 0,
        totalReferences: 0,
        orphanCount: 0,
        communityCount: 0,
        dormantCount: 0,
        sparseEvidenceCount: 0,
        propagationCount: 0,
      },
      ranking: Array.from({ length: 15 }, (_, index) => ({
        documentId: `doc-r-${index}`,
        title: `Rank ${index}`,
        inboundReferences: 1,
        distinctSourceDocuments: 1,
        outboundReferences: 0,
        lastActiveAt: '20260310120000',
      })),
      communities: [
        { id: 'c-1', documentIds: ['doc-a', 'doc-b'], size: 2, hubDocumentIds: [], topTags: [], notebookIds: [], missingTopicPage: false },
        { id: 'c-2', documentIds: ['doc-b', 'doc-c'], size: 2, hubDocumentIds: [], topTags: [], notebookIds: [], missingTopicPage: false },
      ],
      bridgeDocuments: [
        { documentId: 'doc-bridge', title: 'Bridge', degree: 2 },
      ],
      orphans: [
        { documentId: 'doc-orphan', title: 'Orphan', degree: 0, createdAt: '20260301090000', updatedAt: '20260301120000', historicalReferenceCount: 0, lastHistoricalAt: '', hasSparseEvidence: false },
      ],
      dormantDocuments: [
        { documentId: 'doc-orphan', title: 'Orphan', degree: 0, createdAt: '20260301090000', updatedAt: '20260301120000', historicalReferenceCount: 0, lastHistoricalAt: '', hasSparseEvidence: false, inactivityDays: 10, lastConnectedAt: '' },
        { documentId: 'doc-dormant', title: 'Dormant', degree: 0, createdAt: '20260301090000', updatedAt: '20260301120000', historicalReferenceCount: 0, lastHistoricalAt: '', hasSparseEvidence: false, inactivityDays: 15, lastConnectedAt: '' },
      ],
      propagationNodes: Array.from({ length: 9 }, (_, index) => ({
        documentId: `doc-p-${index}`,
        title: `Propagation ${index}`,
        degree: 1,
        score: 2,
        pathPairCount: 2,
        focusDocumentCount: 2,
        communitySpan: 1,
        bridgeRole: false,
      })),
      suggestions: [
        { type: 'promote-hub', documentId: 'doc-a', title: 'A', reason: 'Reason' },
        { type: 'repair-orphan', documentId: 'doc-a', title: 'A', reason: 'Reason' },
        { type: 'maintain-bridge', documentId: 'doc-c', title: 'C', reason: 'Reason' },
      ],
      evidenceByDocument: {},
    } as any

    const trends = {
      current: { referenceCount: 0 },
      previous: { referenceCount: 0 },
      risingDocuments: Array.from({ length: 6 }, (_, index) => ({
        documentId: `doc-rise-${index}`,
        title: `Rise ${index}`,
        delta: 2,
        currentReferences: 2,
        previousReferences: 0,
      })),
      fallingDocuments: Array.from({ length: 7 }, (_, index) => ({
        documentId: `doc-fall-${index}`,
        title: `Fall ${index}`,
        delta: -1,
        currentReferences: 0,
        previousReferences: 1,
      })),
      connectionChanges: {
        newCount: 0,
        brokenCount: 0,
        newEdges: [],
        brokenEdges: [],
      },
      communityTrends: [],
      risingCommunities: [],
      dormantCommunities: [],
    } as any

    const counts = buildPanelCounts({
      report,
      trends,
      pathChain: ['doc-a', 'doc-b', 'doc-c', 'doc-d'],
    })

    expect(counts.ranking).toBe(12)
    expect(counts.suggestions).toBe(2)
    expect(counts.communities).toBe(3)
    expect(counts.orphanBridge).toBe(3)
    expect(counts.trends).toBe(10)
    expect(counts.propagation).toBe(8)
  })
})
