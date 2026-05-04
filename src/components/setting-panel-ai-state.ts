import type { AiProviderPresetKey } from '@/types/ai-provider'
import type { PluginConfig } from '@/types/config'
import { t } from '@/i18n/ui'

export function syncAiProviderConfigSnapshot(config: PluginConfig, provider: AiProviderPresetKey) {
  config.aiProviderPreset = provider
  if (!config.aiProviderConfigs || typeof config.aiProviderConfigs !== 'object') {
    config.aiProviderConfigs = {}
  }

  config.aiProviderConfigs[provider] = {
    aiBaseUrl: config.aiBaseUrl ?? '',
    aiApiKey: config.aiApiKey ?? '',
    aiModel: config.aiModel ?? '',
    aiRequestTimeoutSeconds: config.aiRequestTimeoutSeconds,
    aiMaxTokens: config.aiMaxTokens,
    aiTemperature: config.aiTemperature,
    aiMaxContextMessages: config.aiMaxContextMessages,
  }
}

export function shouldResetSiliconFlowModelCatalog(params: {
  provider: AiProviderPresetKey
  apiKey?: string
  previousProvider: AiProviderPresetKey
  previousApiKey?: string
}) {
  const currentApiKey = params.apiKey?.trim() ?? ''
  const previousApiKey = params.previousApiKey?.trim() ?? ''

  if (params.provider !== 'siliconflow') {
    return true
  }
  if (!currentApiKey) {
    return true
  }
  return params.provider !== params.previousProvider || currentApiKey !== previousApiKey
}

export function buildSiliconFlowModelSelectTitle(params: {
  baseTitle: string
  placeholder: string
  error: string
}) {
  return [
    params.baseTitle,
    params.placeholder,
    params.error ? t('settings.ai.lastLoadFailed', { error: params.error }) : '',
  ]
    .filter(Boolean)
    .join(' ')
}
