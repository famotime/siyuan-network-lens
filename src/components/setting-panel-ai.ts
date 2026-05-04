import { t } from '@/i18n/ui'

export function getAiFieldTooltips() {
  return {
    baseUrl: t('aiConfig.tooltipBaseUrl'),
    timeout: t('aiConfig.tooltipTimeout'),
    maxTokens: t('aiConfig.tooltipMaxTokens'),
    temperature: t('aiConfig.tooltipTemperature'),
    maxContextMessages: t('aiConfig.tooltipMaxContextMessages'),
    siliconFlowChatModel: t('aiConfig.tooltipSiliconFlowChatModel'),
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
  kind: 'chat'
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
    return t('aiConfig.loadingChatModels')
  }
  if (params.error) {
    return t('aiConfig.loadFailedRetry')
  }
  if (params.loaded || params.optionCount > 0) {
    return t('aiConfig.selectChatModel')
  }
  return t('aiConfig.clickToLoadChatModels')
}
