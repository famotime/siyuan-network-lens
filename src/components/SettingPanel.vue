<template>
  <div class="setting-panel">
    <div class="setting-group">
      <div class="setting-header">
        <h3>{{ t('settings.analysisScope.title') }}</h3>
        <p>{{ t('settings.analysisScope.description') }}</p>
      </div>
      <div class="setting-form">
        <label class="setting-field setting-field--full">
          <span>{{ t('settings.analysisScope.excludedPaths') }}</span>
          <input
            v-model.trim="config.analysisExcludedPaths"
            :placeholder="t('settings.analysisScope.excludedPathsPlaceholder')"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>{{ t('settings.analysisScope.namePrefixes') }}</span>
          <input
            v-model.trim="config.analysisExcludedNamePrefixes"
            :placeholder="t('settings.analysisScope.namePrefixesPlaceholder')"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>{{ t('settings.analysisScope.nameSuffixes') }}</span>
          <input
            v-model.trim="config.analysisExcludedNameSuffixes"
            :placeholder="t('settings.analysisScope.nameSuffixesPlaceholder')"
            type="text"
          >
        </label>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>{{ t('settings.topicDocs.title') }}</h3>
        <p>{{ t('settings.topicDocs.description') }}</p>
      </div>
      <div class="setting-form">
        <label class="setting-field setting-field--full">
          <span>{{ t('settings.topicDocs.pathLabel') }}</span>
          <input
            v-model.trim="config.themeDocumentPath"
            :placeholder="t('settings.topicDocs.pathPlaceholder')"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>{{ t('settings.topicDocs.namePrefixes') }}</span>
          <input
            v-model.trim="config.themeNamePrefix"
            :placeholder="t('settings.topicDocs.namePrefixesPlaceholder')"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>{{ t('settings.topicDocs.nameSuffixes') }}</span>
          <input
            v-model.trim="config.themeNameSuffix"
            :placeholder="t('settings.topicDocs.nameSuffixesPlaceholder')"
            type="text"
          >
        </label>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>{{ t('settings.readRules.title') }}</h3>
        <p>{{ t('settings.readRules.description') }}</p>
      </div>
      <div class="setting-form">
        <label class="setting-field setting-field--full">
          <span>{{ t('settings.readRules.readPaths') }}</span>
          <input
            v-model.trim="config.readPaths"
            :placeholder="t('settings.readRules.readPathsPlaceholder')"
            type="text"
          >
        </label>
        <label class="setting-field setting-field--full">
          <span>{{ t('settings.readRules.readTags') }}</span>
          <div class="setting-select-shell">
            <ThemeMultiSelect
              v-model="config.readTagNames"
              :options="readTagOptions"
              :all-label="t('settings.readRules.noneSelected')"
              :empty-label="t('settings.readRules.noTagsAvailable')"
              :selection-unit="t('settings.readRules.tagUnit')"
            />
          </div>
        </label>
        <label class="setting-field">
          <span>{{ t('settings.readRules.titlePrefixes') }}</span>
          <input
            v-model.trim="config.readTitlePrefixes"
            :placeholder="t('settings.readRules.titlePrefixesPlaceholder')"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>{{ t('settings.readRules.titleSuffixes') }}</span>
          <input
            v-model.trim="config.readTitleSuffixes"
            :placeholder="t('settings.readRules.titleSuffixesPlaceholder')"
            type="text"
          >
        </label>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>{{ t('settings.summaryCards.title') }}</h3>
        <p>{{ t('settings.summaryCards.description') }}</p>
      </div>
      <label class="setting-item">
        <span class="setting-item__text">
          <strong>{{ t('settings.summaryCards.topSummaryCards') }}</strong>
          <span>{{ t('settings.summaryCards.topSummaryCardsDescription') }}</span>
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
            <strong>{{ t('settings.ai.enableTodaySuggestions') }}</strong>
            <span>{{ t('settings.ai.enableTodaySuggestionsDescription') }}</span>
          </span>
          <input type="checkbox" v-model="config.aiEnabled" class="b3-switch">
        </label>
        <label v-if="showWikiSettings" class="setting-item setting-item--full">
          <span class="setting-item__text">
            <strong>{{ t('settings.ai.enableWiki') }}</strong>
            <span>{{ t('settings.ai.enableWikiDescription') }}</span>
          </span>
          <input type="checkbox" v-model="config.wikiEnabled" class="b3-switch">
        </label>
        <label v-if="showWikiSettings" class="setting-field">
          <span>{{ t('settings.ai.pageSuffix') }}</span>
          <input
            v-model.trim="config.wikiPageSuffix"
            placeholder="-llm-wiki"
            type="text"
          >
        </label>
        <label v-if="showWikiSettings" class="setting-field">
          <span>{{ t('settings.ai.indexPageTitle') }}</span>
          <input
            v-model.trim="config.wikiIndexTitle"
            placeholder="LLM-Wiki-Index"
            type="text"
          >
        </label>
        <label v-if="showWikiSettings" class="setting-field">
          <span>{{ t('settings.ai.logPageTitle') }}</span>
          <input
            v-model.trim="config.wikiLogTitle"
            placeholder="LLM-Wiki-Maintenance-Log"
            type="text"
          >
        </label>
        <div v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span>{{ t('settings.ai.provider') }}</span>
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
                {{ t('settings.ai.importSettings') }}
              </button>
              <button
                class="setting-button setting-button--ghost setting-button--compact"
                type="button"
                @click="handleExportAiSettings"
              >
                {{ t('settings.ai.exportSettings') }}
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
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.baseUrl">{{ t('settings.ai.baseUrl') }}</span>
          <input
            v-model.trim="config.aiBaseUrl"
            :placeholder="aiProviderPresetMeta.baseUrl ?? 'https://api.openai.com/v1'"
            :title="AI_FIELD_TOOLTIPS.baseUrl"
            type="text"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span>{{ t('settings.ai.apiKey') }}</span>
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
          <span>{{ t('settings.ai.model') }}</span>
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
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.embeddingModel">{{ t('settings.ai.embeddingModelOptional') }}</span>
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
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.timeout">{{ t('settings.ai.timeout') }}</span>
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
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.maxTokens">{{ t('settings.ai.maxTokens') }}</span>
          <input
            v-model.number="config.aiMaxTokens"
            min="1"
            step="1"
            :title="AI_FIELD_TOOLTIPS.maxTokens"
            type="number"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field">
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.temperature">{{ t('settings.ai.temperature') }}</span>
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
          <span class="setting-field__label setting-field__label--hint" :title="AI_FIELD_TOOLTIPS.maxContextMessages">{{ t('settings.ai.maxContextMessages') }}</span>
          <input
            v-model.number="config.aiMaxContextMessages"
            min="1"
            step="1"
            :title="AI_FIELD_TOOLTIPS.maxContextMessages"
            type="number"
          >
        </label>
        <label v-if="showAiServiceSettings" class="setting-field setting-field--full">
          <span>{{ t('settings.ai.contextCapacity') }}</span>
          <select v-model="config.aiContextCapacity">
            <option value="compact">{{ t('settings.ai.contextCapacityCompact') }}</option>
            <option value="balanced">{{ t('settings.ai.contextCapacityBalanced') }}</option>
            <option value="full">{{ t('settings.ai.contextCapacityFull') }}</option>
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
          {{ aiTestingConnection ? t('settings.ai.testing') : t('settings.ai.testConnection') }}
        </button>
        <span class="setting-feedback">
          {{ t('settings.ai.timeoutHint') }}
        </span>
        <span v-if="aiConnectionMessage" class="setting-feedback setting-feedback--success">{{ aiConnectionMessage }}</span>
        <span v-if="aiConnectionError" class="setting-feedback setting-feedback--error">{{ aiConnectionError }}</span>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>{{ t('settings.debug.title') }}</h3>
        <p>{{ t('settings.debug.description') }}</p>
      </div>
      <label class="setting-item">
        <span class="setting-item__text">
          <strong>{{ t('settings.debug.printLogs') }}</strong>
          <span>{{ t('settings.debug.printLogsDescription') }}</span>
        </span>
        <input type="checkbox" v-model="config.enableConsoleLogging" class="b3-switch">
      </label>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>{{ t('settings.propagation.title') }}</h3>
        <p>{{ t('settings.propagation.description') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { lsNotebooks, sql } from '@/api'
import { SUMMARY_CARD_DEFINITIONS } from '@/analytics/summary-card-config'
import { loadSettingPanelData, migrateLegacyThemeDocumentPath, type NotebookOption } from '@/components/setting-panel-data'
import { useSettingPanelAi } from '@/components/use-setting-panel-ai'
import { t } from '@/i18n/ui'
import ThemeMultiSelect from '@/components/ThemeMultiSelect.vue'
import { isAlphaSettingVisible, isAlphaSummaryCardVisible } from '@/plugin/alpha-feature-config'
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
const showAiServiceSettings = isAlphaSettingVisible('ai-service')
const showWikiSettings = isAlphaSettingVisible('llm-wiki')
const showAiSettingsGroup = showAiServiceSettings || showWikiSettings
const aiSettingsTitle = showAiServiceSettings ? t('settings.ai.title') : 'LLM Wiki'
const aiSettingsDescription = showAiServiceSettings
  ? t('settings.ai.description')
  : t('settings.ai.wikiDescription')

const {
  AI_FIELD_TOOLTIPS,
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
} = useSettingPanelAi(props.config)

onMounted(async () => {
  const data = await loadSettingPanelData({
    lsNotebooks,
    sql: statement => sql(statement) as Promise<Array<{ tag: string | null }>>,
  })

  notebooks.value = data.notebooks
  migrateLegacyThemeDocumentPath(props.config, data.notebooks)
  readTagOptions.value = data.readTagOptions
})
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
