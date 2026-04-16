import { computed, ref, watch } from 'vue'

import { forwardProxy } from '@/api'
import { createAiInboxService, fetchSiliconFlowModelCatalog, isAiConfigComplete } from '@/analytics/ai-inbox'
import {
  AI_PROVIDER_PRESETS,
  applyAiProviderPreset,
  buildAiProviderPresetOptions,
  buildAiModelOptionItems,
  getAiProviderPresets,
} from '@/components/ai-provider-presets'
import {
  buildSiliconFlowModelSelectPlaceholder,
  getAiFieldTooltips,
  shouldAutoLoadSiliconFlowModelCatalog,
} from '@/components/setting-panel-ai'
import {
  AI_SETTINGS_TRANSFER_FILE_NAME,
  applyImportedAiSettings,
  parseAiSettingsTransferPayload,
  stringifyAiSettingsTransferPayload,
} from '@/components/setting-panel-ai-transfer'
import {
  buildSiliconFlowModelSelectTitle,
  shouldResetSiliconFlowModelCatalog,
  syncAiProviderConfigSnapshot,
} from '@/components/setting-panel-ai-state'
import { resolveSecretFieldMeta } from '@/components/setting-panel-secret-field'
import { pickUiText } from '@/i18n/ui'
import type { AiProviderPresetKey } from '@/types/ai-provider'
import type { PluginConfig } from '@/types/config'
import { createPluginLogger } from '@/utils/plugin-logger'

export function useSettingPanelAi(config: PluginConfig) {
  const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })
  const aiService = createAiInboxService({
    forwardProxy,
    logger: createPluginLogger(() => config.enableConsoleLogging === true),
  })

  const aiTestingConnection = ref(false)
  const aiConnectionMessage = ref('')
  const aiConnectionError = ref('')
  const selectedAiProviderPreset = ref<AiProviderPresetKey>(config.aiProviderPreset ?? 'custom')
  const siliconFlowChatModelOptions = ref<Array<{ value: string, label: string, key: string }>>([])
  const siliconFlowEmbeddingModelOptions = ref<Array<{ value: string, label: string, key: string }>>([])
  const siliconFlowModelCatalogLoading = ref(false)
  const siliconFlowModelCatalogError = ref('')
  const siliconFlowModelCatalogLoaded = ref(false)
  const aiSettingsFileInput = ref<HTMLInputElement | null>(null)
  const aiTransferMessage = ref('')
  const aiTransferError = ref('')
  const isAiApiKeyVisible = ref(false)
  const aiFieldTooltips = computed(() => getAiFieldTooltips())

  const aiConfigComplete = computed(() => isAiConfigComplete(config))
  const aiProviderPresetOptions = computed(() => buildAiProviderPresetOptions())
  const aiProviderPresetMeta = computed(() => getAiProviderPresets()[selectedAiProviderPreset.value] ?? AI_PROVIDER_PRESETS[selectedAiProviderPreset.value])
  const aiApiKeyFieldMeta = computed(() => resolveSecretFieldMeta(isAiApiKeyVisible.value, 'API Key'))
  const showSiliconFlowModelSelects = computed(() => selectedAiProviderPreset.value === 'siliconflow')
  const canLoadSiliconFlowModels = computed(() => Boolean(config.aiApiKey?.trim()))
  const showSiliconFlowChatModelSelect = computed(() => showSiliconFlowModelSelects.value)
  const showSiliconFlowEmbeddingModelSelect = computed(() => showSiliconFlowModelSelects.value)
  const siliconFlowChatModelSelectOptions = computed(() => buildAiModelOptionItems(
    siliconFlowChatModelOptions.value.map(option => option.value),
    config.aiModel,
  ))
  const siliconFlowEmbeddingModelSelectOptions = computed(() => buildAiModelOptionItems(
    siliconFlowEmbeddingModelOptions.value.map(option => option.value),
    config.aiEmbeddingModel,
  ))
  const siliconFlowChatModelPlaceholder = computed(() => buildSiliconFlowModelSelectPlaceholder({
    kind: 'chat',
    apiKey: config.aiApiKey,
    loading: siliconFlowModelCatalogLoading.value,
    loaded: siliconFlowModelCatalogLoaded.value,
    error: siliconFlowModelCatalogError.value,
    optionCount: siliconFlowChatModelOptions.value.length,
  }))
  const siliconFlowEmbeddingModelPlaceholder = computed(() => buildSiliconFlowModelSelectPlaceholder({
    kind: 'embedding',
    apiKey: config.aiApiKey,
    loading: siliconFlowModelCatalogLoading.value,
    loaded: siliconFlowModelCatalogLoaded.value,
    error: siliconFlowModelCatalogError.value,
    optionCount: siliconFlowEmbeddingModelOptions.value.length,
  }))
  const siliconFlowChatModelSelectTitle = computed(() => buildSiliconFlowModelSelectTitle({
    baseTitle: aiFieldTooltips.value.siliconFlowChatModel,
    placeholder: siliconFlowChatModelPlaceholder.value,
    error: siliconFlowModelCatalogError.value,
  }))
  const siliconFlowEmbeddingModelSelectTitle = computed(() => buildSiliconFlowModelSelectTitle({
    baseTitle: aiFieldTooltips.value.siliconFlowEmbeddingModel,
    placeholder: siliconFlowEmbeddingModelPlaceholder.value,
    error: siliconFlowModelCatalogError.value,
  }))

  watch(
    [
      () => selectedAiProviderPreset.value,
      () => config.aiBaseUrl ?? '',
      () => config.aiApiKey ?? '',
      () => config.aiModel ?? '',
      () => config.aiEmbeddingModel ?? '',
      () => config.aiRequestTimeoutSeconds,
      () => config.aiMaxTokens,
      () => config.aiTemperature,
      () => config.aiMaxContextMessages,
    ],
    ([provider]) => {
      syncAiProviderConfigSnapshot(config, provider)
    },
    { immediate: true },
  )

  watch(
    [() => selectedAiProviderPreset.value, () => config.aiApiKey?.trim() ?? ''],
    ([provider, apiKey], previous = ['custom', ''] as [AiProviderPresetKey, string]) => {
      const [previousProvider, previousApiKey] = previous
      if (shouldResetSiliconFlowModelCatalog({
        provider,
        apiKey,
        previousProvider,
        previousApiKey,
      })) {
        resetSiliconFlowModelCatalog()
      }
    },
    { immediate: true },
  )

  async function handleTestConnection() {
    aiTestingConnection.value = true
    aiConnectionMessage.value = ''
    aiConnectionError.value = ''

    try {
      const result = await aiService.testConnection({
        config,
      })
      aiConnectionMessage.value = result.message
    } catch (error) {
      aiConnectionError.value = error instanceof Error ? error.message : 'AI connection test failed'
    } finally {
      aiTestingConnection.value = false
    }
  }

  function handleAiProviderPresetChange(event: Event) {
    const nextProvider = (event.target as HTMLSelectElement).value as AiProviderPresetKey
    applyAiProviderPreset(config, nextProvider)
    selectedAiProviderPreset.value = config.aiProviderPreset ?? nextProvider

    aiConnectionMessage.value = ''
    aiConnectionError.value = ''
    clearAiTransferFeedback()

    if (nextProvider !== 'siliconflow') {
      resetSiliconFlowModelCatalog()
    }
  }

  function handleImportAiSettingsClick() {
    aiSettingsFileInput.value?.click()
  }

  function toggleAiApiKeyVisibility() {
    isAiApiKeyVisible.value = !isAiApiKeyVisible.value
  }

  function handleExportAiSettings() {
    clearAiTransferFeedback()

    try {
      const content = stringifyAiSettingsTransferPayload(config)
      downloadAiSettingsFile(content)
      aiTransferMessage.value = uiText('AI settings exported', 'AI 设置已导出')
    } catch (error) {
      aiTransferError.value = error instanceof Error ? error.message : uiText('Failed to export AI settings', '导出 AI 设置失败')
    }
  }

  async function handleImportAiSettingsFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
      return
    }

    clearAiTransferFeedback()

    try {
      const content = await file.text()
      const imported = parseAiSettingsTransferPayload(content)
      applyImportedAiSettings(config, imported)
      selectedAiProviderPreset.value = config.aiProviderPreset ?? imported.aiProviderPreset
      aiConnectionMessage.value = ''
      aiConnectionError.value = ''
      aiTransferMessage.value = uiText('AI settings imported', 'AI 设置已导入')
    } catch (error) {
      aiTransferError.value = error instanceof Error ? error.message : uiText('Failed to import AI settings', '导入 AI 设置失败')
    } finally {
      input.value = ''
    }
  }

  function handleSiliconFlowModelSelectOpen() {
    void ensureSiliconFlowModelCatalogLoaded()
  }

  async function ensureSiliconFlowModelCatalogLoaded() {
    if (!showSiliconFlowModelSelects.value) {
      return
    }
    if (!shouldAutoLoadSiliconFlowModelCatalog({
      apiKey: config.aiApiKey,
      loading: siliconFlowModelCatalogLoading.value,
      loaded: siliconFlowModelCatalogLoaded.value,
      error: siliconFlowModelCatalogError.value,
    })) {
      return
    }
    await loadSiliconFlowModelCatalog()
  }

  async function loadSiliconFlowModelCatalog() {
    if (selectedAiProviderPreset.value !== 'siliconflow' || !canLoadSiliconFlowModels.value) {
      return
    }

    siliconFlowModelCatalogLoading.value = true
    siliconFlowModelCatalogError.value = ''

    try {
      const catalog = await fetchSiliconFlowModelCatalog({
        config,
        forwardProxy,
      })
      siliconFlowChatModelOptions.value = buildAiModelOptionItems(catalog.chatModels, config.aiModel)
      siliconFlowEmbeddingModelOptions.value = buildAiModelOptionItems(catalog.embeddingModels, config.aiEmbeddingModel)
      siliconFlowModelCatalogLoaded.value = true
    } catch (error) {
      siliconFlowModelCatalogError.value = error instanceof Error ? error.message : 'Failed to load model list'
    } finally {
      siliconFlowModelCatalogLoading.value = false
    }
  }

  function resetSiliconFlowModelCatalog() {
    siliconFlowChatModelOptions.value = []
    siliconFlowEmbeddingModelOptions.value = []
    siliconFlowModelCatalogLoading.value = false
    siliconFlowModelCatalogError.value = ''
    siliconFlowModelCatalogLoaded.value = false
  }

  function clearAiTransferFeedback() {
    aiTransferMessage.value = ''
    aiTransferError.value = ''
  }

  function downloadAiSettingsFile(content: string) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      throw new Error('File export is not supported in the current environment')
    }

    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = AI_SETTINGS_TRANSFER_FILE_NAME
    document.body?.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  return {
    AI_FIELD_TOOLTIPS: aiFieldTooltips,
    aiTestingConnection,
    aiConnectionMessage,
    aiConnectionError,
    selectedAiProviderPreset,
    siliconFlowModelCatalogLoading,
    siliconFlowModelCatalogError,
    siliconFlowModelCatalogLoaded,
    aiSettingsFileInput,
    aiTransferMessage,
    aiTransferError,
    isAiApiKeyVisible,
    aiConfigComplete,
    aiProviderPresetOptions,
    aiProviderPresetMeta,
    aiApiKeyFieldMeta,
    showSiliconFlowModelSelects,
    canLoadSiliconFlowModels,
    showSiliconFlowChatModelSelect,
    showSiliconFlowEmbeddingModelSelect,
    siliconFlowChatModelSelectOptions,
    siliconFlowEmbeddingModelSelectOptions,
    siliconFlowChatModelPlaceholder,
    siliconFlowEmbeddingModelPlaceholder,
    siliconFlowChatModelSelectTitle,
    siliconFlowEmbeddingModelSelectTitle,
    handleTestConnection,
    handleAiProviderPresetChange,
    handleImportAiSettingsClick,
    toggleAiApiKeyVisibility,
    handleExportAiSettings,
    handleImportAiSettingsFileChange,
    handleSiliconFlowModelSelectOpen,
  }
}
