import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  lsNotebooksMock: vi.fn(),
  sqlMock: vi.fn(),
}))

vi.mock('@/api', () => ({
  lsNotebooks: apiMocks.lsNotebooksMock,
  sql: apiMocks.sqlMock,
}))

import { loadAnalyticsSnapshot } from './siyuan-data'

describe('loadAnalyticsSnapshot', () => {
  beforeEach(() => {
    apiMocks.sqlMock.mockReset()
    apiMocks.lsNotebooksMock.mockReset()
  })

  it('adds siyuan internal links to the aggregated document references', async () => {
    apiMocks.sqlMock.mockImplementation(async (query: string) => {
      if (query.includes('FROM refs r')) {
        return [
          {
            id: 'ref-1',
            sourceBlockId: '20260311120003-srcblk1',
            sourceDocumentId: '20260311120000-srcdoc1',
            targetBlockId: '20260311120001-tgtdoc1',
            targetDocumentId: '20260311120001-tgtdoc1',
            content: '[[Target B]]',
            sourceUpdated: '20260311123000',
          },
        ]
      }

      if (query.includes("WHERE type = 'd'")) {
        return [
          {
            id: '20260311120000-srcdoc1',
            box: 'box-1',
            path: '/a.sy',
            hpath: '/A',
            title: 'Source A',
            tag: '#index',
            created: '20260310120000',
            updated: '20260311120000',
          },
          {
            id: '20260311120001-tgtdoc1',
            box: 'box-1',
            path: '/b.sy',
            hpath: '/B',
            title: 'Target B',
            tag: '#topic',
            created: '20260310121000',
            updated: '20260311120000',
          },
          {
            id: '20260311120002-tgtdoc2',
            box: 'box-1',
            path: '/c.sy',
            hpath: '/C',
            title: 'Target C',
            tag: '#topic',
            created: '20260310122000',
            updated: '20260311120000',
          },
        ]
      }

      if (query.includes('%siyuan://blocks/%') || query.includes('%((%')) {
        return [
          {
            id: '20260311120004-srcblk2',
            rootId: '20260311120000-srcdoc1',
            markdown: [
              '[C](siyuan://blocks/20260311120005-tgtblk2)',
              '[B](siyuan://blocks/20260311120001-tgtdoc1?focus=1)',
              '[Plugin](siyuan://plugins/sample)',
            ].join(' '),
            updated: '20260311124000',
          },
        ]
      }

      if (query.includes("SELECT id, COALESCE(NULLIF(root_id, ''), id) AS rootId")) {
        return [
          {
            id: '20260311120005-tgtblk2',
            rootId: '20260311120002-tgtdoc2',
          },
          {
            id: '20260311120001-tgtdoc1',
            rootId: '20260311120001-tgtdoc1',
          },
        ]
      }

      return []
    })

    apiMocks.lsNotebooksMock.mockResolvedValue({
      notebooks: [
        {
          id: 'box-1',
          name: 'Notebook',
        },
      ],
    })

    const snapshot = await loadAnalyticsSnapshot()

    expect(snapshot.references.map(reference => ({
      sourceDocumentId: reference.sourceDocumentId,
      targetDocumentId: reference.targetDocumentId,
    }))).toEqual(
      expect.arrayContaining([
        {
          sourceDocumentId: '20260311120000-srcdoc1',
          targetDocumentId: '20260311120001-tgtdoc1',
        },
        {
          sourceDocumentId: '20260311120000-srcdoc1',
          targetDocumentId: '20260311120002-tgtdoc2',
        },
      ]),
    )
    expect(snapshot.references).toHaveLength(3)
  })

  it('parses block references from markdown when refs rows are missing', async () => {
    apiMocks.sqlMock.mockImplementation(async (query: string) => {
      if (query.includes('FROM refs r')) {
        return []
      }

      if (query.includes("WHERE type = 'd'")) {
        return [
          {
            id: '20260312100000-srcdoc1',
            box: 'box-1',
            path: '/a.sy',
            hpath: '/A',
            title: 'Source A',
            tag: '#index',
            created: '20260310120000',
            updated: '20260312110000',
          },
          {
            id: '20260312100001-tgtdoc1',
            box: 'box-1',
            path: '/b.sy',
            hpath: '/B',
            title: 'Target B',
            tag: '#topic',
            created: '20260310121000',
            updated: '20260312110000',
          },
        ]
      }

      if (query.includes('%((%') || query.includes('%siyuan://blocks/%')) {
        return [
          {
            id: '20260312100002-srcblk1',
            rootId: '20260312100000-srcdoc1',
            markdown: 'see ((20260312100003-tgtblk1 "skills"))',
            updated: '20260312112000',
          },
        ]
      }

      if (query.includes("SELECT id, COALESCE(NULLIF(root_id, ''), id) AS rootId")) {
        return [
          {
            id: '20260312100003-tgtblk1',
            rootId: '20260312100001-tgtdoc1',
          },
        ]
      }

      return []
    })

    apiMocks.lsNotebooksMock.mockResolvedValue({ notebooks: [] })

    const snapshot = await loadAnalyticsSnapshot()

    expect(snapshot.references).toEqual([
      expect.objectContaining({
        sourceDocumentId: '20260312100000-srcdoc1',
        targetDocumentId: '20260312100001-tgtdoc1',
        targetBlockId: '20260312100003-tgtblk1',
      }),
    ])
  })

  it('parses block references with single-quoted titles', async () => {
    apiMocks.sqlMock.mockImplementation(async (query: string) => {
      if (query.includes('FROM refs r')) {
        return []
      }

      if (query.includes("WHERE type = 'd'")) {
        return [
          {
            id: '20260312150000-srcdoc1',
            box: 'box-1',
            path: '/a.sy',
            hpath: '/A',
            title: 'Source A',
            tag: '#index',
            created: '20260312140000',
            updated: '20260312150000',
          },
          {
            id: '20260312150001-tgtdoc1',
            box: 'box-1',
            path: '/b.sy',
            hpath: '/B',
            title: 'Target B',
            tag: '#topic',
            created: '20260312141000',
            updated: '20260312150000',
          },
        ]
      }

      if (query.includes('%((%') || query.includes('%siyuan://blocks/%')) {
        return [
          {
            id: '20260312150002-srcblk1',
            rootId: '20260312150000-srcdoc1',
            markdown: "see ((20260312150003-tgtblk1 'skills'))",
            updated: '20260312152000',
          },
        ]
      }

      if (query.includes("SELECT id, COALESCE(NULLIF(root_id, ''), id) AS rootId")) {
        return [
          {
            id: '20260312150003-tgtblk1',
            rootId: '20260312150001-tgtdoc1',
          },
        ]
      }

      return []
    })

    apiMocks.lsNotebooksMock.mockResolvedValue({ notebooks: [] })

    const snapshot = await loadAnalyticsSnapshot()

    expect(snapshot.references).toEqual([
      expect.objectContaining({
        sourceDocumentId: '20260312150000-srcdoc1',
        targetDocumentId: '20260312150001-tgtdoc1',
        targetBlockId: '20260312150003-tgtblk1',
      }),
    ])
  })

  it('falls back to the target block id when a document block has an empty root_id', async () => {
    apiMocks.sqlMock.mockImplementation(async (query: string) => {
      if (query.includes('FROM refs r')) {
        return []
      }

      if (query.includes("WHERE type = 'd'")) {
        return [
          {
            id: '20260312110000-srcdoc1',
            box: 'box-1',
            path: '/a.sy',
            hpath: '/A',
            title: 'Source A',
            tag: null,
            created: '20260310120000',
            updated: '20260312110000',
          },
          {
            id: '20260312110001-tgtdoc1',
            box: 'box-1',
            path: '/b.sy',
            hpath: '/B',
            title: 'Target B',
            tag: null,
            created: '20260310121000',
            updated: '20260312110000',
          },
        ]
      }

      if (query.includes('%siyuan://blocks/%')) {
        return [
          {
            id: '20260312110002-srcblk1',
            rootId: '20260312110000-srcdoc1',
            markdown: '[Target](siyuan://blocks/20260312110001-tgtdoc1)',
            updated: '20260312112000',
          },
        ]
      }

      if (query.includes("SELECT id, COALESCE(NULLIF(root_id, ''), id) AS rootId")) {
        return [
          {
            id: '20260312110001-tgtdoc1',
            rootId: '',
          },
        ]
      }

      return []
    })

    apiMocks.lsNotebooksMock.mockResolvedValue({ notebooks: [] })

    const snapshot = await loadAnalyticsSnapshot()

    expect(snapshot.references).toEqual([
      expect.objectContaining({
        sourceDocumentId: '20260312110000-srcdoc1',
        targetDocumentId: '20260312110001-tgtdoc1',
        targetBlockId: '20260312110001-tgtdoc1',
      }),
    ])
  })

  it('adds explicit limit clauses to avoid the default 64-row cap', async () => {
    const queries: string[] = []

    apiMocks.sqlMock.mockImplementation(async (query: string) => {
      queries.push(query)

      if (query.includes('FROM refs r')) {
        return []
      }

      if (query.includes("WHERE type = 'd'")) {
        return []
      }

      if (query.includes('%siyuan://blocks/%') || query.includes('%((%')) {
        return [
          {
            id: '20260312123000-srcblk1',
            rootId: '20260312120000-srcdoc1',
            markdown: '[Target](siyuan://blocks/20260312121000-tgtdoc1)',
            updated: '20260312124000',
          },
        ]
      }

      if (query.includes("SELECT id, COALESCE(NULLIF(root_id, ''), id) AS rootId")) {
        return [
          {
            id: '20260312121000-tgtdoc1',
            rootId: '20260312121000-tgtdoc1',
          },
        ]
      }

      return []
    })

    apiMocks.lsNotebooksMock.mockResolvedValue({ notebooks: [] })

    await loadAnalyticsSnapshot()

    const documentQuery = queries.find(query => query.includes("WHERE type = 'd'"))
    const referenceQuery = queries.find(query => query.includes('FROM refs r'))
    const internalSourceQuery = queries.find(query => query.includes('%siyuan://blocks/%') || query.includes('%((%'))
    const internalTargetQuery = queries.find(query => query.includes("SELECT id, COALESCE(NULLIF(root_id, ''), id) AS rootId"))

    expect(documentQuery).toContain('LIMIT')
    expect(referenceQuery).toContain('LIMIT')
    expect(internalSourceQuery).toContain('LIMIT')
    expect(internalTargetQuery).toContain('LIMIT')
  })
})
