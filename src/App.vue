<template>
  <div class="reference-analytics">
    <div class="hero">
      <div class="hero__intro">
        <div class="hero__copy-block">
          <p class="eyebrow">Context lens</p>
          <h1>脉络镜</h1>
          <p class="hero-copy">
            让隐没的知识，重现脉络
          </p>
        </div>
        <div class="hero__icon-shell">
          <img
            class="hero__icon"
            :src="pluginIconUrl"
            alt="脉络镜插件图标"
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
          {{ loading ? '分析中...' : '刷新分析' }}
        </button>
        <button
          class="ghost-button hero__reset-button"
          type="button"
          :disabled="loading || !visibleSummaryCards.length"
          @click="resetSummaryCardOrder"
        >
          重置排序
        </button>
      </div>
    </div>

    <div class="filter-panel">
      <div class="filter-panel__row filter-panel__row--meta">
        <label class="filter-item">
          <span>时间窗口</span>
          <FilterSelect
            v-model="timeRange"
            :options="timeRangeFilterOptions"
          />
        </label>
        <label class="filter-item">
          <span>笔记本</span>
          <FilterSelect
            v-model="selectedNotebook"
            :options="notebookFilterOptions"
            empty-label="暂无笔记本"
          />
        </label>
        <label class="filter-item">
          <span>标签</span>
          <ThemeMultiSelect
            v-model="selectedTags"
            :options="tagFilterOptions"
            all-label="全部标签"
            empty-label="暂无标签"
            selection-unit="个标签"
          />
        </label>
      </div>

      <div class="filter-panel__row filter-panel__row--focus">
        <label class="filter-item filter-item--theme">
          <span>主题</span>
          <ThemeMultiSelect
            v-model="selectedThemes"
            :options="themeOptions"
          />
        </label>
        <label class="filter-item filter-item--keyword">
          <span>关键词</span>
          <input
            v-model.trim="keyword"
            placeholder="按标题、路径、标签筛选"
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
      class="state-banner"
    >
      正在读取 blocks 与 refs 数据...
    </div>

    <template v-else-if="report && trends">
      <SummaryCardsGrid
        v-if="visibleSummaryCards.length"
        :cards="visibleSummaryCards"
        :selected-summary-card-key="selectedSummaryCardKey"
        :read-card-mode="readCardMode"
        :on-select-summary-card="selectSummaryCard"
        :on-toggle-read-card-mode="toggleReadCardMode"
        :on-reorder-summary-card="reorderSummaryCard"
      />

      <SummaryDetailSection
        v-if="visibleSummaryCards.length && selectedSummaryDetail"
        :detail="selectedSummaryDetail"
        :selected-summary-count="selectedSummaryCount"
        :is-expanded="isPanelExpanded('summary-detail')"
        :on-toggle-panel="() => togglePanel('summary-detail')"
        :orphan-detail-items="orphanDetailItems"
        :orphan-sort="orphanSort"
        :on-update-orphan-sort="updateOrphanSort"
        :dormant-days="dormantDays"
        :on-update-dormant-days="updateDormantDays"
        :open-document="openDocument"
        :toggle-orphan-theme-suggestion="toggleOrphanThemeSuggestion"
        :is-theme-suggestion-active="isThemeSuggestionActive"
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
        :select-community="selectCommunity"
      />
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
import { useAnalyticsState } from '@/composables/use-analytics'
import { appendBlock, deleteBlock, getBlockKramdown, getChildBlocks, prependBlock, updateBlock } from '@/api'
import { ensureConfigDefaults, type PluginConfig } from '@/types/config'
import pluginIconUrl from '../icon.png'

const props = defineProps<{
  plugin: Plugin
  config: PluginConfig
}>()

ensureConfigDefaults(props.config)

const analytics = useAnalyticsState({
  plugin: props.plugin,
  config: props.config,
  openTab,
  showMessage,
  appendBlock,
  prependBlock,
  deleteBlock,
  updateBlock,
  getChildBlocks,
  getBlockKramdown,
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
  notebookOptions,
  tagOptions,
  report,
  trends,
  selectedCommunity,
  selectedCommunityTrend,
  summaryCards,
  selectedSummaryDetail,
  selectedSummaryCount,
  themeDocumentIds,
  orphanDetailItems,
  pathOptions,
  pathChain,
  panelCounts,
  snapshotLabel,
  refresh,
  selectEvidence,
  selectCommunity,
  selectSummaryCard,
  toggleReadCardMode,
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
  formatTimestamp,
  formatDelta,
  toggleOrphanThemeSuggestion,
  isThemeSuggestionActive,
} = analytics

const visibleSummaryCards = computed(() => {
  if (!props.config.showSummaryCards) {
    return []
  }
  return summaryCards.value.filter((card) => {
    if (card.key === 'documents') {
      return props.config.showDocuments
    }
    if (card.key === 'read') {
      return props.config.showRead
    }
    if (card.key === 'references') {
      return props.config.showReferences
    }
    if (card.key === 'ranking') {
      return props.config.showRanking
    }
    if (card.key === 'trends') {
      return props.config.showTrends
    }
    if (card.key === 'communities') {
      return props.config.showCommunities
    }
    if (card.key === 'propagation') {
      return props.config.showPropagation
    }
    if (card.key === 'orphans') {
      return props.config.showOrphans
    }
    if (card.key === 'dormant') {
      return props.config.showDormant
    }
    if (card.key === 'bridges') {
      return props.config.showBridges
    }
    return true
  })
})

const timeRangeFilterOptions = computed(() => timeRangeOptions.value.map(option => ({
  value: option.value,
  label: option.label,
})))

const notebookFilterOptions = computed(() => [
  { value: '', label: '全部笔记本' },
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
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 24px;
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
  gap: 8px;
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

.hero-copy {
  margin-top: 8px;
  max-width: 44ch;
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
  padding: 10px 18px;
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

.ghost-button:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
}

.ghost-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

  .hero {
    flex-direction: column;
    align-items: stretch;
  }

  .hero__intro {
    justify-content: space-between;
  }

  .hero__actions {
    align-items: stretch;
  }
}
</style>
