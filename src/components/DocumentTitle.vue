<template>
  <div :class="['document-title', `document-title--${variant}`]">
    <button
      :class="buttonClass"
      type="button"
      @click="openDocument(documentId)"
    >
      {{ title }}
    </button>
    <span
      v-if="isThemeDocument"
      class="document-title__marker"
    >
      {{ t('shared.topicDoc') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n/ui'

const props = withDefaults(defineProps<{
  title: string
  documentId: string
  openDocument: (documentId: string) => void
  isThemeDocument?: boolean
  variant?: 'default' | 'compact'
}>(), {
  isThemeDocument: false,
  variant: 'default',
})

const buttonClass = computed(() => {
  return [
    'document-title__button',
    `document-title__button--${props.variant}`,
  ]
})
</script>

<style scoped>
.document-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.document-title--compact {
  gap: 6px;
}

.document-title__button {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--b3-theme-primary);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: color 0.15s;
  min-width: 0;
}

.document-title__button:hover {
  color: color-mix(in srgb, var(--b3-theme-primary) 70%, transparent);
}

.document-title__button--default {
  font-weight: 600;
  font-size: 15px;
}

.document-title__button--compact {
  font-weight: 500;
}

.document-title__marker {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--accent-cool, #227c9d) 78%, var(--b3-theme-on-background));
  background: color-mix(in srgb, var(--accent-cool, #227c9d) 14%, var(--b3-theme-surface));
  border: 1px solid color-mix(in srgb, var(--accent-cool, #227c9d) 24%, transparent);
  white-space: nowrap;
}
</style>
