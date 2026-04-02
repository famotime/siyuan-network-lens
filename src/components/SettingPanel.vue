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
      <div class="setting-item-wrapper" v-if="config.showSummaryCards">
        <label
          v-for="cardSetting in summaryCardSettings"
          :key="cardSetting.key"
          class="setting-item setting-item--nested"
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

    <div class="setting-group">
      <div class="setting-header">
        <h3>AI 接入</h3>
        <p>配置兼容 OpenAI API 的服务，用于生成“AI 整理收件箱”的今日优先待办。</p>
      </div>
      <div class="setting-form">
        <label class="setting-item setting-item--full">
          <span class="setting-item__text">
            <strong>启用 AI 整理收件箱</strong>
            <span>开启后可在统计卡片下方生成统一优先级的整理建议</span>
          </span>
          <input type="checkbox" v-model="config.aiEnabled" class="b3-switch">
        </label>
        <label class="setting-field setting-field--full">
          <span>Base URL</span>
          <small class="setting-field__hint">OpenAI 兼容服务通常需要填写到 <code>/v1</code>，例如 <code>https://api.siliconflow.cn/v1</code></small>
          <input
            v-model.trim="config.aiBaseUrl"
            placeholder="https://api.openai.com/v1"
            type="text"
          >
        </label>
        <label class="setting-field setting-field--full">
          <span>API Key</span>
          <input
            v-model.trim="config.aiApiKey"
            placeholder="sk-..."
            type="password"
          >
        </label>
        <label class="setting-field setting-field--full">
          <span>Model</span>
          <input
            v-model.trim="config.aiModel"
            placeholder="gpt-4.1-mini"
            type="text"
          >
        </label>
        <label class="setting-field">
          <span>超时时间</span>
          <small class="setting-field__hint">发起请求的超时时间</small>
          <div class="setting-input-with-suffix">
            <input
              v-model.number="config.aiRequestTimeoutSeconds"
              min="1"
              step="1"
              type="number"
            >
            <span class="setting-input-with-suffix__unit">s</span>
          </div>
        </label>
        <label class="setting-field">
          <span>最大 Token 数</span>
          <small class="setting-field__hint">请求 API 时传入的 <code>max_tokens</code> 参数，用于控制生成的文本长度</small>
          <input
            v-model.number="config.aiMaxTokens"
            min="1"
            step="1"
            type="number"
          >
        </label>
        <label class="setting-field">
          <span>温度</span>
          <small class="setting-field__hint">请求 API 时传入的 <code>temperature</code> 参数，用于控制生成的文本随机性</small>
          <input
            v-model.number="config.aiTemperature"
            max="2"
            min="0"
            step="0.1"
            type="number"
          >
        </label>
        <label class="setting-field">
          <span>最大上下文数</span>
          <small class="setting-field__hint">请求 API 时传入的最大上下文数</small>
          <input
            v-model.number="config.aiMaxContextMessages"
            min="1"
            step="1"
            type="number"
          >
        </label>
        <label class="setting-field setting-field--full">
          <span>上下文容量</span>
          <select v-model="config.aiContextCapacity">
            <option value="compact">紧凑</option>
            <option value="balanced">标准</option>
            <option value="full">扩展</option>
          </select>
        </label>
      </div>
      <div class="setting-actions">
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
import { computed, onMounted, ref } from 'vue'

import { forwardProxy, lsNotebooks, sql } from '@/api'
import { createAiInboxService, isAiConfigComplete } from '@/analytics/ai-inbox'
import { SUMMARY_CARD_DEFINITIONS } from '@/analytics/summary-card-config'
import { loadSettingPanelData, type NotebookOption } from '@/components/setting-panel-data'
import ThemeMultiSelect from '@/components/ThemeMultiSelect.vue'
import { ensureConfigDefaults, type PluginConfig } from '@/types/config'

const props = defineProps<{
  config: PluginConfig
}>()

const notebooks = ref<NotebookOption[]>([])
const readTagOptions = ref<Array<{ value: string, label: string, key: string }>>([])
const summaryCardSettings = SUMMARY_CARD_DEFINITIONS
const aiTestingConnection = ref(false)
const aiConnectionMessage = ref('')
const aiConnectionError = ref('')

ensureConfigDefaults(props.config)

const aiService = createAiInboxService({ forwardProxy })
const aiConfigComplete = computed(() => isAiConfigComplete(props.config))

onMounted(async () => {
  const data = await loadSettingPanelData({
    lsNotebooks,
    sql: statement => sql(statement) as Promise<Array<{ tag: string | null }>>,
  })

  notebooks.value = data.notebooks
  readTagOptions.value = data.readTagOptions
})

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

.setting-field--full {
  grid-column: 1 / -1;
}

.setting-field span {
  font-weight: 500;
}

.setting-field__hint {
  font-size: 12px;
  line-height: 1.5;
  color: color-mix(in srgb, var(--b3-theme-on-background) 58%, transparent);
}

.setting-field__hint code {
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
  color: var(--b3-theme-primary);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
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

.setting-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.setting-feedback {
  font-size: 13px;
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
}
</style>
