<template>
  <div class="setting-panel">
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
            <strong>核心文档排行卡片</strong>
            <span>展示核心文档数量并联动详情</span>
          </span>
          <input type="checkbox" v-model="config.showRanking" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>整理建议卡片</strong>
            <span>展示待处理建议并联动详情</span>
          </span>
          <input type="checkbox" v-model="config.showSuggestions" class="b3-switch">
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
            <strong>孤立与桥接卡片</strong>
            <span>孤立、沉没与桥接文档汇总</span>
          </span>
          <input type="checkbox" v-model="config.showOrphanBridge" class="b3-switch">
        </label>
        <label class="setting-item setting-item--nested">
          <span class="setting-item__text">
            <strong>传播节点卡片</strong>
            <span>高传播价值节点汇总</span>
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
import type { PluginConfig } from '@/types/config'

const props = defineProps<{
  config: PluginConfig
}>()
</script>

<style scoped>
.setting-panel {
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
</style>
