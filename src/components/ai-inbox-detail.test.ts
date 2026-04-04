import { describe, expect, it } from 'vitest'

import { resolveAiInboxItemDocumentId, resolveAiInboxTargetIntent } from './ai-inbox-detail'

describe('ai inbox detail helpers', () => {
  it('resolves the primary document id from inbox items', () => {
    expect(resolveAiInboxItemDocumentId({
      documentIds: ['doc-orphan', 'doc-backup'],
    } as any)).toBe('doc-orphan')

    expect(resolveAiInboxItemDocumentId({
      documentIds: [],
    } as any)).toBe('')
  })

  it('treats document-type target pills as direct link insert actions', () => {
    expect(resolveAiInboxTargetIntent(
      {
        type: 'document',
        documentIds: ['doc-orphan'],
      } as any,
      {
        documentId: 'doc-theme-ai',
        title: '主题-AI-索引',
      } as any,
    )).toEqual({
      kind: 'toggle-link',
      sourceDocumentId: 'doc-orphan',
      targetDocumentId: 'doc-theme-ai',
      targetTitle: '主题-AI-索引',
    })
  })

  it('keeps non-document target pills as open-document actions', () => {
    expect(resolveAiInboxTargetIntent(
      {
        type: 'bridge-risk',
        documentIds: ['doc-bridge'],
      } as any,
      {
        documentId: 'doc-hub',
        title: 'Hub',
      } as any,
    )).toEqual({
      kind: 'open-document',
      documentId: 'doc-hub',
    })
  })
})
