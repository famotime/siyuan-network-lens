import { SUMMARY_CARD_DEFINITIONS, buildSummaryCardVisibilityDefaults } from '@/analytics/summary-card-config'
import type { AiContextCapacity } from '@/analytics/ai-inbox'

export const DEFAULT_AI_REQUEST_TIMEOUT_SECONDS = 30
export const DEFAULT_AI_MAX_TOKENS = 10240
export const DEFAULT_AI_TEMPERATURE = 0.7
export const DEFAULT_AI_MAX_CONTEXT_MESSAGES = 7

export interface PluginConfig {
  showSummaryCards: boolean
  showDocuments?: boolean
  showLargeDocuments?: boolean
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
  readPaths?: string
  aiEnabled?: boolean
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
  aiRequestTimeoutSeconds?: number
  aiMaxTokens?: number
  aiTemperature?: number
  aiMaxContextMessages?: number
  aiContextCapacity?: AiContextCapacity
  summaryCardOrder?: string[]
}

export const DEFAULT_CONFIG: PluginConfig = {
  showSummaryCards: true,
  ...buildSummaryCardVisibilityDefaults(),
  themeNotebookId: '',
  themeDocumentPath: '',
  themeNamePrefix: '',
  themeNameSuffix: '',
  readTagNames: [],
  readTitlePrefixes: '',
  readTitleSuffixes: '',
  readPaths: '',
  aiEnabled: false,
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '',
  aiRequestTimeoutSeconds: DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  aiMaxTokens: DEFAULT_AI_MAX_TOKENS,
  aiTemperature: DEFAULT_AI_TEMPERATURE,
  aiMaxContextMessages: DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  aiContextCapacity: 'balanced',
  summaryCardOrder: undefined,
}

export function ensureConfigDefaults(config: PluginConfig) {
  for (const definition of SUMMARY_CARD_DEFINITIONS) {
    const visibilityKey = definition.visibilityConfigKey
    if (typeof config[visibilityKey] === 'boolean') {
      continue
    }

    const legacyVisibilityKey = definition.legacyVisibilityConfigKey
    if (legacyVisibilityKey && typeof config[legacyVisibilityKey] === 'boolean') {
      config[visibilityKey] = config[legacyVisibilityKey]
      continue
    }

    config[visibilityKey] = definition.defaultVisible
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
  if (typeof config.readPaths !== 'string') {
    config.readPaths = ''
  }
  if (typeof config.aiEnabled !== 'boolean') {
    config.aiEnabled = false
  }
  if (typeof config.aiBaseUrl !== 'string') {
    config.aiBaseUrl = ''
  }
  if (typeof config.aiApiKey !== 'string') {
    config.aiApiKey = ''
  }
  if (typeof config.aiModel !== 'string') {
    config.aiModel = ''
  }
  config.aiRequestTimeoutSeconds = normalizePositiveInteger(
    config.aiRequestTimeoutSeconds,
    DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  )
  config.aiMaxTokens = normalizePositiveInteger(
    config.aiMaxTokens,
    DEFAULT_AI_MAX_TOKENS,
  )
  config.aiTemperature = normalizeTemperature(
    config.aiTemperature,
    DEFAULT_AI_TEMPERATURE,
  )
  config.aiMaxContextMessages = normalizePositiveInteger(
    config.aiMaxContextMessages,
    DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  )
  if (config.aiContextCapacity !== 'compact' && config.aiContextCapacity !== 'balanced' && config.aiContextCapacity !== 'full') {
    config.aiContextCapacity = 'balanced'
  }
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const normalized = typeof value === 'string' && value.trim()
    ? Number.parseInt(value, 10)
    : typeof value === 'number'
      ? Math.floor(value)
      : Number.NaN

  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : fallback
}

function normalizeTemperature(value: unknown, fallback: number): number {
  const normalized = typeof value === 'string' && value.trim()
    ? Number.parseFloat(value)
    : typeof value === 'number'
      ? value
      : Number.NaN

  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 2
    ? normalized
    : fallback
}
