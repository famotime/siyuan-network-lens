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
import { resolveUiLocale, t } from '@/i18n/ui'
import {
  DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  DEFAULT_AI_TEMPERATURE,
  type PluginConfig,
} from '@/types/config'
import {
  resolveNormalizedDocumentTitle,
  stripConfiguredTitleAffixes,
  type DocumentTitleCleanupConfig,
} from './document-utils'

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
    titleCleanupConfig?: DocumentTitleCleanupConfig
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
              t('analytics.aiInbox.promptProduceUnifiedTaskList'),
              t('analytics.aiInbox.promptPreferHighScoringCandidates'),
              t('analytics.aiInbox.promptKeepStructureCompact'),
              t('analytics.aiInbox.promptMakeActionSpecific'),
              t('analytics.aiInbox.promptDoNotFabricateWeakEvidence'),
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
        throw new Error(t('analytics.aiInbox.aiReturnedUnreadableContent'))
      }

      return {
        ok: true,
        message: t('analytics.aiInbox.connectionSuccessful'),
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
  titleCleanupConfig?: DocumentTitleCleanupConfig
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
      titleCleanupConfig: params.titleCleanupConfig,
    }),
    signals: {
      ranking: filteredReport.ranking.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: resolveSignalTitle(documentMap, item.documentId, item.title, params.titleCleanupConfig),
        inboundReferences: item.inboundReferences,
        distinctSourceDocuments: item.distinctSourceDocuments,
        outboundReferences: item.outboundReferences,
      })),
      orphans: filteredReport.orphans.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: resolveSignalTitle(documentMap, item.documentId, item.title, params.titleCleanupConfig),
        updatedAt: item.updatedAt,
        historicalReferenceCount: item.historicalReferenceCount,
        hasSparseEvidence: item.hasSparseEvidence,
      })),
      dormant: filteredReport.dormantDocuments.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: resolveSignalTitle(documentMap, item.documentId, item.title, params.titleCleanupConfig),
        inactivityDays: item.inactivityDays,
        historicalReferenceCount: item.historicalReferenceCount,
      })),
      bridges: filteredReport.bridgeDocuments.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: resolveSignalTitle(documentMap, item.documentId, item.title, params.titleCleanupConfig),
        degree: item.degree,
      })),
      propagation: filteredReport.propagationNodes.slice(0, limits.signalLimit).map(item => ({
        documentId: item.documentId,
        title: resolveSignalTitle(documentMap, item.documentId, item.title, params.titleCleanupConfig),
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
          hubTitles: item.hubDocumentIds.map(documentId => resolveDocumentTitle(documentMap, documentId, params.titleCleanupConfig)),
          missingTopicPage: community?.missingTopicPage ?? false,
        }
      }),
      risingDocuments: filteredTrends.risingDocuments.slice(0, limits.signalLimit).map(item => mapTrendItem(item, documentMap, params.titleCleanupConfig)),
      fallingDocuments: filteredTrends.fallingDocuments.slice(0, limits.signalLimit).map(item => mapTrendItem(item, documentMap, params.titleCleanupConfig)),
      newConnections: filteredTrends.connectionChanges.newEdges.slice(0, limits.connectionLimit).map(item => ({
        title: buildConnectionTitle(documentMap, item.documentIds, params.titleCleanupConfig),
        documentIds: [...item.documentIds],
        referenceCount: item.referenceCount,
      })),
      brokenConnections: filteredTrends.connectionChanges.brokenEdges.slice(0, limits.connectionLimit).map(item => ({
        title: buildConnectionTitle(documentMap, item.documentIds, params.titleCleanupConfig),
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
  titleCleanupConfig?: DocumentTitleCleanupConfig | null
}): AiInboxActionCandidate[] {
  const candidates: AiInboxActionCandidate[] = []
  const usedIds = new Set<string>()

  for (const item of params.report.orphans) {
    const candidate = buildRepairLinkCandidate({
      orphan: item,
      documentMap: params.documentMap,
      ranking: params.report.ranking,
      themeDocuments: params.themeDocuments,
      titleCleanupConfig: params.titleCleanupConfig,
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
      titleCleanupConfig: params.titleCleanupConfig,
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
      titleCleanupConfig: params.titleCleanupConfig,
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
      titleCleanupConfig: params.titleCleanupConfig,
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
  titleCleanupConfig?: DocumentTitleCleanupConfig | null
}): AiInboxActionCandidate | null {
  const document = params.documentMap.get(params.orphan.documentId)
  if (!document) {
    return null
  }
  const documentTitle = resolveDocumentTitle(params.documentMap, params.orphan.documentId, params.titleCleanupConfig)

  const themeMatches = countThemeMatchesForDocument({
    document: normalizeDocumentTitleFields(document, params.titleCleanupConfig),
    themeDocuments: params.themeDocuments,
  }).slice(0, 2)

  const recommendedTargets: AiInboxRecommendedTarget[] = [
    ...themeMatches.map(match => ({
      documentId: match.themeDocumentId,
      title: stripConfiguredTitleAffixes(match.themeDocumentTitle, params.titleCleanupConfig),
      kind: 'theme-document' as const,
      reason: t('analytics.aiInbox.repairTargetThemeReason', { count: match.matchCount }),
    })),
    ...params.ranking
      .filter(item => item.documentId !== params.orphan.documentId && !themeMatches.some(match => match.themeDocumentId === item.documentId))
      .slice(0, themeMatches.length ? 1 : 2)
      .map(item => ({
        documentId: item.documentId,
        title: resolveSignalTitle(params.documentMap, item.documentId, item.title, params.titleCleanupConfig),
        kind: 'core-document' as const,
        reason: t('analytics.aiInbox.repairTargetCoreReason', { count: item.distinctSourceDocuments }),
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
    t('analytics.aiInbox.repairBenefitExitOrphanList'),
    primaryTarget
      ? t('analytics.aiInbox.repairBenefitAddInboundLink', { title: primaryTarget.title })
      : t('analytics.aiInbox.repairBenefitRestoreEntryLink'),
    themeMatches.length
      ? t('analytics.aiInbox.repairBenefitImproveTopicCoverage', { topics: joinLocalizedList(themeMatches.map(item => item.themeName)) })
      : t('analytics.aiInbox.repairBenefitReduceSinkingRisk'),
  ]

  return {
    id: `repair-link:${params.orphan.documentId}`,
    type: 'repair-link',
    title: t('analytics.aiInbox.repairTitle', { title: documentTitle }),
    focusDocumentIds: [params.orphan.documentId],
    confidence: confidenceScore >= 75 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low',
    impactScore,
    urgencyScore,
    actionabilityScore,
    confidenceScore,
    priorityScore,
    recommendedTargets,
    evidence: [
      t('analytics.summaryCards.noValidDocLevelLinksInCurrentWindow'),
      t('analytics.aiInbox.repairEvidenceHistoricalLinks', { count: params.orphan.historicalReferenceCount }),
      ...themeMatches.map(match => t('analytics.aiInbox.repairEvidenceThemeMatch', {
        theme: match.themeName,
        count: match.matchCount,
      })),
    ].slice(0, 4),
    recommendedAction: recommendedTargets.length
      ? t('analytics.aiInbox.repairActionLinkTargets', { targets: joinLocalizedList(recommendedTargets.map(target => target.title)) })
      : t('analytics.aiInbox.repairActionRestoreCoreNetwork'),
    expectedBenefits,
    draftText: primaryTarget?.documentId
      ? t('analytics.aiInbox.repairDraftFitUnder', {
          title: primaryTarget.title,
          documentId: primaryTarget.documentId,
        })
      : undefined,
  }
}

function buildTopicPageCandidate(params: {
  community: ReferenceGraphReport['communities'][number]
  trend: TrendReport['communityTrends'][number]
  documentMap: Map<string, DocumentRecord>
  titleCleanupConfig?: DocumentTitleCleanupConfig | null
}): AiInboxActionCandidate | null {
  const suggestedTitle = buildSuggestedTopicPageTitle(params.community, params.documentMap, params.titleCleanupConfig)
  const recommendedTargets = params.community.hubDocumentIds
    .slice(0, 3)
    .map(documentId => ({
      documentId,
      title: resolveDocumentTitle(params.documentMap, documentId, params.titleCleanupConfig),
      kind: 'community-hub' as const,
      reason: t('analytics.aiInbox.topicPageTargetHubReason'),
    }))

  const impactScore = clampScore(40 + params.community.size * 10 + Math.max(params.trend.delta, 0) * 6)
  const urgencyScore = clampScore(35 + Math.max(params.trend.delta, 0) * 15)
  const actionabilityScore = clampScore(60 + recommendedTargets.length * 8 + (params.community.topTags.length ? 10 : 0))
  const confidenceScore = clampScore(40 + (params.community.topTags.length ? 25 : 10) + recommendedTargets.length * 10)

  return {
    id: `topic-page:${params.community.id}`,
    type: 'create-topic-page',
    title: t('analytics.aiInbox.topicPageTitle', { title: suggestedTitle }),
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
      t('analytics.aiInbox.topicPageEvidenceClusterSize', { count: params.community.size }),
      t('analytics.aiInbox.topicPageEvidenceMissingTopicPage', { delta: formatSignedDelta(params.trend.delta) }),
      params.community.topTags.length
        ? t('analytics.aiInbox.topicPageEvidenceTopTags', { tags: joinLocalizedList(params.community.topTags) })
        : t('analytics.aiInbox.topicPageEvidenceWeakTopTags'),
    ],
    recommendedAction: t('analytics.aiInbox.topicPageActionCreateAndAttach', {
      title: suggestedTitle,
      targets: joinLocalizedList(recommendedTargets.map(target => target.title))
        || t('analytics.aiInbox.topicPageFallbackClusterHubDocs'),
    }),
    expectedBenefits: [
      t('analytics.aiInbox.topicPageBenefitUnifiedEntry'),
      t('analytics.aiInbox.topicPageBenefitBringDocsTogether', { count: params.community.size }),
      t('analytics.aiInbox.topicPageBenefitFollowUpFocused'),
    ],
    draftText: t('analytics.aiInbox.topicPageDraftTitle', { title: suggestedTitle }),
  }
}

function buildBridgeRiskCandidate(params: {
  bridge: ReferenceGraphReport['bridgeDocuments'][number]
  communities: ReferenceGraphReport['communities']
  ranking: ReferenceGraphReport['ranking']
  documentMap: Map<string, DocumentRecord>
  titleCleanupConfig?: DocumentTitleCleanupConfig | null
}): AiInboxActionCandidate | null {
  const relatedCommunities = params.communities.filter(community => community.documentIds.includes(params.bridge.documentId))
  const relatedTargets = relatedCommunities
    .flatMap(community => community.hubDocumentIds)
    .filter(documentId => documentId !== params.bridge.documentId)
  const recommendedTargets = [...new Set(relatedTargets)]
    .slice(0, 3)
    .map(documentId => ({
      documentId,
      title: resolveDocumentTitle(params.documentMap, documentId, params.titleCleanupConfig),
      kind: 'community-hub' as const,
      reason: t('analytics.aiInbox.bridgeTargetHubReason'),
    }))

  if (recommendedTargets.length === 0) {
    recommendedTargets.push(
      ...params.ranking
        .filter(item => item.documentId !== params.bridge.documentId)
        .slice(0, 2)
        .map(item => ({
          documentId: item.documentId,
          title: resolveSignalTitle(params.documentMap, item.documentId, item.title, params.titleCleanupConfig),
          kind: 'related-document' as const,
          reason: t('analytics.aiInbox.bridgeTargetRelatedDocReason'),
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
    title: t('analytics.aiInbox.bridgeTitle', { title: resolveSignalTitle(params.documentMap, params.bridge.documentId, params.bridge.title, params.titleCleanupConfig) }),
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
      t('analytics.aiInbox.bridgeEvidenceRelationshipCount', { count: params.bridge.degree }),
      relatedCommunities.length
        ? t('analytics.aiInbox.bridgeEvidenceAppearsInClusters', { count: relatedCommunities.length })
        : t('analytics.aiInbox.bridgeEvidenceNoAlternativeClusterEntry'),
      recommendedTargets.length
        ? t('analytics.aiInbox.bridgeEvidenceCanLinkToTargets', { targets: joinLocalizedList(recommendedTargets.map(target => target.title)) })
        : t('analytics.aiInbox.bridgeEvidenceNoAlternativeTarget'),
    ],
    recommendedAction: recommendedTargets.length
      ? t('analytics.aiInbox.bridgeActionAddNavigationToTargets', {
          title: resolveSignalTitle(params.documentMap, params.bridge.documentId, params.bridge.title, params.titleCleanupConfig),
          targets: joinLocalizedList(recommendedTargets.map(target => target.title)),
        })
      : t('analytics.aiInbox.bridgeActionAvoidSingleBridgePoint', { title: resolveSignalTitle(params.documentMap, params.bridge.documentId, params.bridge.title, params.titleCleanupConfig) }),
    expectedBenefits: [
      t('analytics.aiInbox.bridgeBenefitReduceFragmentationRisk'),
      recommendedTargets.length
        ? t('analytics.aiInbox.bridgeBenefitAddNavigationForAlternativeEntries', { count: recommendedTargets.length })
        : t('analytics.aiInbox.bridgeBenefitAddAlternativeEntries'),
    ],
    draftText: recommendedTargets.length
      ? t('analytics.aiInbox.bridgeDraftEntries', {
          entries: buildAiInboxEntryLinks(recommendedTargets),
        })
      : undefined,
  }
}

function buildArchiveCandidate(params: {
  dormant: ReferenceGraphReport['dormantDocuments'][number]
  documentMap: Map<string, DocumentRecord>
  ranking: ReferenceGraphReport['ranking']
  themeDocuments: ThemeDocument[]
  titleCleanupConfig?: DocumentTitleCleanupConfig | null
}): AiInboxActionCandidate | null {
  const document = params.documentMap.get(params.dormant.documentId)
  const documentTitle = resolveDocumentTitle(params.documentMap, params.dormant.documentId, params.titleCleanupConfig)
  const themeMatches = document
    ? countThemeMatchesForDocument({
        document: normalizeDocumentTitleFields(document, params.titleCleanupConfig),
        themeDocuments: params.themeDocuments,
      }).slice(0, 1)
    : []
  const recommendedTargets: AiInboxRecommendedTarget[] = themeMatches.map(match => ({
    documentId: match.themeDocumentId,
    title: stripConfiguredTitleAffixes(match.themeDocumentTitle, params.titleCleanupConfig),
    kind: 'theme-document',
    reason: t('analytics.aiInbox.archiveTargetThemeReason'),
  }))

  if (recommendedTargets.length === 0) {
    recommendedTargets.push(
      ...params.ranking
        .filter(item => item.documentId !== params.dormant.documentId)
        .slice(0, 1)
        .map(item => ({
          documentId: item.documentId,
          title: resolveSignalTitle(params.documentMap, item.documentId, item.title, params.titleCleanupConfig),
          kind: 'core-document' as const,
          reason: t('analytics.aiInbox.archiveTargetCoreReason'),
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
    title: t('analytics.aiInbox.archiveTitle', { title: documentTitle }),
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
      t('analytics.aiInbox.archiveEvidenceDaysWithoutLinks', { count: params.dormant.inactivityDays }),
      t('analytics.aiInbox.archiveEvidenceHistoricalLinks', { count: params.dormant.historicalReferenceCount }),
    ],
    recommendedAction: recommendedTargets.length
      ? t('analytics.aiInbox.archiveActionKeepLookupEntry', { title: recommendedTargets[0].title })
      : t('analytics.aiInbox.archiveActionConfirmThenArchive'),
    expectedBenefits: [
      t('analytics.aiInbox.archiveBenefitReduceBuildup'),
      t('analytics.aiInbox.archiveBenefitKeepLookupEntry'),
    ],
  }
}

function mapTrendItem(
  item: TrendDocumentItem,
  documentMap: Map<string, DocumentRecord>,
  titleCleanupConfig?: DocumentTitleCleanupConfig | null,
) {
  return {
    documentId: item.documentId,
    title: resolveSignalTitle(documentMap, item.documentId, item.title, titleCleanupConfig),
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

function resolveDocumentTitle(
  documentMap: Map<string, DocumentRecord>,
  documentId: string,
  titleCleanupConfig?: DocumentTitleCleanupConfig | null,
): string {
  const document = documentMap.get(documentId)
  return document
    ? resolveNormalizedDocumentTitle(document, titleCleanupConfig)
    : documentId
}

function buildConnectionTitle(
  documentMap: Map<string, DocumentRecord>,
  documentIds: string[],
  titleCleanupConfig?: DocumentTitleCleanupConfig | null,
): string {
  return documentIds.map(documentId => resolveDocumentTitle(documentMap, documentId, titleCleanupConfig)).join(' <-> ')
}

function buildSuggestedTopicPageTitle(
  community: ReferenceGraphReport['communities'][number],
  documentMap: Map<string, DocumentRecord>,
  titleCleanupConfig?: DocumentTitleCleanupConfig | null,
) {
  const topic = community.topTags[0]
    || (community.hubDocumentIds[0] ? resolveDocumentTitle(documentMap, community.hubDocumentIds[0], titleCleanupConfig) : '')
    || (community.documentIds[0] ? resolveDocumentTitle(documentMap, community.documentIds[0], titleCleanupConfig) : '')
    || t('analytics.aiInbox.untitledTopic')
  return t('analytics.aiInbox.suggestedTopicPageTitle', { topic })
}

function joinLocalizedList(items: string[]) {
  return items.join(resolveUiLocale() === 'zh_CN' ? '、' : ', ')
}

function buildAiInboxEntryLinks(targets: Array<Pick<AiInboxRecommendedTarget, 'documentId' | 'title'>>) {
  return targets
    .filter((target): target is Required<Pick<AiInboxRecommendedTarget, 'documentId' | 'title'>> => Boolean(target.documentId))
    .map(target => `((` + `${target.documentId} "${target.title}"))`)
    .join(' / ')
}

function resolveSignalTitle(
  documentMap: Map<string, DocumentRecord>,
  documentId: string,
  fallbackTitle: string,
  titleCleanupConfig?: DocumentTitleCleanupConfig | null,
): string {
  const document = documentMap.get(documentId)
  return document
    ? resolveNormalizedDocumentTitle(document, titleCleanupConfig)
    : stripConfiguredTitleAffixes(fallbackTitle, titleCleanupConfig)
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
    throw new Error(t('analytics.aiInbox.enableTodaySuggestionsInSettings'))
  }
  if (!isAiConfigComplete(params.config)) {
    throw new Error(t('analytics.aiInbox.incompleteAiSettings'))
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
    throw new Error(t('analytics.aiInbox.aiReturnedUnparseableJson'))
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
    throw new Error(t('analytics.aiInbox.enterSiliconFlowBaseUrlAndApiKeyFirst'))
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
    throw new Error(t('analytics.aiInbox.modelListRequestFailed', { status: response?.status ?? 'unknown status' }))
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
  throw new Error(t('analytics.aiInbox.aiReturnedUnreadableContent'))
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
    throw new Error(t('analytics.aiInbox.aiReturnedInvalidJson'))
  }
}

function normalizeAiInboxResult(value: any): AiInboxResult {
  const items = Array.isArray(value?.items)
    ? value.items
        .map((item: any, index: number) => normalizeAiInboxItem(item, index))
        .filter((item: AiInboxItem | null): item is AiInboxItem => item !== null)
    : []

  if (items.length === 0) {
    throw new Error(t('analytics.aiInbox.aiDidNotReturnValidCleanupTasks'))
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: typeof value?.summary === 'string' && value.summary.trim()
      ? value.summary.trim()
      : t('analytics.aiInbox.cleanupPrioritiesGenerated'),
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
    hints.push(t('analytics.aiInbox.baseUrlLikelyNeedsV1', { endpoint: params.endpoint }))
  }

  if (params.endpoint.startsWith('https://api.siliconflow.cn/chat/completions')) {
    hints.push(t('analytics.aiInbox.siliconFlowVerifyBaseUrl'))
  }

  if (rawMessage.includes('context deadline exceeded')) {
    hints.push(t('analytics.aiInbox.timeoutHint'))
    return new Error(t('analytics.aiInbox.aiRequestTimedOut', { message: rawMessage, hints: hints.join('\n') }))
  }

  return new Error(t('analytics.aiInbox.aiRequestFailed', { message: rawMessage, hints: hints.join('\n') }))
}

function buildAiNonOkResponseError(params: {
  endpoint: string
  status: string | number
  responseBody: string
}) {
  const hints: string[] = []

  if (isLikelyMissingV1Path(params.endpoint)) {
    hints.push(t('analytics.aiInbox.baseUrlLikelyNeedsV1', { endpoint: params.endpoint }))
  }

  if (params.endpoint.startsWith('https://api.siliconflow.cn/chat/completions')) {
    hints.push(t('analytics.aiInbox.siliconFlowVerifyBaseUrl'))
  }

  const responseSummary = params.responseBody.trim().slice(0, 200)
  const details = responseSummary ? t('analytics.aiInbox.responseSnippet', { value: responseSummary }) : ''
  const hintText = hints.length ? `\n${hints.join('\n')}` : ''

  return new Error(t('analytics.aiInbox.aiRequestFailedWithStatus', { status: params.status, details, hintText }))
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
