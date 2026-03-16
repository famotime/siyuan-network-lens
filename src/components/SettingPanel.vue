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
        <p>定义已读文档判定规则，命中任一标签、标题前缀或标题后缀即计为已读。</p>
      </div>
      <div class="setting-form">
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
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>文档样本卡片</strong>
            <span>展示当前筛选命中的文档数量</span>
          </span>
          <input type="checkbox" v-model="config.showDocuments" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>已读/未读文档卡片</strong>
            <span>展示已读状态统计，并支持在已读与未读之间切换</span>
          </span>
          <input type="checkbox" v-model="config.showRead" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>活跃关系卡片</strong>
            <span>展示当前窗口内的文档级引用次数</span>
          </span>
          <input type="checkbox" v-model="config.showReferences" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>核心文档卡片</strong>
            <span>展示核心文档数量并联动详情</span>
          </span>
          <input type="checkbox" v-model="config.showRanking" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>趋势观察卡片</strong>
            <span>展示趋势变化并联动详情</span>
          </span>
          <input type="checkbox" v-model="config.showTrends" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>主题社区卡片</strong>
            <span>展示社区规模并联动详情</span>
          </span>
          <input type="checkbox" v-model="config.showCommunities" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>孤立文档卡片</strong>
            <span>展示当前窗口内没有有效文档级连接的文档数</span>
          </span>
          <input type="checkbox" v-model="config.showOrphans" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>沉没文档卡片</strong>
            <span>展示超过阈值未产生有效连接的文档数</span>
          </span>
          <input type="checkbox" v-model="config.showDormant" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>桥接节点卡片</strong>
            <span>展示断开后会削弱社区连接的桥接文档数</span>
          </span>
          <input type="checkbox" v-model="config.showBridges" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>传播节点卡片</strong>
            <span>展示高传播价值节点汇总</span>
          </span>
          <input type="checkbox" v-model="config.showPropagation" class="b3-switch">
        </label>
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
import { onMounted, ref } from 'vue'

import { lsNotebooks, sql } from '@/api'
import { loadSettingPanelData, type NotebookOption } from '@/components/setting-panel-data'
import ThemeMultiSelect from '@/components/ThemeMultiSelect.vue'
import { ensureConfigDefaults, type PluginConfig } from '@/types/config'

const props = defineProps<{
  config: PluginConfig
}>()

const notebooks = ref<NotebookOption[]>([])
const readTagOptions = ref<Array<{ value: string, label: string, key: string }>>([])

ensureConfigDefaults(props.config)

onMounted(async () => {
  const data = await loadSettingPanelData({
    lsNotebooks,
    sql: statement => sql(statement) as Promise<Array<{ tag: string | null }>>,
  })

  notebooks.value = data.notebooks
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

.setting-select-shell {
  padding: 10px 12px;
}

@media (max-width: 720px) {
  .setting-form {
    grid-template-columns: 1fr;
  }
}
</style>
