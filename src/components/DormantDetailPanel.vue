<template>
  <div class="dormant-detail">
    <div class="dormant-detail__controls">
      <span>{{ t('shared.dormantThreshold') }}</span>
      <select
        class="dormant-detail__select"
        :value="dormantDays"
        @change="onDaysChange"
      >
        <option :value="30">{{ t('shared.days30') }}</option>
        <option :value="90">{{ t('shared.days90') }}</option>
        <option :value="180">{{ t('shared.days180') }}</option>
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
      {{ t('shared.noDocsUnderCard') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n/ui'
import type { SummaryDetailItem } from '@/analytics/summary-details'
import DocumentTitle from './DocumentTitle.vue'
import SuggestionCallout from './SuggestionCallout.vue'

const props = defineProps<{
  items: SummaryDetailItem[]
  dormantDays: number
  onUpdateDormantDays: (value: number) => void
  openDocument: (documentId: string) => void
}>()

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
