import { isAiConfigComplete, limitChatCompletionMessages, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { WIKI_LLM_OUTPUT_KEYS, type WikiThemeBundle } from './wiki-generation'
import {
  WIKI_OPTIONAL_SECTION_TYPES,
  WIKI_SECTION_TYPES,
  WIKI_SHARED_SECTION_TYPES,
  WIKI_TEMPLATE_TYPES,
  type WikiPagePlan,
  type WikiSectionDraft,
  type WikiSectionFormat,
  type WikiSectionType,
  type WikiTemplateConfidence,
  type WikiTemplateDiagnosis,
  type WikiTemplateType,
} from './wiki-template-model'
import { resolveSectionOrder } from './wiki-template-selection'
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
  | 'aiRequestTimeoutSeconds'
  | 'aiMaxTokens'
  | 'aiTemperature'
  | 'aiMaxContextMessages'
>

type ChatCompletionMessage = { role: 'system' | 'user' | 'assistant', content: string }

export type AiWikiThemeSections = Record<typeof WIKI_LLM_OUTPUT_KEYS[number], string | string[]>

export interface AiWikiService {
  diagnoseThemeTemplate: (params: {
    config: AiConfig
    payload: WikiThemeBundle
  }) => Promise<WikiTemplateDiagnosis>
  planThemePage: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    diagnosis: WikiTemplateDiagnosis
  }) => Promise<WikiPagePlan>
  generateThemeSection: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    diagnosis: WikiTemplateDiagnosis
    pagePlan: WikiPagePlan
    sectionType: WikiSectionType
  }) => Promise<WikiSectionDraft>
  generateThemeSections: (params: {
    config: AiConfig
    payload: WikiThemeBundle
  }) => Promise<AiWikiThemeSections>
}

const BASE_SYSTEM_PROMPT = [
  'You are a topic wiki maintenance assistant for SiYuan notes.',
  'Base every answer on the provided topic page bundle, source document bundles, template signals, and analysis signals.',
  'Return JSON only.',
  'Do not output Markdown, explanations, or code blocks.',
  'Do not invent documents, topic pages, relationships, evidence, or user-visible claims that are not grounded in the input.',
  'All user-visible text must follow the current workspace UI language.',
].join(' ')

export function createAiWikiService(deps: {
  forwardProxy: ForwardProxyFn
}): AiWikiService {
  return {
    async diagnoseThemeTemplate(params) {
      assertAiReady(params.config)

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          {
            role: 'system',
            content: [
              BASE_SYSTEM_PROMPT,
              'Diagnose the best wiki template for the current theme.',
              'The JSON must include templateType, confidence, reason, enabledModules, suppressedModules, and evidenceSummary.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              t('analytics.wiki.diagnoseThemeTemplatePrompt', { theme: params.payload.themeName }),
              t('analytics.wiki.diagnoseThemeTemplateSchemaPrompt'),
              t('analytics.wiki.conservativeFallbackPrompt'),
              JSON.stringify({ payload: params.payload }),
            ].join('\n'),
          },
        ],
      })

      return normalizeTemplateDiagnosis(parseJsonFromContent(response))
    },

    async planThemePage(params) {
      assertAiReady(params.config)

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          {
            role: 'system',
            content: [
              BASE_SYSTEM_PROMPT,
              'Generate a wiki page plan for the diagnosed theme template.',
              'The JSON must include templateType, confidence, coreSections, optionalSections, sectionOrder, sectionGoals, and sectionFormats.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              t('analytics.wiki.planThemePagePrompt', { theme: params.payload.themeName }),
              t('analytics.wiki.planThemePageSchemaPrompt'),
              t('analytics.wiki.conservativeFallbackPrompt'),
              JSON.stringify({ payload: params.payload, diagnosis: params.diagnosis }),
            ].join('\n'),
          },
        ],
      })

      return normalizePagePlan(parseJsonFromContent(response), params.diagnosis)
    },

    async generateThemeSection(params) {
      assertAiReady(params.config)

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          {
            role: 'system',
            content: [
              BASE_SYSTEM_PROMPT,
              'Generate exactly one wiki section draft.',
              'The JSON must include sectionType, title, format, blocks, and sourceRefs.',
              'Each block must include text and sourceRefs.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              t('analytics.wiki.generateThemeSectionPrompt', { theme: params.payload.themeName, sectionType: params.sectionType }),
              t('analytics.wiki.generateThemeSectionSchemaPrompt'),
              t('analytics.wiki.conservativeFallbackPrompt'),
              JSON.stringify({
                payload: params.payload,
                diagnosis: params.diagnosis,
                pagePlan: params.pagePlan,
                sectionType: params.sectionType,
              }),
            ].join('\n'),
          },
        ],
      })

      return normalizeSectionDraft(parseJsonFromContent(response), params.sectionType)
    },

    async generateThemeSections(params) {
      const diagnosis = await this.diagnoseThemeTemplate(params)
      const pagePlan = await this.planThemePage({
        ...params,
        diagnosis,
      })

      const drafts = await Promise.all(pagePlan.sectionOrder.map(sectionType => this.generateThemeSection({
        ...params,
        diagnosis,
        pagePlan,
        sectionType,
      })))

      return normalizeThemeSectionsFromDrafts(drafts)
    },
  }
}

function assertAiReady(config: AiConfig) {
  if (!config.aiEnabled) {
    throw new Error(t('analytics.wiki.enableTodaySuggestionsInSettings'))
  }
  if (!isAiConfigComplete(config)) {
    throw new Error(t('analytics.wiki.incompleteAiSettings'))
  }
}

async function requestChatCompletion(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  messages: ChatCompletionMessage[]
}) {
  const requestOptions = resolveAiRequestOptions(params.config)
  const endpoint = resolveAiEndpoint(params.config.aiBaseUrl!, 'chat/completions')
  const messages = limitChatCompletionMessages(params.messages, requestOptions.maxContextMessages)
  const body = JSON.stringify({
    model: params.config.aiModel,
    messages,
    max_tokens: requestOptions.maxTokens,
    temperature: requestOptions.temperature,
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
    throw new Error(t('analytics.wiki.aiRequestFailed', { status: response?.status ?? 'unknown status' }))
  }

  try {
    return JSON.parse(response.body)
  } catch {
    throw new Error(t('analytics.wiki.aiReturnedUnparseableJson'))
  }
}

function parseJsonFromContent(payload: any) {
  const content = extractChatCompletionContent(payload)
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/```\s*([\s\S]*?)```/)
  const candidate = fencedMatch?.[1]?.trim() || content.trim()

  try {
    return JSON.parse(candidate)
  } catch {
    const startIndex = candidate.indexOf('{')
    const endIndex = candidate.lastIndexOf('}')
    if (startIndex >= 0 && endIndex > startIndex) {
      return JSON.parse(candidate.slice(startIndex, endIndex + 1))
    }
    throw new Error(t('analytics.wiki.aiReturnedInvalidJson'))
  }
}

function extractChatCompletionContent(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }
        if (typeof part?.text === 'string') {
          return part.text
        }
        return ''
      })
      .join('')
  }
  throw new Error(t('analytics.wiki.aiReturnedUnreadableContent'))
}

function normalizeTemplateDiagnosis(value: any): WikiTemplateDiagnosis {
  const isFallback = !isWikiTemplateType(value?.templateType)
    || !isWikiTemplateConfidence(value?.confidence)
    || !Array.isArray(value?.enabledModules)
    || typeof value?.reason !== 'string'
    || typeof value?.evidenceSummary !== 'string'
  const templateType = isWikiTemplateType(value?.templateType) ? value.templateType : 'tech_topic'
  const confidence = isWikiTemplateConfidence(value?.confidence) ? value.confidence : 'low'
  const enabledModules = normalizeSectionTypeList(
    value?.enabledModules,
    ['intro', 'highlights', 'sources'],
  )
  const suppressedModules = normalizeSectionTypeList(value?.suppressedModules, [])
    .filter(sectionType => !isWikiSharedSectionType(sectionType))

  return {
    templateType,
    confidence,
    reason: normalizeFallbackString(value?.reason, t('analytics.wiki.noClearTemplateReasonYet'), isFallback),
    enabledModules,
    suppressedModules,
    evidenceSummary: normalizeFallbackString(value?.evidenceSummary, t('analytics.wiki.noClearTemplateEvidenceYet'), isFallback),
  }
}

function normalizePagePlan(value: any, diagnosis: WikiTemplateDiagnosis): WikiPagePlan {
  const templateType = isWikiTemplateType(value?.templateType) ? value.templateType : diagnosis.templateType
  const confidence = isWikiTemplateConfidence(value?.confidence) ? value.confidence : diagnosis.confidence
  const coreSections = uniqueSharedSectionTypes([
    'intro',
    'highlights',
    'sources',
    ...normalizeSharedSectionList(value?.coreSections, ['intro', 'highlights', 'sources']),
  ])
  const rawOptionalSections = normalizeOptionalSectionList(
    value?.optionalSections,
    diagnosis.enabledModules.filter((item): item is typeof WIKI_OPTIONAL_SECTION_TYPES[number] =>
      WIKI_OPTIONAL_SECTION_TYPES.includes(item as typeof WIKI_OPTIONAL_SECTION_TYPES[number]),
    ),
  )
  const allowedSections = buildAllowedPagePlanSections({
    enabledModules: diagnosis.enabledModules,
    suppressedModules: diagnosis.suppressedModules,
    optionalSections: rawOptionalSections,
  })
  const optionalSections = rawOptionalSections.filter(sectionType => allowedSections.includes(sectionType))
  const requestedOrder = normalizeSectionTypeList(value?.sectionOrder, [])
  const fallbackUsed = !Array.isArray(value?.coreSections)
    || !Array.isArray(value?.optionalSections)
    || !Array.isArray(value?.sectionOrder)
  const sectionOrder = normalizePlannedSectionOrder(requestedOrder, {
    templateType,
    confidence,
    allowedSections,
  })

  return {
    templateType,
    confidence,
    coreSections,
    optionalSections,
    sectionOrder,
    sectionGoals: normalizeSectionGoalMap(
      value?.sectionGoals,
      sectionOrder,
      fallbackUsed || sectionOrder.some(sectionType => !requestedOrder.includes(sectionType)),
    ),
    sectionFormats: normalizeSectionFormatMap(value?.sectionFormats, sectionOrder),
  }
}

function normalizeSectionDraft(value: any, requestedSectionType: WikiSectionType): WikiSectionDraft {
  const returnedSectionType = isWikiSectionType(value?.sectionType) ? value.sectionType : null
  const sectionType = requestedSectionType
  const format = isWikiSectionFormat(value?.format)
    ? value.format
    : inferSectionFormat(sectionType)
  const fallbackUsed = !Array.isArray(value?.blocks) || typeof value?.title !== 'string'
  const blocks = normalizeDraftBlocks(value?.blocks, sectionType, fallbackUsed)
  const sourceRefs = uniqueStrings([
    ...normalizeStringList(value?.sourceRefs),
    ...blocks.flatMap(block => block.sourceRefs),
  ])

  return {
    sectionType,
    title: normalizeFallbackString(value?.title, defaultSectionTitle(sectionType), fallbackUsed),
    format,
    blocks,
    sourceRefs,
  }
}

function normalizeThemeSectionsFromDrafts(drafts: WikiSectionDraft[]): AiWikiThemeSections {
  const introDraft = drafts.find(item => item.sectionType === 'intro')
  const highlightsDrafts = drafts.filter(item => item.sectionType === 'highlights')
  const sourceDrafts = drafts.filter(item => item.sectionType === 'sources')
  const actionSectionTypes = new Set<WikiSectionType>(['faq', 'troubleshooting', 'misunderstandings', 'open_questions'])
  const middleDrafts = drafts.filter(item => !['intro', 'highlights', 'sources'].includes(item.sectionType) && !actionSectionTypes.has(item.sectionType))

  return {
    overview: introDraft
      ? normalizeSectionValue(draftToLegacyText(introDraft), t('analytics.wiki.noClearTopicOverviewYet'))
      : t('analytics.wiki.noClearTopicOverviewYet'),
    keyDocuments: normalizeSectionList(
      highlightsDrafts.flatMap(draftToLegacyList),
      t('analytics.wiki.noKeyDocumentSuggestionsYet'),
    ),
    structureObservations: normalizeSectionList(
      middleDrafts.flatMap(draftToLegacyList),
      t('analytics.wiki.noClearStructureObservationsYet'),
    ),
    evidence: normalizeSectionList(
      sourceDrafts.flatMap(draftToLegacyList),
      t('analytics.wiki.noClearRelationshipEvidenceYet'),
    ),
    actions: normalizeSectionList(
      drafts
        .filter(item => actionSectionTypes.has(item.sectionType))
        .flatMap(draftToLegacyList),
      t('analytics.wiki.noClearCleanupActionsYet'),
    ),
  }
}

function draftToLegacyText(draft: WikiSectionDraft): string {
  return draft.blocks
    .map(block => block.text.trim())
    .filter(Boolean)
    .join('；')
}

function draftToLegacyList(draft: WikiSectionDraft): string[] {
  return draft.blocks
    .map(block => block.text.trim())
    .filter(Boolean)
}

function normalizeSectionValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  if (Array.isArray(value)) {
    const joined = value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .join('；')
    return joined || fallback
  }
  return fallback
}

function normalizeSectionList(value: unknown, fallback: string): string[] {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
    return items.length ? items : [fallback]
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }
  return [fallback]
}

function normalizeDraftBlocks(value: unknown, sectionType: WikiSectionType, forceFallback = false): WikiSectionDraft['blocks'] {
  if (!forceFallback && Array.isArray(value)) {
    const blocks = value
      .filter((item): item is { text?: unknown, sourceRefs?: unknown } => Boolean(item) && typeof item === 'object')
      .map(item => ({
        text: normalizeString(item.text, ''),
        sourceRefs: normalizeStringList(item.sourceRefs),
      }))
      .filter(item => item.text.length > 0)

    if (blocks.length > 0) {
      return blocks
    }
  }

  return [{
    text: prefixFallback(defaultSectionFallback(sectionType)),
    sourceRefs: [],
  }]
}

function normalizeSectionGoalMap(
  value: unknown,
  allowedSections: WikiSectionType[],
  includeFallbackSignal: boolean,
): WikiPagePlan['sectionGoals'] {
  const result: WikiPagePlan['sectionGoals'] = {}

  if (value && typeof value === 'object') {
    const allowed = new Set(allowedSections)

    for (const [key, item] of Object.entries(value)) {
      if (!allowed.has(key as WikiSectionType)) {
        continue
      }
      const normalized = normalizeString(item, '')
      if (normalized) {
        result[key as WikiSectionType] = normalized
      }
    }
  }

  if (includeFallbackSignal && !result.intro) {
    result.intro = t('analytics.wiki.pagePlanFallbackGoal')
  }

  return result
}

function normalizeSectionFormatMap(value: unknown, allowedSections: WikiSectionType[]): WikiPagePlan['sectionFormats'] {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const allowed = new Set(allowedSections)
  const result: WikiPagePlan['sectionFormats'] = {}

  for (const [key, item] of Object.entries(value)) {
    if (!allowed.has(key as WikiSectionType) || !isWikiSectionFormat(item)) {
      continue
    }
    result[key as WikiSectionType] = item
  }

  return result
}

function normalizePlannedSectionOrder(
  requestedOrder: WikiSectionType[],
  params: {
    templateType: WikiTemplateType
    confidence: WikiTemplateConfidence
    allowedSections: WikiSectionType[]
  },
): WikiSectionType[] {
  const allowedSet = new Set(params.allowedSections)
  const filteredRequested = uniqueSectionTypes(requestedOrder.filter(sectionType => allowedSet.has(sectionType)))
  const requiredSharedBase = WIKI_SHARED_SECTION_TYPES.filter(sectionType => allowedSet.has(sectionType))

  if (
    filteredRequested.length > 0
    && requiredSharedBase.every(sectionType => filteredRequested.includes(sectionType))
  ) {
    return uniqueSectionTypes([
      ...filteredRequested,
      ...requiredSharedBase.filter(sectionType => !filteredRequested.includes(sectionType)),
      ...params.allowedSections.filter(sectionType => !filteredRequested.includes(sectionType) && !WIKI_SHARED_SECTION_TYPES.includes(sectionType as typeof WIKI_SHARED_SECTION_TYPES[number])),
    ])
  }

  const fallbackOrder = resolveSectionOrder({
    templateType: params.templateType,
    enabledModules: uniqueSectionTypes(params.allowedSections),
    confidence: params.confidence,
  }).filter(sectionType => allowedSet.has(sectionType))

  return uniqueSectionTypes(fallbackOrder)
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeFallbackString(value: unknown, fallback: string, fallbackUsed: boolean): string {
  const normalized = normalizeString(value, fallback)
  return fallbackUsed ? prefixFallback(normalized) : normalized
}

function prefixFallback(value: string): string {
  if (!value.trim() || /^(Fallback|回退)：/i.test(value)) {
    return value
  }
  return resolveUiLocale() === 'zh_CN' ? `回退：${value}` : `Fallback: ${value}`
}

function buildAllowedPagePlanSections(params: {
  enabledModules: WikiSectionType[]
  suppressedModules: WikiSectionType[]
  optionalSections: typeof WIKI_OPTIONAL_SECTION_TYPES[number][]
}): WikiSectionType[] {
  const suppressed = new Set(params.suppressedModules.filter(sectionType => !isWikiSharedSectionType(sectionType)))
  const enabledOptionalSections = params.enabledModules.filter((item): item is typeof WIKI_OPTIONAL_SECTION_TYPES[number] =>
    isWikiOptionalSectionType(item),
  )

  return uniqueSectionTypes([
    'intro',
    'highlights',
    ...enabledOptionalSections,
    ...params.optionalSections,
    'sources',
  ]).filter(sectionType => !suppressed.has(sectionType))
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return uniqueStrings(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))
}

function normalizeSectionTypeList(value: unknown, fallback: WikiSectionType[]): WikiSectionType[] {
  if (!Array.isArray(value)) {
    return uniqueSectionTypes(fallback)
  }

  return uniqueSectionTypes(value.filter(isWikiSectionType)).length > 0
    ? uniqueSectionTypes(value.filter(isWikiSectionType))
    : uniqueSectionTypes(fallback)
}

function normalizeSharedSectionList(
  value: unknown,
  fallback: typeof WIKI_SHARED_SECTION_TYPES[number][],
): typeof WIKI_SHARED_SECTION_TYPES[number][] {
  if (!Array.isArray(value)) {
    return uniqueSharedSectionTypes(fallback)
  }

  const sections = uniqueSharedSectionTypes(value.filter(isWikiSharedSectionType))
  return sections.length > 0 ? sections : uniqueSharedSectionTypes(fallback)
}

function normalizeOptionalSectionList(
  value: unknown,
  fallback: typeof WIKI_OPTIONAL_SECTION_TYPES[number][],
): typeof WIKI_OPTIONAL_SECTION_TYPES[number][] {
  if (!Array.isArray(value)) {
    return uniqueOptionalSectionTypes(fallback)
  }

  const sections = uniqueOptionalSectionTypes(value.filter(isWikiOptionalSectionType))
  return sections.length > 0 ? sections : uniqueOptionalSectionTypes(fallback)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function uniqueSectionTypes(values: WikiSectionType[]): WikiSectionType[] {
  return [...new Set(values)]
}

function uniqueSharedSectionTypes(values: typeof WIKI_SHARED_SECTION_TYPES[number][]) {
  return [...new Set(values)]
}

function uniqueOptionalSectionTypes(values: typeof WIKI_OPTIONAL_SECTION_TYPES[number][]) {
  return [...new Set(values)]
}

function inferSectionFormat(sectionType: WikiSectionType): WikiSectionFormat {
  if (sectionType === 'intro') {
    return 'overview'
  }
  if (sectionType === 'sources') {
    return 'catalog'
  }
  if (['faq', 'troubleshooting', 'misunderstandings', 'open_questions'].includes(sectionType)) {
    return 'qa'
  }
  if (['viewpoints', 'controversies'].includes(sectionType)) {
    return 'debate'
  }
  return 'structured'
}

function defaultSectionTitle(sectionType: WikiSectionType): string {
  switch (sectionType) {
    case 'intro':
      return t('analytics.wikiPage.overviewHeading')
    case 'highlights':
      return t('analytics.wikiPage.keyDocumentsHeading')
    case 'sources':
      return t('analytics.wikiPage.evidenceHeading')
    default:
      return sectionType
  }
}

function defaultSectionFallback(sectionType: WikiSectionType): string {
  switch (sectionType) {
    case 'intro':
      return t('analytics.wiki.noClearTopicOverviewYet')
    case 'highlights':
      return t('analytics.wiki.noKeyDocumentSuggestionsYet')
    case 'sources':
      return t('analytics.wiki.noClearRelationshipEvidenceYet')
    case 'faq':
      return t('analytics.wiki.noClearFaqYet')
    case 'troubleshooting':
      return t('analytics.wiki.noClearTroubleshootingYet')
    case 'misunderstandings':
      return t('analytics.wiki.noClearMisunderstandingsYet')
    case 'open_questions':
      return t('analytics.wiki.noClearOpenQuestionsYet')
    default:
      return t('analytics.wiki.noClearStructureObservationsYet')
  }
}

function isWikiTemplateType(value: unknown): value is WikiTemplateType {
  return typeof value === 'string' && WIKI_TEMPLATE_TYPES.includes(value as WikiTemplateType)
}

function isWikiTemplateConfidence(value: unknown): value is WikiTemplateConfidence {
  return value === 'high' || value === 'medium' || value === 'low'
}

function isWikiSectionType(value: unknown): value is WikiSectionType {
  return typeof value === 'string' && WIKI_SECTION_TYPES.includes(value as WikiSectionType)
}

function isWikiSharedSectionType(value: unknown): value is typeof WIKI_SHARED_SECTION_TYPES[number] {
  return typeof value === 'string' && WIKI_SHARED_SECTION_TYPES.includes(value as typeof WIKI_SHARED_SECTION_TYPES[number])
}

function isWikiOptionalSectionType(value: unknown): value is typeof WIKI_OPTIONAL_SECTION_TYPES[number] {
  return typeof value === 'string' && WIKI_OPTIONAL_SECTION_TYPES.includes(value as typeof WIKI_OPTIONAL_SECTION_TYPES[number])
}

function isWikiSectionFormat(value: unknown): value is WikiSectionFormat {
  return value === 'overview' || value === 'structured' || value === 'qa' || value === 'debate' || value === 'catalog'
}
