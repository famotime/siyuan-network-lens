import { isAiConfigComplete, limitChatCompletionMessages, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { WIKI_LLM_OUTPUT_KEYS, type WikiThemeGenerationPayload } from './wiki-generation'
import { pickUiText } from '@/i18n/ui'
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
const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

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
        throw new Error(uiText('Enable today suggestions in Settings first', '请先在设置中启用 AI 今日建议'))
      }
      if (!isAiConfigComplete(params.config)) {
        throw new Error(uiText('AI settings are incomplete. Add Base URL, API Key, and Model.', 'AI 接入配置不完整，请补充 Base URL、API Key 和 Model'))
      }

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              uiText(
                `Generate structured content for the topic wiki page. Topic: ${params.payload.themeName}.`,
                `请为主题 wiki 页面生成结构化内容。主题：${params.payload.themeName}。`,
              ),
              uiText(
                'Emphasize the topic overview, key documents, structure observations, relationship evidence, and cleanup actions.',
                '请突出主题概览、关键文档、结构观察、关系证据和整理动作。',
              ),
              uiText(
                'If evidence is weak in any section, respond conservatively with "No clear ..." instead of inventing content.',
                '如果某部分证据不足，可以保守输出“暂无明显...”而不是编造。',
              ),
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
    throw new Error(uiText(`AI request failed (${response?.status ?? 'unknown status'})`, `AI 请求失败（${response?.status ?? '未知状态'}）`))
  }

  try {
    return JSON.parse(response.body)
  } catch {
    throw new Error(uiText('AI returned JSON that could not be parsed', 'AI 接口返回了无法解析的 JSON'))
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
    throw new Error(uiText('AI did not return valid JSON', 'AI 返回内容不是合法 JSON'))
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
  throw new Error(uiText('AI did not return readable content', 'AI 接口未返回可读内容'))
}

function normalizeThemeSections(value: any): AiWikiThemeSections {
  return {
    overview: normalizeSectionValue(value?.overview, uiText('No clear topic overview yet', '暂无明显主题概览')),
    keyDocuments: normalizeSectionList(value?.keyDocuments, uiText('No key document suggestions yet', '暂无关键文档建议')),
    structureObservations: normalizeSectionList(value?.structureObservations, uiText('No clear structure observations yet', '暂无明显结构观察')),
    evidence: normalizeSectionList(value?.evidence, uiText('No clear relationship evidence yet', '暂无明显关系证据')),
    actions: normalizeSectionList(value?.actions, uiText('No clear cleanup actions yet', '暂无明确整理动作')),
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
