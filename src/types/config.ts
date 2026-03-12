export interface PluginConfig {
  showSummaryCards: boolean
  showRanking: boolean
  showEvidence: boolean
  showSuggestions: boolean
  showCommunities: boolean
  showOrphanBridge: boolean
  showTrends: boolean
  showPaths: boolean
  showPropagation: boolean
  showDocumentDetail: boolean
}

export const DEFAULT_CONFIG: PluginConfig = {
  showSummaryCards: true,
  showRanking: true,
  showEvidence: true,
  showSuggestions: true,
  showCommunities: true,
  showOrphanBridge: true,
  showTrends: true,
  showPaths: true,
  showPropagation: true,
  showDocumentDetail: true,
}
