<template>
  <div class="orphan-detail">
    <div class="orphan-detail__controls">
      <span>{{ t('orphanDetail.sortLabel') }}</span>
      <select
        class="orphan-detail__select"
        :value="orphanSort"
        @change="onSortChange"
      >
        <option value="updated-desc">{{ t('orphanDetail.sortUpdated') }}</option>
        <option value="created-desc">{{ t('orphanDetail.sortCreated') }}</option>
        <option value="title-asc">{{ t('orphanDetail.sortTitle') }}</option>
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
                :title="t('orphanDetail.themeTooltip', { title: suggestion.themeDocumentTitle, count: suggestion.matchCount })"
                @click="onToggleThemeSuggestion(item.documentId, suggestion.themeDocumentId)"
              >
                <span class="orphan-detail__theme-name">{{ suggestion.themeName }}</span>
              </button>
            </div>
          </div>
        </SuggestionCallout>
        <div
          v-if="aiEnabled"
          class="orphan-detail__ai-panel"
        >
          <div class="orphan-detail__ai-actions">
            <button
              class="orphan-detail__ai-button"
              type="button"
              :disabled="!aiConfigReady || resolveAiSuggestionState(item.documentId)?.loading"
              @click="onGenerateAiSuggestion(item.documentId)"
            >
              {{ resolveAiSuggestionState(item.documentId)?.result ? t('orphanDetail.regenerateAiSuggestions') : t('orphanDetail.aiSuggestions') }}
            </button>
            <span
              v-if="!aiConfigReady"
              class="orphan-detail__ai-hint"
            >
              {{ t('orphanDetail.aiConfigHint') }}
            </span>
          </div>

          <div
            v-if="resolveAiSuggestionState(item.documentId)?.loading || resolveAiSuggestionState(item.documentId)?.error || resolveAiSuggestionState(item.documentId)?.result"
            class="orphan-detail__ai-body"
          >
            <p
              v-if="resolveAiSuggestionState(item.documentId)?.loading"
              class="orphan-detail__ai-status"
            >
              {{ resolveAiSuggestionState(item.documentId)?.statusMessage }}
            </p>
            <p
              v-else-if="resolveAiSuggestionState(item.documentId)?.error"
              class="orphan-detail__ai-error"
            >
              {{ resolveAiSuggestionState(item.documentId)?.error }}
            </p>
            <div
              v-else-if="resolveAiSuggestionState(item.documentId)?.result"
              class="orphan-detail__ai-result"
            >
              <p class="orphan-detail__ai-summary">{{ resolveAiSuggestionState(item.documentId)?.result?.summary }}</p>
              <div class="orphan-detail__ai-groups">
                <section
                  v-if="resolveAiLinkSuggestions(item.documentId).length"
                  class="orphan-detail__ai-group"
                >
                  <div class="orphan-detail__ai-group-header">
                    <p class="orphan-detail__ai-group-title">{{ t('orphanDetail.linkSuggestions') }}</p>
                    <span class="orphan-detail__ai-group-meta">{{ t('orphanDetail.itemCount', { count: resolveAiLinkSuggestions(item.documentId).length }) }}</span>
                  </div>
                  <div class="orphan-detail__ai-group-list">
                    <div
                      v-for="suggestion in resolveAiLinkSuggestions(item.documentId)"
                      :key="`${item.documentId}-${suggestion.targetDocumentId}`"
                      class="orphan-detail__ai-item orphan-detail__ai-item--elevated"
                    >
                      <div class="orphan-detail__ai-item-top">
                        <button
                          :class="['orphan-detail__ai-pill', { 'orphan-detail__ai-pill--active': isAiLinkSuggestionActive(item.documentId, suggestion.targetDocumentId) }]"
                          type="button"
                          @click="onToggleAiLinkSuggestion(item.documentId, suggestion.targetDocumentId, suggestion.targetTitle)"
                        >
                          {{ suggestion.targetTitle }}
                        </button>
                        <span class="orphan-detail__ai-badge">{{ suggestion.confidence }}</span>
                      </div>
                      <p>{{ suggestion.reason }}</p>
                      <p v-if="suggestion.draftText" class="orphan-detail__ai-draft">{{ suggestion.draftText }}</p>
                    </div>
                  </div>
                </section>

                <section
                  v-if="resolveAiTagSuggestions(item.documentId).length"
                  class="orphan-detail__ai-group"
                >
                  <div class="orphan-detail__ai-group-header">
                    <p class="orphan-detail__ai-group-title">{{ t('orphanDetail.tagSuggestions') }}</p>
                    <span class="orphan-detail__ai-group-meta">{{ t('orphanDetail.itemCount', { count: resolveAiTagSuggestions(item.documentId).length }) }}</span>
                  </div>
                  <div class="orphan-detail__ai-group-list">
                    <div
                      v-for="tagSuggestion in resolveAiTagSuggestions(item.documentId)"
                      :key="`${item.documentId}-${tagSuggestion.tag}`"
                      class="orphan-detail__ai-item orphan-detail__ai-item--elevated"
                    >
                      <div class="orphan-detail__ai-item-top">
                        <button
                          :class="['orphan-detail__ai-pill', { 'orphan-detail__ai-pill--active': isAiTagSuggestionActive(item.documentId, tagSuggestion.tag) }]"
                          type="button"
                          @click="onToggleAiTagSuggestion(item.documentId, tagSuggestion.tag)"
                        >
                          {{ tagSuggestion.tag }}
                        </button>
                        <span class="orphan-detail__ai-tag-badge">{{ resolveTagSuggestionSourceLabel(tagSuggestion.source) }}</span>
                      </div>
                      <p v-if="tagSuggestion.reason">{{ tagSuggestion.reason }}</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
    <div
      v-else
      class="empty-state"
    >
      {{ t('orphanDetail.empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n/ui'
import type { OrphanSort } from '@/analytics/analysis'
import type { AiLinkSuggestionItem, AiLinkTagSuggestion, OrphanAiSuggestionState } from '@/analytics/ai-link-suggestions'
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
  onToggleAiLinkSuggestion: (documentId: string, targetDocumentId: string, targetTitle: string) => void | Promise<void>
  isAiLinkSuggestionActive: (documentId: string, targetDocumentId: string) => boolean
  onToggleAiTagSuggestion: (documentId: string, tag: string) => void | Promise<void>
  isAiTagSuggestionActive: (documentId: string, tag: string) => boolean
  aiEnabled: boolean
  aiConfigReady: boolean
  aiSuggestionStates: Map<string, OrphanAiSuggestionState>
  onGenerateAiSuggestion: (documentId: string) => void | Promise<void>
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
    if (suggestion.label !== 'Repair links' && suggestion.label !== '补齐链接') {
      return suggestion
    }

    const text = suggestion.text.replace(/[.。；，,\s]*$/, '')
    return {
      ...suggestion,
      text: t('orphanDetail.repairLinksWithTopics', { text }),
    }
  })
}

function resolveAiSuggestionState(documentId: string): OrphanAiSuggestionState | undefined {
  return props.aiSuggestionStates.get(documentId)
}

function resolveTagSuggestionSourceLabel(source: AiLinkTagSuggestion['source']) {
  return source === 'existing'
    ? t('orphanDetail.existingTag')
    : t('orphanDetail.newTag')
}

function resolveAiLinkSuggestions(documentId: string): AiLinkSuggestionItem[] {
  return resolveAiSuggestionState(documentId)?.result?.suggestions ?? []
}

function resolveAiTagSuggestions(documentId: string): AiLinkTagSuggestion[] {
  const suggestions = resolveAiLinkSuggestions(documentId)
  const deduplicated = new Map<string, AiLinkTagSuggestion>()

  for (const suggestion of suggestions) {
    for (const tagSuggestion of suggestion.tagSuggestions ?? []) {
      const key = tagSuggestion.tag.trim().toLocaleLowerCase()
      if (!key) {
        continue
      }

      const existing = deduplicated.get(key)
      if (!existing) {
        deduplicated.set(key, tagSuggestion)
        continue
      }

      if (existing.source !== 'existing' && tagSuggestion.source === 'existing') {
        deduplicated.set(key, tagSuggestion)
      }
    }
  }

  return [...deduplicated.values()]
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

.orphan-detail__ai-panel {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--panel-border);
}

.orphan-detail__ai-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.orphan-detail__ai-button {
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
}

.orphan-detail__ai-button {
  padding: 8px 14px;
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
  color: var(--b3-theme-primary);
  font-weight: 600;
}

.orphan-detail__ai-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.orphan-detail__ai-hint,
.orphan-detail__ai-subtle {
  font-size: 12px;
  color: var(--panel-muted);
}

.orphan-detail__ai-body {
  display: grid;
  gap: 10px;
  border-radius: 12px;
  padding: 12px;
  background: color-mix(in srgb, var(--b3-theme-primary) 6%, var(--surface-card));
}

.orphan-detail__ai-status,
.orphan-detail__ai-error,
.orphan-detail__ai-summary,
.orphan-detail__ai-item p {
  margin: 0;
  line-height: 1.65;
}

.orphan-detail__ai-error {
  color: var(--b3-theme-error);
}

.orphan-detail__ai-result {
  display: grid;
  gap: 10px;
}

.orphan-detail__ai-groups {
  display: grid;
  gap: 12px;
}

.orphan-detail__ai-group {
  display: grid;
  gap: 8px;
}

.orphan-detail__ai-group-header,
.orphan-detail__ai-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.orphan-detail__ai-group-header {
  align-items: baseline;
}

.orphan-detail__ai-badge {
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
  color: var(--b3-theme-primary);
  font-size: 12px;
  text-transform: uppercase;
}

.orphan-detail__ai-group-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: color-mix(in srgb, var(--b3-theme-primary) 78%, var(--b3-theme-on-background));
}

.orphan-detail__ai-group-meta {
  font-size: 12px;
  color: var(--panel-muted);
}

.orphan-detail__ai-group-list {
  display: grid;
  gap: 8px;
}

.orphan-detail__ai-item {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 10px;
}

.orphan-detail__ai-item--elevated {
  background: color-mix(in srgb, var(--surface-card) 88%, white);
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 12%, var(--panel-border));
  box-shadow: 0 1px 2px color-mix(in srgb, var(--b3-theme-on-background) 6%, transparent);
}

.orphan-detail__ai-pill {
  border: 0;
  border-radius: 999px;
  padding: 7px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  transition: background-color 0.2s, color 0.2s, transform 0.2s;
}

.orphan-detail__ai-pill:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);
}

.orphan-detail__ai-pill--active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
}

.orphan-detail__ai-tag-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 12px;
}

.orphan-detail__ai-tag-badge {
  background: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  color: var(--panel-muted);
}

.orphan-detail__ai-draft {
  color: var(--panel-muted);
  font-family: var(--b3-font-family-code, monospace);
  font-size: 12px;
}
</style>
