<template>
  <label class="summary-detail-sort">
    <span>{{ t('summaryDetail.sort.label') }}</span>
    <select
      class="summary-detail-sort__select"
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as DocumentSortMode)"
    >
      <option value="updated-desc">{{ t('summaryDetail.sort.updatedDesc') }}</option>
      <option value="updated-asc">{{ t('summaryDetail.sort.updatedAsc') }}</option>
      <option value="created-desc">{{ t('summaryDetail.sort.createdDesc') }}</option>
      <option value="created-asc">{{ t('summaryDetail.sort.createdAsc') }}</option>
      <option value="title-asc">{{ t('summaryDetail.sort.titleAsc') }}</option>
      <option value="title-desc">{{ t('summaryDetail.sort.titleDesc') }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { t } from '@/i18n/ui'

export type DocumentSortMode = 'updated-desc' | 'updated-asc' | 'created-desc' | 'created-asc' | 'title-asc' | 'title-desc'

defineProps<{
  modelValue: DocumentSortMode
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: DocumentSortMode): void
}>()
</script>

<style scoped>
.summary-detail-sort {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--panel-muted);
}

.summary-detail-sort__select {
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--surface-card);
  color: inherit;
  font-size: 13px;
}
</style>
