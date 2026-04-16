import type { AiInboxItem, AiInboxRecommendedTarget } from '@/analytics/ai-inbox'
import type { ThemeDocument } from '@/analytics/theme-documents'
import { pickUiText } from '@/i18n/ui'

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

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
  target: Pick<AiInboxRecommendedTarget, 'documentId' | 'title' | 'kind'>,
): AiInboxTargetIntent {
  const targetDocumentId = target.documentId?.trim() ?? ''
  if (!targetDocumentId) {
    return { kind: 'none' }
  }

  const sourceDocumentId = resolveAiInboxItemDocumentId(item)
  if (item.type === 'document' && target.kind === 'theme-document' && sourceDocumentId) {
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

export function splitAiInboxItemTitle(title: string): { prefix: string, documentTitle: string } {
  const normalizedTitle = title.trim()
  const match = normalizedTitle.match(/^([^:：]+[：:])\s*(.+)$/)
  if (!match) {
    return {
      prefix: '',
      documentTitle: normalizedTitle,
    }
  }

  return {
    prefix: match[1],
    documentTitle: match[2].trim(),
  }
}

export function resolveAiInboxActionLines(action: string): string[] {
  return action
    .split(/\r?\n+/)
    .map(line => sanitizeAiInboxActionText(line))
    .filter(Boolean)
}

export function resolveAiInboxActionTargets(params: {
  item: Pick<AiInboxItem, 'action' | 'recommendedTargets'>
  themeDocuments?: Array<Pick<ThemeDocument, 'documentId' | 'title' | 'themeName'>>
}): AiInboxRecommendedTarget[] {
  const targets: AiInboxRecommendedTarget[] = []
  const seen = new Set<string>()

  for (const target of params.item.recommendedTargets ?? []) {
    const documentId = target.documentId?.trim()
    if (!documentId) {
      continue
    }
    targets.push(target)
    seen.add(documentId)
  }

  const normalizedAction = params.item.action?.trim().toLocaleLowerCase() ?? ''
  if (!normalizedAction || !params.themeDocuments?.length) {
    return targets
  }

  const fallbackTargets = params.themeDocuments
    .map((themeDocument) => {
      const title = themeDocument.title.trim()
      if (!title) {
        return null
      }

      const index = normalizedAction.indexOf(title.toLocaleLowerCase())
      if (index < 0 || seen.has(themeDocument.documentId)) {
        return null
      }

      return {
        index,
        target: {
          documentId: themeDocument.documentId,
          title,
          kind: 'theme-document' as const,
          reason: uiText(
            `Action text mentions topic doc ${themeDocument.themeName || title}`,
            `动作文案提及主题文档 ${themeDocument.themeName || title}`,
          ),
        },
      }
    })
    .filter((item): item is { index: number, target: AiInboxRecommendedTarget } => item !== null)
    .sort((left, right) => left.index - right.index || left.target.title.localeCompare(right.target.title, 'zh-CN'))

  for (const item of fallbackTargets) {
    targets.push(item.target)
    seen.add(item.target.documentId ?? item.target.title)
  }

  return targets
}

function sanitizeAiInboxActionText(text: string): string {
  return text
    .replace(/\(\(([a-zA-Z0-9-]+)\s+"([^"]+)"\)\)/g, '$2')
    .replace(/\(\(([a-zA-Z0-9-]+)\s+'([^']+)'\)\)/g, '$2')
    .trim()
}
