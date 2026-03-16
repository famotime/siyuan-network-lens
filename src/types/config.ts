export interface PluginConfig {
  showSummaryCards: boolean
  showDocuments?: boolean
  showRead?: boolean
  showReferences?: boolean
  showRanking?: boolean
  showCommunities?: boolean
  showTrends?: boolean
  showOrphans?: boolean
  showDormant?: boolean
  showBridges?: boolean
  showPropagation?: boolean
  showOrphanBridge?: boolean
  themeNotebookId: string
  themeDocumentPath: string
  themeNamePrefix: string
  themeNameSuffix: string
  readTagNames?: string[]
  readTitlePrefixes?: string
  readTitleSuffixes?: string
  summaryCardOrder?: string[]
}

export const DEFAULT_CONFIG: PluginConfig = {
  showSummaryCards: true,
  showDocuments: true,
  showRead: true,
  showReferences: true,
  showRanking: true,
  showCommunities: true,
  showTrends: true,
  showOrphans: true,
  showDormant: true,
  showBridges: true,
  showPropagation: true,
  themeNotebookId: '',
  themeDocumentPath: '',
  themeNamePrefix: '',
  themeNameSuffix: '',
  readTagNames: [],
  readTitlePrefixes: '',
  readTitleSuffixes: '',
  summaryCardOrder: undefined,
}

export function ensureConfigDefaults(config: PluginConfig) {
  const legacyOrphanBridge = typeof config.showOrphanBridge === 'boolean'
    ? config.showOrphanBridge
    : true

  if (typeof config.showDocuments !== 'boolean') {
    config.showDocuments = true
  }
  if (typeof config.showRead !== 'boolean') {
    config.showRead = true
  }
  if (typeof config.showReferences !== 'boolean') {
    config.showReferences = true
  }
  if (typeof config.showRanking !== 'boolean') {
    config.showRanking = true
  }
  if (typeof config.showCommunities !== 'boolean') {
    config.showCommunities = true
  }
  if (typeof config.showTrends !== 'boolean') {
    config.showTrends = true
  }
  if (typeof config.showOrphans !== 'boolean') {
    config.showOrphans = legacyOrphanBridge
  }
  if (typeof config.showDormant !== 'boolean') {
    config.showDormant = legacyOrphanBridge
  }
  if (typeof config.showBridges !== 'boolean') {
    config.showBridges = legacyOrphanBridge
  }
  if (typeof config.showPropagation !== 'boolean') {
    config.showPropagation = true
  }
  if (!Array.isArray(config.readTagNames)) {
    config.readTagNames = []
  }
  if (typeof config.readTitlePrefixes !== 'string') {
    config.readTitlePrefixes = ''
  }
  if (typeof config.readTitleSuffixes !== 'string') {
    config.readTitleSuffixes = ''
  }
}
