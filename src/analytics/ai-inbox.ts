import type {
  AnalyticsFilters,
  DocumentRecord,
  ReferenceGraphReport,
  TimeRange,
  TrendDocumentItem,
  TrendReport,
} from './analysis'
import type { SummaryCardItem } from './summary-details'
import {
  DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  DEFAULT_AI_TEMPERATURE,
  type PluginConfig,
} from '@/types/config'

type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type AiLogger = Pick<Console, 'info' | 'warn' | 'error'>

export type AiContextCapacity = 'compact' | 'balanced' | 'full'

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

export type AiInboxItemType = 'document' | 'connection' | 'topic-page' | 'bridge-risk'

export interface AiInboxItem {
  id: string
  type: AiInboxItemType
  title: string
  priority: string
  why: string
  action: string
  benefit: string
  documentIds?: string[]
}

export interface AiInboxResult {
  generatedAt: string
  summary: string
  items: AiInboxItem[]
}

export interface AiInboxConnectionResult {
  ok: boolean
  message: string
}

export interface AiInboxPayload {
  generatedAt: string
  context: {
    capacity: AiContextCapacity
    timeRange: TimeRange
    dormantDays: number
    filters: {
      notebook?: string
      tags?: string[]
      themeNames?: string[]
      keyword?: string
    }
    summaryCards: Array<{ key: string, label: string, value: string, hint: string }>
  }
  signals: {
    ranking: Array<{ documentId: string, title: string, inboundReferences: number, distinctSourceDocuments: number, outboundReferences: number }>
    orphans: Array<{ documentId: string, title: string, updatedAt: string, historicalReferenceCount: number, hasSparseEvidence: boolean }>
    dormant: Array<{ documentId: string, title: string, inactivityDays: number, historicalReferenceCount: number }>
    bridges: Array<{ documentId: string, title: string, degree: number }>
    propagation: Array<{ documentId: string, title: string, score: number, focusDocumentCount: number, communitySpan: number, bridgeRole: boolean }>
    communities: Array<{ communityId: string, size: number, topTags: string[], hubTitles: string[], missingTopicPage: boolean }>
    risingDocuments: Array<{ documentId: string, title: string, currentReferences: number, previousReferences: number, delta: number }>
    fallingDocuments: Array<{ documentId: string, title: string, currentReferences: number, previousReferences: number, delta: number }>
    newConnections: Array<{ title: string, documentIds: string[], referenceCount: number }>
    brokenConnections: Array<{ title: string, documentIds: string[], referenceCount: number }>
  }
}

export interface AiInboxService {
  buildPayload: (params: {
    documents: DocumentRecord[]
    report: ReferenceGraphReport
    trends: TrendReport
    summaryCards: SummaryCardItem[]
    filters: AnalyticsFilters
    timeRange: TimeRange
    dormantDays: number
    contextCapacity?: AiContextCapacity
  }) => AiInboxPayload
  generateInbox: (params: {
    config: AiConfig
    payload: AiInboxPayload
  }) => Promise<AiInboxResult>
  testConnection: (params: {
    config: AiConfig
  }) => Promise<AiInboxConnectionResult>
}

const CAPACITY_LIMITS: Record<AiContextCapacity, {
  signalLimit: number
  connectionLimit: number
  summaryCardLimit: number
}> = {
  compact: {
    signalLimit: 3,
    connectionLimit: 2,
    summaryCardLimit: 4,
  },
  balanced: {
    signalLimit: 6,
    connectionLimit: 5,
    summaryCardLimit: 6,
  },
  full: {
    signalLimit: 10,
    connectionLimit: 8,
    summaryCardLimit: 12,
  },
}

const SYSTEM_PROMPT = [
  '你是思源笔记文档引用网络的整理助手。',
  '你要根据给定的结构化分析结果，输出今天最值得优先处理的整理待办。',
  '必须只输出 JSON，不要输出 Markdown、解释或代码块。',
  'JSON 结构必须是 {"summary": string, "items": AiInboxItem[]}。',
  'items 中每项必须包含 id、type、title、priority、why、action、benefit，可选 documentIds。',
  'type 只能是 document、connection、topic-page、bridge-risk。',
  'priority 用 P1、P2、P3。',
  '优先关注孤立文档、沉没文档、桥接风险、缺主题页社区、趋势变化和关键连接补齐。',
].join(' ')

export function isAiConfigComplete(config: AiConfig): boolean {
  return Boolean(
    config.aiBaseUrl?.trim()
    && config.aiApiKey?.trim()
    && config.aiModel?.trim(),
  )
}

export function createAiInboxService(deps: {
  forwardProxy: ForwardProxyFn
  logger?: AiLogger
}): AiInboxService {
  const logger = deps.logger ?? console

  return {
    buildPayload(params) {
      return buildAiInboxPayload(params)
    },
    async generateInbox(params) {
      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        logger,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              '请基于下面的文档级引用网络分析结果，给出“今天优先处理什么”的统一待办列表。',
              '优先输出 5 到 8 项，尽量覆盖文档整理、补连接、补主题页、桥接风险。',
              '如果证据不足，不要硬造。',
              JSON.stringify(params.payload),
            ].join('\n'),
          },
        ],
      })

      return normalizeAiInboxResult(parseJsonFromContent(response))
    },
    async testConnection(params) {
      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        logger,
        messages: [
          { role: 'system', content: '你是连接测试助手。只返回 OK。' },
          { role: 'user', content: '请只回复 OK' },
        ],
        maxTokensOverride: 20,
      })

      const message = extractChatCompletionContent(response).trim()
      if (!message) {
        throw new Error('AI 接口未返回可读内容')
      }

      return {
        ok: true,
        message: '连接成功',
      }
    },
  }
}

function buildAiInboxPayload(params: {
  documents: DocumentRecord[]
  report: ReferenceGraphReport
  trends: TrendReport
  summaryCards: SummaryCardItem[]
  filters: AnalyticsFilters
  timeRange: TimeRange
  dormantDays: number
  contextCapacity?: AiContextCapacity
}): AiInboxPayload {
  const documentMap = new Map(params.documents.map(document => [document.id, document]))
  const communityById = new Map(params.report.communities.map(community => [community.id, community]))
  const contextCapacity = params.contextCapacity ?? 'balanced'
  const limits = CAPACITY_LIMITS[contextCapacity]

  return {
    generatedAt: new Date().toISOString(),
    context: {
      capacity: contextCapacity,
      timeRange: params.timeRange,
      dormantDays: params.dormantDays,
      filters: {
        notebook: params.filters.notebook,
        tags: params.filters.tags ? [...params.filters.tags] : undefined,
        themeNames: params.filters.themeNames ? [...params.filters.themeNames] : undefined,
        keyword: params.filters.keyword,
      },
      summaryCards: params.summaryCards.slice(0, limits.summaryCardLimit).map(card => ({
        key: card.key,
        label: card.label,
        value: card.value,
        hint: card.hint,
      })),
    },
    signals: {
      ranking: params.report.ranking.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        inboundReferences: item.inboundReferences,
        distinctSourceDocuments: item.distinctSourceDocuments,
        outboundReferences: item.outboundReferences,
      })),
      orphans: params.report.orphans.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        updatedAt: item.updatedAt,
        historicalReferenceCount: item.historicalReferenceCount,
        hasSparseEvidence: item.hasSparseEvidence,
      })),
      dormant: params.report.dormantDocuments.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        inactivityDays: item.inactivityDays,
        historicalReferenceCount: item.historicalReferenceCount,
      })),
      bridges: params.report.bridgeDocuments.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        degree: item.degree,
      })),
      propagation: params.report.propagationNodes.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        score: item.score,
        focusDocumentCount: item.focusDocumentCount,
        communitySpan: item.communitySpan,
        bridgeRole: item.bridgeRole,
      })),
      communities: params.trends.communityTrends.slice(0, limits.signalLimit).map((item) => {
        const community = communityById.get(item.communityId)
        return {
          communityId: item.communityId,
          size: community?.size ?? item.documentIds.length,
          topTags: item.topTags,
          hubTitles: item.hubDocumentIds.map(documentId => resolveDocumentTitle(documentMap, documentId)),
          missingTopicPage: community?.missingTopicPage ?? false,
        }
      }),
      risingDocuments: params.trends.risingDocuments.slice(0, limits.signalLimit).map(item => mapTrendItem(item)),
      fallingDocuments: params.trends.fallingDocuments.slice(0, limits.signalLimit).map(item => mapTrendItem(item)),
      newConnections: params.trends.connectionChanges.newEdges.slice(0, limits.connectionLimit).map(item => ({
        title: buildConnectionTitle(documentMap, item.documentIds),
        documentIds: [...item.documentIds],
        referenceCount: item.referenceCount,
      })),
      brokenConnections: params.trends.connectionChanges.brokenEdges.slice(0, limits.connectionLimit).map(item => ({
        title: buildConnectionTitle(documentMap, item.documentIds),
        documentIds: [...item.documentIds],
        referenceCount: item.referenceCount,
      })),
    },
  }
}

function mapTrendItem(item: TrendDocumentItem) {
  return {
    documentId: item.documentId,
    title: item.title,
    currentReferences: item.currentReferences,
    previousReferences: item.previousReferences,
    delta: item.delta,
  }
}

function resolveDocumentTitle(documentMap: Map<string, DocumentRecord>, documentId: string): string {
  const document = documentMap.get(documentId)
  return document?.title || document?.hpath || document?.path || documentId
}

function buildConnectionTitle(documentMap: Map<string, DocumentRecord>, documentIds: string[]): string {
  return documentIds.map(documentId => resolveDocumentTitle(documentMap, documentId)).join(' <-> ')
}

async function requestChatCompletion(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  logger: AiLogger
  messages: ChatCompletionMessage[]
  maxTokensOverride?: number
}) {
  if (!params.config.aiEnabled) {
    throw new Error('请先在设置中启用 AI 整理收件箱')
  }
  if (!isAiConfigComplete(params.config)) {
    throw new Error('AI 接入配置不完整，请补充 Base URL、API Key 和 Model')
  }

  const requestOptions = resolveAiRequestOptions(params.config)
  const endpoint = `${params.config.aiBaseUrl!.replace(/\/+$/, '')}/chat/completions`
  const messages = limitChatCompletionMessages(params.messages, requestOptions.maxContextMessages)
  const body = JSON.stringify({
    model: params.config.aiModel,
    messages,
    max_tokens: params.maxTokensOverride ?? requestOptions.maxTokens,
    temperature: requestOptions.temperature,
  })
  const requestTrace = {
    endpoint,
    timeoutMs: requestOptions.timeoutMs,
    model: params.config.aiModel ?? '',
    maxTokens: params.maxTokensOverride ?? requestOptions.maxTokens,
    temperature: requestOptions.temperature,
    maxContextMessages: requestOptions.maxContextMessages,
    totalMessages: params.messages.length,
    sentMessages: messages.length,
    requestBytes: body.length,
  }

  params.logger.info('[NetworkLens][AI] Request start', requestTrace)

  let response: IResForwardProxy
  try {
    response = await params.forwardProxy(
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    params.logger.error('[NetworkLens][AI] Request failed', {
      ...requestTrace,
      errorMessage,
    })
    throw buildAiRequestError({
      cause: error,
      endpoint,
      timeoutMs: requestOptions.timeoutMs,
      model: params.config.aiModel ?? '',
      maxTokens: params.maxTokensOverride ?? requestOptions.maxTokens,
      temperature: requestOptions.temperature,
      maxContextMessages: requestOptions.maxContextMessages,
    })
  }

  params.logger.info('[NetworkLens][AI] Response received', {
    ...requestTrace,
    status: response?.status ?? 'unknown',
    elapsed: response?.elapsed ?? 'unknown',
  })

  if (!response || response.status < 200 || response.status >= 300) {
    const status = response?.status ?? '未知状态'
    params.logger.warn('[NetworkLens][AI] Non-2xx response', {
      ...requestTrace,
      status,
      responseBody: response?.body?.slice(0, 500) ?? '',
    })
    throw new Error(`AI 请求失败（${status}）`)
  }

  let payload: any
  try {
    payload = JSON.parse(response.body)
  } catch {
    params.logger.warn('[NetworkLens][AI] Invalid JSON response', {
      ...requestTrace,
      status: response.status,
      responseBody: response.body?.slice(0, 500) ?? '',
    })
    throw new Error('AI 接口返回了无法解析的 JSON')
  }

  return payload
}

export function resolveAiRequestOptions(config: Pick<
  PluginConfig,
  'aiRequestTimeoutSeconds' | 'aiMaxTokens' | 'aiTemperature' | 'aiMaxContextMessages'
>) {
  return {
    timeoutMs: normalizePositiveInteger(config.aiRequestTimeoutSeconds, DEFAULT_AI_REQUEST_TIMEOUT_SECONDS) * 1000,
    maxTokens: normalizePositiveInteger(config.aiMaxTokens, DEFAULT_AI_MAX_TOKENS),
    temperature: normalizeTemperature(config.aiTemperature, DEFAULT_AI_TEMPERATURE),
    maxContextMessages: normalizePositiveInteger(config.aiMaxContextMessages, DEFAULT_AI_MAX_CONTEXT_MESSAGES),
  }
}

export function limitChatCompletionMessages(messages: ChatCompletionMessage[], maxContextMessages: number) {
  const systemMessages = messages.filter(message => message.role === 'system')
  const conversationalMessages = messages.filter(message => message.role !== 'system')

  return [
    ...systemMessages,
    ...conversationalMessages.slice(-Math.max(1, maxContextMessages)),
  ]
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

function normalizeAiInboxResult(value: any): AiInboxResult {
  const items = Array.isArray(value?.items)
    ? value.items
        .map((item: any, index: number) => normalizeAiInboxItem(item, index))
        .filter((item: AiInboxItem | null): item is AiInboxItem => item !== null)
    : []

  if (items.length === 0) {
    throw new Error('AI 未返回有效的整理待办')
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: typeof value?.summary === 'string' && value.summary.trim()
      ? value.summary.trim()
      : '已根据当前引用网络生成整理优先级。',
    items,
  }
}

function normalizeAiInboxItem(value: any, index: number): AiInboxItem | null {
  const title = typeof value?.title === 'string' ? value.title.trim() : ''
  const why = typeof value?.why === 'string' ? value.why.trim() : ''
  const action = typeof value?.action === 'string' ? value.action.trim() : ''
  const benefit = typeof value?.benefit === 'string' ? value.benefit.trim() : ''

  if (!title || !why || !action || !benefit) {
    return null
  }

  const type = normalizeAiInboxItemType(value?.type)
  const priority = normalizePriority(value?.priority)
  const documentIds = Array.isArray(value?.documentIds)
    ? value.documentIds.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined

  return {
    id: typeof value?.id === 'string' && value.id.trim()
      ? value.id.trim()
      : `ai-item-${index + 1}`,
    type,
    title,
    priority,
    why,
    action,
    benefit,
    documentIds: documentIds?.length ? documentIds : undefined,
  }
}

function normalizeAiInboxItemType(value: unknown): AiInboxItemType {
  if (value === 'document' || value === 'connection' || value === 'topic-page' || value === 'bridge-risk') {
    return value
  }
  return 'document'
}

function normalizePriority(value: unknown): string {
  if (value === 'P1' || value === 'P2' || value === 'P3') {
    return value
  }
  return 'P2'
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const normalized = typeof value === 'number'
    ? Math.floor(value)
    : typeof value === 'string' && value.trim()
      ? Number.parseInt(value, 10)
      : Number.NaN

  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : fallback
}

function normalizeTemperature(value: unknown, fallback: number): number {
  const normalized = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number.parseFloat(value)
      : Number.NaN

  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 2
    ? normalized
    : fallback
}

function buildAiRequestError(params: {
  cause: unknown
  endpoint: string
  timeoutMs: number
  model: string
  maxTokens: number
  temperature: number
  maxContextMessages: number
}) {
  const rawMessage = params.cause instanceof Error ? params.cause.message : String(params.cause)
  const hints: string[] = [
    `请求地址：${params.endpoint}`,
    `超时配置：${Math.round(params.timeoutMs / 1000)} 秒`,
    `模型：${params.model}`,
    `max_tokens：${params.maxTokens}`,
    `temperature：${params.temperature}`,
    `最大上下文数：${params.maxContextMessages}`,
  ]

  if (isLikelyMissingV1Path(params.endpoint)) {
    hints.push(`Base URL 很可能应包含 /v1；当前请求落到了 ${params.endpoint}`)
  }

  if (params.endpoint.startsWith('https://api.siliconflow.cn/chat/completions')) {
    hints.push('SiliconFlow 可优先检查 Base URL 是否填写为 https://api.siliconflow.cn/v1')
  }

  if (rawMessage.includes('context deadline exceeded')) {
    hints.push('这是请求超时。优先检查 Base URL、网络连通性，并尝试切换为“紧凑”、降低最大 Token 数或继续增大超时时间')
    return new Error(`AI 请求超时：${rawMessage}\n${hints.join('\n')}`)
  }

  return new Error(`AI 请求失败：${rawMessage}\n${hints.join('\n')}`)
}

function isLikelyMissingV1Path(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return !url.pathname.includes('/v1/')
  } catch {
    return false
  }
}
