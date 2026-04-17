import type {
  AiProviderConfigMap,
  AiProviderConfigSnapshot,
  AiProviderPresetKey,
} from '@/types/ai-provider'
import {
  DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  DEFAULT_AI_TEMPERATURE,
} from '@/types/ai-defaults'
import { t } from '@/i18n/ui'

interface AiProviderPresetDefinition {
  label: string
  baseUrl?: string
  defaultModel?: string
  defaultEmbeddingModel?: string
  modelPlaceholder: string
  embeddingPlaceholder: string
}

export function getAiProviderPresets(): Record<AiProviderPresetKey, AiProviderPresetDefinition> {
  return {
    siliconflow: {
      label: t('aiConfig.siliconFlow'),
      baseUrl: 'https://api.siliconflow.cn/v1',
      defaultModel: '',
      defaultEmbeddingModel: '',
      modelPlaceholder: t('aiConfig.selectModelPlaceholder'),
      embeddingPlaceholder: t('aiConfig.selectEmbeddingPlaceholder'),
    },
    openai: {
      label: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-5',
      defaultEmbeddingModel: 'text-embedding-3-small',
      modelPlaceholder: 'gpt-5',
      embeddingPlaceholder: 'text-embedding-3-small',
    },
    gemini: {
      label: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      defaultModel: 'gemini-2.5-flash',
      defaultEmbeddingModel: 'gemini-embedding-001',
      modelPlaceholder: 'gemini-2.5-flash',
      embeddingPlaceholder: 'gemini-embedding-001',
    },
    custom: {
      label: t('aiConfig.custom'),
      modelPlaceholder: t('aiConfig.enterModelNameManually'),
      embeddingPlaceholder: t('aiConfig.enterEmbeddingModelManually'),
    },
  }
}

export const AI_PROVIDER_PRESETS: Record<AiProviderPresetKey, AiProviderPresetDefinition> = getAiProviderPresets()

export function buildAiProviderPresetOptions() {
  const presets = getAiProviderPresets()
  return ([
    'siliconflow',
    'openai',
    'gemini',
    'custom',
  ] as const).map(value => ({
    value,
    label: presets[value].label,
  }))
}

export const AI_PROVIDER_PRESET_OPTIONS = buildAiProviderPresetOptions()

export function detectAiProviderPreset(baseUrl?: string): AiProviderPresetKey {
  const normalized = normalizeUrl(baseUrl)
  if (!normalized) {
    return 'custom'
  }

  if (/^https:\/\/api\.siliconflow\.cn(?:\/v1)?$/i.test(normalized)) {
    return 'siliconflow'
  }
  if (normalized === 'https://api.openai.com/v1') {
    return 'openai'
  }
  if (normalized === 'https://generativelanguage.googleapis.com/v1beta/openai') {
    return 'gemini'
  }
  return 'custom'
}

export function applyAiProviderPreset(config: {
  aiProviderPreset?: AiProviderPresetKey
  aiProviderConfigs?: AiProviderConfigMap
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
  aiEmbeddingModel?: string
  aiRequestTimeoutSeconds?: number
  aiMaxTokens?: number
  aiTemperature?: number
  aiMaxContextMessages?: number
}, provider: AiProviderPresetKey) {
  const providerConfigs = ensureAiProviderConfigMap(config)
  const currentProvider = normalizeAiProviderPreset(config.aiProviderPreset, config.aiBaseUrl)

  providerConfigs[currentProvider] = buildAiProviderConfigSnapshot({
    provider: currentProvider,
    aiBaseUrl: config.aiBaseUrl,
    aiApiKey: config.aiApiKey,
    aiModel: config.aiModel,
    aiEmbeddingModel: config.aiEmbeddingModel,
    aiRequestTimeoutSeconds: config.aiRequestTimeoutSeconds,
    aiMaxTokens: config.aiMaxTokens,
    aiTemperature: config.aiTemperature,
    aiMaxContextMessages: config.aiMaxContextMessages,
  })

  config.aiProviderPreset = provider
  const nextSnapshot = resolveAiProviderConfigSnapshot(providerConfigs[provider], provider)
  applyAiProviderConfigSnapshot(config, nextSnapshot)
  providerConfigs[provider] = nextSnapshot
}

export function ensureAiProviderConfigState(config: {
  aiProviderPreset?: AiProviderPresetKey
  aiProviderConfigs?: AiProviderConfigMap
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
  aiEmbeddingModel?: string
  aiRequestTimeoutSeconds?: number
  aiMaxTokens?: number
  aiTemperature?: number
  aiMaxContextMessages?: number
}) {
  const providerConfigs = ensureAiProviderConfigMap(config)
  const activeProvider = normalizeAiProviderPreset(config.aiProviderPreset, config.aiBaseUrl)
  const hasStoredConfig = typeof providerConfigs[activeProvider] === 'object' && providerConfigs[activeProvider] !== null
  const activeSnapshot = hasStoredConfig
    ? resolveAiProviderConfigSnapshot(providerConfigs[activeProvider], activeProvider)
    : buildAiProviderConfigSnapshot({
        provider: activeProvider,
        aiBaseUrl: config.aiBaseUrl,
        aiApiKey: config.aiApiKey,
        aiModel: config.aiModel,
        aiEmbeddingModel: config.aiEmbeddingModel,
        aiRequestTimeoutSeconds: config.aiRequestTimeoutSeconds,
        aiMaxTokens: config.aiMaxTokens,
        aiTemperature: config.aiTemperature,
        aiMaxContextMessages: config.aiMaxContextMessages,
      })

  config.aiProviderPreset = activeProvider
  providerConfigs[activeProvider] = activeSnapshot
  applyAiProviderConfigSnapshot(config, activeSnapshot)
}

export function buildAiModelOptionItems(modelIds: string[], currentValue?: string) {
  const values = new Set(modelIds.map(item => item.trim()).filter(Boolean))
  const current = currentValue?.trim()
  if (current) {
    values.add(current)
  }

  return [...values]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map(value => ({
      value,
      label: value,
      key: value,
    }))
}

function normalizeUrl(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return ''
  }

  try {
    return new URL(trimmed).toString().replace(/\/+$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

function getAiProviderDefaultConfig(provider: AiProviderPresetKey): AiProviderConfigSnapshot {
  const preset = getAiProviderPresets()[provider]
  return {
    aiBaseUrl: preset.baseUrl ?? '',
    aiApiKey: '',
    aiModel: preset.defaultModel ?? '',
    aiEmbeddingModel: preset.defaultEmbeddingModel ?? '',
    aiRequestTimeoutSeconds: DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
    aiMaxTokens: DEFAULT_AI_MAX_TOKENS,
    aiTemperature: DEFAULT_AI_TEMPERATURE,
    aiMaxContextMessages: DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  }
}

function resolveAiProviderConfigSnapshot(
  snapshot: Partial<AiProviderConfigSnapshot> | undefined,
  provider: AiProviderPresetKey,
): AiProviderConfigSnapshot {
  const defaults = getAiProviderDefaultConfig(provider)
  return {
    aiBaseUrl: typeof snapshot?.aiBaseUrl === 'string' ? snapshot.aiBaseUrl : defaults.aiBaseUrl,
    aiApiKey: typeof snapshot?.aiApiKey === 'string' ? snapshot.aiApiKey : defaults.aiApiKey,
    aiModel: typeof snapshot?.aiModel === 'string' ? snapshot.aiModel : defaults.aiModel,
    aiEmbeddingModel: typeof snapshot?.aiEmbeddingModel === 'string' ? snapshot.aiEmbeddingModel : defaults.aiEmbeddingModel,
    aiRequestTimeoutSeconds: normalizePositiveInteger(snapshot?.aiRequestTimeoutSeconds, defaults.aiRequestTimeoutSeconds),
    aiMaxTokens: normalizePositiveInteger(snapshot?.aiMaxTokens, defaults.aiMaxTokens),
    aiTemperature: normalizeTemperature(snapshot?.aiTemperature, defaults.aiTemperature),
    aiMaxContextMessages: normalizePositiveInteger(snapshot?.aiMaxContextMessages, defaults.aiMaxContextMessages),
  }
}

function buildAiProviderConfigSnapshot(params: {
  provider: AiProviderPresetKey
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
  aiEmbeddingModel?: string
  aiRequestTimeoutSeconds?: number
  aiMaxTokens?: number
  aiTemperature?: number
  aiMaxContextMessages?: number
}): AiProviderConfigSnapshot {
  return resolveAiProviderConfigSnapshot({
    aiBaseUrl: params.aiBaseUrl,
    aiApiKey: params.aiApiKey,
    aiModel: params.aiModel,
    aiEmbeddingModel: params.aiEmbeddingModel,
    aiRequestTimeoutSeconds: params.aiRequestTimeoutSeconds,
    aiMaxTokens: params.aiMaxTokens,
    aiTemperature: params.aiTemperature,
    aiMaxContextMessages: params.aiMaxContextMessages,
  }, params.provider)
}

function applyAiProviderConfigSnapshot(config: {
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
  aiEmbeddingModel?: string
  aiRequestTimeoutSeconds?: number
  aiMaxTokens?: number
  aiTemperature?: number
  aiMaxContextMessages?: number
}, snapshot: AiProviderConfigSnapshot) {
  config.aiBaseUrl = snapshot.aiBaseUrl
  config.aiApiKey = snapshot.aiApiKey
  config.aiModel = snapshot.aiModel
  config.aiEmbeddingModel = snapshot.aiEmbeddingModel
  config.aiRequestTimeoutSeconds = snapshot.aiRequestTimeoutSeconds
  config.aiMaxTokens = snapshot.aiMaxTokens
  config.aiTemperature = snapshot.aiTemperature
  config.aiMaxContextMessages = snapshot.aiMaxContextMessages
}

function ensureAiProviderConfigMap(config: {
  aiProviderConfigs?: AiProviderConfigMap
}) {
  if (!config.aiProviderConfigs || typeof config.aiProviderConfigs !== 'object') {
    config.aiProviderConfigs = {}
  }
  return config.aiProviderConfigs
}

function normalizeAiProviderPreset(provider: AiProviderPresetKey | undefined, baseUrl?: string): AiProviderPresetKey {
  return provider === 'siliconflow' || provider === 'openai' || provider === 'gemini' || provider === 'custom'
    ? provider
    : detectAiProviderPreset(baseUrl)
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
