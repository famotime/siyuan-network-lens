import type { DocumentRecord } from './analysis'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import type { AiDocumentIndexStore, DocumentSummarySnapshot } from './ai-index-store'
import { isAiConfigComplete, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { resolveUiLocale, t } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'

type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type AiConfig = Pick<
  PluginConfig,
  | 'aiEnabled'
  | 'aiBaseUrl'
  | 'aiApiKey'
  | 'aiModel'
  | 'aiEmbeddingModel'
  | 'aiRequestTimeoutSeconds'
  | 'aiMaxTokens'
  | 'aiTemperature'
  | 'aiMaxContextMessages'
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
  embeddingJson?: string
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
  forwardProxy?: ForwardProxyFn
  force?: boolean
  updatedAt?: string
}): Promise<EnsuredDocumentSummaryResult> {
  const sourceUpdatedAt = params.sourceDocument.updated ?? ''
  const freshSummary = !params.force && sourceUpdatedAt
    ? await params.indexStore?.getFreshDocumentSummary?.(params.sourceDocument.id, sourceUpdatedAt)
    : null

  if (freshSummary) {
    return {
      ...freshSummary,
      fromCache: true,
    }
  }

  const updatedAt = params.updatedAt || new Date().toISOString()
  let summaryResult: DocumentSummaryResult
  let embeddingJson: string | undefined

  if (params.forwardProxy && isAiConfigComplete(params.config)) {
    try {
      const aiResult = await requestDocumentAiSummary({
        config: params.config,
        forwardProxy: params.forwardProxy,
        sourceDocument: params.sourceDocument,
      })
      summaryResult = aiResult.summary
      embeddingJson = aiResult.embeddingJson
    } catch {
      summaryResult = buildDocumentSummary(params.sourceDocument)
    }
  } else {
    summaryResult = buildDocumentSummary(params.sourceDocument)
  }

  await params.indexStore?.saveDocumentSummary?.({
    config: params.config,
    sourceDocument: params.sourceDocument,
    summaryShort: summaryResult.summaryShort,
    summaryMedium: summaryResult.summaryMedium,
    keywords: summaryResult.keywords,
    evidenceSnippets: summaryResult.evidenceSnippets,
    embeddingJson,
    updatedAt,
  })

  return {
    ...summaryResult,
    updatedAt,
    fromCache: false,
    embeddingJson,
  }
}

const SUMMARY_SYSTEM_PROMPT = `You are a thoughtful reading companion for a personal knowledge base. Your job is to deeply read a document and produce an insightful index that captures what the document is about, what the author cares about, and why this document matters.

You must return JSON only — no Markdown, no code blocks, no explanation.

The JSON shape:
{
  "summaryShort": string,
  "summaryMedium": string,
  "keywords": string[],
  "evidenceSnippets": string[]
}

Guidelines for each field:

summaryShort — One sentence (under 150 characters) that captures the core idea or purpose of this document. Write as if you are telling a friend what this document is about, not as a title or tag. For example: "作者记录了搭建个人知识索引系统的完整思路和踩坑经验" rather than "知识索引系统搭建".

summaryMedium — A thoughtful paragraph (3-6 sentences) that reads like a knowledgeable person's impression of this document. Cover: what problem or question does it address? What are the key ideas or conclusions? What makes it interesting or useful? Write naturally, not in bullet points.

keywords — 5-10 keywords that someone would use to search for this document. Include both explicit topics from the text and implicit themes you infer from reading it. Mix specific terms with broader concepts.

evidenceSnippets — 2-4 passages from the document that best reveal its substance. Choose passages that are insightful, representative of the author's thinking, or capture key conclusions — not generic introductions or filler text. Quote them exactly.

All text must be in the same language as the document content. Keep proper nouns unchanged.`

async function requestDocumentAiSummary(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  sourceDocument: DocumentRecord
}): Promise<{ summary: DocumentSummaryResult, embeddingJson?: string }> {
  const title = resolveDocumentTitle(params.sourceDocument)
  const content = params.sourceDocument.content ?? ''
  const tags = normalizeTags(params.sourceDocument.tags)
  const locale = resolveUiLocale()

  const userMessage = [
    `Please read the following document carefully and produce its index.`,
    '',
    `Title: ${title}`,
    params.sourceDocument.hpath ? `Path: ${params.sourceDocument.hpath}` : '',
    tags.length ? `Tags: ${tags.join(', ')}` : '',
    '',
    '---',
    content,
    '---',
  ].filter(Boolean).join('\n')

  const requestOptions = resolveAiRequestOptions(params.config)
  const endpoint = resolveAiEndpoint(params.config.aiBaseUrl!, 'chat/completions')
  const body = JSON.stringify({
    model: params.config.aiModel,
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: Math.min(requestOptions.maxTokens, 2048),
    temperature: 0.7,
  })

  const response = await params.forwardProxy(
    endpoint,
    'POST',
    body,
    [
      { Authorization: `Bearer ${params.config.aiApiKey}` },
      { Accept: 'application/json' },
    ],
    requestOptions.timeoutMs,
    'application/json',
  )

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(t('analytics.docSummary.aiRequestFailed', { status: String(response?.status ?? 'unknown') }))
  }

  const payload = JSON.parse(response.body)
  const aiContent: string = payload?.choices?.[0]?.message?.content ?? ''
  const summary = parseAiSummaryResponse(aiContent, params.sourceDocument)

  let embeddingJson: string | undefined
  if (params.config.aiEmbeddingModel?.trim()) {
    try {
      embeddingJson = await requestDocumentEmbedding({
        config: params.config,
        forwardProxy: params.forwardProxy,
        text: `${title}\n${content.slice(0, 500)}`,
      })
    } catch {
      embeddingJson = undefined
    }
  }

  return { summary, embeddingJson }
}

function parseAiSummaryResponse(raw: string, sourceDocument: DocumentRecord): DocumentSummaryResult {
  const fallback = buildDocumentSummary(sourceDocument)

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      summaryShort: typeof parsed.summaryShort === 'string' && parsed.summaryShort.trim()
        ? parsed.summaryShort.trim().slice(0, 300)
        : fallback.summaryShort,
      summaryMedium: typeof parsed.summaryMedium === 'string' && parsed.summaryMedium.trim()
        ? parsed.summaryMedium.trim()
        : fallback.summaryMedium,
      keywords: Array.isArray(parsed.keywords)
        ? deduplicateStrings(parsed.keywords.filter((k: unknown): k is string => typeof k === 'string'))
        : fallback.keywords,
      evidenceSnippets: Array.isArray(parsed.evidenceSnippets)
        ? deduplicateStrings(parsed.evidenceSnippets.filter((s: unknown): s is string => typeof s === 'string'))
        : fallback.evidenceSnippets,
    }
  } catch {
    return fallback
  }
}

async function requestDocumentEmbedding(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  text: string
}): Promise<string> {
  const endpoint = resolveAiEndpoint(params.config.aiBaseUrl!, 'embeddings')
  const requestOptions = resolveAiRequestOptions(params.config)
  const response = await params.forwardProxy(
    endpoint,
    'POST',
    JSON.stringify({
      model: params.config.aiEmbeddingModel,
      input: [params.text],
    }),
    [
      { Authorization: `Bearer ${params.config.aiApiKey}` },
      { Accept: 'application/json' },
    ],
    requestOptions.timeoutMs,
    'application/json',
  )

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(t('analytics.docSummary.embeddingRequestFailed', { status: String(response?.status ?? 'unknown') }))
  }

  const payload = JSON.parse(response.body)
  const embedding = Array.isArray(payload?.data) && Array.isArray(payload.data[0]?.embedding)
    ? payload.data[0].embedding
    : []

  return JSON.stringify(embedding)
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
