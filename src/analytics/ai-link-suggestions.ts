import type { DocumentRecord, OrphanItem, ReferenceGraphReport } from './analysis'
import { resolveDocumentTitle } from './document-utils'
import { countThemeMatchesForDocument, type ThemeDocument } from './theme-documents'
import { isAiConfigComplete, resolveAiRequestOptions } from './ai-inbox'
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

type CandidateTargetType = 'theme-document' | 'core-document' | 'related-document'
type SuggestionConfidence = 'high' | 'medium' | 'low'

interface CandidateTarget {
  documentId: string
  title: string
  targetType: CandidateTargetType
  embeddingInput: string
  reasons: string[]
  baseScore: number
}

export interface AiLinkSuggestionItem {
  targetDocumentId: string
  targetTitle: string
  targetType: CandidateTargetType
  confidence: SuggestionConfidence
  reason: string
  expectedBenefit: string
  draftText?: string
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
    report: ReferenceGraphReport
    onProgress?: (message: string) => void
  }) => Promise<AiLinkSuggestionResult>
}

const SUGGESTION_SYSTEM_PROMPT = [
  '你是思源笔记的补链建议助手。',
  '你只可以在给定候选目标中选择，不要发明不存在的文档。',
  '必须返回 JSON，格式为 {"summary": string, "suggestions": Suggestion[] }。',
  '每条 Suggestion 必须包含 targetDocumentId、targetTitle、targetType、confidence、reason、expectedBenefit，可选 draftText。',
  'reason 必须结合 embedding 分数、主题命中或结构角色解释。',
  'expectedBenefit 必须写成处理后的可观察变化，不要写宽泛空话。',
  '如果主题页明显合适，优先推荐主题页。',
].join(' ')

export function isAiLinkSuggestionConfigComplete(config: AiConfig): boolean {
  return isAiConfigComplete(config)
}

export function createAiLinkSuggestionService(deps: {
  forwardProxy: ForwardProxyFn
}): AiLinkSuggestionService {
  return {
    async suggestForOrphan(params) {
      if (!params.config.aiEnabled) {
        throw new Error('请先在设置中启用 AI 功能')
      }
      if (!isAiLinkSuggestionConfigComplete(params.config)) {
        throw new Error('AI 补链建议配置不完整，请补充 Base URL、API Key 和 Model')
      }

      const candidates = buildCandidates({
        sourceDocument: params.sourceDocument,
        documents: params.documents,
        themeDocuments: params.themeDocuments,
        report: params.report,
      })

      if (!candidates.length) {
        throw new Error('当前没有足够的候选目标可供 AI 补链')
      }

      const embeddingModel = params.config.aiEmbeddingModel?.trim()
      const rankedCandidates = embeddingModel
        ? await rankCandidatesWithEmbeddings({
            config: params.config,
            forwardProxy: deps.forwardProxy,
            candidates,
            sourceDocument: params.sourceDocument,
            onProgress: params.onProgress,
          })
        : rankCandidatesWithoutEmbeddings({
            candidates,
            onProgress: params.onProgress,
          })

      const topCandidates = rankedCandidates
        .sort((left, right) => right.finalScore - left.finalScore || left.title.localeCompare(right.title, 'zh-CN'))
        .slice(0, 6)

      params.onProgress?.('AI 正在整理推荐理由与插入文案…')

      const payload = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          { role: 'system', content: SUGGESTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              sourceDocument: {
                id: params.sourceDocument.id,
                title: resolveDocumentTitle(params.sourceDocument),
                hpath: params.sourceDocument.hpath,
                tags: normalizeTags(params.sourceDocument.tags),
                contentPreview: extractContentPreview(params.sourceDocument.content),
                historicalReferenceCount: params.orphan.historicalReferenceCount,
                hasSparseEvidence: params.orphan.hasSparseEvidence,
              },
              candidates: topCandidates.map(candidate => ({
                id: candidate.documentId,
                title: candidate.title,
                targetType: candidate.targetType,
                baseScore: candidate.baseScore,
                embeddingScore: candidate.embeddingScore,
                finalScore: candidate.finalScore,
                reasons: candidate.reasons,
              })),
            }),
          },
        ],
      })

      return normalizeSuggestionResult(parseJsonFromResponse(payload))
    },
  }
}

async function rankCandidatesWithEmbeddings(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  sourceDocument: DocumentRecord
  candidates: CandidateTarget[]
  onProgress?: (message: string) => void
}) {
  params.onProgress?.('正在分析文档语义并生成 embedding…')
  const embeddingRequestInputs = [
    buildEmbeddingInput(params.sourceDocument),
    ...params.candidates.map(candidate => candidate.embeddingInput),
  ]
  const embeddings = await requestEmbeddings({
    config: params.config,
    forwardProxy: params.forwardProxy,
    inputs: embeddingRequestInputs,
  })
  const sourceEmbedding = embeddings[0]

  params.onProgress?.('正在基于 embedding 与结构信号召回候选…')
  return params.candidates
    .map((candidate, index) => ({
      ...candidate,
      embeddingScore: cosineSimilarity(sourceEmbedding, embeddings[index + 1]),
    }))
    .map(candidate => ({
      ...candidate,
      finalScore: roundScore(candidate.baseScore * 0.45 + candidate.embeddingScore * 0.55),
    }))
}

function rankCandidatesWithoutEmbeddings(params: {
  candidates: CandidateTarget[]
  onProgress?: (message: string) => void
}) {
  params.onProgress?.('未配置 Embedding Model，改为基于主题命中与结构信号召回候选…')
  return params.candidates.map(candidate => ({
    ...candidate,
    embeddingScore: 0,
    finalScore: roundScore(candidate.baseScore),
  }))
}

function buildCandidates(params: {
  sourceDocument: DocumentRecord
  documents: DocumentRecord[]
  themeDocuments: ThemeDocument[]
  report: ReferenceGraphReport
}): CandidateTarget[] {
  const documentMap = new Map(params.documents.map(document => [document.id, document]))
  const themeMatches = countThemeMatchesForDocument({
    document: params.sourceDocument,
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
        title: match.themeDocumentTitle,
        targetType: 'theme-document' as const,
        embeddingInput: buildEmbeddingInput(themeDocument),
        reasons: [
          `主题匹配命中 ${match.matchCount} 次`,
          '该目标承担主题入口角色',
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
        title: item.title,
        targetType: 'core-document' as const,
        embeddingInput: buildEmbeddingInput(document),
        reasons: [
          `被 ${item.distinctSourceDocuments} 个文档引用`,
          `当前窗口内共有 ${item.inboundReferences} 次入链`,
        ],
        baseScore: Math.min(1, 0.3 + item.distinctSourceDocuments * 0.12),
      }
    })
    .filter((item): item is CandidateTarget => item !== null)

  return [...themeCandidates, ...rankingCandidates]
}

function buildEmbeddingInput(document: Pick<DocumentRecord, 'title' | 'name' | 'hpath' | 'path' | 'tags' | 'content'>): string {
  return [
    `标题：${resolveDocumentTitle(document as DocumentRecord)}`,
    document.hpath ? `路径：${document.hpath}` : '',
    normalizeTags(document.tags).length ? `标签：${normalizeTags(document.tags).join(', ')}` : '',
    extractContentPreview(document.content),
  ].filter(Boolean).join('\n')
}

function extractContentPreview(content?: string) {
  if (!content) {
    return ''
  }
  return `正文片段：${content.replace(/\s+/g, ' ').trim().slice(0, 240)}`
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

async function requestEmbeddings(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  inputs: string[]
}) {
  const endpoint = `${params.config.aiBaseUrl!.replace(/\/+$/, '')}/embeddings`
  const requestOptions = resolveAiRequestOptions(params.config)
  const response = await params.forwardProxy(
    endpoint,
    'POST',
    JSON.stringify({
      model: params.config.aiEmbeddingModel,
      input: params.inputs,
    }),
    [
      { Authorization: `Bearer ${params.config.aiApiKey}` },
      { Accept: 'application/json' },
    ],
    requestOptions.timeoutMs,
    'application/json',
  )

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(`Embedding 请求失败（${response?.status ?? '未知状态'}）`)
  }

  const payload = JSON.parse(response.body)
  const embeddings = Array.isArray(payload?.data)
    ? payload.data.map((item: any) => Array.isArray(item?.embedding) ? item.embedding : [])
    : []

  if (embeddings.length !== params.inputs.length) {
    throw new Error('Embedding 返回数量与输入数量不一致')
  }

  return embeddings
}

async function requestChatCompletion(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
}) {
  const endpoint = `${params.config.aiBaseUrl!.replace(/\/+$/, '')}/chat/completions`
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
    throw new Error(`AI 补链建议请求失败（${response?.status ?? '未知状态'}）`)
  }

  return JSON.parse(response.body)
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) {
    return 0
  }

  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  if (!leftNorm || !rightNorm) {
    return 0
  }
  return roundScore(dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)))
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000
}

function parseJsonFromResponse(payload: any) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 未返回可读的补链建议内容')
  }

  try {
    return JSON.parse(content)
  } catch {
    const startIndex = content.indexOf('{')
    const endIndex = content.lastIndexOf('}')
    if (startIndex >= 0 && endIndex > startIndex) {
      return JSON.parse(content.slice(startIndex, endIndex + 1))
    }
    throw new Error('AI 补链建议返回的不是合法 JSON')
  }
}

function normalizeSuggestionResult(payload: any): AiLinkSuggestionResult {
  const suggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions
      .map((item: any) => normalizeSuggestionItem(item))
      .filter((item: AiLinkSuggestionItem | null): item is AiLinkSuggestionItem => item !== null)
    : []

  if (!suggestions.length) {
    throw new Error('AI 没有返回有效的补链建议')
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: typeof payload?.summary === 'string' && payload.summary.trim()
      ? payload.summary.trim()
      : '已生成当前孤立文档的 AI 补链建议。',
    suggestions,
  }
}

function normalizeSuggestionItem(value: any): AiLinkSuggestionItem | null {
  const targetDocumentId = typeof value?.targetDocumentId === 'string' ? value.targetDocumentId.trim() : ''
  const targetTitle = typeof value?.targetTitle === 'string' ? value.targetTitle.trim() : ''
  const reason = typeof value?.reason === 'string' ? value.reason.trim() : ''
  const expectedBenefit = typeof value?.expectedBenefit === 'string' ? value.expectedBenefit.trim() : ''
  if (!targetDocumentId || !targetTitle || !reason || !expectedBenefit) {
    return null
  }

  return {
    targetDocumentId,
    targetTitle,
    targetType: normalizeTargetType(value?.targetType),
    confidence: normalizeConfidence(value?.confidence),
    reason,
    expectedBenefit,
    draftText: typeof value?.draftText === 'string' && value.draftText.trim()
      ? value.draftText.trim()
      : undefined,
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
