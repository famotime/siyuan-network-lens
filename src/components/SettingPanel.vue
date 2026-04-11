<template>
  <div class="setting-panel">
    <div class="setting-group">
      <div class="setting-header">
        <h3>主题文档</h3>
        <p>指定主题页所在目录，生成主题筛选选项并为孤立文档提供链接建议。</p>
      </div>
      <div class="setting-form">
        <label class="setting-field">
          <span>主题笔记本</span>
          <select v-model="config.themeNotebookId">
            <option value="">请选择笔记本</option>
            <option
              v-for="notebook in notebooks"
              :key="notebook.id"
              :value="notebook.id"
            >
              {{ notebook.name }}
            </option>
          </select>
        </label>
        <label class="setting-field">
          <span>主题文档路径</span>
          <input
            v-model.trim="config.themeDocumentPath"
            placeholder="/专题"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>名称前缀</span>
          <input
            v-model.trim="config.themeNamePrefix"
            placeholder="可选，例如 主题-"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>名称后缀</span>
          <input
            v-model.trim="config.themeNameSuffix"
            placeholder="可选，例如 -索引"
            type="text"
          >
        </label>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>已读标记</h3>
        <p>定义已读文档判定规则，命中任一目录、标签、标题前缀或标题后缀即计为已读。</p>
      </div>
      <div class="setting-form">
        <label class="setting-field setting-field--full">
          <span>已读目录</span>
          <input
            v-model.trim="config.readPaths"
            placeholder="多个目录用 | 分隔，支持包含笔记本的全路径，例如 /知识库/已读|/归档/专题"
            type="text"
          >
        </label>
        <label class="setting-field setting-field--full">
          <span>已读标签</span>
          <div class="setting-select-shell">
            <ThemeMultiSelect
              v-model="config.readTagNames"
              :options="readTagOptions"
              all-label="全部未选"
              empty-label="暂无可选标签"
              selection-unit="个标签"
            />
          </div>
        </label>
        <label class="setting-field">
          <span>标题前缀</span>
          <input
            v-model.trim="config.readTitlePrefixes"
            placeholder="多个前缀用 | 分隔，例如 已读-|三星-"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>标题后缀</span>
          <input
            v-model.trim="config.readTitleSuffixes"
            placeholder="多个后缀用 | 分隔，例如 -已读|-五星"
            type="text"
          >
        </label>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>统计卡片</h3>
        <p>控制顶部卡片以及点击后的详情展示。</p>
      </div>
      <label class="setting-item">
        <span class="setting-item__text">
          <strong>顶部统计卡片</strong>
          <span>显示所有指标卡片并支持点击联动详情</span>
        </span>
        <input type="checkbox" v-model="config.showSummaryCards" class="b3-switch">
      </label>
      <div class="setting-item-wrapper setting-item-grid" v-if="config.showSummaryCards">
        <label
          v-for="cardSetting in summaryCardSettings"
          :key="cardSetting.key"
          class="setting-item setting-item--nested setting-item--grid"
        >
          <span class="setting-item__text">
            <strong>{{ cardSetting.settingLabel }}</strong>
            <span>{{ cardSetting.settingDescription }}</span>
          </span>
          <input
            v-model="config[cardSetting.visibilityConfigKey]"
            type="checkbox"
            class="b3-switch"
          >
        </label>
      </div>
    </div>

    <div v-if="showAiSettingsGroup" class="setting-group">
      <div class="setting-header">
        <h3>{{ aiSettingsTitle }}</h3>
        <p>{{ aiSettingsDescription }}</p>
      </div>
      <div class="setting-form">
        <label v-if="showAiServiceSettings" class="setting-item setting-item--full">
          <span class="setting-item__text">
            <strong>启用 AI 今日建议</strong>
            <span>开启后可在统计卡片中生成统一优先级的整理建议</span>
          </span>
          <input type="checkbox" v-model="config.aiEnabled" class="b3-switch">
        </label>
        <label v-if="showWikiSettings" class="setting-item setting-item--full">
          <span class="setting-item__text">
            <strong>启用 LLM Wiki</strong>
            <span>开启后可基于当前筛选结果生成主题 wiki 预览并安全写回。</span>
          </span>
          <input type="checkbox" v-model="config.wikiEnabled" class="b3-switch">
        </label>
        <label v-if="showWikiSettings" class="setting-field">
          <span>页面后缀</span>
          <input
            v-model.trim="config.wikiPageSuffix"
            placeholder="-llm-wiki"
            type="text"
          >
        </label>
        <label v-if="showWikiSettings" class="setting-field">
          <span>索引页标题</span>
          <input
            v-model.trim="config.wikiIndexTitle"
            placeholder="LLM-Wiki-索引"
            type="text"
          >
        </label>
        <label v-if="showWikiSettings" class="setting-field">
          <span>日志页标题</span>
          <input
            v-model.trim="config.wikiLogTitle"
            placeholder="LLM-Wiki-维护日志"
            type="text"
          >
        </label>
        <div v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span>AI 服务商</span>
          <div class="setting-field__inline">
            <select :value="selectedAiProviderPreset" @change="handleAiProviderPresetChange">
              <option
                v-for="providerOption in aiProviderPresetOptions"
                :key="providerOption.value"
                :value="providerOption.value"
              >
                {{ providerOption.label }}
              </option>
            </select>
            <div class="setting-field__actions">
              <button
                class="setting-button setting-button--ghost setting-button--compact"
                type="button"
                @click="handleImportAiSettingsClick"
              >
                导入设置
              </button>
              <button
                class="setting-button setting-button--ghost setting-button--compact"
                type="button"
                @click="handleExportAiSettings"
              >
                导出设置
              </button>
              <input
                ref="aiSettingsFileInput"
                class="setting-file-input"
                type="file"
                accept="application/json,.json"
                @change="handleImportAiSettingsFileChange"
              >
            </div>
          </div>
          <span v-if="aiTransferMessage" class="setting-feedback setting-feedback--success">{{ aiTransferMessage }}</span>
          <span v-if="aiTransferError" class="setting-feedback setting-feedback--error">{{ aiTransferError }}</span>
        </div>
        <label v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.baseUrl">Base URL</span>
          <input
            v-model.trim="config.aiBaseUrl"
            :placeholder="aiProviderPresetMeta.baseUrl ?? 'https://api.openai.com/v1'"
            :title="AI_FIELD_TOOLTIPS.baseUrl"
            type="text"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span>API Key</span>
          <div class="setting-input-with-action setting-input-with-action--overlay">
            <input
              v-model.trim="config.aiApiKey"
              placeholder="sk-..."
              :type="aiApiKeyFieldMeta.inputType"
            >
            <button
              class="setting-icon-button setting-icon-button--inline"
              type="button"
              :aria-label="aiApiKeyFieldMeta.actionLabel"
              :title="aiApiKeyFieldMeta.actionLabel"
              @click="toggleAiApiKeyVisibility"
            >
              <svg
                v-if="aiApiKeyFieldMeta.icon === 'eye'"
                class="setting-icon-button__svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3.25"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                />
              </svg>
              <svg
                v-else
                class="setting-icon-button__svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M3 3l18 18"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="1.8"
                />
                <path
                  d="M10.7 5.52A10.56 10.56 0 0 1 12 5.25c6 0 9.75 6.75 9.75 6.75a18.78 18.78 0 0 1-4.02 4.85M6.68 6.69C4.04 8.42 2.25 12 2.25 12s3.75 6.75 9.75 6.75c1.85 0 3.47-.64 4.85-1.55M9.88 9.88A3 3 0 0 0 9 12a3 3 0 0 0 3 3c.8 0 1.53-.31 2.07-.82"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
            </button>
          </div>
        </label>
        <label v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span>Model</span>
          <select
            v-if="showSiliconFlowChatModelSelect"
            v-model="config.aiModel"
            :title="siliconFlowChatModelSelectTitle"
            @focus="handleSiliconFlowModelSelectOpen"
            @mousedown="handleSiliconFlowModelSelectOpen"
          >
            <option value="">{{ siliconFlowChatModelPlaceholder }}</option>
            <option
              v-for="option in siliconFlowChatModelSelectOptions"
              :key="option.key"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <input
            v-else
            v-model.trim="config.aiModel"
            :placeholder="aiProviderPresetMeta.modelPlaceholder"
            type="text"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.embeddingModel">Embedding Model（可选）</span>
          <select
            v-if="showSiliconFlowEmbeddingModelSelect"
            v-model="config.aiEmbeddingModel"
            :title="siliconFlowEmbeddingModelSelectTitle"
            @focus="handleSiliconFlowModelSelectOpen"
            @mousedown="handleSiliconFlowModelSelectOpen"
          >
            <option value="">{{ siliconFlowEmbeddingModelPlaceholder }}</option>
            <option
              v-for="option in siliconFlowEmbeddingModelSelectOptions"
              :key="option.key"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <input
            v-else
            v-model.trim="config.aiEmbeddingModel"
            :placeholder="aiProviderPresetMeta.embeddingPlaceholder"
            :title="AI_FIELD_TOOLTIPS.embeddingModel"
            type="text"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field">
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.timeout">超时时间</span>
          <div class="setting-input-with-suffix">
            <input
              v-model.number="config.aiRequestTimeoutSeconds"
              min="1"
              step="1"
              :title="AI_FIELD_TOOLTIPS.timeout"
              type="number"
            >
            <span class="setting-input-with-suffix__unit">s</span>
          </div>
        </label>
        <label v-if="showAiServiceSettings" class="setting-field">
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.maxTokens">最大 Token 数</span>
          <input
            v-model.number="config.aiMaxTokens"
            min="1"
            step="1"
            :title="AI_FIELD_TOOLTIPS.maxTokens"
            type="number"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field">
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.temperature">温度</span>
          <input
            v-model.number="config.aiTemperature"
            max="2"
            min="0"
            step="0.1"
            :title="AI_FIELD_TOOLTIPS.temperature"
            type="number"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field">
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.maxContextMessages">最大上下文数</span>
          <input
            v-model.number="config.aiMaxContextMessages"
            min="1"
            step="1"
            :title="AI_FIELD_TOOLTIPS.maxContextMessages"
            type="number"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span>上下文容量</span>
          <select v-model="config.aiContextCapacity">
            <option value="compact">紧凑</option>
            <option value="balanced">标准</option>
            <option value="full">扩展</option>
          </select>
        </label>
      </div>
      <div v-if="showAiServiceSettings" class="setting-actions">
        <button
          class="setting-button"
          type="button"
          :disabled="aiTestingConnection || !config.aiEnabled || !aiConfigComplete"
          @click="handleTestConnection"
        >
          {{ aiTestingConnection ? '测试中...' : '测试连接' }}
        </button>
        <span class="setting-feedback">
          如果出现超时或 `context deadline exceeded`，优先切换到“紧凑”。
        </span>
        <span v-if="aiConnectionMessage" class="setting-feedback setting-feedback--success">{{ aiConnectionMessage }}</span>
        <span v-if="aiConnectionError" class="setting-feedback setting-feedback--error">{{ aiConnectionError }}</span>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>传播与链路</h3>
        <p>传播节点详情中将包含关系传播路径视图。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { forwardProxy, lsNotebooks, sql } from '@/api'
import { createAiInboxService, fetchSiliconFlowModelCatalog, isAiConfigComplete } from '@/analytics/ai-inbox'
import { SUMMARY_CARD_DEFINITIONS } from '@/analytics/summary-card-config'
import {
  AI_PROVIDER_PRESETS,
  AI_PROVIDER_PRESET_OPTIONS,
  applyAiProviderPreset,
  buildAiModelOptionItems,
} from '@/components/ai-provider-presets'
import {
  AI_FIELD_TOOLTIPS,
  buildSiliconFlowModelSelectPlaceholder,
  shouldAutoLoadSiliconFlowModelCatalog,
} from '@/components/setting-panel-ai'
import {
  AI_SETTINGS_TRANSFER_FILE_NAME,
  applyImportedAiSettings,
  parseAiSettingsTransferPayload,
  stringifyAiSettingsTransferPayload,
} from '@/components/setting-panel-ai-transfer'
import { resolveSecretFieldMeta } from '@/components/setting-panel-secret-field'
import { loadSettingPanelData, type NotebookOption } from '@/components/setting-panel-data'
import ThemeMultiSelect from '@/components/ThemeMultiSelect.vue'
import { isAlphaSettingVisible, isAlphaSummaryCardVisible } from '@/plugin/alpha-feature-config'
import type { AiProviderPresetKey } from '@/types/ai-provider'
import { ensureConfigDefaults, type PluginConfig } from '@/types/config'

const props = defineProps<{
  config: PluginConfig
}>()

ensureConfigDefaults(props.config)

const notebooks = ref<NotebookOption[]>([])
const readTagOptions = ref<Array<{ value: string, label: string, key: string }>>([])
const summaryCardSettings = SUMMARY_CARD_DEFINITIONS
  .filter(item => item.showInSettings !== false)
  .filter(item => isAlphaSummaryCardVisible(item.key))
const aiTestingConnection = ref(false)
const aiConnectionMessage = ref('')
const aiConnectionError = ref('')
const selectedAiProviderPreset = ref<AiProviderPresetKey>(props.config.aiProviderPreset ?? 'custom')
const siliconFlowChatModelOptions = ref<Array<{ value: string, label: string, key: string }>>([])
const siliconFlowEmbeddingModelOptions = ref<Array<{ value: string, label: string, key: string }>>([])
const siliconFlowModelCatalogLoading = ref(false)
const siliconFlowModelCatalogError = ref('')
const siliconFlowModelCatalogLoaded = ref(false)
const aiSettingsFileInput = ref<HTMLInputElement | null>(null)
const aiTransferMessage = ref('')
const aiTransferError = ref('')
const isAiApiKeyVisible = ref(false)
const showAiServiceSettings = isAlphaSettingVisible('ai-service')
const showWikiSettings = isAlphaSettingVisible('llm-wiki')
const showAiSettingsGroup = showAiServiceSettings || showWikiSettings
const aiSettingsTitle = showAiServiceSettings ? 'AI 接入' : 'LLM Wiki'
const aiSettingsDescription = showAiServiceSettings
  ? '配置兼容 OpenAI API 的服务，用于生成“今日建议”和孤立文档的 AI 补链建议。'
  : '配置 LLM Wiki 的开关和页面命名规则。'

const aiService = createAiInboxService({ forwardProxy })
const aiConfigComplete = computed(() => isAiConfigComplete(props.config))
const aiProviderPresetOptions = AI_PROVIDER_PRESET_OPTIONS
const aiProviderPresetMeta = computed(() => AI_PROVIDER_PRESETS[selectedAiProviderPreset.value])
const aiApiKeyFieldMeta = computed(() => resolveSecretFieldMeta(isAiApiKeyVisible.value, 'API Key'))
const showSiliconFlowModelSelects = computed(() => selectedAiProviderPreset.value === 'siliconflow')
const canLoadSiliconFlowModels = computed(() => Boolean(props.config.aiApiKey?.trim()))
const showSiliconFlowChatModelSelect = computed(() => showSiliconFlowModelSelects.value)
const showSiliconFlowEmbeddingModelSelect = computed(() => showSiliconFlowModelSelects.value)
const siliconFlowChatModelSelectOptions = computed(() => buildAiModelOptionItems(
  siliconFlowChatModelOptions.value.map(option => option.value),
  props.config.aiModel,
))
const siliconFlowEmbeddingModelSelectOptions = computed(() => buildAiModelOptionItems(
  siliconFlowEmbeddingModelOptions.value.map(option => option.value),
  props.config.aiEmbeddingModel,
))
const siliconFlowChatModelPlaceholder = computed(() => buildSiliconFlowModelSelectPlaceholder({
  kind: 'chat',
  apiKey: props.config.aiApiKey,
  loading: siliconFlowModelCatalogLoading.value,
  loaded: siliconFlowModelCatalogLoaded.value,
  error: siliconFlowModelCatalogError.value,
  optionCount: siliconFlowChatModelOptions.value.length,
}))
const siliconFlowEmbeddingModelPlaceholder = computed(() => buildSiliconFlowModelSelectPlaceholder({
  kind: 'embedding',
  apiKey: props.config.aiApiKey,
  loading: siliconFlowModelCatalogLoading.value,
  loaded: siliconFlowModelCatalogLoaded.value,
  error: siliconFlowModelCatalogError.value,
  optionCount: siliconFlowEmbeddingModelOptions.value.length,
}))
const siliconFlowChatModelSelectTitle = computed(() => buildSiliconFlowModelSelectTitle({
  baseTitle: AI_FIELD_TOOLTIPS.siliconFlowChatModel,
  placeholder: siliconFlowChatModelPlaceholder.value,
  error: siliconFlowModelCatalogError.value,
}))
const siliconFlowEmbeddingModelSelectTitle = computed(() => buildSiliconFlowModelSelectTitle({
  baseTitle: AI_FIELD_TOOLTIPS.siliconFlowEmbeddingModel,
  placeholder: siliconFlowEmbeddingModelPlaceholder.value,
  error: siliconFlowModelCatalogError.value,
}))

onMounted(async () => {
  const data = await loadSettingPanelData({
    lsNotebooks,
    sql: statement => sql(statement) as Promise<Array<{ tag: string | null }>>,
  })

  notebooks.value = data.notebooks
  readTagOptions.value = data.readTagOptions
})

watch(
  [
    () => selectedAiProviderPreset.value,
    () => props.config.aiBaseUrl ?? '',
    () => props.config.aiApiKey ?? '',
    () => props.config.aiModel ?? '',
    () => props.config.aiEmbeddingModel ?? '',
    () => props.config.aiRequestTimeoutSeconds,
    () => props.config.aiMaxTokens,
    () => props.config.aiTemperature,
    () => props.config.aiMaxContextMessages,
  ],
  ([provider, aiBaseUrl, aiApiKey, aiModel, aiEmbeddingModel, aiRequestTimeoutSeconds, aiMaxTokens, aiTemperature, aiMaxContextMessages]) => {
    props.config.aiProviderPreset = provider
    if (!props.config.aiProviderConfigs || typeof props.config.aiProviderConfigs !== 'object') {
      props.config.aiProviderConfigs = {}
    }
    props.config.aiProviderConfigs[provider] = {
      aiBaseUrl,
      aiApiKey,
      aiModel,
      aiEmbeddingModel,
      aiRequestTimeoutSeconds,
      aiMaxTokens,
      aiTemperature,
      aiMaxContextMessages,
    }
  },
  { immediate: true },
)

watch(
  [() => selectedAiProviderPreset.value, () => props.config.aiApiKey?.trim() ?? ''],
  ([provider, apiKey], previous = ['custom', ''] as [AiProviderPresetKey, string]) => {
    const [previousProvider, previousApiKey] = previous

    if (provider !== 'siliconflow') {
      resetSiliconFlowModelCatalog()
      return
    }

    if (!apiKey) {
      resetSiliconFlowModelCatalog()
      return
    }

    const providerChanged = provider !== previousProvider
    const apiKeyChanged = apiKey !== previousApiKey
    if (providerChanged || apiKeyChanged) {
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
      config: props.config,
    })
    aiConnectionMessage.value = result.message
  } catch (error) {
    aiConnectionError.value = error instanceof Error ? error.message : 'AI 连接测试失败'
  } finally {
    aiTestingConnection.value = false
  }
}

function handleAiProviderPresetChange(event: Event) {
  const nextProvider = (event.target as HTMLSelectElement).value as AiProviderPresetKey
  applyAiProviderPreset(props.config, nextProvider)
  selectedAiProviderPreset.value = props.config.aiProviderPreset ?? nextProvider

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
    const content = stringifyAiSettingsTransferPayload(props.config)
    downloadAiSettingsFile(content)
    aiTransferMessage.value = '已导出 AI 服务设置'
  } catch (error) {
    aiTransferError.value = error instanceof Error ? error.message : '导出 AI 服务设置失败'
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
    applyImportedAiSettings(props.config, imported)
    selectedAiProviderPreset.value = props.config.aiProviderPreset ?? imported.aiProviderPreset
    aiConnectionMessage.value = ''
    aiConnectionError.value = ''
    aiTransferMessage.value = '已导入 AI 服务设置'
  } catch (error) {
    aiTransferError.value = error instanceof Error ? error.message : '导入 AI 服务设置失败'
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
    apiKey: props.config.aiApiKey,
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
      config: props.config,
      forwardProxy,
    })
    siliconFlowChatModelOptions.value = buildAiModelOptionItems(catalog.chatModels, props.config.aiModel)
    siliconFlowEmbeddingModelOptions.value = buildAiModelOptionItems(catalog.embeddingModels, props.config.aiEmbeddingModel)
    siliconFlowModelCatalogLoaded.value = true
  } catch (error) {
    siliconFlowModelCatalogError.value = error instanceof Error ? error.message : '加载模型列表失败'
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

function buildSiliconFlowModelSelectTitle(params: {
  baseTitle: string
  placeholder: string
  error: string
}) {
  return [
    params.baseTitle,
    params.placeholder,
    params.error ? `最近一次加载失败：${params.error}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function downloadAiSettingsFile(content: string) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('当前环境不支持导出文件')
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
</script>

<style scoped>
.setting-panel {
  --panel-border: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  --surface-card-strong: color-mix(in srgb, var(--b3-theme-surface) 96%, var(--b3-theme-background));
  --surface-card-soft: color-mix(in srgb, var(--b3-theme-surface) 90%, var(--b3-theme-background));
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-background);
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  border-radius: 0 0 var(--b3-border-radius-b) var(--b3-border-radius-b);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.setting-header {
  border-bottom: 1px solid color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
  padding-bottom: 8px;
  margin-bottom: 4px;
}

.setting-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.setting-header p {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 65%, transparent);
}

.setting-item-wrapper {
  background: color-mix(in srgb, var(--b3-theme-surface) 60%, transparent);
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 8%, transparent);
  overflow: hidden;
}

.setting-item-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 8px;
}

.setting-item:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 5%, transparent);
}

.setting-item-wrapper .setting-item {
  border-radius: 0;
}

.setting-item-wrapper .setting-item + .setting-item {
  border-top: 1px solid color-mix(in srgb, var(--b3-theme-primary) 5%, transparent);
}

.setting-item--nested {
  padding-left: 44px;
  background: color-mix(in srgb, var(--b3-theme-primary) 2%, transparent);
}

.setting-item--grid {
  min-width: 0;
  min-height: 100%;
  padding-left: 20px;
  border-top: 1px solid color-mix(in srgb, var(--b3-theme-primary) 5%, transparent);
}

.setting-item-grid .setting-item--grid {
  border-top: 1px solid color-mix(in srgb, var(--b3-theme-primary) 5%, transparent);
}

.setting-item-grid .setting-item--grid:nth-child(-n + 2) {
  border-top: 0;
}

.setting-item-grid .setting-item--grid:nth-child(2n) {
  border-left: 1px solid color-mix(in srgb, var(--b3-theme-primary) 5%, transparent);
}

.setting-item__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item__text strong {
  font-weight: 500;
  font-size: 14px;
}

.setting-item__text span {
  font-size: 12px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 60%, transparent);
}

.setting-field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 72%, transparent);
}

.setting-field__inline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.setting-field__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.setting-field--full {
  grid-column: 1 / -1;
}

.setting-field span {
  font-weight: 500;
}

.setting-field__label--hint {
  cursor: help;
  text-decoration: underline dotted color-mix(in srgb, var(--b3-theme-primary) 22%, transparent);
  text-underline-offset: 3px;
}

.setting-select-shell,
.setting-field input,
.setting-field select {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--b3-theme-surface) 60%, transparent);
  color: var(--b3-theme-on-background);
  padding: 10px 12px;
  box-sizing: border-box;
}

.setting-input-with-suffix {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.setting-input-with-action {
  position: relative;
}

.setting-input-with-action--overlay input {
  padding-right: 48px;
}

.setting-input-with-suffix__unit {
  color: color-mix(in srgb, var(--b3-theme-on-background) 58%, transparent);
  font-weight: 500;
}

.setting-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.setting-button {
  border: 0;
  border-radius: 8px;
  padding: 10px 14px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  cursor: pointer;
  font: inherit;
  transition: opacity 0.2s;
}

.setting-button--ghost {
  background: color-mix(in srgb, var(--b3-theme-surface) 84%, var(--b3-theme-primary) 6%);
  color: var(--b3-theme-on-surface);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
}

.setting-button--compact {
  padding: 10px 12px;
  white-space: nowrap;
}

.setting-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--b3-theme-surface) 84%, var(--b3-theme-primary) 6%);
  color: color-mix(in srgb, var(--b3-theme-on-background) 70%, transparent);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.setting-icon-button:hover {
  background: color-mix(in srgb, var(--b3-theme-surface) 76%, var(--b3-theme-primary) 10%);
  color: var(--b3-theme-on-background);
}

.setting-icon-button--inline {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 32px;
  height: 32px;
  padding: 0;
  transform: translateY(-50%);
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.setting-icon-button--inline:hover {
  background: color-mix(in srgb, var(--b3-theme-surface) 76%, var(--b3-theme-primary) 10%);
  border-color: color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
}

.setting-icon-button__svg {
  width: 18px;
  height: 18px;
  display: block;
}

.setting-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.setting-file-input {
  display: none;
}

.setting-feedback {
  font-size: 13px;
  font-weight: 400;
}

.setting-feedback--success {
  color: color-mix(in srgb, var(--b3-theme-primary) 72%, var(--b3-theme-on-background));
}

.setting-feedback--error {
  color: var(--b3-theme-error);
}

.setting-select-shell {
  padding: 10px 12px;
}

@media (max-width: 720px) {
  .setting-form {
    grid-template-columns: 1fr;
  }

  .setting-item-grid {
    grid-template-columns: 1fr;
  }

  .setting-item-grid .setting-item--grid:nth-child(-n + 2) {
    border-top: 1px solid color-mix(in srgb, var(--b3-theme-primary) 5%, transparent);
  }

  .setting-item-grid .setting-item--grid:first-child {
    border-top: 0;
  }

  .setting-item-grid .setting-item--grid:nth-child(2n) {
    border-left: 0;
  }

  .setting-field__inline {
    grid-template-columns: 1fr;
  }

  .setting-field__actions {
    flex-wrap: wrap;
  }
}
</style>
