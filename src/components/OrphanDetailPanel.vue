<template>
  <div class="orphan-detail">
    <div class="orphan-detail__controls">
      <span>孤立排序</span>
      <select
        class="orphan-detail__select"
        :value="orphanSort"
        @change="onSortChange"
      >
        <option value="updated-desc">按更新时间</option>
        <option value="created-desc">按创建时间</option>
        <option value="title-asc">按标题</option>
      </select>
    </div>

    <div
      v-if="items.length"
      class="summary-detail-list"
    >
      <article
        v-for="item in items"
        :key="item.documentId"
        class="summary-detail-item"
      >
        <div class="summary-detail-item__header">
          <DocumentTitle
            :document-id="item.documentId"
            :title="item.title"
            :open-document="openDocument"
            :is-theme-document="item.isThemeDocument"
          />
          <span
            v-if="item.badge"
            class="badge"
          >
            {{ item.badge }}
          </span>
        </div>
        <p class="summary-detail-item__meta">
          {{ item.meta }}
        </p>
        <SuggestionCallout :suggestions="buildSuggestionCalloutItems(item)">
          <div
            v-if="item.themeSuggestions?.length"
            class="orphan-detail__theme-section"
          >
            <div class="orphan-detail__themes">
              <button
                v-for="suggestion in item.themeSuggestions"
                :key="`${item.documentId}-${suggestion.themeDocumentId}`"
                :class="['orphan-detail__theme-tag', { 'orphan-detail__theme-tag--active': isThemeSuggestionActive(item.documentId, suggestion.themeDocumentId) }]"
                type="button"
                :title="`${suggestion.themeDocumentTitle} · 匹配 ${suggestion.matchCount} 次`"
                @click="onToggleThemeSuggestion(item.documentId, suggestion.themeDocumentId)"
              >
                <span class="orphan-detail__theme-name">{{ suggestion.themeName }}</span>
              </button>
            </div>
          </div>
        </SuggestionCallout>
      </article>
    </div>
    <div
      v-else
      class="empty-state"
    >
      当前卡片下没有可展示的文档。
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OrphanSort } from '@/analytics/analysis'
import type { DetailSuggestion, SummaryDetailItem } from '@/analytics/summary-details'
import type { ThemeDocumentMatch } from '@/analytics/theme-documents'
import DocumentTitle from './DocumentTitle.vue'
import SuggestionCallout from './SuggestionCallout.vue'

const props = defineProps<{
  items: Array<SummaryDetailItem & { themeSuggestions?: ThemeDocumentMatch[] }>
  orphanSort: OrphanSort
  onUpdateOrphanSort: (value: OrphanSort) => void
  openDocument: (documentId: string) => void
  onToggleThemeSuggestion: (documentId: string, themeDocumentId: string) => void
  isThemeSuggestionActive: (documentId: string, themeDocumentId: string) => boolean
}>()

function onSortChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as OrphanSort
  props.onUpdateOrphanSort(value)
}

function buildSuggestionCalloutItems(item: SummaryDetailItem & { themeSuggestions?: ThemeDocumentMatch[] }): DetailSuggestion[] {
  const suggestions = item.suggestions ?? []
  if (!item.themeSuggestions?.length) {
    return suggestions
  }

  return suggestions.map((suggestion) => {
    if (suggestion.label !== '补齐链接') {
      return suggestion
    }

    const text = suggestion.text.replace(/[。；，,\s]*$/, '')
    return {
      ...suggestion,
      text: `${text}，建议链接以下主题文档（点击添加）：`,
    }
  })
}
</script>

<style scoped>
.orphan-detail {
  display: grid;
  gap: 12px;
}

.summary-detail-list {
  display: grid;
  gap: 12px;
}

.summary-detail-item {
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s;
}

.summary-detail-item:hover {
  background: var(--surface-card-soft);
}

.summary-detail-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.summary-detail-item__meta {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--panel-muted);
}

.orphan-detail__controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--panel-muted);
}

.orphan-detail__select {
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--surface-card);
  color: inherit;
  font-size: 13px;
}

.orphan-detail__theme-section {
  display: grid;
  gap: 6px;
}

.orphan-detail__themes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.orphan-detail__theme-tag {
  border: 0;
  border-radius: 999px;
  padding: 7px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 58%, transparent);
  background: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  transition: background-color 0.2s, color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0;
  max-width: 100%;
}

.orphan-detail__theme-tag:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 14%, transparent);
  color: var(--b3-theme-primary);
}

.orphan-detail__theme-tag--active {
  background: color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);
  color: var(--b3-theme-primary);
}

.orphan-detail__theme-name {
  font-weight: 600;
}
</style>
