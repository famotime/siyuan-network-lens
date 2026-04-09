<template>
  <section class="wiki-panel panel">
    <div class="wiki-panel__header">
      <div>
        <p class="wiki-panel__eyebrow">LLM Wiki</p>
        <h2>LLM Wiki 维护</h2>
        <p class="wiki-panel__description">基于当前筛选结果生成主题 wiki 预览，并在确认后写回主题页、索引页和维护日志。</p>
      </div>
      <div class="wiki-panel__actions">
        <button
          class="action-button"
          type="button"
          :disabled="previewLoading || !canPreparePreview"
          @click="prepareWikiPreview"
        >
          {{ previewLoading ? '生成中...' : '生成预览' }}
        </button>
        <button
          class="ghost-button"
          type="button"
          :disabled="applyLoading || !canApply"
          @click="applyWikiChanges(allowOverwriteConflicts)"
        >
          {{ applyLoading ? '写入中...' : '确认写入' }}
        </button>
      </div>
    </div>

    <label class="wiki-panel__toggle">
      <input v-model="allowOverwriteConflicts" type="checkbox" class="b3-switch">
      <span>允许覆盖冲突页</span>
    </label>

    <div v-if="error" class="state-banner state-banner--error">
      {{ error }}
    </div>

    <div v-if="!wikiEnabled" class="empty-state">
      请先启用 LLM Wiki
    </div>

    <div v-else-if="!aiEnabled || !aiConfigReady" class="empty-state">
      需要先启用 AI 今日建议并补齐 AI 接入配置
    </div>

    <template v-else>
      <div v-if="preview" class="wiki-panel__scope">
        <div class="wiki-panel__scope-grid">
          <div class="wiki-panel__scope-card">
            <span>命中源文档数</span>
            <strong>{{ preview.scope.summary.sourceDocumentCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card">
            <span>命中主题数</span>
            <strong>{{ preview.scope.summary.themeGroupCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card">
            <span>排除 wiki 页数</span>
            <strong>{{ preview.scope.summary.excludedWikiDocumentCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card">
            <span>未归类来源数</span>
            <strong>{{ preview.scope.summary.unclassifiedDocumentCount }}</strong>
          </div>
        </div>
        <div class="wiki-panel__scope-lines">
          <p v-for="line in preview.scope.descriptionLines" :key="line">{{ line }}</p>
        </div>
      </div>

      <div v-if="preview?.themePages.length" class="wiki-panel__list">
        <article
          v-for="page in preview.themePages"
          :key="page.pageTitle"
          class="wiki-panel__item"
          :data-status="page.preview.status"
        >
          <div class="wiki-panel__item-head">
            <div>
              <h3>{{ page.pageTitle }}</h3>
              <p>配对主题页：{{ page.themeDocumentTitle }}</p>
            </div>
            <span class="wiki-panel__status">状态：{{ statusLabelMap[page.preview.status] }}</span>
          </div>
          <div class="wiki-panel__meta">
            <span>源文档数：{{ page.preview.sourceDocumentCount }}</span>
            <span>影响 section：{{ page.preview.affectedSections.length ? page.preview.affectedSections.join(', ') : '无变化' }}</span>
            <span>人工备注区：{{ page.hasManualNotes ? '已存在' : '首次写入时创建' }}</span>
          </div>
          <p class="wiki-panel__summary"><strong>旧摘要：</strong>{{ page.preview.oldSummary || '暂无旧内容' }}</p>
          <p class="wiki-panel__summary"><strong>新摘要：</strong>{{ page.preview.newSummary || '暂无新内容' }}</p>
          <p v-if="page.preview.conflictReason" class="wiki-panel__conflict">{{ page.preview.conflictReason }}</p>
        </article>
      </div>

      <div v-else-if="preview" class="empty-state">
        当前作用域没有可维护的主题 wiki 页面
      </div>

      <div v-if="preview?.unclassifiedDocuments.length" class="wiki-panel__extra">
        <h3>未归类来源</h3>
        <p>{{ preview.unclassifiedDocuments.map(item => item.title).join('、') }}</p>
      </div>

      <div v-if="preview?.applyResult" class="wiki-panel__result">
        <p>本轮写入结果：新建 {{ preview.applyResult.counts.created }} / 更新 {{ preview.applyResult.counts.updated }} / 无变化 {{ preview.applyResult.counts.skipped }} / 冲突 {{ preview.applyResult.counts.conflict }}</p>
        <div class="wiki-panel__result-actions">
          <button
            v-if="preview.applyResult.indexPage.pageId"
            class="ghost-button"
            type="button"
            @click="openWikiDocument(preview.applyResult.indexPage.pageId)"
          >
            打开索引页
          </button>
          <button
            v-if="preview.applyResult.logPage.pageId"
            class="ghost-button"
            type="button"
            @click="openWikiDocument(preview.applyResult.logPage.pageId)"
          >
            打开日志页
          </button>
          <button
            v-if="latestUpdatedThemePageId"
            class="ghost-button"
            type="button"
            @click="openWikiDocument(latestUpdatedThemePageId)"
          >
            打开最近更新页
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { WikiPreviewState } from '@/composables/use-analytics'

const props = defineProps<{
  wikiEnabled: boolean
  aiEnabled: boolean
  aiConfigReady: boolean
  previewLoading: boolean
  applyLoading: boolean
  error: string
  preview: WikiPreviewState | null
  prepareWikiPreview: () => void | Promise<void>
  applyWikiChanges: (overwriteConflicts?: boolean) => void | Promise<void>
  openWikiDocument: (documentId: string) => void
}>()

const allowOverwriteConflicts = ref(false)

const statusLabelMap = {
  create: '新建',
  update: '更新',
  unchanged: '无变化',
  conflict: '冲突',
} as const

const canPreparePreview = computed(() => props.wikiEnabled && props.aiEnabled && props.aiConfigReady)
const canApply = computed(() => {
  if (!props.preview?.themePages.length) {
    return false
  }

  return props.preview.themePages.some((page) => {
    if (page.preview.status === 'create' || page.preview.status === 'update') {
      return true
    }
    return allowOverwriteConflicts.value && page.preview.status === 'conflict'
  })
})

const latestUpdatedThemePageId = computed(() => {
  const latestPage = [...(props.preview?.applyResult?.themePages ?? [])]
    .reverse()
    .find(page => page.pageId && (page.result === 'updated' || page.result === 'created'))

  return latestPage?.pageId ?? ''
})
</script>

<style scoped>
.wiki-panel {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
}

.wiki-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.wiki-panel__eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--b3-theme-primary) 72%, transparent);
}

.wiki-panel__description,
.wiki-panel__scope-lines p,
.wiki-panel__item-head p,
.wiki-panel__summary,
.wiki-panel__result,
.wiki-panel__extra p {
  margin: 0;
  color: color-mix(in srgb, var(--b3-theme-on-background) 68%, transparent);
}

.wiki-panel__actions,
.wiki-panel__result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wiki-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.wiki-panel__scope {
  display: grid;
  gap: 12px;
}

.wiki-panel__scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.wiki-panel__scope-card,
.wiki-panel__item,
.wiki-panel__extra,
.wiki-panel__result {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  background: color-mix(in srgb, var(--b3-theme-surface) 86%, var(--b3-theme-background));
}

.wiki-panel__scope-card {
  display: grid;
  gap: 4px;
}

.wiki-panel__scope-card span,
.wiki-panel__meta {
  font-size: 12px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 58%, transparent);
}

.wiki-panel__scope-card strong {
  font-size: 22px;
  color: var(--b3-theme-primary);
}

.wiki-panel__list {
  display: grid;
  gap: 12px;
}

.wiki-panel__item-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.wiki-panel__item-head h3,
.wiki-panel__extra h3 {
  margin: 0;
}

.wiki-panel__status {
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
  font-size: 12px;
  white-space: nowrap;
}

.wiki-panel__item[data-status='conflict'] .wiki-panel__status {
  background: color-mix(in srgb, var(--b3-theme-error) 12%, transparent);
  color: var(--b3-theme-error);
}

.wiki-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 10px 0;
}

.wiki-panel__summary {
  margin-top: 8px;
}

.wiki-panel__conflict {
  margin: 10px 0 0;
  color: var(--b3-theme-error);
}

@media (max-width: 720px) {
  .wiki-panel__header,
  .wiki-panel__item-head {
    flex-direction: column;
  }
}
</style>
