import type { DocumentRecord } from './analysis'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import type { AiDocumentIndexStore, DocumentSummarySnapshot } from './ai-index-store'
import { t } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'

type AiConfig = Pick<
  PluginConfig,
  | 'aiModel'
  | 'aiEmbeddingModel'
>

export interface DocumentSummaryResult {
  summaryShort: string
  summaryMedium: string
  keywords: string[]
  evidenceSnippets: string[]
}

export interface EnsuredDocumentSummaryResult extends DocumentSummaryResult {
  updatedAt: string
  fromCache: boolean
}

export function buildDocumentSummary(sourceDocument: DocumentRecord): DocumentSummaryResult {
  const title = resolveDocumentTitle(sourceDocument)
  const contentLines = (sourceDocument.content ?? '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const evidenceSnippets = deduplicateStrings(contentLines.slice(0, 2))
  const flattenedContent = contentLines.join(' ').trim()
  const summaryShort = flattenedContent.slice(0, 120) || t('analytics.summaryDetailSource.documentTitleFallback', { title })
  const summaryMediumParts = [
    t('analytics.summaryDetailSource.titlePrefix', { title }),
    sourceDocument.hpath ? t('analytics.summaryDetailSource.pathPrefix', { path: sourceDocument.hpath }) : '',
    evidenceSnippets.length ? t('analytics.summaryDetailSource.keyPointsPrefix', { value: evidenceSnippets.join(' ') }) : '',
  ].filter(Boolean)

  return {
    summaryShort,
    summaryMedium: summaryMediumParts.join(t('analytics.summaryDetailSource.summarySeparator')),
    keywords: deduplicateStrings([
      ...normalizeTags(sourceDocument.tags),
      ...splitTitleKeywords(title),
    ]),
    evidenceSnippets,
  }
}

export async function ensureDocumentSummary(params: {
  config: AiConfig
  sourceDocument: DocumentRecord
  indexStore?: Pick<AiDocumentIndexStore, 'getFreshDocumentSummary' | 'saveDocumentSummary'> | null
  updatedAt?: string
}): Promise<EnsuredDocumentSummaryResult> {
  const sourceUpdatedAt = params.sourceDocument.updated ?? ''
  const freshSummary = sourceUpdatedAt
    ? await params.indexStore?.getFreshDocumentSummary?.(params.sourceDocument.id, sourceUpdatedAt)
    : null

  if (freshSummary) {
    return {
      ...freshSummary,
      fromCache: true,
    }
  }

  const rebuiltSummary = buildDocumentSummary(params.sourceDocument)
  const updatedAt = params.updatedAt || new Date().toISOString()

  await params.indexStore?.saveDocumentSummary?.({
    config: params.config,
    sourceDocument: params.sourceDocument,
    summaryShort: rebuiltSummary.summaryShort,
    summaryMedium: rebuiltSummary.summaryMedium,
    keywords: rebuiltSummary.keywords,
    evidenceSnippets: rebuiltSummary.evidenceSnippets,
    updatedAt,
  })

  return {
    ...rebuiltSummary,
    updatedAt,
    fromCache: false,
  }
}

function splitTitleKeywords(title: string): string[] {
  return title
    .split(/[\s,，、/]+/)
    .map(part => part.trim())
    .filter(part => part.length >= 2)
}

function deduplicateStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}
