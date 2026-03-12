<template>
  <div class="setting-panel">
    <div class="setting-group">
      <div class="setting-header">
        <h3>分析概览</h3>
        <p>控制顶部统计卡片及其关联详情的显示。</p>
      </div>
      <label class="setting-item">
        <span class="setting-item__text">
          <strong>顶部统计卡片</strong>
        </span>
        <input type="checkbox" v-model="config.showSummaryCards" class="b3-switch">
      </label>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>核心价值发现</h3>
        <p>识别网络中的核心组件、孤立断层和趋势变化。</p>
      </div>
      
      <div class="setting-item-wrapper">
        <label class="setting-item">
          <span class="setting-item__text">
            <strong>核心文档排行</strong>
            <span>按多维度展示引用最多的文档</span>
          </span>
          <input type="checkbox" v-model="config.showRanking" class="b3-switch">
        </label>
        
        <label class="setting-item setting-item--nested" v-if="config.showRanking">
          <span class="setting-item__text">
            <strong>原始引用证据</strong>
            <span>选中核心文档后展示具体引用片段</span>
          </span>
          <input type="checkbox" v-model="config.showEvidence" class="b3-switch">
        </label>
      </div>

      <label class="setting-item">
        <span class="setting-item__text">
          <strong>整理建议</strong>
          <span>将结构分析转化为可执行的动作建议</span>
        </span>
        <input type="checkbox" v-model="config.showSuggestions" class="b3-switch">
      </label>

      <label class="setting-item">
        <span class="setting-item__text">
          <strong>主题社区</strong>
          <span>基于节点连接关系发现的文档簇</span>
        </span>
        <input type="checkbox" v-model="config.showCommunities" class="b3-switch">
      </label>

      <label class="setting-item">
        <span class="setting-item__text">
          <strong>孤立与桥接</strong>
          <span>断裂内容、零散证据与长期沉没资料</span>
        </span>
        <input type="checkbox" v-model="config.showOrphanBridge" class="b3-switch">
      </label>

      <label class="setting-item">
        <span class="setting-item__text">
          <strong>趋势观察</strong>
          <span>对比近期的文档活跃度、连接建立与断开趋势</span>
        </span>
        <input type="checkbox" v-model="config.showTrends" class="b3-switch">
      </label>
    </div>

    <div class="setting-group">
      <div class="setting-header">
        <h3>传播与链路</h3>
        <p>探索文档之间的关联路径与隐性传导价值。</p>
      </div>

      <div class="setting-item-wrapper">
        <label class="setting-item">
          <span class="setting-item__text">
            <strong>关系传播路径</strong>
            <span>查看两篇文档间的最短连接路径</span>
          </span>
          <input type="checkbox" v-model="config.showPaths" class="b3-switch">
        </label>

        <label class="setting-item setting-item--nested" v-if="config.showPaths">
          <span class="setting-item__text">
            <strong>高传播价值节点</strong>
            <span>跨主题路径中频繁出现的关键节点</span>
          </span>
          <input type="checkbox" v-model="config.showPropagation" class="b3-switch">
        </label>
      </div>
      
      <label class="setting-item">
        <span class="setting-item__text">
          <strong>文档详情</strong>
          <span>选中特定文档后展示其在全量网络中的角色与风险</span>
        </span>
        <input type="checkbox" v-model="config.showDocumentDetail" class="b3-switch">
      </label>
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
