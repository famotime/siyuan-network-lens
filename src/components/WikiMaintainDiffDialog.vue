<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { t } from '@/i18n/ui'
import {
  buildInitialSelectedSuggestionIndices,
  getSelectedSuggestions,
  resolveDiffDialogLoading,
  selectAllSuggestionIndices,
  toggleSelectedSuggestionIndex,
} from '@/components/wiki-maintain-diff-state'

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
], ([suggestions, revisedMarkdown]) => {
  isLoading.value = resolveDiffDialogLoading({
    loading: props.loading,
    suggestions,
    revisedMarkdown,
  })
})

const selectedIndices = ref<Set<number>>(buildInitialSelectedSuggestionIndices(props.suggestions))

watch(() => props.suggestions, (newSuggestions) => {
  selectedIndices.value = buildInitialSelectedSuggestionIndices(newSuggestions)
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

const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  'broken-link': '🔗',
  'outdated-section': '📝',
  'outdated_content': '📝',
  'missing-reference': '📎',
  'missing_reference': '📎',
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
          <span class="suggestion-card__icon">{{ SUGGESTION_TYPE_LABELS[suggestion.type] ?? '💡' }}</span>
          <span class="suggestion-card__type">{{ suggestion.type }}</span>
          <span
            v-if="suggestion.sectionHeading"
            class="suggestion-card__section"
          >{{ suggestion.sectionHeading }}</span>
        </div>
        <div class="suggestion-card__desc">{{ suggestion.description }}</div>
        <pre
          v-if="suggestionSnippets[index]"
          class="suggestion-card__snippet"
        >{{ suggestionSnippets[index] }}</pre>
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
  max-width: 800px;
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
  color: var(--b3-theme-on-surface-light);
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
.suggestion-card__snippet {
  font-size: 0.82em;
  line-height: 1.5;
  background: var(--b3-theme-surface-light);
  border-radius: 4px;
  padding: 8px 10px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
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
</style>
