import { describe, expect, it } from 'vitest'

import { mergeReferences } from './siyuan-data-merge'

describe('mergeReferences', () => {
  it('deduplicates fallback references by document and block signature while preserving unique links', () => {
    const merged = mergeReferences(
      [
        {
          id: 'ref-1',
          sourceDocumentId: 'doc-a',
          sourceBlockId: 'blk-a1',
          targetDocumentId: 'doc-b',
          targetBlockId: 'blk-b1',
          content: '[[B]]',
          sourceUpdated: '20260505120000',
        },
      ],
      [
        {
          id: 'fallback-duplicate',
          sourceDocumentId: 'doc-a',
          sourceBlockId: 'blk-a1',
          targetDocumentId: 'doc-b',
          targetBlockId: 'blk-b1',
          content: '[[B]]',
          sourceUpdated: '20260505120001',
        },
        {
          id: 'fallback-new',
          sourceDocumentId: 'doc-a',
          sourceBlockId: 'blk-a2',
          targetDocumentId: 'doc-c',
          targetBlockId: 'blk-c1',
          content: '[[C]]',
          sourceUpdated: '20260505120002',
        },
      ],
    )

    expect(merged).toEqual([
      expect.objectContaining({ id: 'ref-1', targetDocumentId: 'doc-b' }),
      expect.objectContaining({ id: 'fallback-new', targetDocumentId: 'doc-c' }),
    ])
  })
})
