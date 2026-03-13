<template>
  <div class="reference-analytics">
    <div class="hero">
      <div>
        <p class="eyebrow">Reference Analytics</p>
        <h1>引用网络分析器</h1>
        <p class="hero-copy">
          用文档级引用网络识别核心节点、主题社区、孤立内容和可执行整理动作。
        </p>
      </div>
      <button
        class="action-button"
        type="button"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? '分析中...' : '刷新分析' }}
      </button>
    </div>

    <div class="filter-panel">
      <label class="filter-item">
        <span>时间窗口</span>
        <select v-model="timeRange">
          <option
            v-for="option in timeRangeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
      <label class="filter-item">
        <span>笔记本</span>
        <select v-model="selectedNotebook">
          <option value="">全部笔记本</option>
          <option
            v-for="notebook in notebookOptions"
            :key="notebook.id"
            :value="notebook.id"
          >
            {{ notebook.name }}
          </option>
        </select>
      </label>
      <label class="filter-item">
        <span>标签</span>
        <select v-model="selectedTag">
          <option value="">全部标签</option>
          <option
            v-for="tag in tagOptions"
            :key="tag"
            :value="tag"
          >
            {{ tag }}
          </option>
        </select>
      </label>
      <label class="filter-item">
        <span>孤立排序</span>
        <select v-model="orphanSort">
          <option value="updated-desc">按更新时间</option>
          <option value="created-desc">按创建时间</option>
          <option value="title-asc">按标题</option>
        </select>
      </label>
      <label class="filter-item">
        <span>沉没阈值</span>
        <select v-model="dormantDays">
          <option :value="30">30 天</option>
          <option :value="90">90 天</option>
          <option :value="180">180 天</option>
        </select>
      </label>
      <label class="filter-item filter-item--wide">
        <span>主题/关键词</span>
        <input
          v-model.trim="keyword"
          placeholder="按标题、路径、标签筛选"
          type="search"
        >
      </label>
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
      <div v-if="visibleSummaryCards.length" class="summary-grid">
        <button
          v-for="card in visibleSummaryCards"
          :key="card.label"
          :class="['summary-card', 'summary-card--interactive', { 'summary-card--active': card.key === selectedSummaryCardKey }]"
          :title="card.hint"
          type="button"
          @click="selectSummaryCard(card.key)"
        >
          <span class="summary-card__label">{{ card.label }}</span>
          <strong class="summary-card__value">{{ card.value }}</strong>
        </button>
      </div>

      <section
        v-if="visibleSummaryCards.length && selectedSummaryDetail"
        class="panel"
      >
        <div class="panel-header">
          <div>
            <h2>{{ selectedSummaryDetail.title }}</h2>
            <p>{{ selectedSummaryDetail.description }}</p>
          </div>
          <div class="panel-header__actions">
            <span class="meta-text">{{ selectedSummaryCount }} 篇文档</span>
            <button
              class="panel-toggle"
              type="button"
              :aria-expanded="isPanelExpanded('summary-detail')"
              :aria-label="isPanelExpanded('summary-detail') ? '折叠详情' : '展开详情'"
              @click="togglePanel('summary-detail')"
            >
              {{ isPanelExpanded('summary-detail') ? '折叠' : '展开' }}
              <span
                class="panel-toggle__caret"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div
          v-show="isPanelExpanded('summary-detail')"
          class="summary-detail-body"
        >
          <template v-if="selectedSummaryDetail.kind === 'list'">
            <div
              v-if="selectedSummaryDetail.items.length"
              class="summary-detail-list"
            >
              <article
                v-for="item in selectedSummaryDetail.items"
                :key="`${selectedSummaryDetail.key}-${item.documentId}`"
                class="summary-detail-item"
              >
                <div class="summary-detail-item__header">
                  <button
                    class="summary-detail-item__title"
                    type="button"
                    @click="openDocument(item.documentId)"
                  >
                    {{ item.title }}
                  </button>
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
              </article>
            </div>
            <div
              v-else
              class="empty-state"
            >
              当前卡片下没有可展示的文档。
            </div>
          </template>
          <template v-else-if="selectedSummaryDetail.kind === 'propagation'">
            <div
              v-if="selectedSummaryDetail.items.length"
              class="summary-detail-list"
            >
              <article
                v-for="item in selectedSummaryDetail.items"
                :key="`${selectedSummaryDetail.key}-${item.documentId}`"
                class="summary-detail-item"
              >
                <div class="summary-detail-item__header">
                  <button
                    class="summary-detail-item__title"
                    type="button"
                    @click="openDocument(item.documentId)"
                  >
                    {{ item.title }}
                  </button>
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
              </article>
            </div>
            <div
              v-else
              class="empty-state"
            >
              当前卡片下没有可展示的传播节点。
            </div>

            <div class="propagation-path">
              <div class="propagation-path__header">
                <h3>关系传播路径</h3>
                <p>限定路径深度与范围，查看文档如何跨主题建立连接。</p>
              </div>
              <div class="path-controls">
                <label>
                  <span>范围</span>
                  <select v-model="pathScope">
                    <option value="focused">核心 + 桥接</option>
                    <option value="all">当前筛选全部文档</option>
                    <option value="community">当前社区</option>
                  </select>
                </label>
                <label>
                  <span>最大深度</span>
                  <select v-model="maxPathDepth">
                    <option :value="3">3</option>
                    <option :value="4">4</option>
                    <option :value="5">5</option>
                    <option :value="6">6</option>
                  </select>
                </label>
                <label>
                  <span>起点</span>
                  <select v-model="fromDocumentId">
                    <option
                      v-for="document in pathOptions"
                      :key="document.id"
                      :value="document.id"
                    >
                      {{ document.title }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>终点</span>
                  <select v-model="toDocumentId">
                    <option
                      v-for="document in pathOptions"
                      :key="document.id"
                      :value="document.id"
                    >
                      {{ document.title }}
                    </option>
                  </select>
                </label>
              </div>

              <div
                v-if="pathChain.length"
                class="path-chain"
              >
                <button
                  v-for="documentId in pathChain"
                  :key="documentId"
                  class="path-node"
                  type="button"
                  @click="openDocument(documentId)"
                >
                  {{ resolveTitle(documentId) }}
                </button>
              </div>
              <div
                v-else
                class="empty-state"
              >
                当前筛选条件下未找到可解释路径。
              </div>
            </div>
          </template>
          <template v-else-if="selectedSummaryDetail.kind === 'ranking'">
            <RankingPanel
              variant="detail"
              :ranking="selectedSummaryDetail.ranking"
              :panel-count="selectedSummaryDetail.ranking.length"
              :snapshot-label="snapshotLabel"
              :is-expanded="true"
              :on-toggle-panel="() => {}"
              :resolve-title="resolveTitle"
              :format-timestamp="formatTimestamp"
              :open-document="openDocument"
              :toggle-link-panel="toggleLinkPanel"
              :is-link-panel-expanded="isLinkPanelExpanded"
              :resolve-link-associations="resolveLinkAssociations"
              :toggle-link-group="toggleLinkGroup"
              :is-link-group-expanded="isLinkGroupExpanded"
              :is-syncing="isSyncing"
              :sync-association="syncAssociation"
            />
          </template>
          <template v-else-if="selectedSummaryDetail.kind === 'suggestions'">
            <div
              v-if="selectedSummaryDetail.suggestions.length"
              class="suggestion-list"
            >
              <article
                v-for="item in selectedSummaryDetail.suggestions"
                :key="`${item.type}-${item.documentId}`"
                class="suggestion-item"
              >
                <span class="badge">{{ SUGGESTION_TYPE_LABELS[item.type] }}</span>
                <button
                  class="suggestion-item__title"
                  type="button"
                  @click="openDocument(item.documentId)"
                >
                  {{ item.title }}
                </button>
                <p>{{ item.reason }}</p>
              </article>
            </div>
            <div
              v-else
              class="empty-state"
            >
              当前没有需要优先处理的建议项。
            </div>
          </template>
          <template v-else-if="selectedSummaryDetail.kind === 'trends'">
            <div class="trend-stats">
              <div>
                <span>当前窗口</span>
                <strong>{{ selectedSummaryDetail.trends.current.referenceCount }}</strong>
              </div>
              <div>
                <span>前一窗口</span>
                <strong>{{ selectedSummaryDetail.trends.previous.referenceCount }}</strong>
              </div>
              <div>
                <span>新增连接</span>
                <strong>{{ selectedSummaryDetail.trends.connectionChanges.newCount }}</strong>
              </div>
              <div>
                <span>断裂连接</span>
                <strong>{{ selectedSummaryDetail.trends.connectionChanges.brokenCount }}</strong>
              </div>
            </div>

            <div class="split-block">
              <div>
                <h3>升温文档</h3>
                <div
                  v-if="selectedSummaryDetail.trends.risingDocuments.length"
                  class="trend-list"
                >
                  <article
                    v-for="item in selectedSummaryDetail.trends.risingDocuments.slice(0, 5)"
                    :key="item.documentId"
                    class="trend-item"
                  >
                    <button
                      type="button"
                      @click="openDocument(item.documentId)"
                    >
                      {{ item.title }}
                    </button>
                    <span>{{ formatDelta(item.delta) }} ({{ item.currentReferences }}/{{ item.previousReferences }})</span>
                  </article>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  没有明显升温文档。
                </p>
              </div>
              <div>
                <h3>降温文档</h3>
                <div
                  v-if="selectedSummaryDetail.trends.fallingDocuments.length"
                  class="trend-list"
                >
                  <article
                    v-for="item in selectedSummaryDetail.trends.fallingDocuments.slice(0, 5)"
                    :key="item.documentId"
                    class="trend-item"
                  >
                    <button
                      type="button"
                      @click="openDocument(item.documentId)"
                    >
                      {{ item.title }}
                    </button>
                    <span>{{ item.delta }} ({{ item.currentReferences }}/{{ item.previousReferences }})</span>
                  </article>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  没有明显降温文档。
                </p>
              </div>
            </div>

            <div class="split-block">
              <div>
                <h3>升温主题</h3>
                <div
                  v-if="selectedSummaryDetail.trends.risingCommunities.length"
                  class="trend-list"
                >
                  <article
                    v-for="community in selectedSummaryDetail.trends.risingCommunities.slice(0, 3)"
                    :key="community.communityId"
                    class="trend-item"
                  >
                    <button
                      type="button"
                      @click="selectCommunity(community.communityId)"
                    >
                      {{ community.topTags.join(' / ') || community.documentIds.map(resolveTitle).join(' / ') }}
                    </button>
                    <span>{{ formatDelta(community.delta) }} ({{ community.currentReferences }}/{{ community.previousReferences }})</span>
                  </article>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  没有明显升温主题。
                </p>
              </div>
              <div>
                <h3>低活跃主题</h3>
                <div
                  v-if="selectedSummaryDetail.trends.dormantCommunities.length"
                  class="trend-list"
                >
                  <article
                    v-for="community in selectedSummaryDetail.trends.dormantCommunities.slice(0, 3)"
                    :key="community.communityId"
                    class="trend-item"
                  >
                    <button
                      type="button"
                      @click="selectCommunity(community.communityId)"
                    >
                      {{ community.topTags.join(' / ') || community.documentIds.map(resolveTitle).join(' / ') }}
                    </button>
                    <span>{{ community.currentReferences }}/{{ community.previousReferences }}</span>
                  </article>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  没有明显低活跃主题。
                </p>
              </div>
              <div>
                <h3>断裂连接</h3>
                <div
                  v-if="selectedSummaryDetail.trends.connectionChanges.brokenEdges.length"
                  class="trend-list"
                >
                  <article
                    v-for="edge in selectedSummaryDetail.trends.connectionChanges.brokenEdges.slice(0, 3)"
                    :key="edge.documentIds.join('-')"
                    class="trend-item"
                  >
                    <button
                      type="button"
                      @click="openDocument(edge.documentIds[0])"
                    >
                      {{ edge.documentIds.map(resolveTitle).join(' → ') }}
                    </button>
                    <span>{{ edge.referenceCount }} 条</span>
                  </article>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  没有明显断裂连接。
                </p>
              </div>
            </div>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { openTab, showMessage, type Plugin } from 'siyuan'

import { SUGGESTION_TYPE_LABELS } from '@/analytics/ui-copy'
import RankingPanel from '@/components/RankingPanel.vue'
import { useAnalyticsState } from '@/composables/use-analytics'
import { appendBlock, prependBlock } from '@/api'
import type { PluginConfig } from '@/types/config'

const props = defineProps<{
  plugin: Plugin
  config: PluginConfig
}>()

const analytics = useAnalyticsState({
  plugin: props.plugin,
  openTab,
  showMessage,
  appendBlock,
  prependBlock,
})

const {
  loading,
  errorMessage,
  timeRange,
  timeRangeOptions,
  selectedNotebook,
  selectedTag,
  keyword,
  orphanSort,
  dormantDays,
  fromDocumentId,
  toDocumentId,
  pathScope,
  maxPathDepth,
  selectedSummaryCardKey,
  notebookOptions,
  tagOptions,
  report,
  trends,
  selectedCommunity,
  selectedCommunityTrend,
  summaryCards,
  selectedSummaryDetail,
  selectedSummaryCount,
  pathOptions,
  pathChain,
  panelCounts,
  snapshotLabel,
  refresh,
  selectEvidence,
  selectCommunity,
  selectSummaryCard,
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
} = analytics

const visibleSummaryCards = computed(() => {
  if (!props.config.showSummaryCards) {
    return []
  }
  return summaryCards.value.filter((card) => {
    if (card.key === 'ranking') {
      return props.config.showRanking
    }
    if (card.key === 'suggestions') {
      return props.config.showSuggestions
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
    if (card.key === 'orphans' || card.key === 'dormant' || card.key === 'bridges') {
      return props.config.showOrphanBridge
    }
    return true
  })
})

watch(visibleSummaryCards, (cards) => {
  if (cards.length === 0) {
    return
  }
  if (!cards.some(card => card.key === selectedSummaryCardKey.value)) {
    selectSummaryCard(cards[0].key)
  }
}, { immediate: true })
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

.filter-panel,
.summary-grid,
.layout-grid {
  display: grid;
  gap: 16px;
}

.filter-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin-bottom: 24px;
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

.filter-item--wide {
  grid-column: span 2;
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

.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.summary-card--interactive {
  width: 100%;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.summary-card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.12);
  border-color: color-mix(in srgb, var(--b3-theme-primary) 20%, transparent);
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
.meta-text,
.empty-inline,
.trend-item span {
  color: var(--panel-muted);
  font-size: 13px;
}

.meta-text {
  font-size: 12px;
  white-space: nowrap;
}

.suggestion-list,
.community-list,
.propagation-list,
.summary-detail-list {
  display: grid;
  gap: 12px;
}

.suggestion-item,
.community-item,
.propagation-item,
.summary-detail-item {
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s;
}

.suggestion-item:hover,
.community-item:hover,
.propagation-item:hover,
.summary-detail-item:hover {
  background: var(--surface-card-soft);
}

.suggestion-item__title,
.propagation-item__title,
.summary-detail-item__title,
.trend-item button,
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

.suggestion-item__title:hover,
.propagation-item__title:hover,
.summary-detail-item__title:hover,
.trend-item button:hover {
  color: color-mix(in srgb, var(--b3-theme-primary) 70%, transparent);
}

.suggestion-item__title,
.propagation-item__title,
.summary-detail-item__title {
  font-weight: 600;
  font-size: 15px;
}

.community-item__header,
.community-detail__header,
.propagation-item__header,
.summary-detail-item__header,
.path-controls,
.trend-stats,
.split-block {
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

.split-block {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: start;
  gap: 16px;
}

.split-block h3 {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-primary);
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

.mini-list__item,
.trend-item button {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface-card-soft);
  font-weight: 500;
  transition: background-color 0.2s;
}

.mini-list__item:hover,
.trend-item button:hover {
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

.trend-stats {
  margin-bottom: 16px;
}

.trend-stats div {
  flex: 1;
  min-width: 0;
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
}

.trend-stats span {
  display: block;
  font-size: 13px;
  color: var(--panel-muted);
  font-weight: 500;
  margin-bottom: 4px;
}

.trend-stats strong {
  font-size: 22px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.trend-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
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
  transition: opacity 0.2s, background-color 0.2s;
  font-weight: 500;
}

.action-button {
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
  padding: 6px 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--b3-theme-primary) 8%, transparent);
  color: var(--b3-theme-primary);
}

.ghost-button:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
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
  .split-block {
    grid-template-columns: 1fr;
  }

  .panel--primary {
    grid-column: span 1;
  }

  .hero {
    flex-direction: column;
  }
}
</style>
