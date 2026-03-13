import { describe, expect, it } from 'vitest'

import { buildInternalLinkReferences, collectInternalLinkTargetIds } from './internal-links'

describe('internal links', () => {
  it('parses fallback links from content when markdown is empty', () => {
    const sourceRows = [
      {
        id: 'blk-1',
        rootId: 'doc-a',
        markdown: null,
        content: 'See ((doc-b "Beta"))',
        updated: '20260311120000',
      },
    ] as any

    const targetIds = collectInternalLinkTargetIds(sourceRows)
    expect(targetIds).toEqual(['doc-b'])

    const references = buildInternalLinkReferences({
      sourceRows,
      targetRows: [{ id: 'doc-b', rootId: 'doc-b' }],
    })

    expect(references).toEqual([
      expect.objectContaining({
        sourceDocumentId: 'doc-a',
        targetDocumentId: 'doc-b',
        content: '((doc-b "Beta"))',
      }),
    ])
  })
})
