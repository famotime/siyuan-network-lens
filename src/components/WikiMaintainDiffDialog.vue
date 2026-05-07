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
