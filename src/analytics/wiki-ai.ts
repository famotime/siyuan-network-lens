import { isAiConfigComplete, limitChatCompletionMessages, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { WIKI_LLM_OUTPUT_KEYS, type WikiThemeGenerationPayload } from './wiki-generation'
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
  '你是思源笔记里的主题 wiki 页面维护助手。',
  '你会根据主题页、来源文档摘要和结构信号，生成一个主题 wiki 页的结构化 JSON。',
  '必须只输出 JSON，不要输出 Markdown、解释或代码块。',
  'JSON 必须包含 overview、keyDocuments、structureObservations、evidence、actions 五个字段。',
  'overview 必须是字符串；其余字段可以是字符串或字符串数组。',
  '不要编造不存在的文档、主题页、关系或证据。',
  '优先使用输入里已有的 sourceDocuments、signals 和 evidence。',
  '所有面向用户展示的文本必须使用简体中文。',
].join(' ')

export function createAiWikiService(deps: {
  forwardProxy: ForwardProxyFn
}): AiWikiService {
  return {
    async generateThemeSections(params) {
      if (!params.config.aiEnabled) {
        throw new Error('请先在设置中启用 AI 今日建议')
      }
      if (!isAiConfigComplete(params.config)) {
        throw new Error('AI 接入配置不完整，请补充 Base URL、API Key 和 Model')
      }

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `请为主题 wiki 页面生成结构化内容。主题：${params.payload.themeName}。`,
              '请突出主题概览、关键文档、结构观察、关系证据和整理动作。',
              '如果某部分证据不足，可以保守输出“暂无明显...”而不是编造。',
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
    throw new Error(`AI 请求失败（${response?.status ?? '未知状态'}）`)
  }

  try {
    return JSON.parse(response.body)
  } catch {
    throw new Error('AI 接口返回了无法解析的 JSON')
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
    throw new Error('AI 返回内容不是合法 JSON')
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
  throw new Error('AI 接口未返回可读内容')
}

function normalizeThemeSections(value: any): AiWikiThemeSections {
  return {
    overview: normalizeSectionValue(value?.overview, '暂无明显主题概览'),
    keyDocuments: normalizeSectionList(value?.keyDocuments, '暂无关键文档建议'),
    structureObservations: normalizeSectionList(value?.structureObservations, '暂无明显结构观察'),
    evidence: normalizeSectionList(value?.evidence, '暂无明显关系证据'),
    actions: normalizeSectionList(value?.actions, '暂无明确整理动作'),
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
