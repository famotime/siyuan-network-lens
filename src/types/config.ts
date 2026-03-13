export interface PluginConfig {
  showSummaryCards: boolean
  showRanking: boolean
  showSuggestions: boolean
  showCommunities: boolean
  showOrphanBridge: boolean
  showTrends: boolean
  showPropagation: boolean
  themeNotebookId: string
  themeDocumentPath: string
  themeNamePrefix: string
  themeNameSuffix: string
}

export const DEFAULT_CONFIG: PluginConfig = {
  showSummaryCards: true,
  showRanking: true,
  showSuggestions: true,
  showCommunities: true,
  showOrphanBridge: true,
  showTrends: true,
  showPropagation: true,
  themeNotebookId: '',
  themeDocumentPath: '',
  themeNamePrefix: '',
  themeNameSuffix: '',
}
