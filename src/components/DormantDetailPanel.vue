<template>
  <div class="dormant-detail">
    <div class="dormant-detail__controls">
      <span>{{ uiText('Dormant threshold', '沉没阈值') }}</span>
      <select
        class="dormant-detail__select"
        :value="dormantDays"
        @change="onDaysChange"
      >
        <option :value="30">{{ uiText('30 days', '30 天') }}</option>
        <option :value="90">{{ uiText('90 days', '90 天') }}</option>
        <option :value="180">{{ uiText('180 days', '180 天') }}</option>
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
        <SuggestionCallout :suggestions="item.suggestions ?? []" />
      </article>
    </div>
    <div
      v-else
      class="empty-state"
    >
      {{ uiText('No docs to show under this card.', '当前卡片下暂无文档。') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { pickUiText } from '@/i18n/ui'
import type { SummaryDetailItem } from '@/analytics/summary-details'
import DocumentTitle from './DocumentTitle.vue'
import SuggestionCallout from './SuggestionCallout.vue'

const props = defineProps<{
  items: SummaryDetailItem[]
  dormantDays: number
  onUpdateDormantDays: (value: number) => void
  openDocument: (documentId: string) => void
}>()

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

function onDaysChange(event: Event) {
  const value = Number.parseInt((event.target as HTMLSelectElement).value, 10)
  if (!Number.isNaN(value)) {
    props.onUpdateDormantDays(value)
  }
}
</script>

<style scoped>
.dormant-detail {
  display: grid;
  gap: 12px;
}

.dormant-detail__controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--panel-muted);
}

.dormant-detail__select {
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--surface-card);
  color: inherit;
  font-size: 13px;
}
</style>
