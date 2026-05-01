<template>
  <div class="reference-analytics">
    <div class="hero">
      <div class="hero__header">
        <div class="hero__intro">
          <div class="hero__copy-block">
            <p class="eyebrow">{{ pluginEyebrow }}</p>
            <h1>{{ pluginTitle }}</h1>
          </div>
          <div class="hero__icon-shell">
            <img
              class="hero__icon"
              :src="pluginIconUrl"
              :alt="pluginIconAlt"
            >
          </div>
        </div>
        <div class="hero__actions">
          <button
            class="action-button"
            type="button"
            :disabled="loading"
            @click="refresh"
          >
            {{ loading ? t('app.analyzing') : t('app.refreshAnalysis') }}
          </button>
          <button
            class="ghost-button hero__reset-button"
            type="button"
            :disabled="loading || !visibleSummaryCards.length"
            @click="resetSummaryCardOrder"
          >
            {{ t('app.resetOrder') }}
          </button>
        </div>
      </div>
      <p class="hero__tagline">
        {{ pluginTagline }}
      </p>
    </div>

    <div class="filter-panel">
      <div class="filter-panel__row filter-panel__row--meta">
        <label class="filter-item">
          <span>{{ t('app.filter.timeWindow') }}</span>
          <FilterSelect
            v-model="timeRange"
            :options="timeRangeFilterOptions"
          />
        </label>
        <label class="filter-item">
          <span>{{ t('app.filter.notebook') }}</span>
          <FilterSelect
            v-model="selectedNotebook"
            :options="notebookFilterOptions"
            :empty-label="t('app.filter.noNotebooks')"
          />
        </label>
        <label class="filter-item">
          <span>{{ t('app.filter.tags') }}</span>
          <ThemeMultiSelect
            v-model="selectedTags"
            :options="tagFilterOptions"
            :all-label="t('app.filter.allTags')"
            :empty-label="t('app.filter.noTags')"
            :selection-unit="t('app.filter.tagUnit')"
          />
        </label>
      </div>

      <div class="filter-panel__row filter-panel__row--focus">
        <label class="filter-item filter-item--theme">
          <span>{{ t('app.filter.topics') }}</span>
          <ThemeMultiSelect
            v-model="selectedThemes"
            :options="themeOptions"
          />
        </label>
        <label class="filter-item filter-item--keyword">
          <span>{{ t('app.filter.keyword') }}</span>
          <input
            v-model.trim="keyword"
            :placeholder="t('app.filter.keywordPlaceholder')"
            type="search"
          >
        </label>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="state-banner state-banner--error"
    >
      {{ errorMessage }}
    </div>

    <div
      v-else-if="loading && !report"
      class="loading-panel panel"
      role="status"
      aria-live="polite"
    >
      <div class="loading-panel__header">
        <div class="loading-panel__copy">
          <p class="loading-panel__eyebrow">
            {{ t('app.loading.contextEyebrow') }}
          </p>
          <h2 class="loading-panel__title">
            {{ t('app.loading.contextTitle') }}
          </h2>
          <p class="loading-panel__description">
            {{ t('app.loading.contextDescription') }}
          </p>
        </div>
        <div
          class="loading-panel__pulse"
          aria-hidden="true"
        >
          <span class="loading-panel__pulse-core" />
        </div>
      </div>

      <div
        class="loading-panel__chips"
        aria-hidden="true"
      >
        <span class="loading-panel__chip loading-shimmer" />
        <span class="loading-panel__chip loading-shimmer" />
        <span class="loading-panel__chip loading-shimmer" />
        <span class="loading-panel__chip loading-shimmer" />
      </div>

      <div
        class="loading-panel__cards"
        aria-hidden="true"
      >
        <div class="loading-panel__card loading-shimmer" />
        <div class="loading-panel__card loading-shimmer" />
        <div class="loading-panel__card loading-shimmer" />
        <div class="loading-panel__card loading-shimmer" />
      </div>

      <div
        class="loading-panel__detail"
        aria-hidden="true"
      >
        <div class="loading-panel__detail-head">
          <span class="loading-panel__line loading-panel__line--title loading-shimmer" />
          <span class="loading-panel__line loading-panel__line--meta loading-shimmer" />
        </div>
        <div class="loading-panel__detail-grid">
          <div class="loading-panel__detail-block loading-shimmer" />
          <div class="loading-panel__detail-block loading-shimmer" />
          <div class="loading-panel__detail-block loading-shimmer" />
        </div>
      </div>
    </div>

    <template v-else-if="report && trends">
      <SummaryCardsGrid
        v-if="visibleSummaryCards.length"
        :cards="visibleSummaryCards"
        :selected-summary-card-key="selectedSummaryCardKey"
        :read-card-mode="readCardMode"
        :large-document-card-mode="largeDocumentCardMode"
        :on-select-summary-card="selectSummaryCard"
        :on-toggle-read-card-mode="toggleReadCardMode"
        :on-toggle-large-document-card-mode="toggleLargeDocumentCardMode"
        :on-reorder-summary-card="reorderSummaryCard"
      />

      <SummaryDetailSection
        v-if="visibleSummaryCards.length && selectedSummaryDetail"
        :detail="selectedSummaryDetail"
        :selected-summary-count="selectedSummaryCount"
        :is-expanded="isPanelExpanded('summary-detail')"
        :on-toggle-panel="() => togglePanel('summary-detail')"
        :ai-suggestion-enabled="Boolean(props.config.aiEnabled)"
        :ai-suggestion-configured="aiConfigReady"
        :ai-suggestion-loading="aiInboxLoading"
        :ai-suggestion-error="aiInboxError"
        :generate-ai-inbox="generateAiInbox"
        :ai-inbox-history="aiInboxHistory"
        :selected-ai-inbox-history-id="selectedAiInboxHistoryId"
        :select-ai-inbox-history="selectAiInboxHistory"
        :orphan-detail-items="orphanDetailItems"
        :orphan-theme-suggestions="orphanThemeSuggestions"
        :orphan-sort="orphanSort"
        :on-update-orphan-sort="updateOrphanSort"
        :dormant-days="dormantDays"
        :on-update-dormant-days="updateDormantDays"
        :open-document="openDocument"
        :toggle-orphan-theme-suggestion="toggleOrphanThemeSuggestion"
        :is-theme-suggestion-active="isThemeSuggestionActive"
        :toggle-orphan-ai-link-suggestion="toggleOrphanAiLinkSuggestion"
        :is-ai-link-suggestion-active="isAiLinkSuggestionActive"
        :toggle-orphan-ai-tag-suggestion="toggleOrphanAiTagSuggestion"
        :is-ai-tag-suggestion-active="isAiTagSuggestionActive"
        :ai-enabled="Boolean(props.config.aiEnabled)"
        :ai-link-suggestion-config-ready="aiLinkSuggestionConfigReady"
        :orphan-ai-suggestion-states="orphanAiSuggestionStates"
        :generate-orphan-ai-suggestion="generateOrphanAiSuggestion"
        :read-card-mode="readCardMode"
        :path-scope="pathScope"
        :on-update-path-scope="updatePathScope"
        :max-path-depth="maxPathDepth"
        :on-update-max-path-depth="updateMaxPathDepth"
        :from-document-id="fromDocumentId"
        :on-update-from-document-id="updateFromDocumentId"
        :to-document-id="toDocumentId"
        :on-update-to-document-id="updateToDocumentId"
        :path-options="pathOptions"
        :path-chain="pathChain"
        :resolve-title="resolveTitle"
        :snapshot-label="snapshotLabel"
        :format-timestamp="formatTimestamp"
        :toggle-link-panel="toggleLinkPanel"
        :is-link-panel-expanded="isLinkPanelExpanded"
        :resolve-link-associations="resolveLinkAssociations"
        :toggle-link-group="toggleLinkGroup"
        :is-link-group-expanded="isLinkGroupExpanded"
        :is-syncing="isSyncing"
        :sync-association="syncAssociation"
        :format-delta="formatDelta"
        :theme-document-ids="themeDocumentIds"
        :theme-documents="themeDocuments"
        :select-community="selectCommunity"
        :show-wiki-panel-actions="showWikiFeature"
        :wiki-panel-props="wikiPanelProps"
        :is-core-document-wiki-panel-visible="showWikiFeature ? isCoreDocumentWikiPanelVisible : () => false"
        :toggle-core-document-wiki-panel="showWikiFeature ? toggleCoreDocumentWikiPanel : () => {}"
        :show-document-index="Boolean(props.config.showDocumentIndex)"
        :generate-doc-index="generateDocIndex"
        :has-doc-index="hasDocIndex"
        :open-doc-index="openDocIndex"
      />
      <div
        v-if="showWikiFeature && visibleSummaryCards.length && selectedSummaryDetail?.key === 'documents'"
        class="detail-wiki-stack"
      >
        <button
          class="ghost-button ghost-button--filled detail-wiki-action"
          type="button"
          @click="toggleDocumentWikiPanel"
        >
          {{ wikiPanelPlacement === 'documents' ? t('app.wiki.hide') : t('app.wiki.maintain') }}
        </button>
        <WikiMaintainPanel
          v-if="wikiPanelPlacement === 'documents'"
          v-bind="wikiPanelProps"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { openTab, showMessage, type Plugin } from 'siyuan'

import FilterSelect from '@/components/FilterSelect.vue'
import SummaryCardsGrid from '@/components/SummaryCardsGrid.vue'
import SummaryDetailSection from '@/components/SummaryDetailSection.vue'
import ThemeMultiSelect from '@/components/ThemeMultiSelect.vue'
import WikiMaintainPanel from '@/components/WikiMaintainPanel.vue'
import { isSummaryCardVisible } from '@/analytics/summary-card-config'
import { pickOppositePluginText, pickPluginText } from '@/i18n/plugin'
import { useAnalyticsState } from '@/composables/use-analytics'
import { createAppWikiPanelController } from '@/composables/use-app-wiki-panel'
import { appendBlock, createDocWithMd, deleteBlock, forwardProxy, getBlockAttrs, getBlockKramdown, getChildBlocks, getIDsByHPath, prependBlock, setBlockAttrs, updateBlock } from '@/api'
import { isAlphaSettingVisible, isAlphaSummaryCardVisible } from '@/plugin/alpha-feature-config'
import { t } from '@/i18n/ui'
import { ensureConfigDefaults, type PluginConfig } from '@/types/config'
import pluginIconUrl from '../icon.png'

const props = defineProps<{
  plugin: Plugin
  config: PluginConfig
}>()

ensureConfigDefaults(props.config)

const pluginTitle = computed(() => props.plugin.i18n?.pluginTitle ?? props.plugin.displayName ?? pickPluginText('pluginTitle'))
const pluginEyebrow = computed(() => pickOppositePluginText('pluginEyebrow'))
const pluginTagline = computed(() => props.plugin.i18n?.pluginTagline ?? pickPluginText('pluginTagline'))
const pluginIconAlt = computed(() => props.plugin.i18n?.pluginIconAlt ?? pickPluginText('pluginIconAlt'))

const analytics = useAnalyticsState({
  plugin: props.plugin,
  config: props.config,
  openTab,
  showMessage,
  appendBlock,
  prependBlock,
  deleteBlock,
  updateBlock,
  createDocWithMd,
  getIDsByHPath,
  getChildBlocks,
  getBlockKramdown,
  getBlockAttrs,
  setBlockAttrs,
  forwardProxy,
})

const {
  loading,
  errorMessage,
  timeRange,
  timeRangeOptions,
  selectedNotebook,
  selectedTags,
  selectedThemes,
  themeOptions,
  keyword,
  orphanSort,
  dormantDays,
  fromDocumentId,
  toDocumentId,
  pathScope,
  maxPathDepth,
  selectedSummaryCardKey,
  readCardMode,
  largeDocumentCardMode,
  notebookOptions,
  tagOptions,
  filteredDocuments,
  report,
  trends,
  selectedCommunity,
  selectedCommunityTrend,
  summaryCards,
  selectedSummaryDetail,
  selectedSummaryCount,
  themeDocuments,
  themeDocumentIds,
  orphanDetailItems,
  orphanThemeSuggestions,
  orphanAiSuggestionStates,
  pathOptions,
  pathChain,
  panelCounts,
  snapshotLabel,
  aiConfigReady,
  aiLinkSuggestionConfigReady,
  aiInboxLoading,
  aiInboxError,
  aiInboxHistory,
  selectedAiInboxHistoryId,
  wikiPreviewLoading,
  wikiApplyLoading,
  wikiError,
  wikiPreview,
  refresh,
  generateAiInbox,
  prepareWikiPreview,
  applyWikiChanges,
  generateOrphanAiSuggestion,
  selectEvidence,
  selectCommunity,
  selectSummaryCard,
  selectAiInboxHistory,
  toggleReadCardMode,
  toggleLargeDocumentCardMode,
  reorderSummaryCard,
  resetSummaryCardOrder,
  resolveLinkAssociations,
  toggleLinkPanel,
  isLinkPanelExpanded,
  toggleLinkGroup,
  isLinkGroupExpanded,
  isSyncing,
  syncAssociation,
  togglePanel,
  isPanelExpanded,
  resolveTitle,
  resolveNotebookName,
  openDocument,
  openWikiDocument,
  generateDocIndex,
  hasDocIndex,
  openDocIndex,
  formatTimestamp,
  formatDelta,
  toggleOrphanThemeSuggestion,
  isThemeSuggestionActive,
  toggleOrphanAiLinkSuggestion,
  isAiLinkSuggestionActive,
  toggleOrphanAiTagSuggestion,
  isAiTagSuggestionActive,
} = analytics

const {
  wikiPanelPlacement,
  isCoreDocumentWikiPanelVisible,
  prepareCurrentWikiPreview,
  toggleDocumentWikiPanel,
  toggleCoreDocumentWikiPanel,
} = createAppWikiPanelController({
  filteredDocuments,
  resolveLinkAssociations,
  resolveTitle,
  prepareWikiPreview,
})

const wikiPanelProps = computed(() => ({
  wikiEnabled: Boolean(props.config.wikiEnabled),
  aiEnabled: Boolean(props.config.aiEnabled),
  aiConfigReady: aiConfigReady.value,
  previewLoading: wikiPreviewLoading.value,
  applyLoading: wikiApplyLoading.value,
  error: wikiError.value,
  preview: wikiPreview.value,
  prepareWikiPreview: prepareCurrentWikiPreview,
  applyWikiChanges,
  openWikiDocument,
}))
const showWikiFeature = isAlphaSettingVisible('llm-wiki')

const visibleSummaryCards = computed(() => {
  if (!props.config.showSummaryCards) {
    return []
  }
  return summaryCards.value.filter(card => isSummaryCardVisible(props.config, card.key) && isAlphaSummaryCardVisible(card.key))
})

const timeRangeFilterOptions = computed(() => timeRangeOptions.value.map(option => ({
  value: option.value,
  label: option.label,
})))

const notebookFilterOptions = computed(() => [
  { value: '', label: t('app.filter.allNotebooks') },
  ...notebookOptions.value.map(notebook => ({
    value: notebook.id,
    label: notebook.name,
  })),
])

const tagFilterOptions = computed(() => tagOptions.value.map(tag => ({
  value: tag,
  label: tag,
  key: tag,
})))

watch(visibleSummaryCards, (cards) => {
  if (cards.length === 0) {
    return
  }
  if (!cards.some(card => card.key === selectedSummaryCardKey.value)) {
    selectSummaryCard(cards[0].key)
  }
}, { immediate: true })

function updateOrphanSort(value: typeof orphanSort.value) {
  orphanSort.value = value
}

function updateDormantDays(value: number) {
  dormantDays.value = value
}

function updatePathScope(value: typeof pathScope.value) {
  pathScope.value = value
}

function updateMaxPathDepth(value: number) {
  maxPathDepth.value = value
}

function updateFromDocumentId(value: string) {
  fromDocumentId.value = value
}

function updateToDocumentId(value: string) {
  toDocumentId.value = value
}
</script>

<style lang="scss" scoped>
.reference-analytics {
  --panel-border: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  --panel-strong: color-mix(in srgb, var(--b3-theme-primary) 12%, var(--b3-theme-surface));
  --panel-soft: color-mix(in srgb, var(--b3-theme-primary) 4%, var(--b3-theme-surface));
  --panel-muted: color-mix(in srgb, var(--b3-theme-on-surface) 60%, transparent);
  --surface-card: var(--b3-theme-surface);
  --surface-card-strong: color-mix(in srgb, var(--b3-theme-surface) 96%, var(--b3-theme-background));
  --surface-card-soft: color-mix(in srgb, var(--b3-theme-surface) 90%, var(--b3-theme-background));
  --surface-chip-warm: color-mix(in srgb, var(--accent-warm) 14%, var(--b3-theme-surface));
  --surface-chip-cool: color-mix(in srgb, var(--accent-cool) 10%, var(--b3-theme-surface));
  --accent-warm: #e77b45;
  --accent-cool: #227c9d;
  height: 100%;
  overflow: auto;
  padding: 24px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  box-sizing: border-box;
}

.hero,
.filter-panel,
.summary-grid,
.layout-grid {
  width: 100%;
}

.hero {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}

.hero__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.hero__intro {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.hero__copy-block {
  min-width: 0;
}

.hero__icon-shell {
  flex: none;
  width: 48px;
  height: 48px;
}

.hero__icon {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hero__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-cool) 80%, var(--b3-theme-on-background));
  font-weight: 500;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: 26px;
  line-height: 1.2;
  font-weight: 600;
}

.hero__tagline {
  width: 100%;
  color: var(--panel-muted);
  line-height: 1.6;
}

.summary-grid,
.layout-grid {
  display: grid;
  gap: 16px;
}

.filter-panel {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
}

.filter-panel__row {
  display: grid;
  gap: 16px;
}

.filter-panel__row--meta {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.filter-panel__row--focus {
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  align-items: start;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card);
  transition: border-color 0.2s;
}

.filter-item:hover {
  border-color: color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
}

.filter-item span {
  font-size: 12px;
  color: var(--panel-muted);
  font-weight: 500;
}

select,
input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font-size: 14px;
}

.filter-item--theme {
  min-height: auto;
}

.summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  align-items: stretch;
  margin-bottom: 24px;
}

.summary-card,
.panel,
.state-banner {
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
}

.summary-card {
  padding: 10px;
  min-width: 0;
  height: 100%;
  text-align: left;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  box-sizing: border-box;
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
  border-color: color-mix(in srgb, var(--accent-cool) 40%, transparent);
  background: color-mix(in srgb, var(--accent-cool) 5%, var(--b3-theme-surface));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-cool) 10%, transparent);
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

.layout-grid {
  grid-template-columns: 1fr;
  align-items: start;
  gap: 20px;
}

.panel {
  padding: 24px;
}

.panel--primary {
  grid-column: span 1;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.panel-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.panel-header p,
.meta-text {
  color: var(--panel-muted);
  font-size: 13px;
}

.meta-text {
  font-size: 12px;
  white-space: nowrap;
}

.community-list,
.propagation-list,
.summary-detail-list {
  display: grid;
  gap: 12px;
}

.community-item,
.propagation-item,
.summary-detail-item {
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s;
}

.community-item:hover,
.propagation-item:hover,
.summary-detail-item:hover {
  background: var(--surface-card-soft);
}

.propagation-item__title,
.mini-list__item,
.community-tag,
.path-node {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--b3-theme-primary);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: color 0.15s;
}

.propagation-item__title:hover {
  color: color-mix(in srgb, var(--b3-theme-primary) 70%, transparent);
}

.propagation-item__title {
  font-weight: 600;
  font-size: 15px;
}

.community-item__header,
.community-detail__header,
.propagation-item__header,
.summary-detail-item__header,
.path-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-detail-item__header {
  align-items: center;
  justify-content: space-between;
}

.panel-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.panel-toggle {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-card-soft);
  color: var(--b3-theme-on-background);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s, color 0.2s;
}

.panel-toggle:hover {
  background: var(--surface-card);
}

.panel-toggle__caret {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.panel-toggle[aria-expanded='false'] .panel-toggle__caret {
  transform: rotate(-45deg);
}

.badge,
.community-tag,
.path-node {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-weight: 500;
}

.badge {
  width: fit-content;
  font-size: 12px;
  background: var(--surface-chip-warm);
  color: color-mix(in srgb, var(--accent-warm) 60%, var(--b3-theme-on-background));
}

.community-tags,
.path-chain {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.community-tag,
.path-node {
  background: var(--surface-chip-cool);
  font-size: 13px;
  color: color-mix(in srgb, var(--accent-cool) 70%, var(--b3-theme-on-background));
}

.community-tag:hover,
.path-node:hover {
  background: color-mix(in srgb, var(--surface-chip-cool) 80%, var(--b3-theme-primary));
}

.mini-list,
.trend-list {
  display: grid;
  gap: 10px;
}

.mini-list__entry,
.community-detail,
.detail-card {
  padding: 14px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
}

.mini-list__item {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface-card-soft);
  font-weight: 500;
  transition: background-color 0.2s;
}

.mini-list__item:hover {
  background: var(--surface-card-strong);
}

.mini-list__entry {
  display: grid;
  gap: 6px;
}

.mini-list__meta,
.community-item__meta,
.community-item__warning,
.propagation-item__meta,
.summary-detail-item__meta,
.community-detail p,
.detail-card span {
  margin: 0;
  font-size: 12px;
  color: var(--panel-muted);
}

.community-item--active {
  border-color: color-mix(in srgb, var(--accent-cool) 40%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-cool) 15%, transparent);
}

.community-item__warning {
  color: #db7a4d;
}

.community-detail {
  margin-top: 16px;
  display: grid;
  gap: 8px;
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
}

.trend-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.trend-stats__card {
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 10px 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--b3-theme-primary) 4%, transparent), transparent 55%),
    var(--surface-card-strong);
}

.trend-stats__label {
  margin: 0;
}

.trend-stats__value {
  font-size: 26px;
}

.trend-section-card {
  display: grid;
  gap: 12px;
  align-content: start;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-accent, var(--b3-theme-primary)) 7%, transparent), transparent 42%),
    var(--surface-card-strong);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--b3-theme-background) 60%, transparent);
}

.trend-section-card--warm {
  --card-accent: var(--accent-warm);
}

.trend-section-card--cool {
  --card-accent: var(--accent-cool);
}

.trend-section-card--accent {
  --card-accent: var(--b3-theme-primary);
}

.trend-section-card--muted {
  --card-accent: color-mix(in srgb, var(--b3-theme-on-background) 45%, transparent);
}

.trend-section-card--neutral {
  --card-accent: color-mix(in srgb, var(--b3-theme-primary) 45%, var(--accent-warm));
}

.trend-section-card__eyebrow {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--card-accent, var(--b3-theme-primary)) 52%, var(--panel-muted));
  font-weight: 700;
}

.trend-section-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.trend-section-card__empty {
  padding: 16px 14px;
  border-radius: 12px;
  border: 1px dashed var(--panel-border);
  background: color-mix(in srgb, var(--surface-card) 78%, transparent);
  color: var(--panel-muted);
  font-size: 13px;
}

.trend-record {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--card-accent, var(--b3-theme-primary)) 16%, var(--panel-border));
  background: var(--surface-card);
  transition: border-color 0.2s, background-color 0.2s;
}

.trend-record:hover {
  background: var(--surface-card-soft);
  border-color: color-mix(in srgb, var(--card-accent, var(--b3-theme-primary)) 30%, var(--panel-border));
}

.trend-record__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.trend-record__button {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--b3-theme-primary);
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  transition: color 0.15s;
}

.trend-record__button:hover {
  color: color-mix(in srgb, var(--b3-theme-primary) 70%, transparent);
}

.trend-record__meta {
  margin: 0;
  font-size: 12px;
  color: var(--panel-muted);
}

.trend-record__delta,
.trend-record__badge {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
}

.trend-record__delta--positive {
  color: color-mix(in srgb, var(--accent-warm) 62%, var(--b3-theme-on-background));
  background: color-mix(in srgb, var(--accent-warm) 14%, var(--b3-theme-surface));
}

.trend-record__delta--negative {
  color: color-mix(in srgb, var(--accent-cool) 74%, var(--b3-theme-on-background));
  background: color-mix(in srgb, var(--accent-cool) 12%, var(--b3-theme-surface));
}

.trend-record__badge {
  color: color-mix(in srgb, var(--b3-theme-on-background) 72%, transparent);
  background: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.detail-card {
  display: grid;
  gap: 6px;
}

.path-controls label {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
}

.path-controls span {
  font-size: 13px;
  color: var(--panel-muted);
  font-weight: 500;
}

.action-button,
.ghost-button {
  border: 0;
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  letter-spacing: 0;
  white-space: nowrap;
  width: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s;
  font-weight: 500;
}

.action-button {
  min-width: 108px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
}

.action-button:hover:not(:disabled) {
  opacity: 0.9;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: progress;
  box-shadow: none;
}

.ghost-button {
  min-width: 108px;
  padding: 6px 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--b3-theme-primary) 8%, transparent);
  color: var(--b3-theme-primary);
}

.ghost-button--filled {
  background: color-mix(in srgb, var(--b3-theme-primary) 9%, var(--surface-card));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 50%, transparent);
}

.ghost-button:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
}

.ghost-button--filled:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 16%, var(--surface-card));
}

.ghost-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.detail-wiki-stack {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.state-banner,
.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--panel-muted);
  background: var(--surface-card);
  border-radius: 12px;
  border: 1px dashed var(--panel-border);
}

.state-banner--error {
  color: var(--b3-theme-error);
  border-color: color-mix(in srgb, var(--b3-theme-error) 40%, transparent);
  background: color-mix(in srgb, var(--b3-theme-error) 5%, var(--b3-theme-surface));
}

.loading-panel {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 22px;
  padding: 24px;
  margin-bottom: 24px;
  border-color: color-mix(in srgb, var(--accent-cool) 18%, var(--panel-border));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-cool) 12%, transparent), transparent 32%),
    linear-gradient(180deg, color-mix(in srgb, var(--b3-theme-primary) 5%, transparent), transparent 38%),
    var(--surface-card-strong);
  box-shadow:
    0 12px 30px -24px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 color-mix(in srgb, var(--b3-theme-background) 48%, transparent);
}

.loading-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, transparent 0%, color-mix(in srgb, white 10%, transparent) 22%, transparent 44%);
  transform: translateX(-100%);
  animation: loading-panel-sheen 2.8s ease-in-out infinite;
  pointer-events: none;
}

.loading-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.loading-panel__copy {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.loading-panel__eyebrow {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-cool) 68%, var(--panel-muted));
  font-weight: 700;
}

.loading-panel__title {
  font-size: 22px;
  line-height: 1.25;
}

.loading-panel__description {
  max-width: 48ch;
  color: var(--panel-muted);
  line-height: 1.7;
}

.loading-panel__pulse {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--accent-cool) 18%, transparent) 0%, transparent 64%);
}

.loading-panel__pulse-core {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-cool) 74%, var(--b3-theme-primary));
  box-shadow:
    0 0 0 0 color-mix(in srgb, var(--accent-cool) 28%, transparent),
    0 0 18px color-mix(in srgb, var(--accent-cool) 34%, transparent);
  animation: loading-panel-pulse 1.8s ease-out infinite;
}

.loading-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.loading-panel__chip {
  display: inline-flex;
  width: 108px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, transparent);
  background: color-mix(in srgb, var(--surface-card) 88%, transparent);
}

.loading-panel__chip:nth-child(2) {
  width: 84px;
}

.loading-panel__chip:nth-child(3) {
  width: 132px;
}

.loading-panel__chip:nth-child(4) {
  width: 96px;
}

.loading-panel__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.loading-panel__card {
  height: 110px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-cool) 8%, transparent), transparent 44%),
    var(--surface-card);
}

.loading-panel__detail {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 88%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--b3-theme-primary) 5%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface-card) 92%, var(--b3-theme-background));
}

.loading-panel__detail-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.loading-panel__line {
  display: inline-flex;
  height: 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-card-soft) 88%, transparent);
}

.loading-panel__line--title {
  width: min(220px, 42%);
  height: 14px;
}

.loading-panel__line--meta {
  width: min(110px, 24%);
}

.loading-panel__detail-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 12px;
}

.loading-panel__detail-block {
  min-height: 104px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-card-soft) 86%, transparent), transparent),
    var(--surface-card);
}

.loading-shimmer {
  position: relative;
  overflow: hidden;
}

.loading-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 0%,
    color-mix(in srgb, white 18%, transparent) 28%,
    transparent 56%
  );
  transform: translateX(-100%);
  animation: loading-shimmer 1.8s ease-in-out infinite;
}

@keyframes loading-shimmer {
  to {
    transform: translateX(100%);
  }
}

@keyframes loading-panel-sheen {
  0%,
  18% {
    transform: translateX(-100%);
  }

  42%,
  100% {
    transform: translateX(100%);
  }
}

@keyframes loading-panel-pulse {
  0% {
    transform: scale(0.92);
    box-shadow:
      0 0 0 0 color-mix(in srgb, var(--accent-cool) 28%, transparent),
      0 0 18px color-mix(in srgb, var(--accent-cool) 34%, transparent);
  }

  70% {
    transform: scale(1);
    box-shadow:
      0 0 0 16px color-mix(in srgb, var(--accent-cool) 0%, transparent),
      0 0 24px color-mix(in srgb, var(--accent-cool) 20%, transparent);
  }

  100% {
    transform: scale(0.92);
    box-shadow:
      0 0 0 0 color-mix(in srgb, var(--accent-cool) 0%, transparent),
      0 0 16px color-mix(in srgb, var(--accent-cool) 10%, transparent);
  }
}

@media (max-width: 980px) {
  .filter-panel,
  .summary-grid,
  .layout-grid,
  .trend-grid,
  .filter-panel__row--meta,
  .filter-panel__row--focus {
    grid-template-columns: 1fr;
  }

  .panel--primary {
    grid-column: span 1;
  }

  .hero__header {
    flex-direction: column;
    align-items: stretch;
  }

  .hero__intro {
    justify-content: space-between;
  }

  .hero__actions {
    align-items: stretch;
  }

  .loading-panel__header,
  .loading-panel__detail-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .loading-panel__detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
