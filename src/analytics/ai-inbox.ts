import type {
  AnalyticsFilters,
  DocumentRecord,
  ReferenceGraphReport,
  TimeRange,
  TrendDocumentItem,
  TrendReport,
} from './analysis'
import type { SummaryCardItem } from './summary-details'
import { parseSiyuanTimestamp } from './document-utils'
import { countThemeMatchesForDocument, type ThemeDocument } from './theme-documents'
import { isWikiDocumentTitle } from './wiki-page-model'
import { pickUiText } from '@/i18n/ui'
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
export type AiInboxTargetKind = 'theme-document' | 'core-document' | 'community-hub' | 'related-document'
export type AiInboxActionCandidateType = 'repair-link' | 'create-topic-page' | 'maintain-bridge' | 'archive-dormant'
export type AiInboxConfidence = 'high' | 'medium' | 'low'

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

export interface AiInboxRecommendedTarget {
  documentId?: string
  title: string
  kind: AiInboxTargetKind
  reason: string
}

export interface AiInboxPriorityBreakdown {
  impactScore: number
  urgencyScore: number
  actionabilityScore: number
  confidenceScore: number
  priorityScore: number
}

export interface AiInboxItem {
  id: string
  type: AiInboxItemType
  title: string
  priority: string
  action: string
  reason: string
  documentIds?: string[]
  confidence?: AiInboxConfidence
  recommendedTargets?: AiInboxRecommendedTarget[]
  evidence?: string[]
  expectedChanges?: string[]
  priorityBreakdown?: AiInboxPriorityBreakdown
}

export interface AiInboxActionCandidate extends AiInboxPriorityBreakdown {
  id: string
  type: AiInboxActionCandidateType
  title: string
  focusDocumentIds: string[]
  confidence: AiInboxConfidence
  recommendedAction: string
  recommendedTargets: AiInboxRecommendedTarget[]
  evidence: string[]
  expectedBenefits: string[]
  draftText?: string
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

export interface AiModelCatalogResult {
  chatModels: string[]
  embeddingModels: string[]
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
  actionCandidates: AiInboxActionCandidate[]
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
    themeDocuments?: ThemeDocument[]
    wikiPageSuffix?: string
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
  actionCandidateLimit: number
}> = {
  compact: {
    signalLimit: 3,
    connectionLimit: 2,
    summaryCardLimit: 4,
    actionCandidateLimit: 3,
  },
  balanced: {
    signalLimit: 6,
    connectionLimit: 5,
    summaryCardLimit: 6,
    actionCandidateLimit: 6,
  },
  full: {
    signalLimit: 10,
    connectionLimit: 8,
    summaryCardLimit: 12,
    actionCandidateLimit: 10,
  },
}

const SYSTEM_PROMPT = [
  'You are a knowledge-organization assistant for a SiYuan note library.',
  'Based on recently collected or created notes and related network analysis signals, output the highest-priority cleanup tasks for today. The goal is to turn scattered notes into a topic-centered knowledge structure.',
  'You must return JSON only. Do not output Markdown, explanations, or code blocks.',
  'The JSON shape must be {"summary": string, "items": AiInboxItem[]}.',
  'Each item must include id, type, title, priority, action, and reason, with optional documentIds, confidence, recommendedTargets, evidence, expectedChanges, and priorityBreakdown.',
  'type must be one of document, connection, topic-page, or bridge-risk.',
  'priority must be P1, P2, or P3.',
  'Prefer using the recommended targets, evidence, estimated gains, and scores already provided in actionCandidates. Do not invent documents or topic pages that do not exist.',
  'If an actionCandidate includes focusDocumentIds, put the related primary object ids into documentIds.',
  'If recommendedTargets exist, action must mention the target titles explicitly instead of generic actions like "repair links" or "improve structure".',
  'action should be directly usable as user-visible recommended action text.',
  'reason should be directly usable as user-visible why-this-first text and must cite at least one structure signal.',
  'Prioritize orphan docs, dormant docs, bridge risks, communities missing topic pages, trend changes, and critical link repair.',
  'All user-visible text fields must follow the user interface language of the current workspace. Keep proper nouns such as document titles, tag names, and model names as needed.',
].join(' ')

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

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
              uiText(
                'Based on the doc-link network analysis below, produce one unified task list for what should be handled first today.',
                '请基于下面的文档级引用网络分析结果，给出“今天优先处理什么”的统一待办列表。',
              ),
              uiText(
                'Return 5 to 8 items when possible, preferring high-scoring candidates from actionCandidates.',
                '优先输出 5 到 8 项，优先从 actionCandidates 中挑选高分候选。',
              ),
              uiText(
                'Keep the structure compact: merge recommended actions and suggestions into action, and merge why-this-first plus expected gains into reason.',
                '输出结构要更紧凑：把推荐动作和建议合并到 action，把为什么先做和预估收益合并成推荐理由写到 reason。',
              ),
              uiText(
                'Each item should make clear what to handle now, where to link it or what page to create, and why it should be done first.',
                '每项建议尽量写清：现在处理哪个对象、补到哪里/建什么页、推荐理由是什么。',
              ),
              uiText(
                'Do not fabricate weak evidence. If no clear target exists, leave it empty honestly.',
                '如果证据不足，不要硬造；如果没有明确目标，就如实保留为空。',
              ),
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
          { role: 'system', content: 'You are a connection test assistant. Return OK only.' },
          { role: 'user', content: 'Reply with OK only.' },
        ],
        maxTokensOverride: 20,
      })

      const message = extractChatCompletionContent(response).trim()
      if (!message) {
        throw new Error(uiText('AI did not return readable content', 'AI 接口未返回可读内容'))
      }

      return {
        ok: true,
        message: uiText('Connection successful', '连接成功'),
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
  themeDocuments?: ThemeDocument[]
  wikiPageSuffix?: string
}): AiInboxPayload {
  const ordinaryDocuments = filterOutWikiDocuments(params.documents, params.wikiPageSuffix)
  const ordinaryDocumentIds = new Set(ordinaryDocuments.map(document => document.id))
  const filteredReport = filterReportForInbox(params.report, ordinaryDocumentIds)
  const filteredTrends = filterTrendReportForInbox(params.trends, ordinaryDocumentIds)
  const documentMap = new Map(ordinaryDocuments.map(document => [document.id, document]))
  const communityById = new Map(filteredReport.communities.map(community => [community.id, community]))
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
    actionCandidates: buildActionCandidates({
      documentMap,
      report: filteredReport,
      trends: filteredTrends,
      themeDocuments: params.themeDocuments ?? [],
      actionCandidateLimit: limits.actionCandidateLimit,
    }),
    signals: {
      ranking: filteredReport.ranking.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        inboundReferences: item.inboundReferences,
        distinctSourceDocuments: item.distinctSourceDocuments,
        outboundReferences: item.outboundReferences,
      })),
      orphans: filteredReport.orphans.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        updatedAt: item.updatedAt,
        historicalReferenceCount: item.historicalReferenceCount,
        hasSparseEvidence: item.hasSparseEvidence,
      })),
      dormant: filteredReport.dormantDocuments.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        inactivityDays: item.inactivityDays,
        historicalReferenceCount: item.historicalReferenceCount,
      })),
      bridges: filteredReport.bridgeDocuments.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        degree: item.degree,
      })),
      propagation: filteredReport.propagationNodes.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: item.title,
        score: item.score,
        focusDocumentCount: item.focusDocumentCount,
        communitySpan: item.communitySpan,
        bridgeRole: item.bridgeRole,
      })),
      communities: filteredTrends.communityTrends.slice(0, limits.signalLimit).map((item) => {
        const community = communityById.get(item.communityId)
        return {
          communityId: item.communityId,
          size: community?.size ?? item.documentIds.length,
          topTags: item.topTags,
          hubTitles: item.hubDocumentIds.map(documentId => resolveDocumentTitle(documentMap, documentId)),
          missingTopicPage: community?.missingTopicPage ?? false,
        }
      }),
      risingDocuments: filteredTrends.risingDocuments.slice(0, limits.signalLimit).map(item => mapTrendItem(item)),
      fallingDocuments: filteredTrends.fallingDocuments.slice(0, limits.signalLimit).map(item => mapTrendItem(item)),
      newConnections: filteredTrends.connectionChanges.newEdges.slice(0, limits.connectionLimit).map(item => ({
        title: buildConnectionTitle(documentMap, item.documentIds),
        documentIds: [...item.documentIds],
        referenceCount: item.referenceCount,
      })),
      brokenConnections: filteredTrends.connectionChanges.brokenEdges.slice(0, limits.connectionLimit).map(item => ({
        title: buildConnectionTitle(documentMap, item.documentIds),
        documentIds: [...item.documentIds],
        referenceCount: item.referenceCount,
      })),
    },
  }
}

function buildActionCandidates(params: {
  documentMap: Map<string, DocumentRecord>
  report: ReferenceGraphReport
  trends: TrendReport
  themeDocuments: ThemeDocument[]
  actionCandidateLimit: number
}): AiInboxActionCandidate[] {
  const candidates: AiInboxActionCandidate[] = []
  const usedIds = new Set<string>()

  for (const item of params.report.orphans) {
    const candidate = buildRepairLinkCandidate({
      orphan: item,
      documentMap: params.documentMap,
      ranking: params.report.ranking,
      themeDocuments: params.themeDocuments,
    })
    if (candidate && !usedIds.has(candidate.id)) {
      usedIds.add(candidate.id)
      candidates.push(candidate)
    }
  }

  for (const item of params.trends.communityTrends) {
    const community = params.report.communities.find(entry => entry.id === item.communityId)
    if (!community?.missingTopicPage) {
      continue
    }
    const candidate = buildTopicPageCandidate({
      community,
      trend: item,
      documentMap: params.documentMap,
    })
    if (candidate && !usedIds.has(candidate.id)) {
      usedIds.add(candidate.id)
      candidates.push(candidate)
    }
  }

  for (const item of params.report.bridgeDocuments) {
    const candidate = buildBridgeRiskCandidate({
      bridge: item,
      communities: params.report.communities,
      ranking: params.report.ranking,
      documentMap: params.documentMap,
    })
    if (candidate && !usedIds.has(candidate.id)) {
      usedIds.add(candidate.id)
      candidates.push(candidate)
    }
  }

  for (const item of params.report.dormantDocuments) {
    const candidate = buildArchiveCandidate({
      dormant: item,
      documentMap: params.documentMap,
      ranking: params.report.ranking,
      themeDocuments: params.themeDocuments,
    })
    if (candidate && !usedIds.has(candidate.id)) {
      usedIds.add(candidate.id)
      candidates.push(candidate)
    }
  }

  return candidates
    .sort((left, right) => right.priorityScore - left.priorityScore || left.title.localeCompare(right.title, 'zh-CN'))
    .slice(0, params.actionCandidateLimit)
}

function buildRepairLinkCandidate(params: {
  orphan: ReferenceGraphReport['orphans'][number]
  documentMap: Map<string, DocumentRecord>
  ranking: ReferenceGraphReport['ranking']
  themeDocuments: ThemeDocument[]
}): AiInboxActionCandidate | null {
  const document = params.documentMap.get(params.orphan.documentId)
  if (!document) {
    return null
  }
  const documentTitle = resolveDocumentTitle(params.documentMap, params.orphan.documentId)

  const themeMatches = countThemeMatchesForDocument({
    document,
    themeDocuments: params.themeDocuments,
  }).slice(0, 2)

  const recommendedTargets: AiInboxRecommendedTarget[] = [
    ...themeMatches.map(match => ({
      documentId: match.themeDocumentId,
      title: match.themeDocumentTitle,
      kind: 'theme-document' as const,
      reason: uiText(
        `Topic match hit ${match.matchCount} times and works as a stable entry point`,
        `主题匹配命中 ${match.matchCount} 次，适合作为稳定入口`,
      ),
    })),
    ...params.ranking
      .filter(item => item.documentId !== params.orphan.documentId && !themeMatches.some(match => match.themeDocumentId === item.documentId))
      .slice(0, themeMatches.length ? 1 : 2)
      .map(item => ({
        documentId: item.documentId,
        title: item.title,
        kind: 'core-document' as const,
        reason: uiText(
          `High-reference core doc, referenced by ${item.distinctSourceDocuments} docs`,
          `当前是高引用核心文档，被 ${item.distinctSourceDocuments} 个文档引用`,
        ),
      })),
  ].slice(0, 3)

  const impactScore = clampScore(45 + params.orphan.historicalReferenceCount * 6 + themeMatches.length * 10)
  const urgencyScore = buildUrgencyScore(params.orphan.updatedAt)
  const actionabilityScore = clampScore(35 + recommendedTargets.length * 18 + themeMatches.length * 8)
  const confidenceScore = clampScore(30 + themeMatches.length * 25 + (params.orphan.hasSparseEvidence ? 10 : 5))
  const priorityScore = combinePriorityScores({
    impactScore,
    urgencyScore,
    actionabilityScore,
    confidenceScore,
  })

  const primaryTarget = recommendedTargets[0]
  const expectedBenefits = [
    uiText('Expected to leave the orphan doc list', '预计移出孤立文档列表'),
    primaryTarget
      ? uiText(`Add 1 inbound link to ${primaryTarget.title}`, `为 ${primaryTarget.title} 增加 1 条入链`)
      : uiText('Restore one entry link to the current network', '为当前网络补回 1 个入口连接'),
    themeMatches.length
      ? uiText(
          `Improve topic coverage for ${themeMatches.map(item => item.themeName).join(', ')}`,
          `补全 ${themeMatches.map(item => item.themeName).join('、')} 主题的网络覆盖`,
        )
      : uiText('Reduce the risk of sinking further later', '降低后续继续沉没的风险'),
  ]

  return {
    id: `repair-link:${params.orphan.documentId}`,
    type: 'repair-link',
    title: uiText(`Repair orphan doc: ${documentTitle}`, `修复孤立文档：${documentTitle}`),
    focusDocumentIds: [params.orphan.documentId],
    confidence: confidenceScore >= 75 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low',
    impactScore,
    urgencyScore,
    actionabilityScore,
    confidenceScore,
    priorityScore,
    recommendedTargets,
    evidence: [
      uiText('No valid doc-level links in the current window', '当前窗口内没有有效文档级连接'),
      uiText(
        `${params.orphan.historicalReferenceCount} historical link traces exist`,
        `历史上出现过 ${params.orphan.historicalReferenceCount} 条连接证据`,
      ),
      ...themeMatches.map(match => uiText(
        `${match.themeName} topic match hit ${match.matchCount} times`,
        `${match.themeName} 主题匹配命中 ${match.matchCount} 次`,
      )),
    ].slice(0, 4),
    recommendedAction: recommendedTargets.length
      ? uiText(
          `First link it to ${recommendedTargets.map(target => target.title).join(', ')}, then add one short note about which topic this note belongs to.`,
          `先补到 ${recommendedTargets.map(target => target.title).join('、')}，并补一句说明这篇笔记属于哪个主题。`,
        )
      : uiText(
          'First add one link back to the core network, then add one short note about the current doc topic.',
          '先补 1 条回到核心网络的连接，并补一句说明当前文档的归属主题。',
        ),
    expectedBenefits,
    draftText: primaryTarget?.documentId
      ? uiText(
          `Can fit under ${primaryTarget.title}: ((` + `${primaryTarget.documentId} "${primaryTarget.title}"))`,
          `可归入 ${primaryTarget.title}：((` + `${primaryTarget.documentId} "${primaryTarget.title}"))`,
        )
      : undefined,
  }
}

function buildTopicPageCandidate(params: {
  community: ReferenceGraphReport['communities'][number]
  trend: TrendReport['communityTrends'][number]
  documentMap: Map<string, DocumentRecord>
}): AiInboxActionCandidate | null {
  const suggestedTitle = buildSuggestedTopicPageTitle(params.community)
  const recommendedTargets = params.community.hubDocumentIds
    .slice(0, 3)
    .map(documentId => ({
      documentId,
      title: resolveDocumentTitle(params.documentMap, documentId),
      kind: 'community-hub' as const,
      reason: uiText(
        'This is a hub doc in the current cluster and works well as an initial topic page entry.',
        '这是当前社区的 hub 文档，适合作为主题页的首批入口',
      ),
    }))

  const impactScore = clampScore(40 + params.community.size * 10 + Math.max(params.trend.delta, 0) * 6)
  const urgencyScore = clampScore(35 + Math.max(params.trend.delta, 0) * 15)
  const actionabilityScore = clampScore(60 + recommendedTargets.length * 8 + (params.community.topTags.length ? 10 : 0))
  const confidenceScore = clampScore(40 + (params.community.topTags.length ? 25 : 10) + recommendedTargets.length * 10)

  return {
    id: `topic-page:${params.community.id}`,
    type: 'create-topic-page',
    title: uiText(`Create topic page: ${suggestedTitle}`, `创建主题页：${suggestedTitle}`),
    focusDocumentIds: [...params.community.documentIds],
    confidence: confidenceScore >= 75 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low',
    impactScore,
    urgencyScore,
    actionabilityScore,
    confidenceScore,
    priorityScore: combinePriorityScores({
      impactScore,
      urgencyScore,
      actionabilityScore,
      confidenceScore,
    }),
    recommendedTargets,
    evidence: [
      uiText(`Cluster size: ${params.community.size} docs`, `社区规模 ${params.community.size} 篇文档`),
      uiText(
        `Missing topic page, recent link change ${formatSignedDelta(params.trend.delta)}`,
        `当前缺少主题页，最近关系变化 ${formatSignedDelta(params.trend.delta)}`,
      ),
      params.community.topTags.length
        ? uiText(`Top tags: ${params.community.topTags.join(', ')}`, `高频标签：${params.community.topTags.join('、')}`)
        : uiText('Top tag evidence is weak', '高频标签证据较弱'),
    ],
    recommendedAction: uiText(
      `Create ${suggestedTitle}, then attach it first to ${recommendedTargets.map(target => target.title).join(', ') || 'cluster hub docs'}.`,
      `新建 ${suggestedTitle}，并先挂入 ${recommendedTargets.map(target => target.title).join('、') || '社区 hub 文档'}。`,
    ),
    expectedBenefits: [
      uiText('Build one unified entry page for this cluster', '为该社区建立统一入口页'),
      uiText(
        `Bring ${params.community.size} docs into one navigable topic structure`,
        `把 ${params.community.size} 篇文档收束到可导航的主题结构中`,
      ),
      uiText('Follow-up link repair and archive work becomes more focused', '后续补链和归档动作会更集中'),
    ],
    draftText: uiText(`Suggested topic page title: ${suggestedTitle}`, `建议主题页标题：${suggestedTitle}`),
  }
}

function buildBridgeRiskCandidate(params: {
  bridge: ReferenceGraphReport['bridgeDocuments'][number]
  communities: ReferenceGraphReport['communities']
  ranking: ReferenceGraphReport['ranking']
  documentMap: Map<string, DocumentRecord>
}): AiInboxActionCandidate | null {
  const relatedCommunities = params.communities.filter(community => community.documentIds.includes(params.bridge.documentId))
  const relatedTargets = relatedCommunities
    .flatMap(community => community.hubDocumentIds)
    .filter(documentId => documentId !== params.bridge.documentId)
  const recommendedTargets = [...new Set(relatedTargets)]
    .slice(0, 3)
    .map(documentId => ({
      documentId,
      title: resolveDocumentTitle(params.documentMap, documentId),
      kind: 'community-hub' as const,
      reason: uiText(
        'Linking to neighboring cluster hubs can reduce this bridge becoming the only path.',
        '补到相邻社区 hub，可以减少该桥接点成为唯一路径',
      ),
    }))

  if (recommendedTargets.length === 0) {
    recommendedTargets.push(
      ...params.ranking
        .filter(item => item.documentId !== params.bridge.documentId)
        .slice(0, 2)
        .map(item => ({
          documentId: item.documentId,
          title: item.title,
          kind: 'related-document' as const,
          reason: uiText(
            'A highly connected doc in the current network that can act as an alternative entry point.',
            '当前网络中的高连接文档，可作为替代入口',
          ),
        })),
    )
  }

  const impactScore = clampScore(45 + params.bridge.degree * 8 + relatedCommunities.length * 8)
  const urgencyScore = clampScore(40 + params.bridge.degree * 4)
  const actionabilityScore = clampScore(35 + recommendedTargets.length * 18)
  const confidenceScore = clampScore(35 + relatedCommunities.length * 15 + recommendedTargets.length * 10)

  return {
    id: `bridge-risk:${params.bridge.documentId}`,
    type: 'maintain-bridge',
    title: uiText(`Reduce bridge risk: ${params.bridge.title}`, `降低桥接风险：${params.bridge.title}`),
    focusDocumentIds: [params.bridge.documentId],
    confidence: confidenceScore >= 75 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low',
    impactScore,
    urgencyScore,
    actionabilityScore,
    confidenceScore,
    priorityScore: combinePriorityScores({
      impactScore,
      urgencyScore,
      actionabilityScore,
      confidenceScore,
    }),
    recommendedTargets,
    evidence: [
      uiText(`Currently connects ${params.bridge.degree} relationships`, `当前连接 ${params.bridge.degree} 条关系`),
      relatedCommunities.length
        ? uiText(`Appears in ${relatedCommunities.length} clusters`, `同时出现在 ${relatedCommunities.length} 个社区中`)
        : uiText('No clear alternative cluster entry is available yet', '当前缺少明确的社区替代入口'),
      recommendedTargets.length
        ? uiText(`Can first link to ${recommendedTargets.map(target => target.title).join(', ')}`, `可优先补到 ${recommendedTargets.map(target => target.title).join('、')}`)
        : uiText('No sufficiently clear alternative target was found', '当前未找到足够清晰的替代目标'),
    ],
    recommendedAction: recommendedTargets.length
      ? uiText(
          `Add an upstream/downstream navigation block in ${params.bridge.title} and link explicitly to ${recommendedTargets.map(target => target.title).join(', ')}.`,
          `在 ${params.bridge.title} 中补一段上下游导航，显式链接到 ${recommendedTargets.map(target => target.title).join('、')}。`,
        )
      : uiText(
          `Add an upstream/downstream navigation block for ${params.bridge.title} so it does not become a single bridge point.`,
          `为 ${params.bridge.title} 补一段上下游导航，避免它成为单点桥接。`,
        ),
    expectedBenefits: [
      uiText('Reduce the risk of cluster fragmentation from a single bridge point', '降低单点桥接导致社区断裂的风险'),
      recommendedTargets.length
        ? uiText(`Add navigation for ${recommendedTargets.length} alternative entry points`, `为 ${recommendedTargets.length} 个替代入口补齐导航`)
        : uiText('Add alternative entries for neighboring topics', '为相邻主题补出替代入口'),
    ],
    draftText: recommendedTargets.length
      ? uiText(
          `Upstream/downstream entries: ${recommendedTargets.map(target => `((` + `${target.documentId} "${target.title}"))`).join(' / ')}`,
          `上游/下游入口：${recommendedTargets.map(target => `((` + `${target.documentId} "${target.title}"))`).join(' / ')}`,
        )
      : undefined,
  }
}

function buildArchiveCandidate(params: {
  dormant: ReferenceGraphReport['dormantDocuments'][number]
  documentMap: Map<string, DocumentRecord>
  ranking: ReferenceGraphReport['ranking']
  themeDocuments: ThemeDocument[]
}): AiInboxActionCandidate | null {
  const document = params.documentMap.get(params.dormant.documentId)
  const documentTitle = resolveDocumentTitle(params.documentMap, params.dormant.documentId)
  const themeMatches = document
    ? countThemeMatchesForDocument({
        document,
        themeDocuments: params.themeDocuments,
      }).slice(0, 1)
    : []
  const recommendedTargets: AiInboxRecommendedTarget[] = themeMatches.map(match => ({
    documentId: match.themeDocumentId,
    title: match.themeDocumentTitle,
    kind: 'theme-document',
    reason: uiText(
      'If this still has value, linking it to a topic page before archiving makes it easier to revisit later.',
      '如果仍有保留价值，先补到主题页再归档更容易回查',
    ),
  }))

  if (recommendedTargets.length === 0) {
    recommendedTargets.push(
      ...params.ranking
        .filter(item => item.documentId !== params.dormant.documentId)
        .slice(0, 1)
        .map(item => ({
          documentId: item.documentId,
          title: item.title,
          kind: 'core-document' as const,
          reason: uiText(
            'You can first link it to an active index entry, then decide whether to archive it.',
            '可先补到一个仍活跃的索引入口，再决定是否归档',
          ),
        })),
    )
  }

  const impactScore = clampScore(30 + Math.min(params.dormant.historicalReferenceCount * 8, 35))
  const urgencyScore = clampScore(25 + Math.min(Math.floor(params.dormant.inactivityDays / 3), 45))
  const actionabilityScore = clampScore(30 + recommendedTargets.length * 18)
  const confidenceScore = clampScore(35 + (params.dormant.historicalReferenceCount > 0 ? 20 : 0) + recommendedTargets.length * 10)

  return {
    id: `archive-dormant:${params.dormant.documentId}`,
    type: 'archive-dormant',
    title: uiText(`Handle dormant doc: ${documentTitle}`, `处理沉没文档：${documentTitle}`),
    focusDocumentIds: [params.dormant.documentId],
    confidence: confidenceScore >= 75 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low',
    impactScore,
    urgencyScore,
    actionabilityScore,
    confidenceScore,
    priorityScore: combinePriorityScores({
      impactScore,
      urgencyScore,
      actionabilityScore,
      confidenceScore,
    }),
    recommendedTargets,
    evidence: [
      uiText(`${params.dormant.inactivityDays} days without valid links`, `${params.dormant.inactivityDays} 天未产生有效连接`),
      uiText(
        `${params.dormant.historicalReferenceCount} historical link traces exist`,
        `历史上出现过 ${params.dormant.historicalReferenceCount} 条连接证据`,
      ),
    ],
    recommendedAction: recommendedTargets.length
      ? uiText(
          `First link it to ${recommendedTargets[0].title} to keep a lookup entry; archive it later if you stop maintaining it.`,
          `先补到 ${recommendedTargets[0].title} 留下回查入口；如果后续不再维护，再归档。`,
        )
      : uiText(
          'First confirm whether it still needs to be kept. If not, archive it and add one index note.',
          '先确认是否仍需保留；如无持续维护计划，归档并补一条索引说明。',
        ),
    expectedBenefits: [
      uiText('Reduce buildup of dormant docs', '减少沉没文档堆积'),
      uiText('Keep a necessary lookup entry and avoid losing it completely later', '保留必要回查入口，避免后续完全失联'),
    ],
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

function filterOutWikiDocuments(documents: DocumentRecord[], wikiPageSuffix?: string): DocumentRecord[] {
  if (!wikiPageSuffix?.trim()) {
    return documents
  }

  return documents.filter(document => !isWikiDocumentTitle(document.title || document.hpath || document.path || document.id, wikiPageSuffix))
}

function filterReportForInbox(report: ReferenceGraphReport, ordinaryDocumentIds: Set<string>): ReferenceGraphReport {
  return {
    ...report,
    ranking: report.ranking.filter(item => ordinaryDocumentIds.has(item.documentId)),
    communities: report.communities
      .map(item => ({
        ...item,
        documentIds: item.documentIds.filter(documentId => ordinaryDocumentIds.has(documentId)),
        hubDocumentIds: item.hubDocumentIds.filter(documentId => ordinaryDocumentIds.has(documentId)),
      }))
      .filter(item => item.documentIds.length > 0),
    bridgeDocuments: report.bridgeDocuments.filter(item => ordinaryDocumentIds.has(item.documentId)),
    orphans: report.orphans.filter(item => ordinaryDocumentIds.has(item.documentId)),
    dormantDocuments: report.dormantDocuments.filter(item => ordinaryDocumentIds.has(item.documentId)),
    propagationNodes: report.propagationNodes.filter(item => ordinaryDocumentIds.has(item.documentId)),
  }
}

function filterTrendReportForInbox(trends: TrendReport, ordinaryDocumentIds: Set<string>): TrendReport {
  const communityTrends = trends.communityTrends
    .map(item => ({
      ...item,
      documentIds: item.documentIds.filter(documentId => ordinaryDocumentIds.has(documentId)),
      hubDocumentIds: item.hubDocumentIds.filter(documentId => ordinaryDocumentIds.has(documentId)),
    }))
    .filter(item => item.documentIds.length > 0)
  const newEdges = trends.connectionChanges.newEdges.filter(item => item.documentIds.every(documentId => ordinaryDocumentIds.has(documentId)))
  const brokenEdges = trends.connectionChanges.brokenEdges.filter(item => item.documentIds.every(documentId => ordinaryDocumentIds.has(documentId)))

  return {
    ...trends,
    risingDocuments: trends.risingDocuments.filter(item => ordinaryDocumentIds.has(item.documentId)),
    fallingDocuments: trends.fallingDocuments.filter(item => ordinaryDocumentIds.has(item.documentId)),
    communityTrends,
    risingCommunities: communityTrends.filter(item => item.delta > 0),
    dormantCommunities: communityTrends.filter(item => item.currentReferences === 0 || (item.delta < 0 && item.currentReferences <= 1)),
    connectionChanges: {
      newCount: newEdges.length,
      brokenCount: brokenEdges.length,
      newEdges,
      brokenEdges,
    },
  }
}

function resolveDocumentTitle(documentMap: Map<string, DocumentRecord>, documentId: string): string {
  const document = documentMap.get(documentId)
  return document?.title || document?.hpath || document?.path || documentId
}

function buildConnectionTitle(documentMap: Map<string, DocumentRecord>, documentIds: string[]): string {
  return documentIds.map(documentId => resolveDocumentTitle(documentMap, documentId)).join(' <-> ')
}

function buildSuggestedTopicPageTitle(community: ReferenceGraphReport['communities'][number]) {
  const topic = community.topTags[0] || community.hubDocumentIds[0] || community.documentIds[0] || uiText('Untitled topic', '未命名主题')
  return uiText(`Topic-${topic}-Index`, `主题-${topic}-索引`)
}

function buildUrgencyScore(updatedAt?: string) {
  const updatedTime = parseSiyuanTimestamp(updatedAt ?? '')
  if (!updatedTime) {
    return 40
  }
  const daysAgo = Math.max(0, Math.floor((Date.now() - updatedTime) / (24 * 60 * 60 * 1000)))
  if (daysAgo <= 3) {
    return 90
  }
  if (daysAgo <= 7) {
    return 75
  }
  if (daysAgo <= 30) {
    return 60
  }
  return 45
}

function combinePriorityScores(scores: Omit<AiInboxPriorityBreakdown, 'priorityScore'>) {
  return clampScore(Math.round(
    scores.impactScore * 0.35
    + scores.urgencyScore * 0.25
    + scores.actionabilityScore * 0.25
    + scores.confidenceScore * 0.15,
  ))
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatSignedDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta)
}

async function requestChatCompletion(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  logger: AiLogger
  messages: ChatCompletionMessage[]
  maxTokensOverride?: number
}) {
  if (!params.config.aiEnabled) {
    throw new Error(uiText('Enable today suggestions in Settings first', '请先在设置中启用 AI 今日建议'))
  }
  if (!isAiConfigComplete(params.config)) {
    throw new Error(uiText('AI settings are incomplete. Add Base URL, API Key, and Model.', 'AI 接入配置不完整，请补充 Base URL、API Key 和 Model'))
  }

  const requestOptions = resolveAiRequestOptions(params.config)
  const endpoint = resolveAiEndpoint(params.config.aiBaseUrl!, 'chat/completions')
  const messages = limitChatCompletionMessages(params.messages, requestOptions.maxContextMessages)
  const body = JSON.stringify({
    model: params.config.aiModel,
    messages,
    max_tokens: params.maxTokensOverride ?? requestOptions.maxTokens,
    temperature: requestOptions.temperature,
  })
  const requestHeaders = [
    { Authorization: `Bearer ${params.config.aiApiKey}` },
    { Accept: 'application/json' },
  ]
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
  const requestDetail = [
    'Request method: POST',
    `Request URL: ${endpoint}`,
    'Request headers: ' + JSON.stringify(maskHeadersForLogging(requestHeaders)),
    'Content-Type: application/json',
    `Full request body: ${body}`,
  ].join('\n')

  params.logger.info('[NetworkLens][AI] Request start', requestTrace)
  params.logger.info('[NetworkLens][AI] Request start detail', requestDetail)

  let response: IResForwardProxy
  try {
    response = await params.forwardProxy(
      endpoint,
      'POST',
      body,
      requestHeaders,
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
    const status = response?.status ?? 'unknown status'
    params.logger.warn('[NetworkLens][AI] Non-2xx response', {
      ...requestTrace,
      status,
      responseBody: response?.body?.slice(0, 500) ?? '',
    })
    params.logger.warn(
      '[NetworkLens][AI] Non-2xx response detail',
      `Status: ${status}\nFull response: ${response?.body ?? ''}`,
    )
    params.logger.warn('[NetworkLens][AI] Non-2xx response raw', {
      status,
      elapsed: response?.elapsed ?? 'unknown',
      contentType: response?.contentType ?? '',
      headers: response?.headers ?? {},
      url: response?.url ?? endpoint,
      body: response?.body ?? '',
    })
    throw buildAiNonOkResponseError({
      endpoint,
      status,
      responseBody: response?.body ?? '',
    })
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
    throw new Error(uiText('AI returned JSON that could not be parsed', 'AI 接口返回了无法解析的 JSON'))
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

export function resolveAiEndpoint(baseUrl: string, resourcePath: 'chat/completions' | 'embeddings' | 'models'): string {
  const trimmedBaseUrl = baseUrl.trim()

  try {
    const url = new URL(trimmedBaseUrl)
    const pathname = url.pathname.replace(/\/+$/, '')
    const shouldAppendV1 = url.hostname === 'api.siliconflow.cn' && (pathname === '' || pathname === '/')

    if (shouldAppendV1) {
      url.pathname = '/v1'
    }

    return `${url.toString().replace(/\/+$/, '')}/${resourcePath}`
  } catch {
    return `${trimmedBaseUrl.replace(/\/+$/, '')}/${resourcePath}`
  }
}

export async function fetchSiliconFlowModelCatalog(params: {
  config: Pick<AiConfig, 'aiBaseUrl' | 'aiApiKey' | 'aiRequestTimeoutSeconds'>
  forwardProxy: ForwardProxyFn
}): Promise<AiModelCatalogResult> {
  const aiBaseUrl = params.config.aiBaseUrl?.trim()
  const aiApiKey = params.config.aiApiKey?.trim()
  if (!aiBaseUrl || !aiApiKey) {
    throw new Error(uiText('Before loading the model list, enter SiliconFlow Base URL and API Key first', '加载模型列表前，请先填写 SiliconFlow 的 Base URL 和 API Key'))
  }

  const requestOptions = resolveAiRequestOptions(params.config)
  const [chatModels, embeddingModels] = await Promise.all([
    requestModelIds({
      endpoint: `${resolveAiEndpoint(aiBaseUrl, 'models')}?sub_type=chat`,
      apiKey: aiApiKey,
      forwardProxy: params.forwardProxy,
      timeoutMs: requestOptions.timeoutMs,
    }),
    requestModelIds({
      endpoint: `${resolveAiEndpoint(aiBaseUrl, 'models')}?sub_type=embedding`,
      apiKey: aiApiKey,
      forwardProxy: params.forwardProxy,
      timeoutMs: requestOptions.timeoutMs,
    }),
  ])

  return {
    chatModels,
    embeddingModels,
  }
}

async function requestModelIds(params: {
  endpoint: string
  apiKey: string
  forwardProxy: ForwardProxyFn
  timeoutMs: number
}) {
  const response = await params.forwardProxy(
    params.endpoint,
    'GET',
    undefined,
    [
      { Authorization: `Bearer ${params.apiKey}` },
      { Accept: 'application/json' },
    ],
    params.timeoutMs,
    'application/json',
  )

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(uiText(`Model list request failed (${response?.status ?? 'unknown status'})`, `模型列表请求失败（${response?.status ?? '未知状态'}）`))
  }

  const payload = JSON.parse(response.body)
  const ids = Array.isArray(payload?.data)
    ? payload.data
        .map((item: any) => (typeof item?.id === 'string' ? item.id.trim() : ''))
        .filter(Boolean)
    : []

  return [...new Set(ids)].sort((left, right) => left.localeCompare(right, 'en'))
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
  throw new Error(uiText('AI did not return readable content', 'AI 接口未返回可读内容'))
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

function normalizeAiInboxResult(value: any): AiInboxResult {
  const items = Array.isArray(value?.items)
    ? value.items
        .map((item: any, index: number) => normalizeAiInboxItem(item, index))
        .filter((item: AiInboxItem | null): item is AiInboxItem => item !== null)
    : []

  if (items.length === 0) {
    throw new Error(uiText('AI did not return valid cleanup tasks', 'AI 未返回有效的整理待办'))
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: typeof value?.summary === 'string' && value.summary.trim()
      ? value.summary.trim()
      : uiText('Cleanup priorities generated from the current reference network.', '已根据当前引用网络生成整理优先级。'),
    items,
  }
}

function normalizeAiInboxItem(value: any, index: number): AiInboxItem | null {
  const title = typeof value?.title === 'string' ? value.title.trim() : ''
  const action = typeof value?.action === 'string' ? value.action.trim() : ''
  const reason = typeof value?.reason === 'string' ? value.reason.trim() : ''

  if (!title || !action || !reason) {
    return null
  }

  const type = normalizeAiInboxItemType(value?.type)
  const priority = normalizePriority(value?.priority)
  const documentIds = Array.isArray(value?.documentIds)
    ? value.documentIds.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined
  const recommendedTargets = normalizeRecommendedTargets(value?.recommendedTargets)
  const evidence = normalizeStringList(value?.evidence)
  const expectedChanges = normalizeStringList(value?.expectedChanges)
  const priorityBreakdown = normalizePriorityBreakdown(value?.priorityBreakdown)
  const confidence = normalizeConfidence(value?.confidence)

  return {
    id: typeof value?.id === 'string' && value.id.trim()
      ? value.id.trim()
      : `ai-item-${index + 1}`,
    type,
    title,
    priority,
    action,
    reason,
    documentIds: documentIds?.length ? documentIds : undefined,
    confidence,
    recommendedTargets,
    evidence,
    expectedChanges,
    priorityBreakdown,
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

function normalizeConfidence(value: unknown): AiInboxConfidence | undefined {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  return undefined
}

function normalizeRecommendedTargets(value: unknown): AiInboxRecommendedTarget[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const targets = value
    .map((item) => {
      const title = typeof item?.title === 'string' ? item.title.trim() : ''
      const reason = typeof item?.reason === 'string' ? item.reason.trim() : ''
      if (!title || !reason) {
        return null
      }
      const documentId = typeof item?.documentId === 'string' && item.documentId.trim()
        ? item.documentId.trim()
        : undefined
      return {
        documentId,
        title,
        reason,
        kind: normalizeTargetKind(item?.kind),
      }
    })
    .filter((item): item is AiInboxRecommendedTarget => item !== null)

  return targets.length ? targets : undefined
}

function normalizeTargetKind(value: unknown): AiInboxTargetKind {
  if (value === 'theme-document' || value === 'core-document' || value === 'community-hub' || value === 'related-document') {
    return value
  }
  return 'related-document'
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
  return items.length ? items : undefined
}

function normalizePriorityBreakdown(value: unknown): AiInboxPriorityBreakdown | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const impactScore = clampScore(readNumericField((value as any).impactScore))
  const urgencyScore = clampScore(readNumericField((value as any).urgencyScore))
  const actionabilityScore = clampScore(readNumericField((value as any).actionabilityScore))
  const confidenceScore = clampScore(readNumericField((value as any).confidenceScore))
  const priorityScore = clampScore(readNumericField((value as any).priorityScore))

  if ([impactScore, urgencyScore, actionabilityScore, confidenceScore, priorityScore].every(item => item === 0)) {
    return undefined
  }

  return {
    impactScore,
    urgencyScore,
    actionabilityScore,
    confidenceScore,
    priorityScore,
  }
}

function readNumericField(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
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
    `Request URL: ${params.endpoint}`,
    `Timeout: ${Math.round(params.timeoutMs / 1000)}s`,
    `Model: ${params.model}`,
    `max_tokens：${params.maxTokens}`,
    `temperature：${params.temperature}`,
    `Max context messages: ${params.maxContextMessages}`,
  ]

  if (isLikelyMissingV1Path(params.endpoint)) {
    hints.push(uiText(`Base URL likely needs /v1; current request resolved to ${params.endpoint}`, `Base URL 很可能应包含 /v1；当前请求落到了 ${params.endpoint}`))
  }

  if (params.endpoint.startsWith('https://api.siliconflow.cn/chat/completions')) {
    hints.push(uiText('For SiliconFlow, first verify that Base URL is https://api.siliconflow.cn/v1', 'SiliconFlow 可优先检查 Base URL 是否填写为 https://api.siliconflow.cn/v1'))
  }

  if (rawMessage.includes('context deadline exceeded')) {
    hints.push(uiText('This was a timeout. Check Base URL and network connectivity first, then try Compact mode, fewer max tokens, or a longer timeout.', '这是请求超时。优先检查 Base URL、网络连通性，并尝试切换为“紧凑”、降低最大 Token 数或继续增大超时时间'))
    return new Error(uiText(`AI request timed out: ${rawMessage}\n${hints.join('\n')}`, `AI 请求超时：${rawMessage}\n${hints.join('\n')}`))
  }

  return new Error(uiText(`AI request failed: ${rawMessage}\n${hints.join('\n')}`, `AI 请求失败：${rawMessage}\n${hints.join('\n')}`))
}

function buildAiNonOkResponseError(params: {
  endpoint: string
  status: string | number
  responseBody: string
}) {
  const hints: string[] = []

  if (isLikelyMissingV1Path(params.endpoint)) {
    hints.push(uiText(`Base URL likely needs /v1; current request resolved to ${params.endpoint}`, `Base URL 很可能应包含 /v1；当前请求落到了 ${params.endpoint}`))
  }

  if (params.endpoint.startsWith('https://api.siliconflow.cn/chat/completions')) {
    hints.push(uiText('For SiliconFlow, first verify that Base URL is https://api.siliconflow.cn/v1', 'SiliconFlow 可优先检查 Base URL 是否填写为 https://api.siliconflow.cn/v1'))
  }

  const responseSummary = params.responseBody.trim().slice(0, 200)
  const details = responseSummary ? uiText(`\nResponse snippet: ${responseSummary}`, `\n响应片段：${responseSummary}`) : ''
  const hintText = hints.length ? `\n${hints.join('\n')}` : ''

  return new Error(uiText(`AI request failed (${params.status})${details}${hintText}`, `AI 请求失败（${params.status}）${details}${hintText}`))
}

function isLikelyMissingV1Path(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return !url.pathname.includes('/v1/')
  } catch {
    return false
  }
}

function maskHeadersForLogging(headers: any[]) {
  return headers.map((header) => {
    if (!header || typeof header !== 'object') {
      return header
    }

    const normalized = { ...header }
    if (typeof normalized.Authorization === 'string') {
      normalized.Authorization = maskAuthorizationValue(normalized.Authorization)
    }
    return normalized
  })
}

function maskAuthorizationValue(value: string) {
  const [scheme = '', token = ''] = value.split(/\s+/, 2)
  if (!token) {
    return value
  }

  const visiblePrefix = token.slice(0, 3)
  return `${scheme} ${visiblePrefix}***`.trim()
}
