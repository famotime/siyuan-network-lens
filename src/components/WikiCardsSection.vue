<script setup lang="ts">
import type { WikiIndexPage, WikiChatScope } from '@/analytics/wiki-index'
import { t } from '@/i18n/ui'
import DocumentTitle from './DocumentTitle.vue'

const props = defineProps<{
  pages: WikiIndexPage[]
  openDocument: (documentId: string) => void
  formatTimestamp: (timestamp?: string) => string
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
        <DocumentTitle
          :document-id="page.documentId"
          :title="page.title"
          :open-document="props.openDocument"
          :is-theme-document="!!page.themeDocumentTitle"
          :marker="t('shared.llmWikiDoc')"
          variant="compact"
        />
      </div>
      <div class="wiki-card__meta">
        <span>{{ t('rankingPanel.connectionSummary', { inbound: page.inboundReferences ?? 0, sources: page.inboundReferences ?? 0, outbound: page.outboundReferences ?? 0, children: page.childDocumentCount ?? 0 }) }}</span>
      </div>
      <div class="wiki-card__timestamps">
        <span>{{ t('rankingPanel.created') }}: {{ props.formatTimestamp(page.createdAt) }}</span>
        <span>{{ t('rankingPanel.updated') }}: {{ props.formatTimestamp(page.updatedAt) }}</span>
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
.action-button {
  border: 0;
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s;
  font-weight: 500;
  min-width: 108px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
}
.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
.wiki-cards-section__empty {
  color: var(--panel-muted);
  padding: 24px;
  text-align: center;
}
.wiki-card {
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
  margin-bottom: 8px;
  display: grid;
  gap: 6px;
}
.wiki-card:hover {
  background: var(--surface-card-soft);
}
.wiki-card__header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.wiki-card__meta,
.wiki-card__timestamps {
  color: var(--panel-muted);
  font-size: 13px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.wiki-card__timestamps {
  row-gap: 4px;
}
.wiki-card__maintenance-summary {
  font-size: 13px;
  color: var(--panel-muted);
}
.wiki-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.ghost-button {
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.ghost-button:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
}
.ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.wiki-card__action-btn {
  min-width: auto;
}
</style>
