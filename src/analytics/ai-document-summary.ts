import type { DocumentRecord } from './analysis'
import type { AiDocumentIndexStore } from './ai-index-store'
import type { ClassifiedSourceBlocks } from './document-index-source-blocks'
import { collectDocumentSourceBlocks } from './document-index-source-blocks'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import { isAiConfigComplete, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { t } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'

const TAG = '[NetworkLens][DocIndex]'

type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string, subtype?: string }>>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>

type AiConfig = Pick<
  PluginConfig,
  | 'aiBaseUrl'
  | 'aiApiKey'
  | 'aiModel'
  | 'aiRequestTimeoutSeconds'
  | 'aiMaxTokens'
  | 'aiTemperature'
  | 'aiMaxContextMessages'
>

export interface EvidenceCompilationResult {
  positioning: string
  propositions: Array<{ text: string, sourceBlockIds: string[] }>
  keywords: string[]
}

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

export async function ensureDocumentIndex(params: {
  config: AiConfig
  sourceDocument: DocumentRecord
  indexStore: Pick<AiDocumentIndexStore, 'getFreshDocumentProfile' | 'saveDocumentIndex'>
  forwardProxy: ForwardProxyFn
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
  force?: boolean
  updatedAt?: string
}): Promise<{ fromCache: boolean, updatedAt: string }> {
  const sourceUpdatedAt = params.sourceDocument.updated ?? ''

  if (!params.force && sourceUpdatedAt) {
    const freshProfile = await params.indexStore.getFreshDocumentProfile(
      params.sourceDocument.id,
      sourceUpdatedAt,
    )
    if (freshProfile) {
      return { fromCache: true, updatedAt: freshProfile.generatedAt }
    }
  }

  const updatedAt = params.updatedAt || new Date().toISOString()

  if (!isAiConfigComplete(params.config)) {
    throw new Error(t('analytics.docSummary.aiRequired'))
  }

  const sourceBlocks = await collectDocumentSourceBlocks({
    documentId: params.sourceDocument.id,
    getChildBlocks: params.getChildBlocks,
    getBlockKramdown: params.getBlockKramdown,
  })

  const result = await requestEvidenceCompilation({
    config: params.config,
    forwardProxy: params.forwardProxy,
    sourceDocument: params.sourceDocument,
    sourceBlocks,
  })

  await params.indexStore.saveDocumentIndex({
    config: params.config,
    sourceDocument: params.sourceDocument,
    positioning: result.positioning,
    propositions: result.propositions,
    keywords: result.keywords,
    primarySourceBlocks: sourceBlocks.primary,
    secondarySourceBlocks: sourceBlocks.secondary,
    generatedAt: updatedAt,
  })

  return { fromCache: false, updatedAt }
}

export async function ensureDocumentSummary(params: {
  config: AiConfig
  sourceDocument: DocumentRecord
  indexStore?: Pick<AiDocumentIndexStore, 'getFreshDocumentSummary' | 'saveDocumentIndex'> | null
  forwardProxy?: ForwardProxyFn
  getChildBlocks?: GetChildBlocksFn
  getBlockKramdown?: GetBlockKramdownFn
  force?: boolean
  updatedAt?: string
}): Promise<EnsuredDocumentSummaryResult> {
  const sourceUpdatedAt = params.sourceDocument.updated ?? ''
  const freshSummary = !params.force && sourceUpdatedAt
    ? await params.indexStore?.getFreshDocumentSummary?.(params.sourceDocument.id, sourceUpdatedAt)
    : null

  if (freshSummary) {
    return { ...freshSummary, fromCache: true }
  }

  if (!params.forwardProxy || !params.getChildBlocks || !params.getBlockKramdown) {
    throw new Error(t('analytics.docSummary.aiRequired'))
  }

  const { fromCache, updatedAt } = await ensureDocumentIndex({
    config: params.config,
    sourceDocument: params.sourceDocument,
    indexStore: params.indexStore!,
    forwardProxy: params.forwardProxy,
    getChildBlocks: params.getChildBlocks,
    getBlockKramdown: params.getBlockKramdown,
    force: params.force,
    updatedAt: params.updatedAt,
  })

  const freshSummaryAfterIndex = await params.indexStore?.getFreshDocumentSummary?.(
    params.sourceDocument.id,
    sourceUpdatedAt,
  )

  if (freshSummaryAfterIndex) {
    return { ...freshSummaryAfterIndex, fromCache }
  }

  return {
    summaryShort: '',
    summaryMedium: '',
    keywords: [],
    evidenceSnippets: [],
    updatedAt,
    fromCache,
  }
}

const EVIDENCE_COMPILATION_SYSTEM_PROMPT = `You are an evidence compiler for a personal knowledge base. Read a document and its evidence blocks, then produce a structured index.

Return ONLY a valid JSON object. No markdown fences, no explanation, no extra text before or after the JSON.

Required JSON structure:
{
  "positioning": "one sentence describing the document topic",
  "propositions": [
    { "text": "a factual claim from the document", "sourceBlockIds": ["block-id-1"] }
  ],
  "keywords": ["keyword1", "keyword2"]
}

Field rules:

positioning — One sentence (under 120 chars). Neutral description of what the document covers. No evaluative language.

propositions — 3 to 6 items. Each is a factual claim or key idea from the document. Each must:
  - Be self-contained and understandable without reading the document
  - Reference at least one sourceBlockId from the evidence blocks provided
  - Use neutral language, no "this document explains" or similar
  - Keep each proposition under 100 characters

keywords — 5 to 8 keywords. Mix specific terms and broader concepts.

IMPORTANT:
- sourceBlockIds must be real block IDs from the evidence blocks below
- All text in the same language as the document
- Return ONLY the JSON object, nothing else`

async function requestEvidenceCompilation(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  sourceDocument: DocumentRecord
  sourceBlocks: ClassifiedSourceBlocks
}): Promise<EvidenceCompilationResult> {
  const title = resolveDocumentTitle(params.sourceDocument)
  const tags = normalizeTags(params.sourceDocument.tags)

  const allBlocks = [...params.sourceBlocks.primary, ...params.sourceBlocks.secondary]
  const blockSection = allBlocks.length > 0
    ? allBlocks.map(block => `[${block.blockId}] ${block.text}`).join('\n\n')
    : '(No evidence blocks extracted)'

  const userMessage = [
    `Document: ${title}`,
    params.sourceDocument.hpath ? `Path: ${params.sourceDocument.hpath}` : '',
    tags.length ? `Tags: ${tags.join(', ')}` : '',
    '',
    'Evidence blocks:',
    blockSection,
  ].filter(Boolean).join('\n')

  const requestOptions = resolveAiRequestOptions(params.config)
  const endpoint = resolveAiEndpoint(params.config.aiBaseUrl!, 'chat/completions')
  const body = JSON.stringify({
    model: params.config.aiModel,
    messages: [
      { role: 'system', content: EVIDENCE_COMPILATION_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: Math.min(requestOptions.maxTokens, 4096),
    temperature: 0.3,
  })

  console.info(TAG, 'Evidence compilation request', {
    title,
    blockCount: allBlocks.length,
    model: params.config.aiModel,
    endpoint,
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
  const finishReason = payload?.choices?.[0]?.finish_reason ?? 'unknown'

  console.info(TAG, 'Evidence compilation response', {
    finishReason,
    contentLength: aiContent.length,
    contentPreview: aiContent.slice(0, 200),
  })

  return parseEvidenceCompilationResponse(aiContent, allBlocks.map(b => b.blockId))
}

function parseEvidenceCompilationResponse(raw: string, validBlockIds: string[]): EvidenceCompilationResult {
  const cleaned = stripCodeFences(raw)
  const parsed = tryParseJson(cleaned)

  if (!parsed) {
    console.warn(TAG, 'Failed to parse AI response as JSON', {
      rawLength: raw.length,
      rawPreview: raw.slice(0, 300),
      rawTail: raw.slice(-100),
    })
    throw new Error(t('analytics.docSummary.invalidAiResponse'))
  }

  const validIdSet = new Set(validBlockIds)

  const positioning = typeof parsed.positioning === 'string' && parsed.positioning.trim()
    ? parsed.positioning.trim().slice(0, 200)
    : ''

  const propositions = Array.isArray(parsed.propositions)
    ? parsed.propositions
        .filter((p: any) => p && typeof p.text === 'string' && p.text.trim())
        .map((p: any) => ({
          text: p.text.trim(),
          sourceBlockIds: Array.isArray(p.sourceBlockIds)
            ? p.sourceBlockIds.filter((id: any) => typeof id === 'string' && validIdSet.has(id))
            : [],
        }))
        .slice(0, 10)
    : []

  const keywords = Array.isArray(parsed.keywords)
    ? deduplicateStrings(parsed.keywords.filter((k: unknown): k is string => typeof k === 'string'))
    : []

  console.info(TAG, 'Parsed evidence compilation', {
    hasPositioning: Boolean(positioning),
    propositionCount: propositions.length,
    keywordCount: keywords.length,
  })

  if (!positioning && propositions.length === 0) {
    console.warn(TAG, 'AI response had neither positioning nor propositions', {
      rawPreview: raw.slice(0, 200),
    })
    throw new Error(t('analytics.docSummary.invalidAiResponse'))
  }

  return { positioning, propositions, keywords }
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text)
  } catch {
    // Try to extract JSON object from surrounding text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        // Attempt to fix truncated JSON by closing open strings/arrays/objects
        const fixed = attemptTruncationFix(match[0])
        if (fixed) {
          try {
            return JSON.parse(fixed)
          } catch {
            // give up
          }
        }
      }
    }
    return null
  }
}

function attemptTruncationFix(text: string): string | null {
  let fixed = text

  // Count unmatched brackets/braces
  const openBraces = (fixed.match(/{/g) || []).length
  const closeBraces = (fixed.match(/}/g) || []).length
  const openBrackets = (fixed.match(/\[/g) || []).length
  const closeBrackets = (fixed.match(/]/g) || []).length

  // If the text ends mid-string (inside a quoted value), close the string first
  const lastQuoteIndex = fixed.lastIndexOf('"')
  if (lastQuoteIndex >= 0) {
    const afterLastQuote = fixed.slice(lastQuoteIndex + 1)
    // If there's no closing quote paired properly, add one
    const quotesBefore = (fixed.slice(0, lastQuoteIndex).match(/"/g) || []).length
    if (quotesBefore % 2 !== 0) {
      fixed += '"'
    }
  }

  // Close any unclosed arrays
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']'
  }

  // Close any unclosed objects
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}'
  }

  return fixed
}

function deduplicateStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}
