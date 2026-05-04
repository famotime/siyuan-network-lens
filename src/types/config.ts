import { ensureAiProviderConfigState } from '@/components/ai-provider-presets'
import { SUMMARY_CARD_DEFINITIONS, buildSummaryCardVisibilityDefaults } from '@/analytics/summary-card-config'
import type { AiContextCapacity } from '@/analytics/ai-inbox'
import {
  DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  DEFAULT_AI_TEMPERATURE,
} from '@/types/ai-defaults'
import type { AiProviderConfigMap, AiProviderPresetKey } from '@/types/ai-provider'

export {
  DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  DEFAULT_AI_TEMPERATURE,
} from '@/types/ai-defaults'
export const DEFAULT_WIKI_PAGE_SUFFIX = '-llm-wiki'
export const DEFAULT_WIKI_INDEX_TITLE = 'LLM-Wiki-Index'
export const DEFAULT_WIKI_LOG_TITLE = 'LLM-Wiki-Maintenance-Log'

export interface PluginConfig {
  showSummaryCards: boolean
  showDocuments?: boolean
  showLargeDocuments?: boolean
  showRead?: boolean
  showTodaySuggestions?: boolean
  showReferences?: boolean
  showRanking?: boolean
  showCommunities?: boolean
  showTrends?: boolean
  showOrphans?: boolean
  showDormant?: boolean
  showBridges?: boolean
  showPropagation?: boolean
  showOrphanBridge?: boolean
  themeNotebookId?: string
  themeDocumentPath: string
  themeNamePrefix: string
  themeNameSuffix: string
  analysisExcludedPaths?: string
  analysisExcludedNamePrefixes?: string
  analysisExcludedNameSuffixes?: string
  readTagNames?: string[]
  readTitlePrefixes?: string
  readTitleSuffixes?: string
  readPaths?: string
  aiEnabled?: boolean
  aiProviderPreset?: AiProviderPresetKey
  aiProviderConfigs?: AiProviderConfigMap
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string

  aiRequestTimeoutSeconds?: number
  aiMaxTokens?: number
  aiTemperature?: number
  aiMaxContextMessages?: number
  aiContextCapacity?: AiContextCapacity
  enableConsoleLogging?: boolean
  showDocumentIndex?: boolean
  wikiEnabled?: boolean
  wikiPageSuffix?: string
  wikiIndexTitle?: string
  wikiLogTitle?: string
  summaryCardOrder?: string[]
}

export const DEFAULT_CONFIG: PluginConfig = {
  showSummaryCards: true,
  ...buildSummaryCardVisibilityDefaults(),
  themeNotebookId: '',
  themeDocumentPath: '',
  themeNamePrefix: '',
  themeNameSuffix: '',
  analysisExcludedPaths: '',
  analysisExcludedNamePrefixes: '',
  analysisExcludedNameSuffixes: '',
  readTagNames: [],
  readTitlePrefixes: '',
  readTitleSuffixes: '',
  readPaths: '',
  aiEnabled: false,
  aiProviderPreset: 'custom',
  aiProviderConfigs: undefined,
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '',

  aiRequestTimeoutSeconds: DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  aiMaxTokens: DEFAULT_AI_MAX_TOKENS,
  aiTemperature: DEFAULT_AI_TEMPERATURE,
  aiMaxContextMessages: DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  aiContextCapacity: 'balanced',
  enableConsoleLogging: false,
  showDocumentIndex: false,
  wikiEnabled: false,
  wikiPageSuffix: DEFAULT_WIKI_PAGE_SUFFIX,
  wikiIndexTitle: DEFAULT_WIKI_INDEX_TITLE,
  wikiLogTitle: DEFAULT_WIKI_LOG_TITLE,
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
  if (typeof config.themeNotebookId !== 'string') {
    config.themeNotebookId = ''
  }
  if (typeof config.themeDocumentPath !== 'string') {
    config.themeDocumentPath = ''
  }
  if (typeof config.themeNamePrefix !== 'string') {
    config.themeNamePrefix = ''
  }
  if (typeof config.themeNameSuffix !== 'string') {
    config.themeNameSuffix = ''
  }
  if (typeof config.analysisExcludedPaths !== 'string') {
    config.analysisExcludedPaths = ''
  }
  if (typeof config.analysisExcludedNamePrefixes !== 'string') {
    config.analysisExcludedNamePrefixes = ''
  }
  if (typeof config.analysisExcludedNameSuffixes !== 'string') {
    config.analysisExcludedNameSuffixes = ''
  }
  if (config.themeNotebookId.trim() && config.themeDocumentPath.trim() && !looksLikeNotebookScopedPath(config.themeDocumentPath)) {
    config.themeDocumentPath = `/${config.themeNotebookId.trim()}${normalizeLegacyPath(config.themeDocumentPath)}`
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
  if (
    config.aiProviderPreset !== 'siliconflow'
    && config.aiProviderPreset !== 'openai'
    && config.aiProviderPreset !== 'gemini'
    && config.aiProviderPreset !== 'custom'
  ) {
    config.aiProviderPreset = undefined
  }
  if (!config.aiProviderConfigs || typeof config.aiProviderConfigs !== 'object') {
    config.aiProviderConfigs = {}
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
  if (typeof config.enableConsoleLogging !== 'boolean') {
    config.enableConsoleLogging = false
  }
  if (typeof config.showDocumentIndex !== 'boolean') {
    config.showDocumentIndex = false
  }
  if (typeof config.wikiEnabled !== 'boolean') {
    config.wikiEnabled = false
  }
  config.wikiPageSuffix = normalizeNonEmptyString(
    config.wikiPageSuffix,
    DEFAULT_WIKI_PAGE_SUFFIX,
  )
  config.wikiIndexTitle = normalizeNonEmptyString(
    config.wikiIndexTitle,
    DEFAULT_WIKI_INDEX_TITLE,
  )
  config.wikiLogTitle = normalizeNonEmptyString(
    config.wikiLogTitle,
    DEFAULT_WIKI_LOG_TITLE,
  )
  ensureAiProviderConfigState(config)
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

function normalizeNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback
}

function normalizeLegacyPath(value: string): string {
  const normalized = value
    .replace(/\\/g, '/')
    .trim()
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withLeadingSlash === '/'
    ? withLeadingSlash
    : withLeadingSlash.replace(/\/+$/, '')
}

function looksLikeNotebookScopedPath(value: string): boolean {
  return value.includes('|') || value.trim().split('/').filter(Boolean).length >= 2
}
