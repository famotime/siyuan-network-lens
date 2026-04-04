import type { AiInboxItem, AiInboxRecommendedTarget } from '@/analytics/ai-inbox'

export type AiInboxTargetIntent =
  | {
    kind: 'toggle-link'
    sourceDocumentId: string
    targetDocumentId: string
    targetTitle: string
  }
  | {
    kind: 'open-document'
    documentId: string
  }
  | {
    kind: 'none'
  }

export function resolveAiInboxItemDocumentId(item: Pick<AiInboxItem, 'documentIds'>): string {
  return item.documentIds?.find(documentId => typeof documentId === 'string' && documentId.trim())?.trim() ?? ''
}

export function resolveAiInboxTargetIntent(
  item: Pick<AiInboxItem, 'type' | 'documentIds'>,
  target: Pick<AiInboxRecommendedTarget, 'documentId' | 'title'>,
): AiInboxTargetIntent {
  const targetDocumentId = target.documentId?.trim() ?? ''
  if (!targetDocumentId) {
    return { kind: 'none' }
  }

  const sourceDocumentId = resolveAiInboxItemDocumentId(item)
  if (item.type === 'document' && sourceDocumentId) {
    return {
      kind: 'toggle-link',
      sourceDocumentId,
      targetDocumentId,
      targetTitle: target.title,
    }
  }

  return {
    kind: 'open-document',
    documentId: targetDocumentId,
  }
}
