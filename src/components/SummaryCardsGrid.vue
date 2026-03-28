<template>
  <div class="summary-grid">
    <article
      v-for="card in cards"
      :key="card.key"
      :class="[
        'summary-card',
        'summary-card--interactive',
        {
          'summary-card--active': card.key === selectedSummaryCardKey,
          'summary-card--dragging': card.key === draggedSummaryCardKey,
          'summary-card--drop-target': card.key === dropTargetSummaryCardKey && card.key !== draggedSummaryCardKey,
        },
      ]"
      :title="card.hint"
      draggable="true"
      @dragstart="handleSummaryCardDragStart(card.key, $event)"
      @dragover.prevent="handleSummaryCardDragOver(card.key, $event)"
      @drop.prevent="handleSummaryCardDrop(card.key)"
      @dragend="handleSummaryCardDragEnd"
    >
      <div class="summary-card__frame">
        <button
          class="summary-card__main"
          type="button"
          @click="onSelectSummaryCard(card.key)"
        >
          <span class="summary-card__label">{{ card.label }}</span>
          <strong class="summary-card__value">{{ card.value }}</strong>
        </button>
        <button
          v-if="shouldShowCardToggle(card.key)"
          class="summary-card__toggle"
          type="button"
          :aria-label="resolveToggleLabel(card.key)"
          :title="resolveToggleLabel(card.key)"
          @click.stop="handleCardToggle(card.key)"
        >
          <svg
            class="summary-card__toggle-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              d="M3 5h8.5M9.5 2.5 12 5l-2.5 2.5M13 11H4.5M6.5 8.5 4 11l2.5 2.5"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.4"
            />
          </svg>
        </button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { LargeDocumentCardMode } from '@/analytics/large-documents'
import type { ReadCardMode } from '@/analytics/read-status'
import type { SummaryCardItem, SummaryCardKey } from '@/analytics/summary-details'

const props = defineProps<{
  cards: SummaryCardItem[]
  selectedSummaryCardKey: SummaryCardKey
  readCardMode: ReadCardMode
  largeDocumentCardMode: LargeDocumentCardMode
  onSelectSummaryCard: (cardKey: SummaryCardKey) => void
  onToggleReadCardMode: () => void
  onToggleLargeDocumentCardMode: () => void
  onReorderSummaryCard: (draggedKey: SummaryCardKey, targetKey: SummaryCardKey) => void
}>()

const draggedSummaryCardKey = ref<SummaryCardKey | ''>('')
const dropTargetSummaryCardKey = ref<SummaryCardKey | ''>('')

function handleSummaryCardDragStart(cardKey: SummaryCardKey, event: DragEvent) {
  draggedSummaryCardKey.value = cardKey
  dropTargetSummaryCardKey.value = ''
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', cardKey)
  }
}

function handleSummaryCardDragOver(cardKey: SummaryCardKey, event: DragEvent) {
  if (!draggedSummaryCardKey.value || draggedSummaryCardKey.value === cardKey) {
    return
  }
  dropTargetSummaryCardKey.value = cardKey
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleSummaryCardDrop(cardKey: SummaryCardKey) {
  if (!draggedSummaryCardKey.value) {
    return
  }
  props.onReorderSummaryCard(draggedSummaryCardKey.value, cardKey)
  draggedSummaryCardKey.value = ''
  dropTargetSummaryCardKey.value = ''
}

function handleSummaryCardDragEnd() {
  draggedSummaryCardKey.value = ''
  dropTargetSummaryCardKey.value = ''
}

function shouldShowCardToggle(cardKey: SummaryCardKey): boolean {
  return cardKey === 'read' || cardKey === 'largeDocuments'
}

function resolveToggleLabel(cardKey: SummaryCardKey): string {
  if (cardKey === 'read') {
    return props.readCardMode === 'read' ? '切换为未读文档' : '切换为已读文档'
  }

  return props.largeDocumentCardMode === 'storage' ? '切换为按文字统计' : '切换为按资源统计'
}

function handleCardToggle(cardKey: SummaryCardKey) {
  if (cardKey === 'read') {
    props.onToggleReadCardMode()
    return
  }

  if (cardKey === 'largeDocuments') {
    props.onToggleLargeDocumentCardMode()
  }
}
</script>

<style scoped>
.summary-grid {
  --summary-card-active-border: color-mix(in srgb, var(--accent-cool) 60%, transparent);
  --summary-card-active-sheen: color-mix(in srgb, var(--accent-cool) 14%, transparent);
  --summary-card-active-surface: color-mix(in srgb, var(--accent-cool) 8%, var(--b3-theme-surface));
  --summary-card-active-ring: color-mix(in srgb, var(--accent-cool) 20%, transparent);
  --summary-card-active-shadow: color-mix(in srgb, var(--accent-cool) 34%, transparent);
  --summary-card-active-strip-end: color-mix(in srgb, var(--b3-theme-primary) 72%, white);
  --summary-card-active-label: color-mix(in srgb, var(--accent-cool) 52%, var(--b3-theme-on-surface));
  --summary-card-active-value: color-mix(in srgb, var(--accent-cool) 42%, var(--b3-theme-primary));
  --summary-card-active-value-shadow: transparent;
  --summary-card-active-toggle-border: color-mix(in srgb, var(--accent-cool) 30%, transparent);
  --summary-card-active-toggle-bg: color-mix(in srgb, var(--accent-cool) 10%, var(--surface-card));
  --summary-card-active-toggle-color: color-mix(in srgb, var(--accent-cool) 56%, var(--b3-theme-on-surface));
  --summary-card-focus-outline: color-mix(in srgb, var(--accent-cool) 44%, transparent);
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  align-items: stretch;
  margin-bottom: 24px;
}

:global(.b3-theme-light) .summary-grid,
:global([data-theme-mode='light']) .summary-grid {
  --summary-card-active-border: color-mix(in srgb, var(--accent-cool) 74%, var(--b3-theme-primary));
  --summary-card-active-sheen: color-mix(in srgb, var(--accent-cool) 12%, white);
  --summary-card-active-surface: color-mix(in srgb, var(--accent-cool) 10%, white);
  --summary-card-active-ring: color-mix(in srgb, var(--accent-cool) 24%, transparent);
  --summary-card-active-shadow: color-mix(in srgb, var(--accent-cool) 28%, transparent);
  --summary-card-active-strip-end: color-mix(in srgb, var(--b3-theme-primary) 58%, white);
  --summary-card-active-label: color-mix(in srgb, var(--accent-cool) 62%, var(--b3-theme-on-surface));
  --summary-card-active-value: color-mix(in srgb, var(--accent-cool) 54%, var(--b3-theme-primary));
  --summary-card-active-value-shadow: color-mix(in srgb, white 58%, transparent);
  --summary-card-active-toggle-border: color-mix(in srgb, var(--accent-cool) 34%, transparent);
  --summary-card-active-toggle-bg: color-mix(in srgb, var(--accent-cool) 12%, white);
  --summary-card-active-toggle-color: color-mix(in srgb, var(--accent-cool) 62%, var(--b3-theme-on-surface));
  --summary-card-focus-outline: color-mix(in srgb, var(--accent-cool) 52%, transparent);
}

:global(.b3-theme-dark) .summary-grid,
:global([data-theme-mode='dark']) .summary-grid {
  --summary-card-active-border: color-mix(in srgb, var(--accent-cool) 58%, white);
  --summary-card-active-sheen: color-mix(in srgb, var(--accent-cool) 24%, transparent);
  --summary-card-active-surface: color-mix(in srgb, var(--accent-cool) 16%, var(--b3-theme-surface));
  --summary-card-active-ring: color-mix(in srgb, var(--accent-cool) 30%, transparent);
  --summary-card-active-shadow: color-mix(in srgb, var(--accent-cool) 46%, transparent);
  --summary-card-active-strip-end: color-mix(in srgb, var(--b3-theme-primary) 72%, #d9f4ff);
  --summary-card-active-label: color-mix(in srgb, var(--accent-cool) 42%, white);
  --summary-card-active-value: color-mix(in srgb, var(--accent-cool) 34%, white);
  --summary-card-active-value-shadow: color-mix(in srgb, black 42%, transparent);
  --summary-card-active-toggle-border: color-mix(in srgb, var(--accent-cool) 42%, transparent);
  --summary-card-active-toggle-bg: color-mix(in srgb, var(--accent-cool) 16%, var(--surface-card));
  --summary-card-active-toggle-color: color-mix(in srgb, var(--accent-cool) 38%, white);
  --summary-card-focus-outline: color-mix(in srgb, var(--accent-cool) 60%, transparent);
}

.summary-card {
  position: relative;
  overflow: hidden;
  padding: 10px;
  min-width: 0;
  height: 100%;
  text-align: left;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s, background-color 0.2s;
  box-sizing: border-box;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
}

.summary-card--interactive {
  width: 100%;
  cursor: grab;
  color: inherit;
}

.summary-card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.12);
  border-color: color-mix(in srgb, var(--b3-theme-primary) 20%, transparent);
}

.summary-card--dragging {
  opacity: 0.6;
  cursor: grabbing;
}

.summary-card--drop-target {
  border-color: color-mix(in srgb, var(--accent-warm) 45%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-warm) 18%, transparent);
}

.summary-card--active {
  border-color: var(--summary-card-active-border);
  background:
    linear-gradient(180deg, var(--summary-card-active-sheen), transparent 58%),
    var(--summary-card-active-surface);
  box-shadow:
    0 0 0 1px var(--summary-card-active-ring),
    0 14px 28px -18px var(--summary-card-active-shadow);
  transform: translateY(-1px);
}

.summary-card--active::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  background: linear-gradient(90deg, var(--accent-cool), var(--summary-card-active-strip-end));
}

.summary-card--active .summary-card__label {
  color: var(--summary-card-active-label);
}

.summary-card--active .summary-card__value {
  color: var(--summary-card-active-value);
  text-shadow: 0 1px 0 var(--summary-card-active-value-shadow);
}

.summary-card--active .summary-card__toggle {
  color: var(--summary-card-active-toggle-color);
  border-color: var(--summary-card-active-toggle-border);
  background: var(--summary-card-active-toggle-bg);
}

.summary-card__label {
  font-size: 13px;
  color: var(--panel-muted);
  font-weight: 500;
}

.summary-card__frame {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.summary-card__main {
  flex: 1;
  min-width: 0;
  border: 0;
  border-radius: 12px;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-card__main:focus-visible,
.summary-card__toggle:focus-visible {
  outline: 2px solid var(--summary-card-focus-outline);
  outline-offset: 3px;
}

.summary-card__toggle {
  flex: none;
  width: 20px;
  height: 20px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 16%, transparent);
  border-radius: 999px;
  padding: 0;
  background: color-mix(in srgb, var(--b3-theme-primary) 6%, var(--surface-card));
  color: var(--panel-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s, transform 0.2s;
}

.summary-card__toggle:hover {
  color: var(--b3-theme-primary);
  border-color: color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, var(--surface-card));
  transform: rotate(18deg);
}

.summary-card__toggle-icon {
  width: 10px;
  height: 10px;
}

.summary-card__value {
  font-size: 32px;
  line-height: 1;
  font-weight: 600;
  color: var(--b3-theme-primary);
}
</style>
