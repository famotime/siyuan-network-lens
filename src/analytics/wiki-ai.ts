import { isAiConfigComplete, limitChatCompletionMessages, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { WIKI_LLM_OUTPUT_KEYS, type WikiThemeGenerationPayload } from './wiki-generation'
import { t } from '@/i18n/ui'
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
  generateThemeSections: (params: {
    config: AiConfig
    payload: WikiThemeGenerationPayload
  }) => Promise<AiWikiThemeSections>
}

const SYSTEM_PROMPT = [
  'You are a topic wiki maintenance assistant for SiYuan notes.',
  'Based on the topic page, source document summaries, and structure signals, generate structured JSON for one topic wiki page.',
  'Return JSON only. Do not output Markdown, explanations, or code blocks.',
  'The JSON must include overview, keyDocuments, structureObservations, evidence, and actions.',
  'overview must be a string; the other fields may be strings or arrays of strings.',
  'Do not invent documents, topic pages, relationships, or evidence that do not exist.',
  'Prefer using sourceDocuments, signals, and evidence already provided in the input.',
  'All user-visible text must follow the current workspace UI language.',
].join(' ')

export function createAiWikiService(deps: {
  forwardProxy: ForwardProxyFn
}): AiWikiService {
  return {
    async generateThemeSections(params) {
      if (!params.config.aiEnabled) {
        throw new Error(t('analytics.wiki.enableTodaySuggestionsInSettings'))
      }
      if (!isAiConfigComplete(params.config)) {
        throw new Error(t('analytics.wiki.incompleteAiSettings'))
      }

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              t('analytics.wiki.generateStructuredContentPrompt', { theme: params.payload.themeName }),
              t('analytics.wiki.emphasizeSectionsPrompt'),
              t('analytics.wiki.conservativeFallbackPrompt'),
              JSON.stringify(params.payload),
            ].join('\n'),
          },
        ],
      })

      return normalizeThemeSections(parseJsonFromContent(response))
    },
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

function normalizeThemeSections(value: any): AiWikiThemeSections {
  return {
    overview: normalizeSectionValue(value?.overview, t('analytics.wiki.noClearTopicOverviewYet')),
    keyDocuments: normalizeSectionList(value?.keyDocuments, t('analytics.wiki.noKeyDocumentSuggestionsYet')),
    structureObservations: normalizeSectionList(value?.structureObservations, t('analytics.wiki.noClearStructureObservationsYet')),
    evidence: normalizeSectionList(value?.evidence, t('analytics.wiki.noClearRelationshipEvidenceYet')),
    actions: normalizeSectionList(value?.actions, t('analytics.wiki.noClearCleanupActionsYet')),
  }
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
