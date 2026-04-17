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
    readCount: 1,
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
  suggestions: [
    { type: 'promote-hub', documentId: 'doc-b', title: 'Beta', reason: 'Referenced by 2 docs, 2 times total' },
    { type: 'repair-orphan', documentId: 'doc-c', title: 'Gamma', reason: 'No doc-level links in the current window' },
    { type: 'archive-dormant', documentId: 'doc-c', title: 'Gamma', reason: 'No valid links for 11 days. Consider archiving or adding an index.' },
    { type: 'maintain-bridge', documentId: 'doc-a', title: 'Alpha', reason: 'Connected to 1 relationship; removing it would break community connectivity' },
  ],
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
      themeDocumentIds: new Set(['doc-b']),
      dormantDays: 30,
    })

    expect(sections.references.items).toEqual([
      expect.objectContaining({ documentId: 'doc-a', badge: '1 refs' }),
      expect.objectContaining({ documentId: 'doc-b', badge: '1 refs', isThemeDocument: true }),
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
      themeDocumentIds: new Set(['doc-b']),
      dormantDays: 30,
      config: {
        readTagNames: ['topic'],
        readTitlePrefixes: '',
        readTitleSuffixes: '',
      } as any,
      readCardMode: 'read',
      aiInboxResult: {
        generatedAt: '2026-03-12T08:00:00.000Z',
        summary: '今天先处理孤立补链。',
        items: [
          {
            id: 'task-doc-c',
            type: 'document',
            title: '修复孤立文档：Gamma',
            priority: 'P1',
            action: '补到主题页。',
            reason: '当前窗口内没有有效连接，可重新进入主题网络。',
            documentIds: ['doc-c'],
          },
        ],
      },
    })

    expect(sections.orphans.kind).toBe('list')
    expect(sections.orphans.items).toEqual([
      expect.objectContaining({
        documentId: 'doc-c',
        title: 'Gamma',
        suggestions: [
          expect.objectContaining({ label: 'Repair links', text: 'No doc-level links in the current window' }),
        ],
      }),
    ])
    expect(sections.dormant.items).toEqual([
      expect.objectContaining({
        documentId: 'doc-c',
        title: 'Gamma',
        suggestions: [
          expect.objectContaining({ label: 'Archive dormant', text: 'No valid links for 11 days. Consider archiving or adding an index.' }),
        ],
      }),
    ])
    expect(sections.bridges.items).toEqual([
      expect.objectContaining({
        documentId: 'doc-a',
        title: 'Alpha',
        suggestions: [
          expect.objectContaining({ label: 'Maintain bridge', text: 'Connected to 1 relationship; removing it would break community connectivity' }),
        ],
      }),
    ])
    expect(sections.propagation.kind).toBe('propagation')
    expect(sections.propagation.items).toEqual([
      expect.objectContaining({
        documentId: 'doc-a',
        badge: '2 pts',
        suggestions: [
          expect.objectContaining({ label: 'Propagation optimization' }),
        ],
      }),
    ])

    expect(sections.ranking.kind).toBe('ranking')
    expect(sections.ranking.ranking).toEqual([
      expect.objectContaining({
        documentId: 'doc-b',
        tagCount: 1,
        createdAt: '20260302090000',
        updatedAt: '20260310120000',
        isThemeDocument: true,
        suggestions: [],
      }),
    ])
    expect(sections.trends.kind).toBe('trends')
    expect(sections.todaySuggestions).toEqual(expect.objectContaining({
      key: 'todaySuggestions',
      kind: 'aiInbox',
      title: 'Today suggestions',
      description: 'Suggestions ranked by priority.',
      result: expect.objectContaining({
        summary: '今天先处理孤立补链。',
      }),
    }))
    expect((sections as Record<string, any>).read).toEqual(expect.objectContaining({
      key: 'read',
      kind: 'list',
      items: [
        expect.objectContaining({
          documentId: 'doc-b',
          title: 'Beta',
          badge: 'Tag match',
          meta: 'Tags: topic',
          isThemeDocument: true,
        }),
      ],
    }))
  })

  it('builds unread document details by default for the read card slot', () => {
    const sections = buildSummaryDetailSections({
      documents: [...documents],
      references: [...references],
      report: report as any,
      now,
      timeRange: 'all',
      themeDocumentIds: new Set(['doc-b']),
      dormantDays: 30,
      config: {
        readTagNames: ['topic'],
        readTitlePrefixes: '',
        readTitleSuffixes: '',
      } as any,
      largeDocumentMetrics: new Map([
        ['doc-c', { documentId: 'doc-c', wordCount: 500, documentBytes: 1024, assetBytes: 4 * 1024 * 1024, totalBytes: 4 * 1024 * 1024 + 1024, assetCount: 3 }],
      ]),
    })

    expect((sections as Record<string, any>).read).toEqual(expect.objectContaining({
      key: 'read',
      title: 'Unread docs',
      items: [
        expect.objectContaining({
          documentId: 'doc-a',
          badge: 'Needs review',
          meta: 'Created 2026-03-01',
          suggestions: [],
        }),
        expect.objectContaining({
          documentId: 'doc-c',
          badge: 'Needs review',
          meta: 'Created 2026-03-03',
          suggestions: [
            expect.objectContaining({ label: 'Repair links', text: 'No doc-level links in the current window' }),
            expect.objectContaining({ label: 'Clean embedded assets' }),
          ],
        }),
      ],
    }))
  })

  it('builds large document details in word mode using the text threshold and no top-10 cap', () => {
    const sections = buildSummaryDetailSections({
      documents: [
        { id: 'doc-big-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', content: '甲'.repeat(10001), created: '20260301090000', updated: '20260311120000' },
        { id: 'doc-big-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', content: '乙'.repeat(9999), created: '20260302090000', updated: '20260310120000' },
        { id: 'doc-big-c', box: 'box-1', path: '/c.sy', hpath: '/Gamma', title: 'Gamma', content: '丙'.repeat(15000), created: '20260303090000', updated: '20260309120000' },
        { id: 'doc-big-d', box: 'box-1', path: '/d.sy', hpath: '/Delta', title: 'Delta', content: '丁'.repeat(12000), created: '20260304090000', updated: '20260308120000' },
      ],
      references: [],
      report: {
        ...report,
        summary: {
          ...report.summary,
          totalDocuments: 3,
          analyzedDocuments: 3,
          totalReferences: 0,
          orphanCount: 3,
          communityCount: 0,
          dormantCount: 0,
          propagationCount: 0,
        },
        ranking: [],
        communities: [],
        bridgeDocuments: [],
        orphans: [],
        dormantDocuments: [],
        propagationNodes: [],
        suggestions: [],
      } as any,
      now,
      timeRange: 'all',
      dormantDays: 30,
      largeDocumentMetrics: new Map([
        ['doc-big-a', { documentId: 'doc-big-a', wordCount: 10001, documentBytes: 10, assetBytes: 30, totalBytes: 40, assetCount: 2 }],
        ['doc-big-b', { documentId: 'doc-big-b', wordCount: 9999, documentBytes: 50, assetBytes: 0, totalBytes: 50, assetCount: 0 }],
        ['doc-big-c', { documentId: 'doc-big-c', wordCount: 15000, documentBytes: 20, assetBytes: 5, totalBytes: 25, assetCount: 1 }],
        ['doc-big-d', { documentId: 'doc-big-d', wordCount: 12000, documentBytes: 30, assetBytes: 10, totalBytes: 40, assetCount: 1 }],
      ]),
      largeDocumentCardMode: 'words',
    })

    expect((sections as Record<string, any>).largeDocuments).toEqual(expect.objectContaining({
      key: 'largeDocuments',
      kind: 'list',
      title: 'Large docs · text',
      items: [
        expect.objectContaining({ documentId: 'doc-big-c', badge: '15000 words' }),
        expect.objectContaining({ documentId: 'doc-big-d', badge: '12000 words' }),
        expect.objectContaining({ documentId: 'doc-big-a', badge: '10001 words' }),
      ],
    }))
  })

  it('builds large document details in storage mode using the storage threshold and no top-10 cap', () => {
    const sections = buildSummaryDetailSections({
      documents: [
        { id: 'doc-big-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', content: '甲'.repeat(10001), created: '20260301090000', updated: '20260311120000' },
        { id: 'doc-big-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', content: '乙'.repeat(9999), created: '20260302090000', updated: '20260310120000' },
        { id: 'doc-big-c', box: 'box-1', path: '/c.sy', hpath: '/Gamma', title: 'Gamma', content: '丙'.repeat(15000), created: '20260303090000', updated: '20260309120000' },
        { id: 'doc-big-d', box: 'box-1', path: '/d.sy', hpath: '/Delta', title: 'Delta', content: '丁'.repeat(12000), created: '20260304090000', updated: '20260308120000' },
      ],
      references: [],
      report: {
        ...report,
        summary: {
          ...report.summary,
          totalDocuments: 3,
          analyzedDocuments: 3,
          totalReferences: 0,
          orphanCount: 3,
          communityCount: 0,
          dormantCount: 0,
          propagationCount: 0,
        },
        ranking: [],
        communities: [],
        bridgeDocuments: [],
        orphans: [],
        dormantDocuments: [],
        propagationNodes: [],
        suggestions: [],
      } as any,
      now,
      timeRange: 'all',
      dormantDays: 30,
      largeDocumentMetrics: new Map([
        ['doc-big-a', { documentId: 'doc-big-a', wordCount: 10001, documentBytes: 10, assetBytes: 4 * 1024 * 1024, totalBytes: 4 * 1024 * 1024 + 10, assetCount: 2 }],
        ['doc-big-b', { documentId: 'doc-big-b', wordCount: 9999, documentBytes: 50, assetBytes: 0, totalBytes: 50, assetCount: 0 }],
        ['doc-big-c', { documentId: 'doc-big-c', wordCount: 15000, documentBytes: 20, assetBytes: 5, totalBytes: 25, assetCount: 1 }],
        ['doc-big-d', { documentId: 'doc-big-d', wordCount: 12000, documentBytes: 2 * 1024 * 1024, assetBytes: 1024 * 1024 + 1, totalBytes: 3 * 1024 * 1024 + 1, assetCount: 1 }],
      ]),
      largeDocumentCardMode: 'storage',
    })

    expect((sections as Record<string, any>).largeDocuments).toEqual(expect.objectContaining({
      key: 'largeDocuments',
      kind: 'list',
      title: 'Large docs · assets',
      items: [
        expect.objectContaining({ documentId: 'doc-big-a', badge: '4.0 MB' }),
        expect.objectContaining({ documentId: 'doc-big-d', badge: '3.0 MB' }),
      ],
    }))
  })

  it('supports notebook-scoped read directories in read detail sections', () => {
    const sections = buildSummaryDetailSections({
      documents: [
        { id: 'doc-notebook-read', box: 'box-1', path: '/read/archive/note.sy', hpath: '/已读/归档/Notebook Read', title: 'Notebook Read', tags: [], created: '20260302090000', updated: '20260310120000' },
        { id: 'doc-other-box', box: 'box-2', path: '/read/archive/note.sy', hpath: '/已读/归档/Other Box', title: 'Other Box', tags: [], created: '20260302090000', updated: '20260310120000' },
      ],
      references: [],
      report: {
        ...report,
        summary: {
          ...report.summary,
          totalDocuments: 2,
          analyzedDocuments: 2,
          totalReferences: 0,
          orphanCount: 2,
          communityCount: 0,
          dormantCount: 0,
          propagationCount: 0,
        },
        ranking: [],
        communities: [],
        bridgeDocuments: [],
        orphans: [
          { documentId: 'doc-notebook-read', title: 'Notebook Read', degree: 0, createdAt: '20260302090000', updatedAt: '20260310120000', historicalReferenceCount: 0, lastHistoricalAt: '', hasSparseEvidence: false },
          { documentId: 'doc-other-box', title: 'Other Box', degree: 0, createdAt: '20260302090000', updatedAt: '20260310120000', historicalReferenceCount: 0, lastHistoricalAt: '', hasSparseEvidence: false },
        ],
        dormantDocuments: [],
        propagationNodes: [],
        suggestions: [],
      } as any,
      now,
      timeRange: 'all',
      notebooks: [
        { id: 'box-1', name: '知识库' },
        { id: 'box-2', name: '工作台' },
      ],
      dormantDays: 30,
      config: {
        readTagNames: [],
        readTitlePrefixes: '',
        readTitleSuffixes: '',
        readPaths: '/知识库/已读',
      } as any,
      readCardMode: 'read',
    })

    expect((sections as Record<string, any>).read).toEqual(expect.objectContaining({
      key: 'read',
      kind: 'list',
      items: [
        expect.objectContaining({
          documentId: 'doc-notebook-read',
          badge: 'Path match',
          meta: 'Paths: /知识库/已读',
        }),
      ],
    }))
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
      themeDocumentIds: new Set(['doc-b']),
      dormantDays: 30,
    })

    const docA = sections.references.items.find(item => item.documentId === 'doc-a')
    const docB = sections.references.items.find(item => item.documentId === 'doc-b')
    const docC = sections.references.items.find(item => item.documentId === 'doc-c')

    expect(docA?.meta).toBe('Inbound 0 / Outbound 2')
    expect(docB?.meta).toBe('Inbound 2 / Outbound 0')
    expect(docC?.meta).toBe('Inbound 1 / Outbound 1')
  })

  it('keeps active relationship details aligned with local time window semantics', () => {
    const sections = buildSummaryDetailSections({
      documents: [
        { id: 'doc-local-source', box: 'box-1', path: '/local-source.sy', hpath: '/Local Source', title: 'Local Source', tags: [], created: '20260301090000', updated: '20260313213430' },
        { id: 'doc-local-target', box: 'box-1', path: '/local-target.sy', hpath: '/Local Target', title: 'Local Target', tags: [], created: '20260301090000', updated: '20260313213430' },
      ],
      references: [
        { id: 'ref-local', sourceDocumentId: 'doc-local-source', sourceBlockId: 'blk-local-source', targetDocumentId: 'doc-local-target', targetBlockId: 'blk-local-target', content: '[[Local Target]]', sourceUpdated: '20260313213430' },
      ],
      report: {
        ...report,
        summary: {
          ...report.summary,
          totalDocuments: 2,
          analyzedDocuments: 2,
          totalReferences: 1,
          orphanCount: 0,
          communityCount: 1,
          dormantCount: 0,
          propagationCount: 0,
        },
        ranking: [
          { documentId: 'doc-local-target', title: 'Local Target', inboundReferences: 1, distinctSourceDocuments: 1, outboundReferences: 0, lastActiveAt: '20260313213430' },
        ],
        communities: [
          { id: 'community-doc-local-source', documentIds: ['doc-local-source', 'doc-local-target'], size: 2, hubDocumentIds: ['doc-local-source'], topTags: [], notebookIds: ['box-1'], missingTopicPage: true },
        ],
        bridgeDocuments: [],
        orphans: [],
        dormantDocuments: [],
        propagationNodes: [],
      } as any,
      now: new Date('2026-03-13T22:02:45+08:00'),
      timeRange: '7d',
      dormantDays: 30,
    })

    expect(sections.references.items).toEqual([
      expect.objectContaining({ documentId: 'doc-local-source', badge: '1 refs' }),
      expect.objectContaining({ documentId: 'doc-local-target', badge: '1 refs' }),
    ])
  })

  it('does not show missing topic page badges when a community already contains a recognized theme document', () => {
    const sections = buildSummaryDetailSections({
      documents: [
        { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], created: '20260301090000', updated: '20260311120000' },
        { id: 'doc-note', box: 'box-1', path: '/notes/ai.sy', hpath: '/笔记/AI', title: 'AI 笔记', tags: [], created: '20260302090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-1', sourceDocumentId: 'doc-note', sourceBlockId: 'blk-note', targetDocumentId: 'doc-theme-ai', targetBlockId: 'blk-theme', content: '[[主题-AI-索引]]', sourceUpdated: '20260311120000' },
      ],
      report: {
        ...report,
        summary: {
          ...report.summary,
          totalDocuments: 2,
          analyzedDocuments: 2,
          totalReferences: 1,
          orphanCount: 0,
          communityCount: 1,
          dormantCount: 0,
          propagationCount: 0,
        },
        ranking: [
          { documentId: 'doc-theme-ai', title: '主题-AI-索引', inboundReferences: 1, distinctSourceDocuments: 1, outboundReferences: 0, lastActiveAt: '20260311120000' },
        ],
        communities: [
          { id: 'community-doc-theme-ai', documentIds: ['doc-note', 'doc-theme-ai'], size: 2, hubDocumentIds: ['doc-theme-ai'], topTags: [], notebookIds: ['box-1'], missingTopicPage: true },
        ],
        bridgeDocuments: [],
        orphans: [],
        dormantDocuments: [],
        propagationNodes: [],
      } as any,
      now,
      timeRange: 'all',
      themeDocumentIds: new Set(['doc-theme-ai']),
      dormantDays: 30,
    })

    expect(sections.communities.items).toEqual([
      expect.objectContaining({ documentId: 'doc-note', badge: undefined }),
      expect.objectContaining({ documentId: 'doc-theme-ai', badge: undefined, isThemeDocument: true }),
    ])
  })
})

describe('buildSummaryCards', () => {
  it('keeps the summary card order stable across read and large document modes', () => {
    const cards = buildSummaryCards({
      report: report as any,
      dormantDays: 30,
      documentCount: 5,
      readDocumentCount: 2,
      readCardMode: 'read',
      trends: trends as any,
      largeDocumentSummary: {
        wordDocumentCount: 3,
        storageDocumentCount: 2,
      },
      largeDocumentCardMode: 'storage',
    })

    expect(cards.map(card => card.key)).toEqual([
      'documents',
      'read',
      'todaySuggestions',
      'largeDocuments',
      'references',
      'ranking',
      'trends',
      'communities',
      'orphans',
      'dormant',
      'bridges',
      'propagation',
    ])
  })

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
      documentCount: 5,
      readDocumentCount: 2,
      trends: trends as any,
      largeDocumentSummary: {
        wordDocumentCount: 3,
        storageDocumentCount: 2,
      },
      aiInboxCount: 4,
    })

    const dormant = cards.find(card => card.key === 'dormant')
    const read = cards.find(card => card.key === 'read')
    const todaySuggestions = cards.find(card => card.key === 'todaySuggestions')
    const largeDocuments = cards.find(card => card.key === 'largeDocuments')

    expect(dormant).toEqual(expect.objectContaining({
      label: 'Dormant docs',
      value: report.summary.dormantCount.toString(),
      hint: 'No valid links for more than 45 days',
    }))
    expect(read).toEqual(expect.objectContaining({
      label: 'Unread docs',
      value: '3',
      hint: 'Docs not matched by read rules',
    }))
    expect(todaySuggestions).toEqual(expect.objectContaining({
      label: 'Today suggestions',
      value: '4',
      hint: 'AI-ranked suggestions for today',
    }))
    expect(largeDocuments).toEqual(expect.objectContaining({
      label: 'Large docs · text',
      value: '3',
      hint: 'Docs with more than 10,000 words',
    }))
  })

  it('can build the read card in read mode explicitly', () => {
    const cards = buildSummaryCards({
      report: report as any,
      dormantDays: 30,
      documentCount: 5,
      readDocumentCount: 2,
      readCardMode: 'read',
      trends: trends as any,
    })

    expect(cards.find(card => card.key === 'read')).toEqual(expect.objectContaining({
      label: 'Read docs',
      value: '2',
      hint: 'Docs matched by read rules',
    }))
  })

  it('adds cards for ranking and trends without standalone suggestions', () => {
    const cards = buildSummaryCards({
      report: report as any,
      dormantDays: 30,
      trends: trends as any,
      largeDocumentSummary: {
        wordDocumentCount: 3,
        storageDocumentCount: 2,
      },
    })

    expect(cards.find(card => card.key === 'ranking')?.value).toBe('1')
    expect(cards.some(card => card.key === 'suggestions')).toBe(false)
    expect(cards.find(card => card.key === 'todaySuggestions')?.value).toBe('0')
    expect(cards.find(card => card.key === 'trends')?.value).toBe('2')
    expect(cards.find(card => card.key === 'largeDocuments')?.value).toBe('3')
  })

  it('can switch the large document card to storage mode explicitly', () => {
    const cards = buildSummaryCards({
      report: report as any,
      dormantDays: 30,
      trends: trends as any,
      largeDocumentSummary: {
        wordDocumentCount: 3,
        storageDocumentCount: 2,
      },
      largeDocumentCardMode: 'storage',
    })

    expect(cards.find(card => card.key === 'largeDocuments')).toEqual(expect.objectContaining({
      label: 'Large docs · assets',
      value: '2',
      hint: 'Docs larger than 3 MB in total size',
    }))
  })
})
