import type { ReferenceGraphReport, TrendReport } from './analysis'

export interface PanelCounts {
  ranking: number
  suggestions: number
  communities: number
  orphanBridge: number
  trends: number
  propagation: number
}

const RANKING_LIMIT = 12
const TREND_LIMIT = 5
const PROPAGATION_LIMIT = 8

export function buildPanelCounts(params: {
  report: ReferenceGraphReport
  trends: TrendReport | null
  pathChain: string[]
}): PanelCounts {
  const suggestions = new Set(params.report.suggestions.map(item => item.documentId))
  const communityDocuments = new Set(params.report.communities.flatMap(community => community.documentIds))
  const orphanBridgeDocuments = new Set([
    ...params.report.orphans.map(item => item.documentId),
    ...params.report.bridgeDocuments.map(item => item.documentId),
    ...params.report.dormantDocuments.map(item => item.documentId),
  ])
  const trendsDocuments = new Set<string>()
  if (params.trends) {
    for (const item of params.trends.risingDocuments.slice(0, TREND_LIMIT)) {
      trendsDocuments.add(item.documentId)
    }
    for (const item of params.trends.fallingDocuments.slice(0, TREND_LIMIT)) {
      trendsDocuments.add(item.documentId)
    }
  }

  return {
    ranking: Math.min(params.report.ranking.length, RANKING_LIMIT),
    suggestions: suggestions.size,
    communities: communityDocuments.size,
    orphanBridge: orphanBridgeDocuments.size,
    trends: trendsDocuments.size,
    propagation: Math.min(params.report.propagationNodes.length, PROPAGATION_LIMIT),
  }
}
