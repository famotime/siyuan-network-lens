<script setup lang="ts">
import type { WikiIndexPage, WikiChatScope } from '@/analytics/wiki-index'
import { t } from '@/i18n/ui'

const props = defineProps<{
  pages: WikiIndexPage[]
}>()

const emit = defineEmits<{
  openChat: [scope: WikiChatScope]
  maintain: [page: WikiIndexPage]
}>()

function openTopicChat() {
  emit('openChat', { mode: 'topic' })
}

function openPageChat(page: WikiIndexPage) {
  emit('openChat', { mode: 'document', targetPage: page })
}

function maintainPage(page: WikiIndexPage) {
  emit('maintain', page)
}

function buildMaintenanceSummary(page: WikiIndexPage): string {
  if (!page.maintenanceState?.suggestions?.length) {
    return ''
  }
  const counts = new Map<string, number>()
  for (const s of page.maintenanceState.suggestions) {
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1)
  }
  const parts: string[] = []
  if (counts.get('broken-link')) {
    parts.push(`${t('llmWiki.maintain.brokenLink')} ×${counts.get('broken-link')}`)
  }
  if (counts.get('outdated-section')) {
    parts.push(`${t('llmWiki.maintain.outdatedSection')} ×${counts.get('outdated-section')}`)
  }
  if (counts.get('missing-reference')) {
    parts.push(`${t('llmWiki.maintain.missingReference')} ×${counts.get('missing-reference')}`)
  }
  return parts.join('、')
}
</script>

<template>
  <div class="wiki-cards-section">
    <div class="wiki-cards-section__header">
      <button
        class="action-button"
        @click="openTopicChat"
      >
        {{ t('llmWiki.chat.startChat') }}
      </button>
    </div>
    <div
      v-if="pages.length === 0"
      class="wiki-cards-section__empty"
    >
      {{ t('llmWiki.chat.noWikiPages') }}
    </div>
    <div
      v-for="page in pages"
      :key="page.documentId"
      class="wiki-card"
    >
      <div class="wiki-card__header">
        <span class="wiki-card__title">{{ page.title }}</span>
        <span
          v-if="page.themeDocumentTitle"
          class="wiki-card__theme"
        >{{ page.themeDocumentTitle }}</span>
      </div>
      <div
        v-if="page.maintenanceState?.suggestions?.length"
        class="wiki-card__maintenance-summary"
      >
        {{ buildMaintenanceSummary(page) }}
      </div>
      <div class="wiki-card__actions">
        <button
          class="ghost-button wiki-card__action-btn"
          @click="openPageChat(page)"
        >
          {{ t('llmWiki.chat.chatWithPage') }}
        </button>
        <button
          class="ghost-button wiki-card__action-btn"
          @click="maintainPage(page)"
        >
          {{ t('llmWiki.maintain.button') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wiki-cards-section {
  padding: 12px;
}
.wiki-cards-section__header {
  margin-bottom: 12px;
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
.wiki-cards-section__empty {
  color: var(--b3-theme-on-surface-light);
  padding: 24px;
  text-align: center;
}
.wiki-card {
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}
.wiki-card__header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}
.wiki-card__title {
  font-weight: 600;
}
.wiki-card__theme {
  font-size: 0.85em;
  color: var(--b3-theme-on-surface-light);
}
.wiki-card__maintenance-summary {
  font-size: 0.85em;
  color: var(--b3-theme-on-surface-light);
  margin-bottom: 6px;
}
.wiki-card__actions {
  display: flex;
  gap: 8px;
}
.wiki-card__action-btn {
  padding: 4px 10px;
  font-size: 12px;
  min-width: auto;
}
</style>
