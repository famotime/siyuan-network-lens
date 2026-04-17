<template>
  <section class="wiki-panel panel">
    <div class="wiki-panel__header">
      <div>
        <p class="wiki-panel__eyebrow">LLM Wiki</p>
        <h2>{{ t('wikiMaintain.title') }}</h2>
        <p class="wiki-panel__description">{{ t('wikiMaintain.description') }}</p>
      </div>
      <div class="wiki-panel__actions">
        <button
          class="action-button"
          type="button"
          :disabled="previewLoading || !canPreparePreview"
          @click="prepareWikiPreview"
        >
          {{ previewLoading ? t('wikiMaintain.generating') : t('wikiMaintain.generatePreview') }}
        </button>
        <button
          class="ghost-button"
          type="button"
          :disabled="applyLoading || !canApply"
          @click="applyWikiChanges(allowOverwriteConflicts)"
        >
          {{ applyLoading ? t('wikiMaintain.applying') : t('wikiMaintain.applyChanges') }}
        </button>
      </div>
    </div>

    <label class="wiki-panel__toggle">
      <input v-model="allowOverwriteConflicts" type="checkbox" class="b3-switch">
      <span>{{ t('wikiMaintain.allowOverwriteConflictPages') }}</span>
    </label>

    <div v-if="error" class="state-banner state-banner--error">
      {{ error }}
    </div>

    <div v-if="!wikiEnabled" class="empty-state">
      {{ t('wikiMaintain.enableWikiFirst') }}
    </div>

    <div v-else-if="!aiEnabled || !aiConfigReady" class="empty-state">
      {{ t('wikiMaintain.enableSuggestionsAndAi') }}
    </div>

    <template v-else>
      <div v-if="preview" class="wiki-panel__scope">
        <div class="wiki-panel__scope-grid">
          <div class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.matchedSourceDocs') }}</span>
            <strong>{{ preview.scope.summary.sourceDocumentCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.matchedTopics') }}</span>
            <strong>{{ preview.scope.summary.themeGroupCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.excludedWikiPages') }}</span>
            <strong>{{ preview.scope.summary.excludedWikiDocumentCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.unclassifiedSources') }}</span>
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
              <p>{{ t('wikiMaintain.pairedTopicPage') }}: {{ page.themeDocumentTitle }}</p>
            </div>
            <span class="wiki-panel__status">{{ t('wikiMaintain.status') }}: {{ statusLabelMap[page.preview.status] }}</span>
          </div>
          <div class="wiki-panel__meta">
            <span>{{ t('wikiMaintain.sourceDocs') }}: {{ page.preview.sourceDocumentCount }}</span>
            <span>{{ t('wikiMaintain.affectedSections') }}: {{ page.preview.affectedSections.length ? page.preview.affectedSections.join(', ') : t('wikiMaintain.noChanges') }}</span>
            <span>{{ t('wikiMaintain.manualNotes') }}: {{ page.hasManualNotes ? t('wikiMaintain.existing') : t('wikiMaintain.createdOnFirstWrite') }}</span>
          </div>
          <p class="wiki-panel__summary"><strong>{{ t('wikiMaintain.oldSummary') }}</strong>{{ page.preview.oldSummary || t('wikiMaintain.noPreviousContent') }}</p>
          <p class="wiki-panel__summary"><strong>{{ t('wikiMaintain.newSummary') }}</strong>{{ page.preview.newSummary || t('wikiMaintain.noNewContent') }}</p>
          <p v-if="page.preview.conflictReason" class="wiki-panel__conflict">{{ page.preview.conflictReason }}</p>
        </article>
      </div>

      <div v-else-if="preview" class="empty-state">
        {{ t('wikiMaintain.noMaintainablePages') }}
      </div>

      <div v-if="preview?.unclassifiedDocuments.length" class="wiki-panel__extra">
        <h3>{{ t('wikiMaintain.unclassifiedSources') }}</h3>
        <p>{{ preview.unclassifiedDocuments.map(item => item.title).join('、') }}</p>
      </div>

      <div v-if="preview?.applyResult" class="wiki-panel__result">
        <p>{{ resultSummary }}</p>
        <div class="wiki-panel__result-actions">
          <button
            v-if="preview.applyResult.indexPage.pageId"
            class="ghost-button"
            type="button"
            @click="openWikiDocument(preview.applyResult.indexPage.pageId)"
          >
            {{ t('wikiMaintain.openIndexPage') }}
          </button>
          <button
            v-if="preview.applyResult.logPage.pageId"
            class="ghost-button"
            type="button"
            @click="openWikiDocument(preview.applyResult.logPage.pageId)"
          >
            {{ t('wikiMaintain.openLogPage') }}
          </button>
          <button
            v-if="latestUpdatedThemePageId"
            class="ghost-button"
            type="button"
            @click="openWikiDocument(latestUpdatedThemePageId)"
          >
            {{ t('wikiMaintain.openLatestUpdatedPage') }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { WikiPreviewState } from '@/composables/use-analytics'
import { t } from '@/i18n/ui'

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
  create: t('wikiMaintain.statusCreate'),
  update: t('wikiMaintain.statusUpdate'),
  unchanged: t('wikiMaintain.statusUnchanged'),
  conflict: t('wikiMaintain.statusConflict'),
} as const

const resultSummary = computed(() => {
  if (!props.preview?.applyResult) {
    return ''
  }

  const { counts } = props.preview.applyResult
  return t('wikiMaintain.applyRunSummary', counts)
})

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
