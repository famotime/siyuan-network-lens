<template>
  <div
    v-if="suggestions.length || Boolean($slots.default)"
    class="suggestion-callout"
  >
    <span class="suggestion-callout__heading">{{ t('shared.suggestions') }}</span>
    <div class="suggestion-callout__list">
      <div
        v-for="suggestion in suggestions"
        :key="`${suggestion.label}-${suggestion.text}`"
        class="suggestion-callout__item"
      >
        <span class="suggestion-callout__label">{{ suggestion.label }}</span>
        <p class="suggestion-callout__text">{{ suggestion.text }}</p>
      </div>
    </div>
    <div
      v-if="$slots.default"
      class="suggestion-callout__extra"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DetailSuggestion } from '@/analytics/summary-details'
import { t } from '@/i18n/ui'

defineProps<{
  suggestions: DetailSuggestion[]
}>()
</script>

<style scoped>
.suggestion-callout {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent-warm, var(--b3-theme-primary)) 24%, transparent);
  background: color-mix(in srgb, var(--accent-warm, var(--b3-theme-primary)) 10%, var(--surface-card-soft, var(--b3-theme-surface)));
}

.suggestion-callout__heading {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-warm, var(--b3-theme-primary)) 82%, var(--b3-theme-on-background));
  font-weight: 700;
}

.suggestion-callout__list {
  display: grid;
  gap: 8px;
}

.suggestion-callout__item {
  display: grid;
  gap: 4px;
}

.suggestion-callout__label {
  font-size: 12px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--b3-theme-on-background);
}

.suggestion-callout__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: color-mix(in srgb, var(--b3-theme-on-background) 78%, transparent);
}

.suggestion-callout__extra {
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--accent-warm, var(--b3-theme-primary)) 16%, transparent);
}
</style>
