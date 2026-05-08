<template>
  <section class="wiki-panel panel">
    <div class="wiki-panel__header">
      <p class="wiki-panel__eyebrow">LLM Wiki</p>
      <h2>{{ t('wikiMaintain.title') }}</h2>
      <p class="wiki-panel__description">{{ t('wikiMaintain.description') }}</p>
      <div class="wiki-panel__actions">
        <button
          class="action-button"
          type="button"
          :disabled="previewLoading || !canPreparePreview"
          @click="prepareWikiPreview"
        >
          <span v-if="previewLoading" class="spinner" aria-hidden="true" />
          {{ previewLoading ? t('wikiMaintain.generating') : t('wikiMaintain.generatePreview') }}
        </button>
        <button
          class="ghost-button"
          type="button"
          :disabled="applyLoading || !canApply"
          @click="applyWikiChanges(allowOverwriteConflicts)"
        >
          <span v-if="applyLoading" class="spinner" aria-hidden="true" />
          {{ applyLoading ? t('wikiMaintain.applying') : t('wikiMaintain.applyChanges') }}
        </button>
      </div>
    </div>

    <label class="wiki-panel__toggle">
      <input v-model="allowOverwriteConflicts" type="checkbox" class="b3-switch">
      <span>{{ t('wikiMaintain.allowOverwriteConflictPages') }}</span>
    </label>

    <label class="wiki-panel__toggle">
      <input v-model="incrementalEnabled" type="checkbox" class="b3-switch">
      <span>{{ t('wikiMaintain.incrementalGeneration') }}</span>
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
        <p class="wiki-panel__generated-at">
          {{ t('wikiMaintain.generatedAt') }}: {{ formatTimestamp(preview.generatedAt) }}
        </p>
        <div class="wiki-panel__scope-grid">
          <div class="wiki-panel__scope-card" :title="t('wikiMaintain.sourceDocumentsTooltip')">
            <span>{{ t('wikiMaintain.sourceDocuments') }}</span>
            <strong>{{ preview.scope.summary.sourceDocumentCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card" :title="t('wikiMaintain.generatedSectionsTooltip')">
            <span>{{ t('wikiMaintain.generatedSections') }}</span>
            <strong>{{ preview.scope.summary.generatedSectionCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card" :title="t('wikiMaintain.linkedReferencesTooltip')">
            <span>{{ t('wikiMaintain.linkedReferences') }}</span>
            <strong>{{ preview.scope.summary.referenceCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card" :title="t('wikiMaintain.manualNotesTooltip')">
            <span>{{ t('wikiMaintain.manualNotes') }}</span>
            <strong>{{ preview.scope.summary.manualNotesParagraphCount }}</strong>
          </div>
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
          <dl class="wiki-panel__meta">
            <div class="wiki-panel__meta-item">
              <dt>{{ t('wikiMaintain.sourceDocs') }}</dt>
              <dd>{{ page.preview.sourceDocumentCount }}</dd>
            </div>
            <div class="wiki-panel__meta-item">
              <dt>{{ t('wikiMaintain.template') }}</dt>
              <dd>{{ resolveTemplateLabel(page.diagnosis.templateType) }}</dd>
            </div>
            <div class="wiki-panel__meta-item">
              <dt>{{ t('wikiMaintain.confidence') }}</dt>
              <dd>{{ resolveConfidenceLabel(page.diagnosis.confidence) }}</dd>
            </div>
            <div class="wiki-panel__meta-item">
              <dt>{{ t('wikiMaintain.affectedSections') }}</dt>
              <dd>{{ page.affectedSectionHeadings.length ? page.affectedSectionHeadings.join(', ') : t('wikiMaintain.noChanges') }}</dd>
            </div>
            <div class="wiki-panel__meta-item">
              <dt>{{ t('wikiMaintain.sectionOrder') }}</dt>
              <dd>{{ resolveSectionOrderLabels(page) }}</dd>
            </div>
            <div class="wiki-panel__meta-item">
              <dt>{{ t('wikiMaintain.manualNotes') }}</dt>
              <dd>{{ page.hasManualNotes ? t('wikiMaintain.existing') : t('wikiMaintain.createdOnFirstWrite') }}</dd>
            </div>
          </dl>
          <p v-if="page.preview.oldSummary" class="wiki-panel__summary wiki-panel__summary--muted">{{ t('wikiMaintain.oldSummary') }} {{ sanitizeSummaryText(page.preview.oldSummary) }}</p>
          <p v-if="page.preview.conflictReason" class="wiki-panel__conflict">{{ page.preview.conflictReason }}</p>
          <div class="wiki-panel__item-actions">
            <button
              class="ghost-button"
              type="button"
              @click="detailPage = page"
            >
              {{ t('wikiMaintain.openDetail') }}
            </button>
          </div>
        </article>
      </div>

      <div v-else-if="preview" class="empty-state">
        {{ t('wikiMaintain.noMaintainablePages') }}
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

      <div v-if="preview" class="wiki-panel__scope-lines">
        <p v-for="line in preview.scope.descriptionLines" :key="line">{{ line }}</p>
      </div>

      <div v-if="preview?.deltaStats" class="wiki-panel__delta-stats">
        <h4>{{ t('wikiMaintain.deltaStatsTitle') }}</h4>
        <div class="wiki-panel__scope-grid">
          <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.deltaNewCount') }}</span>
            <strong class="wiki-panel__stat--new">{{ preview.deltaStats.newCount }}</strong>
          </div>
          <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.deltaChangedCount') }}</span>
            <strong class="wiki-panel__stat--changed">{{ preview.deltaStats.changedCount }}</strong>
          </div>
          <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.deltaUnchangedCount') }}</span>
            <strong>{{ preview.deltaStats.unchangedCount }}</strong>
          </div>
          <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.deltaDeletedCount') }}</span>
            <strong class="wiki-panel__stat--deleted">{{ preview.deltaStats.deletedCount }}</strong>
          </div>
          <div v-if="!preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.sourceDocTotalCount') }}</span>
            <strong>{{ preview.scope.summary.sourceDocumentCount }}</strong>
          </div>
          <div class="wiki-panel__scope-card">
            <span>{{ t('wikiMaintain.processingTime') }}</span>
            <strong>{{ formatProcessingTime(preview.deltaStats.processingTimeMs) }}</strong>
          </div>
        </div>
      </div>

      <div v-if="preview?.sourceDocMetas?.length" class="wiki-panel__source-cards">
        <div class="wiki-panel__source-cards-header">
          <h4>{{ t('wikiMaintain.sourceDocCardsTitle') }}</h4>
          <button
            :class="['wiki-panel__collapse-toggle', { 'wiki-panel__collapse-toggle--expanded': !sourceCardsCollapsed }]"
            type="button"
            :aria-expanded="!sourceCardsCollapsed"
            @click="sourceCardsCollapsed = !sourceCardsCollapsed"
          >
            <span
              class="wiki-panel__collapse-caret"
              aria-hidden="true"
            />
          </button>
        </div>
        <div
          v-show="!sourceCardsCollapsed"
          class="wiki-panel__source-card-list"
        >
          <article
            v-for="meta in sortedSourceDocMetas"
            :key="meta.documentId"
            class="wiki-panel__source-card"
            :data-delta="meta.deltaStatus"
          >
            <div class="wiki-panel__source-card-head">
              <a
                class="wiki-panel__source-card-title"
                href="#"
                @click.prevent="openSourceDocument(meta.documentId)"
              >
                {{ meta.title }}
              </a>
              <div class="wiki-panel__source-card-tags">
                <span class="wiki-panel__delta-tag" :data-status="meta.deltaStatus">
                  {{ deltaStatusLabel(meta.deltaStatus) }}
                </span>
                <span class="wiki-panel__link-type-tag">
                  {{ linkTypeLabel(meta.linkType) }}
                </span>
              </div>
            </div>
            <p class="wiki-panel__source-card-updated">
              {{ meta.updatedAt }}
            </p>
            <div class="wiki-panel__source-card-suggestions">
              <div v-if="meta.themeSuggestions?.length" class="wiki-panel__theme-suggestions">
                <button
                  v-for="suggestion in meta.themeSuggestions"
                  :key="suggestion.themeDocumentId"
                  :class="['wiki-panel__theme-pill', { 'wiki-panel__theme-pill--active': isThemeSuggestionActive?.(meta.documentId, suggestion.themeDocumentId) }]"
                  :title="t('wikiMaintain.themeSuggestionTooltip', { title: suggestion.themeDocumentTitle, count: suggestion.matchCount })"
                  @click="emit('toggleThemeLink', meta.documentId, suggestion.themeDocumentId)"
                >
                  {{ suggestion.themeName }}
                </button>
              </div>
              <button
                class="ghost-button ghost-button--sm"
                type="button"
                @click="emit('addTag', meta.documentId)"
              >
                {{ t('wikiMaintain.addTag') }}
              </button>
              <span v-if="meta.isWeakAssociation" class="wiki-panel__weak-warning">
                {{ t('wikiMaintain.weakAssociationWarning') }}
              </span>
              <span v-if="meta.deltaStatus === 'changed'" class="wiki-panel__changed-notice">
                {{ t('wikiMaintain.contentChangedNotice') }}
              </span>
            </div>
          </article>
        </div>
      </div>

    </template>

    <Teleport to="body">
      <div
        v-if="detailPage"
        class="wiki-detail-overlay"
        @click.self="detailPage = null"
      >
        <div class="wiki-detail-dialog">
          <div class="wiki-detail-dialog__header">
            <h3>{{ detailPage.pageTitle }}</h3>
            <button
              class="ghost-button"
              type="button"
              @click="detailPage = null"
            >
              &times;
            </button>
          </div>
          <div class="wiki-detail-dialog__body" v-html="renderSimpleMarkdown(stripMetaSection(detailPage.draft.managedMarkdown))" />
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { WikiPreviewState } from '@/composables/use-analytics'
import { resolveWikiSectionOrderLabels } from '@/composables/use-analytics-wiki'
import { t } from '@/i18n/ui'
import { renderSimpleMarkdown } from '@/utils/markdown'

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
  openSourceDocument: (documentId: string) => void
  formatTimestamp: (timestamp?: string) => string
  incrementalEnabled?: boolean
  isThemeSuggestionActive?: (documentId: string, themeDocumentId: string) => boolean
}>()

const emit = defineEmits<{
  (e: 'update:incrementalEnabled', value: boolean): void
  (e: 'toggleThemeLink', documentId: string, themeDocumentId: string): void
  (e: 'addTag', documentId: string): void
}>()

const allowOverwriteConflicts = ref(false)
const detailPage = ref<WikiPreviewState['themePages'][number] | null>(null)
const sourceCardsCollapsed = ref(true)

const incrementalEnabled = computed({
  get: () => props.incrementalEnabled ?? true,
  set: (value: boolean) => emit('update:incrementalEnabled', value),
})

const statusLabelMap = computed(() => ({
  create: t('wikiMaintain.statusCreate'),
  update: t('wikiMaintain.statusUpdate'),
  unchanged: t('wikiMaintain.statusUnchanged'),
  conflict: t('wikiMaintain.statusConflict'),
} as const))

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

function resolveTemplateLabel(templateType: string) {
  switch (templateType) {
    case 'tech_topic':
      return t('wikiMaintain.templateTechTopic')
    case 'product_howto':
      return t('wikiMaintain.templateProductHowto')
    case 'social_topic':
      return t('wikiMaintain.templateSocialTopic')
    case 'media_list':
      return t('wikiMaintain.templateMediaList')
    default:
      return templateType
    }
}

function resolveConfidenceLabel(confidence: string) {
  switch (confidence) {
    case 'high':
      return t('wikiMaintain.confidenceHigh')
    case 'medium':
      return t('wikiMaintain.confidenceMedium')
    case 'low':
      return t('wikiMaintain.confidenceLow')
    default:
      return confidence
  }
}

function resolveSectionOrderLabels(page: WikiPreviewState['themePages'][number]) {
  const labels = resolveWikiSectionOrderLabels({
    pagePlan: page.pagePlan,
    draft: page.draft,
  })

  return labels.length ? labels.join(', ') : t('wikiMaintain.noChanges')
}

function sanitizeSummaryText(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\(\([^)\s]+\s*"[^"]*"\)\)/g, '')
    .replace(/\[[^\]]*?\]\(siyuan:\/\/[^)]*\)/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\{:\s[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripMetaSection(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  let skipUntilNextH3 = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line.startsWith('### ')) {
      continue
    }

    const heading = line.replace(/^###\s+/, '').replace(/\s*\{:[^}]*\}$/, '').trim()
    if (heading === 'Page meta' || heading === '页面头信息') {
      skipUntilNextH3 = true
      continue
    }

    if (skipUntilNextH3) {
      return lines.slice(index).join('\n')
    }

    return lines.slice(index).join('\n')
  }

  return markdown
}

const sortedSourceDocMetas = computed(() => {
  if (!props.preview?.sourceDocMetas) return []
  const order = { new: 0, changed: 1, unchanged: 2, deleted: 3 } as const
  return [...props.preview.sourceDocMetas].sort((a, b) => order[a.deltaStatus] - order[b.deltaStatus])
})

function deltaStatusLabel(status: string): string {
  switch (status) {
    case 'new': return t('wikiMaintain.deltaStatusNew')
    case 'changed': return t('wikiMaintain.deltaStatusChanged')
    case 'unchanged': return t('wikiMaintain.deltaStatusUnchanged')
    case 'deleted': return t('wikiMaintain.deltaStatusDeleted')
    default: return status
  }
}

function linkTypeLabel(linkType: string): string {
  switch (linkType) {
    case 'outbound': return t('wikiMaintain.linkTypeOutbound')
    case 'inbound': return t('wikiMaintain.linkTypeInbound')
    case 'child': return t('wikiMaintain.linkTypeChild')
    default: return linkType
  }
}

function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<style scoped>
.wiki-panel {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
}

.wiki-panel__header {
  display: grid;
  gap: 10px;
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

.wiki-panel__generated-at {
  margin: 0;
  font-size: 12px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 55%, transparent);
}

.wiki-panel__scope-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.wiki-panel__scope-lines {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
  background: color-mix(in srgb, var(--b3-theme-surface) 60%, var(--b3-theme-background));
}

.wiki-panel__scope-lines p {
  margin: 2px 0;
  font-size: 13px;
  line-height: 1.6;
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

.wiki-panel__scope-card span {
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
  flex-direction: column;
  gap: 2px;
  margin: 10px 0;
}

.wiki-panel__meta-item {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.wiki-panel__meta dt {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: color-mix(in srgb, var(--b3-theme-on-background) 80%, transparent);
  flex-shrink: 0;
}

.wiki-panel__meta dd {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
}

.wiki-panel__summary {
  margin-top: 8px;
}

.wiki-panel__summary--muted {
  font-size: 12px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 48%, transparent);
}

.wiki-panel__item-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.wiki-panel__conflict {
  margin: 10px 0 0;
  color: var(--b3-theme-error);
}

@media (max-width: 720px) {
  .wiki-panel__scope-grid {
    grid-template-columns: 1fr;
  }

  .wiki-panel__item-head {
    flex-direction: column;
  }
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: -2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.wiki-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--b3-theme-background) 72%, transparent);
  backdrop-filter: blur(4px);
}

.wiki-detail-dialog {
  display: grid;
  grid-template-rows: auto 1fr;
  width: min(90vw, 720px);
  max-height: 80vh;
  border-radius: 14px;
  background: var(--b3-theme-surface);
  box-shadow: 0 12px 40px color-mix(in srgb, var(--b3-theme-on-background) 18%, transparent);
  overflow: hidden;
}

.wiki-detail-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
}

.wiki-detail-dialog__header h3 {
  margin: 0;
}

.wiki-detail-dialog__body {
  margin: 0;
  padding: 18px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.8;
  word-break: break-word;
}

.wiki-detail-dialog__body :deep(h1),
.wiki-detail-dialog__body :deep(h2) {
  margin: 18px 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.wiki-detail-dialog__body :deep(h3),
.wiki-detail-dialog__body :deep(h4),
.wiki-detail-dialog__body :deep(h5),
.wiki-detail-dialog__body :deep(h6) {
  margin: 14px 0 6px;
  font-size: 14px;
  font-weight: 600;
}

.wiki-detail-dialog__body :deep(p) {
  margin: 6px 0;
}

.wiki-detail-dialog__body :deep(ul) {
  margin: 6px 0;
  padding-left: 20px;
}

.wiki-detail-dialog__body :deep(li) {
  margin: 2px 0;
}

.wiki-detail-dialog__body :deep(blockquote) {
  margin: 8px 0;
  padding: 2px 12px;
  border-left: 3px solid color-mix(in srgb, var(--b3-theme-primary) 40%, transparent);
  color: color-mix(in srgb, var(--b3-theme-on-background) 72%, transparent);
}

.wiki-detail-dialog__body :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
  background: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
}

.wiki-detail-dialog__body :deep(strong) {
  font-weight: 600;
}

.action-button {
  border: 0;
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.2s, background-color 0.2s;
  font-weight: 500;
  min-width: 108px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
}

.action-button:hover:not(:disabled) {
  opacity: 0.9;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: progress;
  box-shadow: none;
}

.ghost-button {
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 108px;
  transition: background-color 0.2s;
}

.ghost-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
}

.ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.wiki-panel__delta-stats {
  display: grid;
  gap: 10px;
}

.wiki-panel__delta-stats h4 {
  margin: 0;
  font-size: 14px;
}

.wiki-panel__stat--new {
  color: var(--b3-theme-success, #4caf50);
}

.wiki-panel__stat--changed {
  color: var(--b3-theme-warning, #ff9800);
}

.wiki-panel__stat--deleted {
  color: var(--b3-theme-error, #f44336);
}

.wiki-panel__source-cards {
  display: grid;
  gap: 10px;
}

.wiki-panel__source-cards-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.wiki-panel__source-cards-header h4 {
  margin: 0;
  font-size: 14px;
}

.wiki-panel__collapse-toggle {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.wiki-panel__collapse-toggle:hover {
  background: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
}

.wiki-panel__collapse-caret {
  width: 6px;
  height: 6px;
  border-right: 1.5px solid color-mix(in srgb, var(--b3-theme-on-background) 60%, transparent);
  border-bottom: 1.5px solid color-mix(in srgb, var(--b3-theme-on-background) 60%, transparent);
  transform: rotate(-45deg);
  transition: transform 0.2s ease;
}

.wiki-panel__collapse-toggle--expanded .wiki-panel__collapse-caret {
  transform: rotate(45deg);
}

.wiki-panel__source-card-list {
  display: grid;
  gap: 8px;
}

.wiki-panel__source-card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  background: color-mix(in srgb, var(--b3-theme-surface) 86%, var(--b3-theme-background));
}

.wiki-panel__source-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.wiki-panel__source-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  text-decoration: none;
}

.wiki-panel__source-card-title:hover {
  text-decoration: underline;
}

.wiki-panel__source-card-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.wiki-panel__delta-tag,
.wiki-panel__link-type-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
}

.wiki-panel__delta-tag[data-status='new'] {
  background: color-mix(in srgb, var(--b3-theme-success, #4caf50) 14%, transparent);
  color: var(--b3-theme-success, #4caf50);
}

.wiki-panel__delta-tag[data-status='changed'] {
  background: color-mix(in srgb, var(--b3-theme-warning, #ff9800) 14%, transparent);
  color: var(--b3-theme-warning, #ff9800);
}

.wiki-panel__delta-tag[data-status='unchanged'] {
  background: color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
  color: color-mix(in srgb, var(--b3-theme-on-background) 60%, transparent);
}

.wiki-panel__delta-tag[data-status='deleted'] {
  background: color-mix(in srgb, var(--b3-theme-error, #f44336) 14%, transparent);
  color: var(--b3-theme-error, #f44336);
}

.wiki-panel__link-type-tag {
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  color: var(--b3-theme-primary);
}

.wiki-panel__source-card-updated {
  margin: 4px 0 0;
  font-size: 11px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 45%, transparent);
}

.wiki-panel__source-card-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}

.ghost-button--sm {
  font-size: 11px;
  padding: 3px 8px;
  min-width: auto;
}

.wiki-panel__weak-warning {
  font-size: 11px;
  color: var(--b3-theme-warning, #ff9800);
}

.wiki-panel__changed-notice {
  font-size: 11px;
  color: var(--b3-theme-primary);
}

.wiki-panel__theme-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.wiki-panel__theme-pill {
  padding: 2px 10px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.wiki-panel__theme-pill:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, transparent);
}

.wiki-panel__theme-pill--active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border-color: var(--b3-theme-primary);
}
</style>
