<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { t } from '@/i18n/ui'

const props = defineProps<{
  pageTitle: string
  currentMarkdown: string
  suggestions: WikiMaintenanceSuggestion[]
  revisedMarkdown: string
}>()

const emit = defineEmits<{
  close: []
  apply: [selectedSuggestions: WikiMaintenanceSuggestion[]]
}>()

const selectedIndices = ref<Set<number>>(new Set(props.suggestions.map((_, i) => i)))

function toggleSuggestion(index: number) {
  if (selectedIndices.value.has(index)) {
    selectedIndices.value.delete(index)
  } else {
    selectedIndices.value.add(index)
  }
}

function selectAll() {
  selectedIndices.value = new Set(props.suggestions.map((_, i) => i))
}

function applySelected() {
  const selected = [...selectedIndices.value]
    .sort((a, b) => a - b)
    .map(i => props.suggestions[i])
  emit('apply', selected)
}

const hasSelection = computed(() => selectedIndices.value.size > 0)
</script>

<template>
  <div class="wiki-maintain-diff-dialog">
    <div class="wiki-maintain-diff-dialog__header">
      <h3>{{ t('llmWiki.maintain.diffTitle') }} — {{ pageTitle }}</h3>
      <button @click="emit('close')">
        {{ t('llmWiki.chat.close') }}
      </button>
    </div>
    <div class="wiki-maintain-diff-dialog__suggestions">
      <div
        v-for="(suggestion, index) in suggestions"
        :key="index"
        class="suggestion-item"
        :class="{ 'suggestion-item--selected': selectedIndices.has(index) }"
        @click="toggleSuggestion(index)"
      >
        <input
          type="checkbox"
          :checked="selectedIndices.has(index)"
          @change="toggleSuggestion(index)"
        >
        <span class="suggestion-item__type">{{ suggestion.type }}</span>
        <span class="suggestion-item__desc">{{ suggestion.description }}</span>
        <span
          v-if="suggestion.sectionHeading"
          class="suggestion-item__section"
        >{{ suggestion.sectionHeading }}</span>
      </div>
      <div
        v-if="suggestions.length === 0"
        class="wiki-maintain-diff-dialog__empty"
      >
        {{ t('llmWiki.maintain.noSuggestions') }}
      </div>
    </div>
    <div class="wiki-maintain-diff-dialog__diff">
      <div class="wiki-maintain-diff-dialog__diff-panel">
        <h4>{{ t('llmWiki.maintain.currentContent') }}</h4>
        <pre>{{ currentMarkdown }}</pre>
      </div>
      <div class="wiki-maintain-diff-dialog__diff-panel">
        <h4>{{ t('llmWiki.maintain.suggestedContent') }}</h4>
        <pre>{{ revisedMarkdown }}</pre>
      </div>
    </div>
    <div class="wiki-maintain-diff-dialog__footer">
      <button @click="selectAll">
        {{ t('llmWiki.maintain.applyAll') }}
      </button>
      <button
        :disabled="!hasSelection"
        @click="applySelected"
      >
        {{ t('llmWiki.maintain.applySelected') }}
      </button>
      <button @click="emit('close')">
        {{ t('llmWiki.maintain.cancel') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.wiki-maintain-diff-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw;
  max-width: 1000px;
  max-height: 85vh;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}
.wiki-maintain-diff-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}
.wiki-maintain-diff-dialog__header h3 {
  margin: 0;
  font-size: 1em;
}
.wiki-maintain-diff-dialog__suggestions {
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.suggestion-item:hover {
  background: var(--b3-theme-surface-light);
}
.suggestion-item--selected {
  background: var(--b3-theme-primary-lightest);
}
.suggestion-item__type {
  font-weight: 600;
  font-size: 0.85em;
  min-width: 100px;
}
.suggestion-item__desc {
  flex: 1;
}
.suggestion-item__section {
  font-size: 0.8em;
  color: var(--b3-theme-on-surface-light);
}
.wiki-maintain-diff-dialog__empty {
  color: var(--b3-theme-on-surface-light);
  padding: 12px;
  text-align: center;
}
.wiki-maintain-diff-dialog__diff {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  overflow: hidden;
  background: var(--b3-border-color);
}
.wiki-maintain-diff-dialog__diff-panel {
  background: var(--b3-theme-surface);
  overflow-y: auto;
  padding: 12px;
}
.wiki-maintain-diff-dialog__diff-panel h4 {
  margin: 0 0 8px;
  font-size: 0.9em;
}
.wiki-maintain-diff-dialog__diff-panel pre {
  font-size: 0.85em;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.wiki-maintain-diff-dialog__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.wiki-maintain-diff-dialog__footer button {
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
