import type { DocumentRecord, OrphanItem, ReferenceGraphReport } from './analysis'
import {
  resolveNormalizedDocumentTitle,
  stripConfiguredTitleAffixes,
  type DocumentTitleCleanupConfig,
} from './document-utils'
import { countThemeMatchesForDocument, type ThemeDocument } from './theme-documents'
import { isAiConfigComplete, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { buildAiLinkRewritePrompt, buildAiLinkSuggestionPrompt, type AiLinkSuggestionPromptInput } from './ai-prompts'
import { resolveUiLocale, t, type UiLocale } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'
import { createPluginLogger } from '@/utils/plugin-logger'

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
  | 'aiRequestTimeoutSeconds'
  | 'aiMaxTokens'
  | 'aiTemperature'
  | 'aiMaxContextMessages'
  | 'enableConsoleLogging'
  | 'themeNamePrefix'
  | 'themeNameSuffix'
  | 'readTitlePrefixes'
  | 'readTitleSuffixes'
>

type CandidateTargetType = 'theme-document' | 'core-document' | 'related-document'
type SuggestionConfidence = 'high' | 'medium' | 'low'
type TagSuggestionSource = 'existing' | 'new'

interface CandidateTarget {
  documentId: string
  title: string
  targetType: CandidateTargetType
  reasons: string[]
  baseScore: number
}

export interface AiLinkSuggestionItem {
  targetDocumentId: string
  targetTitle: string
  targetType: CandidateTargetType
  confidence: SuggestionConfidence
  reason: string
  draftText?: string
  tagSuggestions?: AiLinkTagSuggestion[]
}

export interface AiLinkTagSuggestion {
  tag: string
  source: TagSuggestionSource
  reason?: string
}

export interface AiLinkSuggestionResult {
  generatedAt: string
  summary: string
  suggestions: AiLinkSuggestionItem[]
}

export interface OrphanAiSuggestionState {
  loading: boolean
  statusMessage: string
  error: string
  result: AiLinkSuggestionResult | null
}

export interface AiLinkSuggestionService {
  suggestForOrphan: (params: {
    config: AiConfig
    sourceDocument: DocumentRecord
    orphan: OrphanItem
    documents: DocumentRecord[]
    themeDocuments: ThemeDocument[]
    existingTags: string[]
    report: ReferenceGraphReport
    onProgress?: (message: string) => void
  }) => Promise<AiLinkSuggestionResult>
}

export function isAiLinkSuggestionConfigComplete(config: AiConfig): boolean {
  return isAiConfigComplete(config)
}

export function createAiLinkSuggestionService(deps: {
  forwardProxy: ForwardProxyFn
}): AiLinkSuggestionService {
  return {
    async suggestForOrphan(params) {
      const locale = resolveUiLocale()
      const logger = createPluginLogger(() => params.config.enableConsoleLogging === true)
      if (!params.config.aiEnabled) {
        throw new Error(t('analytics.aiLink.enableAiInSettingsFirst'))
      }
      if (!isAiLinkSuggestionConfigComplete(params.config)) {
        throw new Error(t('analytics.aiLink.incompleteSettings'))
      }

      const candidates = buildCandidates({
        sourceDocument: params.sourceDocument,
        documents: params.documents,
        themeDocuments: params.themeDocuments,
        report: params.report,
        titleCleanupConfig: params.config,
        locale,
      })

      if (!candidates.length) {
        throw new Error(t('analytics.aiLink.notEnoughCandidateTargets'))
      }

      const rankedCandidates = rankCandidatesWithoutEmbeddings({
        candidates,
      })

      const topCandidates = rankedCandidates
        .sort((left, right) => right.finalScore - left.finalScore || left.title.localeCompare(right.title, 'zh-CN'))
        .slice(0, 6)
      const normalizedSourceDocument = normalizeDocumentTitleFields(params.sourceDocument, params.config)

      params.onProgress?.(t('analytics.aiLink.aiIsAnalyzing'))
      const promptInput: AiLinkSuggestionPromptInput = {
        uiLanguage: locale,
        sourceDocument: {
          id: params.sourceDocument.id,
          title: resolveNormalizedDocumentTitle(normalizedSourceDocument, params.config),
          hpath: normalizedSourceDocument.hpath,
          tags: normalizeTags(params.sourceDocument.tags),
          contentPreview: extractContentPreview(params.sourceDocument.content),
          historicalReferenceCount: params.orphan.historicalReferenceCount,
          hasSparseEvidence: params.orphan.hasSparseEvidence,
        },
        availableThemes: params.themeDocuments.map((themeDocument) => {
          const normalizedThemeDocument = normalizeThemeDocumentForAi(themeDocument, params.config)
          return {
            documentId: themeDocument.documentId,
            title: resolveNormalizedDocumentTitle(normalizedThemeDocument, params.config),
            themeName: themeDocument.themeName,
            matchTerms: themeDocument.matchTerms,
            hpath: normalizedThemeDocument.hpath,
          }
        }),
        existingTags: deduplicateTags(params.existingTags),
        candidates: topCandidates.map(candidate => ({
          id: candidate.documentId,
          title: candidate.title,
          targetType: candidate.targetType,
          baseScore: candidate.baseScore,
          finalScore: candidate.finalScore,
          reasons: candidate.reasons,
        })),
      }
      const prompt = buildAiLinkSuggestionPrompt({
        locale,
        input: promptInput,
      })

      const payload = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: prompt.messages,
      })

      const result = normalizeSuggestionResult(parseJsonFromResponse(payload), logger)
      return await rewriteSuggestionResultForLocaleIfNeeded({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        locale,
        result,
      })
    },
  }
}

async function rewriteSuggestionResultForLocaleIfNeeded(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  locale: UiLocale
  result: AiLinkSuggestionResult
}) {
  if (!shouldRewriteSuggestionResultForLocale(params.result, params.locale)) {
    return params.result
  }

  try {
    const prompt = buildAiLinkRewritePrompt({
      locale: params.locale,
      result: params.result,
    })
    const payload = await requestChatCompletion({
      config: params.config,
      forwardProxy: params.forwardProxy,
      messages: prompt.messages,
    })

    return normalizeSuggestionResult(parseJsonFromResponse(payload), createPluginLogger(() => params.config.enableConsoleLogging === true))
  } catch {
    return params.result
  }
}

function shouldRewriteSuggestionResultForLocale(result: AiLinkSuggestionResult, locale: UiLocale) {
  if (locale !== 'zh_CN') {
    return false
  }

  return collectUserVisibleSuggestionText(result)
    .some(text => isLikelyEnglishSentence(text))
}

function collectUserVisibleSuggestionText(result: AiLinkSuggestionResult) {
  return [
    result.summary,
    ...result.suggestions.flatMap(suggestion => [
      suggestion.reason,
      suggestion.draftText,
      ...(suggestion.tagSuggestions ?? []).map(item => item.reason),
    ]),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function isLikelyEnglishSentence(text: string) {
  const normalized = text.trim()
  if (!normalized || /[\u3400-\u9fff]/.test(normalized)) {
    return false
  }

  const latinWords = normalized.match(/[A-Za-z]{3,}/g) ?? []
  return latinWords.length >= 4
}

function rankCandidatesWithoutEmbeddings(params: {
  candidates: CandidateTarget[]
}) {
  return params.candidates.map(candidate => ({
    ...candidate,
    finalScore: roundScore(candidate.baseScore),
  }))
}

function buildCandidates(params: {
  sourceDocument: DocumentRecord
  documents: DocumentRecord[]
  themeDocuments: ThemeDocument[]
  report: ReferenceGraphReport
  titleCleanupConfig?: DocumentTitleCleanupConfig | null
  locale: UiLocale
}): CandidateTarget[] {
  const documentMap = new Map(params.documents.map(document => [document.id, document]))
  const themeMatches = countThemeMatchesForDocument({
    document: normalizeDocumentTitleFields(params.sourceDocument, params.titleCleanupConfig),
    themeDocuments: params.themeDocuments,
  })

  const themeCandidates = themeMatches
    .slice(0, 4)
    .map((match) => {
      const themeDocument = documentMap.get(match.themeDocumentId)
      if (!themeDocument) {
        return null
      }
      return {
        documentId: match.themeDocumentId,
        title: resolveNormalizedDocumentTitle(themeDocument, params.titleCleanupConfig),
        targetType: 'theme-document' as const,
        reasons: [
          t('analytics.aiLink.candidateThemeMatch', { count: match.matchCount }, params.locale),
          t('analytics.aiLink.candidateTopicEntry', params.locale),
        ],
        baseScore: Math.min(1, 0.55 + match.matchCount * 0.08),
      }
    })
    .filter((item): item is CandidateTarget => item !== null)

  const themeCandidateIds = new Set(themeCandidates.map(item => item.documentId))

  const rankingCandidates = params.report.ranking
    .filter(item => item.documentId !== params.sourceDocument.id && !themeCandidateIds.has(item.documentId))
    .slice(0, 4)
    .map((item) => {
      const document = documentMap.get(item.documentId)
      if (!document) {
        return null
      }
      return {
        documentId: item.documentId,
        title: resolveNormalizedDocumentTitle(document, params.titleCleanupConfig),
        targetType: 'core-document' as const,
        reasons: [
          t('analytics.aiLink.candidateReferencedByDocs', { count: item.distinctSourceDocuments }, params.locale),
          t('analytics.aiLink.candidateInboundRefsCurrentWindow', { count: item.inboundReferences }, params.locale),
        ],
        baseScore: Math.min(1, 0.3 + item.distinctSourceDocuments * 0.12),
      }
    })
    .filter((item): item is CandidateTarget => item !== null)

  return [...themeCandidates, ...rankingCandidates]
}

function normalizeDocumentTitleFields<T extends Pick<DocumentRecord, 'id' | 'title' | 'name' | 'hpath' | 'path'>>(document: T, config?: DocumentTitleCleanupConfig | null): T {
  const normalizedTitle = typeof document.title === 'string'
    ? stripConfiguredTitleAffixes(document.title, config)
    : document.title
  const normalizedName = typeof document.name === 'string'
    ? stripConfiguredTitleAffixes(document.name, config)
    : document.name
  return {
    ...document,
    title: normalizedTitle,
    name: normalizedName,
    hpath: normalizeDocumentHPath(document.hpath, document.title, normalizedTitle, document.name, normalizedName),
    path: normalizeDocumentPath(document.path, document.title, normalizedTitle, document.name, normalizedName),
  }
}

function normalizeDocumentHPath(
  hpath: string | undefined,
  originalTitle: string | undefined,
  normalizedTitle: string | undefined,
  originalName: string | null | undefined,
  normalizedName: string | null | undefined,
) {
  if (!hpath) {
    return hpath
  }

  if (originalTitle && normalizedTitle && hpath.endsWith(originalTitle)) {
    return `${hpath.slice(0, -originalTitle.length)}${normalizedTitle}`
  }

  if (originalName && normalizedName && hpath.endsWith(originalName)) {
    return `${hpath.slice(0, -originalName.length)}${normalizedName}`
  }

  return hpath
}

function normalizeDocumentPath(
  path: string | undefined,
  originalTitle: string | undefined,
  normalizedTitle: string | undefined,
  originalName: string | null | undefined,
  normalizedName: string | null | undefined,
) {
  if (!path) {
    return path
  }

  if (originalTitle && normalizedTitle && path.endsWith(`${originalTitle}.sy`)) {
    return `${path.slice(0, -(`${originalTitle}.sy`).length)}${normalizedTitle}.sy`
  }

  if (originalName && normalizedName && path.endsWith(`${originalName}.sy`)) {
    return `${path.slice(0, -(`${originalName}.sy`).length)}${normalizedName}.sy`
  }

  return path
}

function normalizeThemeDocumentForAi(themeDocument: ThemeDocument, config?: DocumentTitleCleanupConfig | null) {
  return {
    ...themeDocument,
    title: stripConfiguredTitleAffixes(themeDocument.title, config),
    hpath: normalizeDocumentHPath(themeDocument.hpath, themeDocument.title, stripConfiguredTitleAffixes(themeDocument.title, config), undefined, undefined),
  }
}

function extractContentPreview(content?: string) {
  if (!content) {
    return ''
  }
  return content.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function normalizeTags(tags?: readonly string[] | string): string[] {
  if (!tags) {
    return []
  }
  if (Array.isArray(tags)) {
    return tags.map(tag => tag.trim()).filter(Boolean)
  }
  return tags.split(/[,\s#]+/).map(tag => tag.trim()).filter(Boolean)
}

async function requestChatCompletion(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
}) {
  const endpoint = resolveAiEndpoint(params.config.aiBaseUrl!, 'chat/completions')
  const requestOptions = resolveAiRequestOptions(params.config)
  const response = await params.forwardProxy(
    endpoint,
    'POST',
    JSON.stringify({
      model: params.config.aiModel,
      messages: params.messages,
      max_tokens: params.config.aiMaxTokens ?? requestOptions.maxTokens,
      temperature: params.config.aiTemperature ?? requestOptions.temperature,
    }),
    [
      { Authorization: `Bearer ${params.config.aiApiKey}` },
      { Accept: 'application/json' },
    ],
    requestOptions.timeoutMs,
    'application/json',
  )

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(t('analytics.aiLink.requestFailed', { status: response?.status ?? 'unknown status' }))
  }

  return JSON.parse(response.body)
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000
}

function parseJsonFromResponse(payload: any) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(t('analytics.aiLink.unreadableContent'))
  }

  try {
    return JSON.parse(content)
  } catch {
    const startIndex = content.indexOf('{')
    const endIndex = content.lastIndexOf('}')
    if (startIndex >= 0 && endIndex > startIndex) {
      return JSON.parse(content.slice(startIndex, endIndex + 1))
    }
    throw new Error(t('analytics.aiLink.invalidJson'))
  }
}

function normalizeSuggestionResult(payload: any, logger = createPluginLogger(() => false)): AiLinkSuggestionResult {
  const rawSuggestions = extractSuggestionArray(payload)
  const suggestions = rawSuggestions.length
    ? rawSuggestions
      .map((item: any) => normalizeSuggestionItem(item))
      .filter((item: AiLinkSuggestionItem | null): item is AiLinkSuggestionItem => item !== null)
    : []

  if (!suggestions.length) {
    logger.warn('[ai-link-suggestions] AI response contained no usable suggestions', {
      topLevelKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
      rawSuggestionCount: rawSuggestions.length,
      firstSuggestionKeys: rawSuggestions[0] && typeof rawSuggestions[0] === 'object'
        ? Object.keys(rawSuggestions[0])
        : [],
    })
    throw new Error(t('analytics.aiLink.invalidSuggestions'))
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: typeof payload?.summary === 'string' && payload.summary.trim()
      ? payload.summary.trim()
      : t('analytics.aiLink.generatedForCurrentOrphan'),
    suggestions,
  }
}

function extractSuggestionArray(payload: any): any[] {
  if (Array.isArray(payload?.suggestions)) {
    return payload.suggestions
  }
  if (Array.isArray(payload?.links)) {
    return payload.links
  }
  if (Array.isArray(payload?.recommendations)) {
    return payload.recommendations
  }
  if (Array.isArray(payload?.items)) {
    return payload.items
  }
  return []
}

function normalizeSuggestionItem(value: any): AiLinkSuggestionItem | null {
  const targetDocumentId = firstStringValue(value, ['targetDocumentId', 'documentId', 'targetId', 'id'])
  const targetTitle = firstStringValue(value, ['targetTitle', 'title', 'name', 'documentTitle'])
  const reason = mergeSuggestionReason(
    firstStringValue(value, ['reason', 'description', 'rationale', 'explanation']),
    firstStringValue(value, ['expectedBenefit', 'benefit', 'expectedImprovement']),
  )
  if (!targetDocumentId || !targetTitle || !reason) {
    return null
  }

  return {
    targetDocumentId,
    targetTitle,
    targetType: normalizeTargetType(value?.targetType ?? value?.type),
    confidence: normalizeConfidence(value?.confidence),
    reason,
    draftText: firstStringValue(value, ['draftText', 'draft', 'linkText'])
      ? firstStringValue(value, ['draftText', 'draft', 'linkText'])
      : undefined,
    tagSuggestions: normalizeTagSuggestions(value?.tagSuggestions ?? value?.tags ?? value?.suggestedTags),
  }
}

function firstStringValue(value: any, keys: string[]): string {
  for (const key of keys) {
    const candidate = value?.[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return ''
}

function normalizeTargetType(value: unknown): CandidateTargetType {
  if (value === 'theme-document' || value === 'core-document' || value === 'related-document') {
    return value
  }
  return 'related-document'
}

function normalizeConfidence(value: unknown): SuggestionConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  return 'medium'
}

function mergeSuggestionReason(reason: string, expectedBenefit: string): string {
  if (!reason && !expectedBenefit) {
    return ''
  }
  if (!reason) {
    return expectedBenefit
  }
  if (!expectedBenefit) {
    return reason
  }
  if (reason.includes(expectedBenefit) || expectedBenefit.includes(reason)) {
    return reason.length >= expectedBenefit.length ? reason : expectedBenefit
  }
  const normalizedReason = /[。！？.!?]$/.test(reason) ? reason : `${reason}.`
  return `${normalizedReason}${expectedBenefit}`
}

function normalizeTagSuggestions(value: unknown): AiLinkTagSuggestion[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const items = value
    .map(item => normalizeTagSuggestion(item))
    .filter((item): item is AiLinkTagSuggestion => item !== null)

  if (!items.length) {
    return undefined
  }

  const deduplicated = new Map<string, AiLinkTagSuggestion>()
  for (const item of items) {
    const key = item.tag.toLocaleLowerCase()
    if (!deduplicated.has(key)) {
      deduplicated.set(key, item)
    }
  }
  return [...deduplicated.values()]
}

function normalizeTagSuggestion(value: any): AiLinkTagSuggestion | null {
  if (typeof value === 'string') {
    const tag = value.trim()
    return tag ? { tag, source: 'new' } : null
  }
  const tag = firstStringValue(value, ['tag', 'name', 'label'])
  if (!tag) {
    return null
  }

  return {
    tag,
    source: normalizeTagSuggestionSource(value?.source ?? value?.type),
    reason: firstStringValue(value, ['reason', 'description', 'rationale'])
      ? firstStringValue(value, ['reason', 'description', 'rationale'])
      : undefined,
  }
}

function normalizeTagSuggestionSource(value: unknown): TagSuggestionSource {
  return value === 'existing' ? 'existing' : 'new'
}

function deduplicateTags(tags: string[]): string[] {
  return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))]
}
