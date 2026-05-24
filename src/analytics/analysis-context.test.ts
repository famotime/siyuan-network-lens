import { describe, expect, it } from 'vitest'

import {
  buildGraphAnalysisContext,
  buildTrendAnalysisContext,
} from './analysis-context'

const now = new Date('2026-03-11T00:00:00Z')

describe('buildGraphAnalysisContext', () => {
  it('keeps recently edited documents in the sample while filtering active references to the current window', () => {
    const context = buildGraphAnalysisContext({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: ['topic'], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: ['topic'], created: '20260102090000', updated: '20260310120000' },
        { id: 'doc-c', box: 'box-1', path: '/c.sy', hpath: '/Gamma', title: 'Gamma', tags: ['archive'], created: '20260103090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-current', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260310120000' },
        { id: 'ref-old', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b1', targetDocumentId: 'doc-c', targetBlockId: 'blk-c1', content: '[[Gamma]]', sourceUpdated: '20260105090000' },
      ],
      now,
      timeRange: '7d',
    })

    expect(context.documents.map(document => document.id)).toEqual(['doc-a', 'doc-b', 'doc-c'])
    expect(context.references.map(reference => reference.id)).toEqual(['ref-current'])
    expect(context.allReferences.map(reference => reference.id)).toEqual(['ref-current', 'ref-old'])
  })
})

describe('buildTrendAnalysisContext', () => {
  it('splits current and previous references for the filtered document sample', () => {
    const context = buildTrendAnalysisContext({
      documents: [
        { id: 'doc-a', box: 'box-1', path: '/a.sy', hpath: '/Alpha', title: 'Alpha', tags: ['topic'], created: '20260101090000', updated: '20260310120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: ['topic'], created: '20260102090000', updated: '20260310120000' },
      ],
      references: [
        { id: 'ref-current', sourceDocumentId: 'doc-a', sourceBlockId: 'blk-a1', targetDocumentId: 'doc-b', targetBlockId: 'blk-b1', content: '[[Beta]]', sourceUpdated: '20260310120000' },
        { id: 'ref-previous', sourceDocumentId: 'doc-b', sourceBlockId: 'blk-b1', targetDocumentId: 'doc-a', targetBlockId: 'blk-a1', content: '[[Alpha]]', sourceUpdated: '20260302120000' },
      ],
      now,
      days: 7,
      timeRange: '30d',
    })

    expect(context.documents.map(document => document.id)).toEqual(['doc-a', 'doc-b'])
    expect(context.currentReferences.map(reference => reference.id)).toEqual(['ref-current'])
    expect(context.previousReferences.map(reference => reference.id)).toEqual(['ref-previous'])
  })
})

describe('timeFilterByCreated / timeFilterByUpdated', () => {
  const baseDocuments = [
    { id: 'doc-created-recent', box: 'box-1', path: '/cr.sy', hpath: '/CreatedRecent', title: 'CreatedRecent', tags: [], created: '20260305090000', updated: '20260101090000' },
    { id: 'doc-updated-recent', box: 'box-1', path: '/ur.sy', hpath: '/UpdatedRecent', title: 'UpdatedRecent', tags: [], created: '20260101090000', updated: '20260305090000' },
    { id: 'doc-old', box: 'box-1', path: '/old.sy', hpath: '/Old', title: 'Old', tags: [], created: '20260101090000', updated: '20260101090000' },
  ]

  it('includes documents by creation time when only timeFilterByCreated is true', () => {
    const context = buildGraphAnalysisContext({
      documents: baseDocuments,
      references: [],
      now,
      timeRange: '7d',
      timeFilterByCreated: true,
      timeFilterByUpdated: false,
    })
    const ids = context.documents.map(document => document.id)
    expect(ids).toContain('doc-created-recent')
    expect(ids).not.toContain('doc-updated-recent')
    expect(ids).not.toContain('doc-old')
  })

  it('includes documents by update time when only timeFilterByUpdated is true', () => {
    const context = buildGraphAnalysisContext({
      documents: baseDocuments,
      references: [],
      now,
      timeRange: '7d',
      timeFilterByCreated: false,
      timeFilterByUpdated: true,
    })
    const ids = context.documents.map(document => document.id)
    expect(ids).not.toContain('doc-created-recent')
    expect(ids).toContain('doc-updated-recent')
    expect(ids).not.toContain('doc-old')
  })

  it('excludes all documents by timestamp when both flags are false', () => {
    const context = buildGraphAnalysisContext({
      documents: baseDocuments,
      references: [],
      now,
      timeRange: '7d',
      timeFilterByCreated: false,
      timeFilterByUpdated: false,
    })
    expect(context.documents).toHaveLength(0)
  })

  it('excludes documents outside time window even when they have active references', () => {
    const context = buildGraphAnalysisContext({
      documents: baseDocuments,
      references: [
        { id: 'ref-active', sourceDocumentId: 'doc-old', sourceBlockId: 'blk-1', targetDocumentId: 'doc-created-recent', targetBlockId: 'blk-2', content: '[[link]]', sourceUpdated: '20260310120000' },
      ],
      now,
      timeRange: '7d',
      timeFilterByCreated: true,
      timeFilterByUpdated: true,
    })
    const ids = context.documents.map(document => document.id)
    expect(ids).toContain('doc-created-recent')
    expect(ids).toContain('doc-updated-recent')
    expect(ids).not.toContain('doc-old')
  })
})
