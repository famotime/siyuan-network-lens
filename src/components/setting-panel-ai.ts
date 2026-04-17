import { t } from '@/i18n/ui'

export function getAiFieldTooltips() {
  return {
    baseUrl: t('aiConfig.tooltipBaseUrl'),
    embeddingModel: t('aiConfig.tooltipEmbeddingModel'),
    timeout: t('aiConfig.tooltipTimeout'),
    maxTokens: t('aiConfig.tooltipMaxTokens'),
    temperature: t('aiConfig.tooltipTemperature'),
    maxContextMessages: t('aiConfig.tooltipMaxContextMessages'),
    siliconFlowChatModel: t('aiConfig.tooltipSiliconFlowChatModel'),
    siliconFlowEmbeddingModel: t('aiConfig.tooltipSiliconFlowEmbeddingModel'),
  } as const
}

export function shouldAutoLoadSiliconFlowModelCatalog(params: {
  apiKey?: string
  loading: boolean
  loaded: boolean
  error: string
}) {
  if (!params.apiKey?.trim()) {
    return false
  }
  if (params.loading) {
    return false
  }
  return !params.loaded || Boolean(params.error)
}

export function buildSiliconFlowModelSelectPlaceholder(params: {
  kind: 'chat' | 'embedding'
  apiKey?: string
  loading: boolean
  loaded: boolean
  error: string
  optionCount: number
}) {
  if (!params.apiKey?.trim()) {
    return t('aiConfig.enterApiKeyFirst')
  }
  if (params.loading) {
    return params.kind === 'chat'
      ? t('aiConfig.loadingChatModels')
      : t('aiConfig.loadingEmbeddingModels')
  }
  if (params.error) {
    return t('aiConfig.loadFailedRetry')
  }
  if (params.loaded || params.optionCount > 0) {
    return params.kind === 'chat'
      ? t('aiConfig.selectChatModel')
      : t('aiConfig.selectEmbeddingModel')
  }
  return params.kind === 'chat'
    ? t('aiConfig.clickToLoadChatModels')
    : t('aiConfig.clickToLoadEmbeddingModels')
}
