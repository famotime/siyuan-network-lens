import type { DocumentRecord, OrphanItem, ReferenceGraphReport } from './analysis'
import {
  resolveNormalizedDocumentTitle,
  stripConfiguredTitleAffixes,
  type DocumentTitleCleanupConfig,
} from './document-utils'
import { countThemeMatchesForDocument, type ThemeDocument } from './theme-documents'
import { isAiConfigComplete, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { resolveUiLocale, t, type UiLocale } from '@/i18n/ui'
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
  | 'aiRequestTimeoutSeconds'
  | 'aiMaxTokens'
  | 'aiTemperature'
  | 'aiMaxContextMessages'
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

const SUGGESTION_SYSTEM_PROMPT = [
  'You are a link-repair assistant for SiYuan notes.',
  'Only choose from the provided candidate targets. Do not invent documents that do not exist.',
  'You must return JSON in the format {"summary": string, "suggestions": Suggestion[] }.',
  'Each Suggestion must include targetDocumentId, targetTitle, targetType, confidence, and reason, with optional draftText and tagSuggestions.',
  'reason must merge the recommendation basis and the main expected improvement into one concise explanation.',
  'tagSuggestions is an array of tag suggestions. Each item includes tag, source, and reason; source can only be existing or new.',
  'For tag suggestions, actively propose both: (1) existing tags from the existingTags list that fit the document content, and (2) new tags that do not exist yet but would be reasonable and useful for organizing the document. New tags should follow the naming style and granularity of the existing tags.',
  'If a topic page is clearly suitable, prefer recommending the topic page.',
  'All user-visible text must follow the current workspace UI language.',
].join(' ')

const SUGGESTION_REWRITE_SYSTEM_PROMPT = [
  'You normalize SiYuan link suggestion JSON into the requested workspace language.',
  'Return JSON only.',
  'Keep targetDocumentId, targetTitle, targetType, confidence, tag text, and source unchanged.',
  'Only rewrite summary, reason, draftText, and tagSuggestions.reason.',
  'Do not add, remove, or reorder suggestions or tagSuggestions.',
].join(' ')

export function isAiLinkSuggestionConfigComplete(config: AiConfig): boolean {
  return isAiConfigComplete(config)
}

export function createAiLinkSuggestionService(deps: {
  forwardProxy: ForwardProxyFn
}): AiLinkSuggestionService {
  return {
    async suggestForOrphan(params) {
      const locale = resolveUiLocale()
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

      const payload = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          { role: 'system', content: buildSuggestionSystemPrompt(locale) },
          {
            role: 'user',
            content: JSON.stringify({
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
            }),
          },
        ],
      })

      const result = normalizeSuggestionResult(parseJsonFromResponse(payload))
      return await rewriteSuggestionResultForLocaleIfNeeded({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        locale,
        result,
      })
    },
  }
}

function buildSuggestionSystemPrompt(locale: UiLocale) {
  const targetLanguage = locale === 'zh_CN' ? 'Simplified Chinese' : 'English'
  return `${SUGGESTION_SYSTEM_PROMPT} Current workspace locale is ${locale}. Write summary, reason, draftText, and tagSuggestions.reason in ${targetLanguage}.`
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
    const payload = await requestChatCompletion({
      config: params.config,
      forwardProxy: params.forwardProxy,
      messages: [
        {
          role: 'system',
          content: buildSuggestionRewriteSystemPrompt(params.locale),
        },
        {
          role: 'user',
          content: JSON.stringify({
            locale: params.locale,
            summary: params.result.summary,
            suggestions: params.result.suggestions,
          }),
        },
      ],
    })

    return normalizeSuggestionResult(parseJsonFromResponse(payload))
  } catch {
    return params.result
  }
}

function buildSuggestionRewriteSystemPrompt(locale: UiLocale) {
  const targetLanguage = locale === 'zh_CN' ? 'Simplified Chinese' : 'English'
  return `${SUGGESTION_REWRITE_SYSTEM_PROMPT} Rewrite the user-visible copy into ${targetLanguage}.`
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

function normalizeSuggestionResult(payload: any): AiLinkSuggestionResult {
  const suggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions
      .map((item: any) => normalizeSuggestionItem(item))
      .filter((item: AiLinkSuggestionItem | null): item is AiLinkSuggestionItem => item !== null)
    : []

  if (!suggestions.length) {
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

function normalizeSuggestionItem(value: any): AiLinkSuggestionItem | null {
  const targetDocumentId = typeof value?.targetDocumentId === 'string' ? value.targetDocumentId.trim() : ''
  const targetTitle = typeof value?.targetTitle === 'string' ? value.targetTitle.trim() : ''
  const reason = mergeSuggestionReason(
    typeof value?.reason === 'string' ? value.reason.trim() : '',
    typeof value?.expectedBenefit === 'string' ? value.expectedBenefit.trim() : '',
  )
  if (!targetDocumentId || !targetTitle || !reason) {
    return null
  }

  return {
    targetDocumentId,
    targetTitle,
    targetType: normalizeTargetType(value?.targetType),
    confidence: normalizeConfidence(value?.confidence),
    reason,
    draftText: typeof value?.draftText === 'string' && value.draftText.trim()
      ? value.draftText.trim()
      : undefined,
    tagSuggestions: normalizeTagSuggestions(value?.tagSuggestions),
  }
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
  const tag = typeof value?.tag === 'string' ? value.tag.trim() : ''
  if (!tag) {
    return null
  }

  return {
    tag,
    source: normalizeTagSuggestionSource(value?.source),
    reason: typeof value?.reason === 'string' && value.reason.trim()
      ? value.reason.trim()
      : undefined,
  }
}

function normalizeTagSuggestionSource(value: unknown): TagSuggestionSource {
  return value === 'existing' ? 'existing' : 'new'
}

function deduplicateTags(tags: string[]): string[] {
  return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))]
}
