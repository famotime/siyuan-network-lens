<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { t } from '@/i18n/ui'
import { renderSimpleMarkdown } from '@/utils/markdown'
import {
  buildInitialSelectedSuggestionIndices,
  getSelectedSuggestions,
  resolveDiffDialogLoading,
  selectAllSuggestionIndices,
  toggleSelectedSuggestionIndex,
} from '@/components/wiki-maintain-diff-state'
import { buildSuggestionSnippetPreview } from '@/components/wiki-maintain-diff-preview'

const props = defineProps<{
  pageTitle: string
  currentMarkdown: string
  suggestions: WikiMaintenanceSuggestion[]
  revisedMarkdown: string
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [selectedSuggestions: WikiMaintenanceSuggestion[]]
}>()

const SNIPPET_COLLAPSE_LINE_COUNT = 5

const isLoading = ref(resolveDiffDialogLoading({
  loading: props.loading,
  suggestions: props.suggestions,
  revisedMarkdown: props.revisedMarkdown,
}))

watch(() => props.loading, (val) => {
  isLoading.value = resolveDiffDialogLoading({
    loading: val,
    suggestions: props.suggestions,
    revisedMarkdown: props.revisedMarkdown,
  })
})

watch([
  () => props.suggestions,
  () => props.revisedMarkdown,
  () => props.currentMarkdown,
], ([suggestions, revisedMarkdown]) => {
  isLoading.value = resolveDiffDialogLoading({
    loading: props.loading,
    suggestions,
    revisedMarkdown,
  })
})

const selectedIndices = ref<Set<number>>(buildInitialSelectedSuggestionIndices(props.suggestions))
const expandedSnippetIndices = ref<Set<number>>(new Set())

watch(() => props.suggestions, (newSuggestions) => {
  selectedIndices.value = buildInitialSelectedSuggestionIndices(newSuggestions)
  expandedSnippetIndices.value = new Set()
})

function toggleSuggestion(index: number) {
  selectedIndices.value = toggleSelectedSuggestionIndex(selectedIndices.value, index)
}

function selectAll() {
  selectedIndices.value = selectAllSuggestionIndices(props.suggestions)
}

function applySelected() {
  emit('apply', getSelectedSuggestions(props.suggestions, selectedIndices.value))
}

function toggleSnippetExpanded(index: number) {
  const next = new Set(expandedSnippetIndices.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  expandedSnippetIndices.value = next
}

const hasSelection = computed(() => selectedIndices.value.size > 0)

function extractSection(markdown: string, heading: string): string {
  if (!markdown || !heading) return ''
  const lines = markdown.split(/\r?\n/)
  const normalizedHeading = heading.trim().toLowerCase()
  let capturing = false
  const result: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const currentHeading = headingMatch[2].trim().toLowerCase()
      if (currentHeading === normalizedHeading || currentHeading.includes(normalizedHeading) || normalizedHeading.includes(currentHeading)) {
        capturing = true
        continue
      }
      if (capturing) break
    }

    if (capturing) result.push(line)
  }

  return result.join('\n').trim()
}

const suggestionSnippets = computed(() =>
  props.suggestions.map((s) => {
    if (!s.sectionHeading) return ''
    return extractSection(props.revisedMarkdown, s.sectionHeading)
  }),
)

function buildCollapsedSnippet(snippet: string): string {
  const lines = snippet.split(/\r?\n/)
  if (lines.length <= SNIPPET_COLLAPSE_LINE_COUNT) {
    return snippet
  }
  return lines.slice(0, SNIPPET_COLLAPSE_LINE_COUNT).join('\n')
}

const suggestionSnippetHtml = computed(() =>
  suggestionSnippets.value.map((snippet, index) => {
    if (!snippet) {
      return ''
    }

    const source = expandedSnippetIndices.value.has(index)
      ? snippet
      : buildCollapsedSnippet(snippet)

    return renderSimpleMarkdown(source, {
      preserveSiyuanLinkLabels: true,
      stripHtmlTags: true,
    })
  })
)

const suggestionSnippetNeedsCollapse = computed(() =>
  suggestionSnippets.value.map(snippet => snippet.split(/\r?\n/).filter(Boolean).length > SNIPPET_COLLAPSE_LINE_COUNT)
)

const suggestionDiffPreviews = computed(() =>
  props.suggestions.map(suggestion => buildSuggestionSnippetPreview({
    suggestion,
    currentMarkdown: props.currentMarkdown,
    revisedMarkdown: props.revisedMarkdown,
  }))
)

function resolveSuggestionTypeLabel(type: WikiMaintenanceSuggestion['type']): string {
  switch (type) {
    case 'broken-link':
      return t('llmWiki.maintain.brokenLink')
    case 'outdated-section':
      return t('llmWiki.maintain.outdatedSection')
    case 'missing-reference':
      return t('llmWiki.maintain.missingReference')
    default:
      return type
  }
}

const SUGGESTION_TYPE_ICONS: Record<WikiMaintenanceSuggestion['type'], string> = {
  'broken-link': '🔗',
  'outdated-section': '📝',
  'missing-reference': '📎',
}

const dialogStyle = ref<Record<string, string>>({})
const isDragging = ref(false)
const isResizing = ref(false)

function onHeaderMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  const dialog = (e.currentTarget as HTMLElement).closest('.wiki-maintain-diff-dialog') as HTMLElement
  if (!dialog) return
  const rect = dialog.getBoundingClientRect()
  dialogStyle.value = {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    transform: 'none',
  }
  const offsetX = e.clientX - rect.left
  const offsetY = e.clientY - rect.top
  isDragging.value = true

  const onMove = (ev: MouseEvent) => {
    dialogStyle.value = {
      ...dialogStyle.value,
      top: `${Math.max(0, ev.clientY - offsetY)}px`,
      left: `${Math.max(0, ev.clientX - offsetX)}px`,
    }
  }
  const onUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onResizeMouseDown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  const dialog = (e.target as HTMLElement).closest('.wiki-maintain-diff-dialog') as HTMLElement
  if (!dialog) return
  const rect = dialog.getBoundingClientRect()
  dialogStyle.value = {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    transform: 'none',
  }
  const startX = e.clientX
  const startY = e.clientY
  const startW = rect.width
  const startH = rect.height
  isResizing.value = true

  const onMove = (ev: MouseEvent) => {
    dialogStyle.value = {
      ...dialogStyle.value,
      width: `${Math.max(400, startW + ev.clientX - startX)}px`,
      height: `${Math.max(300, startH + ev.clientY - startY)}px`,
    }
  }
  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onBeforeUnmount(() => {
  isDragging.value = false
  isResizing.value = false
})
</script>

<template>
  <div
    class="wiki-maintain-diff-dialog"
    :class="{ 'wiki-maintain-diff-dialog--dragging': isDragging, 'wiki-maintain-diff-dialog--resizing': isResizing }"
    :style="dialogStyle"
  >
    <div
      class="wiki-maintain-diff-dialog__header"
      @mousedown="onHeaderMouseDown"
    >
      <h3>{{ t('llmWiki.maintain.diffTitle') }} — {{ pageTitle }}</h3>
      <button
        class="ghost-button"
        @click="emit('close')"
      >
        {{ t('llmWiki.chat.close') }}
      </button>
    </div>
    <div
      v-if="isLoading"
      class="wiki-maintain-diff-dialog__loading"
    >
      <span class="wiki-maintain-diff-dialog__spinner" />
      {{ t('llmWiki.maintain.reviewing') }}
    </div>
    <template v-else>
      <div class="wiki-maintain-diff-dialog__body">
        <div
          v-if="suggestions.length === 0"
          class="wiki-maintain-diff-dialog__empty"
        >
          {{ t('llmWiki.maintain.noSuggestions') }}
        </div>
        <div
          v-for="(suggestion, index) in suggestions"
          :key="index"
          class="suggestion-card"
          :class="{ 'suggestion-card--selected': selectedIndices.has(index) }"
          @click="toggleSuggestion(index)"
        >
          <div class="suggestion-card__header">
            <input
              type="checkbox"
              :checked="selectedIndices.has(index)"
              @change="toggleSuggestion(index)"
              @click.stop
            >
            <span class="suggestion-card__icon">{{ SUGGESTION_TYPE_ICONS[suggestion.type] ?? '💡' }}</span>
            <span class="suggestion-card__type">{{ resolveSuggestionTypeLabel(suggestion.type) }}</span>
            <span
              v-if="suggestion.sectionHeading"
              class="suggestion-card__section"
            >{{ suggestion.sectionHeading }}</span>
          </div>
          <div class="suggestion-card__desc">{{ suggestion.description }}</div>
          <div
            v-if="suggestionSnippetHtml[index]"
            class="suggestion-card__snippet-shell"
          >
            <div
              v-if="suggestion.sectionHeading"
              class="suggestion-card__snippet-heading"
            >
              <span class="suggestion-card__snippet-heading-label">{{ t('llmWiki.maintain.targetSection') }}</span>
              <strong>{{ suggestion.sectionHeading }}</strong>
            </div>
            <div
              v-if="suggestionDiffPreviews[index]?.hasDiff"
              class="suggestion-card__diff-preview"
            >
              <div class="suggestion-card__diff-column">
                <div class="suggestion-card__diff-label">{{ t('llmWiki.maintain.currentContent') }}</div>
                <div
                  class="suggestion-card__diff-content markdown-body"
                  v-html="suggestionDiffPreviews[index].currentHtml"
                />
                <div
                  v-if="suggestionDiffPreviews[index].currentDiffHtml"
                  class="suggestion-card__diff-highlights markdown-body"
                  v-html="suggestionDiffPreviews[index].currentDiffHtml"
                />
              </div>
              <div class="suggestion-card__diff-column">
                <div class="suggestion-card__diff-label">{{ t('llmWiki.maintain.suggestedContent') }}</div>
                <div
                  class="suggestion-card__diff-content suggestion-card__diff-content--next markdown-body"
                  v-html="suggestionDiffPreviews[index].revisedHtml"
                />
                <div
                  v-if="suggestionDiffPreviews[index].revisedDiffHtml"
                  class="suggestion-card__diff-highlights markdown-body"
                  v-html="suggestionDiffPreviews[index].revisedDiffHtml"
                />
              </div>
            </div>
            <div
              class="suggestion-card__snippet markdown-body"
              :class="{ 'suggestion-card__snippet--collapsed': suggestionSnippetNeedsCollapse[index] && !expandedSnippetIndices.has(index) }"
              v-html="suggestionSnippetHtml[index]"
            />
            <button
              v-if="suggestionSnippetNeedsCollapse[index]"
              class="suggestion-card__snippet-toggle"
              type="button"
              @click.stop="toggleSnippetExpanded(index)"
            >
              {{ expandedSnippetIndices.has(index) ? t('llmWiki.maintain.showLess') : t('llmWiki.maintain.showMore') }}
            </button>
          </div>
        </div>
      </div>
      <div class="wiki-maintain-diff-dialog__footer">
        <button
          class="action-button"
          @click="selectAll"
        >
          {{ t('llmWiki.maintain.applyAll') }}
        </button>
        <button
          class="action-button"
          :disabled="!hasSelection"
          @click="applySelected"
        >
          {{ t('llmWiki.maintain.applySelected') }}
        </button>
        <button
          class="ghost-button"
          @click="emit('close')"
        >
          {{ t('llmWiki.maintain.cancel') }}
        </button>
      </div>
    </template>
    <div
      class="wiki-maintain-diff-dialog__resize-handle"
      @mousedown="onResizeMouseDown"
    />
  </div>
</template>

<style scoped>
.wiki-maintain-diff-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw;
  max-width: 920px;
  max-height: 85vh;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.wiki-maintain-diff-dialog--dragging,
.wiki-maintain-diff-dialog--resizing {
  user-select: none;
}

.wiki-maintain-diff-dialog--dragging {
  cursor: grabbing;
}

.wiki-maintain-diff-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
  cursor: grab;
  flex-shrink: 0;
}

.wiki-maintain-diff-dialog__header h3 {
  margin: 0;
  font-size: 1em;
}

.wiki-maintain-diff-dialog__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wiki-maintain-diff-dialog__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 16px;
  color: var(--b3-theme-on-surface-light);
  font-size: 0.95em;
}

.wiki-maintain-diff-dialog__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--b3-theme-on-surface-light);
  border-top-color: transparent;
  border-radius: 50%;
  animation: wiki-maintain-spin 0.8s linear infinite;
}

@keyframes wiki-maintain-spin {
  to { transform: rotate(360deg); }
}

.wiki-maintain-diff-dialog__empty {
  color: var(--b3-theme-on-surface-light);
  padding: 24px;
  text-align: center;
}

.suggestion-card {
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.suggestion-card:hover {
  border-color: var(--b3-theme-primary-light);
}

.suggestion-card--selected {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-lightest);
}

.suggestion-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.suggestion-card__icon {
  font-size: 1em;
}

.suggestion-card__type {
  font-weight: 600;
  font-size: 0.82em;
  color: var(--b3-theme-on-background);
}

.suggestion-card__section {
  font-size: 0.8em;
  color: var(--b3-theme-on-surface-light);
  margin-left: auto;
}

.suggestion-card__desc {
  font-size: 0.9em;
  line-height: 1.5;
  margin-bottom: 8px;
}

.suggestion-card__snippet-shell {
  display: grid;
  gap: 8px;
}

.suggestion-card__snippet-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.suggestion-card__snippet-heading-label {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  color: var(--b3-theme-primary);
}

.suggestion-card__diff-preview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.suggestion-card__diff-column {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.suggestion-card__diff-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-light);
}

.suggestion-card__diff-content {
  min-height: 72px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--b3-border-color) 90%, transparent);
  background: color-mix(in srgb, var(--b3-theme-surface-light) 88%, transparent);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.suggestion-card__diff-content--next {
  border-color: color-mix(in srgb, var(--b3-theme-primary) 24%, transparent);
  background: color-mix(in srgb, var(--b3-theme-primary) 8%, var(--b3-theme-surface-light));
}

.suggestion-card__diff-highlights {
  display: grid;
  gap: 6px;
}

.suggestion-card__diff-line {
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.55;
}

.suggestion-card__diff-line--removed {
  border: 1px solid color-mix(in srgb, #d94f70 26%, transparent);
  background: color-mix(in srgb, #d94f70 12%, var(--b3-theme-surface));
}

.suggestion-card__diff-line--added {
  border: 1px solid color-mix(in srgb, #3ba776 26%, transparent);
  background: color-mix(in srgb, #3ba776 14%, var(--b3-theme-surface));
}

.suggestion-card__snippet {
  font-size: 0.82em;
  line-height: 1.6;
  background: var(--b3-theme-surface-light);
  border-radius: 4px;
  padding: 8px 10px;
  margin: 0;
  word-break: break-word;
  max-height: 240px;
  overflow-y: auto;
}

.suggestion-card__snippet--collapsed {
  max-height: 136px;
  overflow: hidden;
  position: relative;
}

.suggestion-card__snippet--collapsed::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 40px;
  background: linear-gradient(to bottom, transparent, var(--b3-theme-surface-light));
  pointer-events: none;
}

.suggestion-card__snippet-toggle {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--b3-theme-primary);
  cursor: pointer;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
}

.suggestion-card__diff-content :deep(h1),
.suggestion-card__diff-content :deep(h2),
.suggestion-card__diff-content :deep(h3),
.suggestion-card__diff-content :deep(h4),
.suggestion-card__diff-content :deep(h5),
.suggestion-card__diff-content :deep(h6),
.suggestion-card__snippet :deep(h1),
.suggestion-card__snippet :deep(h2),
.suggestion-card__snippet :deep(h3),
.suggestion-card__snippet :deep(h4),
.suggestion-card__snippet :deep(h5),
.suggestion-card__snippet :deep(h6) {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.4;
}

.suggestion-card__diff-content :deep(p),
.suggestion-card__snippet :deep(p) {
  margin: 0;
}

.suggestion-card__diff-content :deep(p + p),
.suggestion-card__diff-content :deep(p + ul),
.suggestion-card__diff-content :deep(p + ol),
.suggestion-card__diff-content :deep(ul + p),
.suggestion-card__diff-content :deep(ol + p),
.suggestion-card__diff-content :deep(blockquote + p),
.suggestion-card__diff-content :deep(p + blockquote),
.suggestion-card__snippet :deep(p + p),
.suggestion-card__snippet :deep(p + ul),
.suggestion-card__snippet :deep(p + ol),
.suggestion-card__snippet :deep(ul + p),
.suggestion-card__snippet :deep(ol + p),
.suggestion-card__snippet :deep(blockquote + p),
.suggestion-card__snippet :deep(p + blockquote) {
  margin-top: 6px;
}

.suggestion-card__diff-content :deep(ul),
.suggestion-card__diff-content :deep(ol),
.suggestion-card__snippet :deep(ul),
.suggestion-card__snippet :deep(ol) {
  margin: 6px 0 0;
  padding-left: 18px;
}

.suggestion-card__diff-content :deep(li + li),
.suggestion-card__snippet :deep(li + li) {
  margin-top: 4px;
}

.suggestion-card__diff-content :deep(blockquote),
.suggestion-card__snippet :deep(blockquote) {
  margin: 6px 0 0;
  padding: 2px 0 2px 10px;
  border-left: 3px solid color-mix(in srgb, var(--b3-theme-primary) 42%, transparent);
  color: color-mix(in srgb, var(--b3-theme-on-background) 82%, transparent);
}

.suggestion-card__diff-content :deep(code),
.suggestion-card__snippet :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
  background: color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
}

.suggestion-card__diff-content :deep(strong),
.suggestion-card__snippet :deep(strong) {
  color: color-mix(in srgb, var(--b3-theme-on-background) 100%, white 10%);
  font-weight: 700;
}

.wiki-maintain-diff-dialog__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-button,
.ghost-button {
  border: 0;
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s;
}

.action-button {
  min-width: 108px;
  padding: 10px 18px;
  border-radius: 8px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
}

.action-button:disabled,
.ghost-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost-button {
  min-width: 108px;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 8%, transparent);
  color: var(--b3-theme-primary);
}

.wiki-maintain-diff-dialog__resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

.wiki-maintain-diff-dialog__resize-handle::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--b3-theme-on-surface-light);
  border-bottom: 2px solid var(--b3-theme-on-surface-light);
  opacity: 0.5;
}

@media (max-width: 860px) {
  .suggestion-card__diff-preview {
    grid-template-columns: 1fr;
  }
}
</style>
