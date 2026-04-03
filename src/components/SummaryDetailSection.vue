<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>{{ detail.title }}</h2>
        <p>{{ detail.description }}</p>
      </div>
      <div class="panel-header__actions">
        <span class="meta-text">{{ selectedSummaryCount }} 篇文档</span>
        <button
          class="panel-toggle"
          type="button"
          :aria-expanded="isExpanded"
          :aria-label="isExpanded ? '折叠详情' : '展开详情'"
          @click="onTogglePanel()"
        >
          {{ isExpanded ? '折叠' : '展开' }}
          <span
            class="panel-toggle__caret"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <div
      v-show="isExpanded"
      class="summary-detail-body"
    >
      <template v-if="detail.key === 'orphans'">
        <OrphanDetailPanel
          :items="orphanDetailItems"
          :orphan-sort="orphanSort"
          :open-document="openDocument"
          :on-update-orphan-sort="onUpdateOrphanSort"
          :on-toggle-theme-suggestion="toggleOrphanThemeSuggestion"
          :is-theme-suggestion-active="isThemeSuggestionActive"
          :ai-enabled="aiEnabled"
          :ai-config-ready="aiLinkSuggestionConfigReady"
          :ai-suggestion-states="orphanAiSuggestionStates"
          :on-generate-ai-suggestion="generateOrphanAiSuggestion"
        />
      </template>
      <template v-else-if="detail.key === 'dormant'">
        <DormantDetailPanel
          :items="detail.items"
          :dormant-days="dormantDays"
          :open-document="openDocument"
          :on-update-dormant-days="onUpdateDormantDays"
        />
      </template>
      <template v-else-if="detail.kind === 'list'">
        <div
          v-if="listItems.length"
          class="summary-detail-list"
        >
          <article
            v-for="item in listItems"
            :key="`${detail.key}-${item.documentId}`"
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
            <SuggestionCallout
              v-if="hasSuggestionCallout(item)"
              :suggestions="buildSuggestionCalloutItems(item)"
            >
              <div
                v-if="item.themeSuggestions?.length"
                class="detail-theme-section"
              >
                <div class="detail-theme-tags">
                  <button
                    v-for="suggestion in item.themeSuggestions"
                    :key="`${item.documentId}-${suggestion.themeDocumentId}`"
                    :class="['detail-theme-tag', { 'detail-theme-tag--active': isThemeSuggestionActive(item.documentId, suggestion.themeDocumentId) }]"
                    type="button"
                    :title="`${suggestion.themeDocumentTitle} · 匹配 ${suggestion.matchCount} 次`"
                    @click="toggleOrphanThemeSuggestion(item.documentId, suggestion.themeDocumentId)"
                  >
                    <span class="detail-theme-name">{{ suggestion.themeName }}</span>
                  </button>
                </div>
              </div>
            </SuggestionCallout>
          </article>
        </div>
        <div
          v-else
          class="empty-state"
        >
          当前卡片下没有可展示的文档。
        </div>
      </template>
      <template v-else-if="detail.kind === 'propagation'">
        <div
          v-if="detail.items.length"
          class="summary-detail-list"
        >
          <article
            v-for="item in detail.items"
            :key="`${detail.key}-${item.documentId}`"
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
              <select
                :value="pathScope"
                @change="onUpdatePathScope(($event.target as HTMLSelectElement).value as PathScope)"
              >
                <option value="focused">核心 + 桥接</option>
                <option value="all">当前筛选全部文档</option>
                <option value="community">当前社区</option>
              </select>
            </label>
            <label>
              <span>最大深度</span>
              <select
                :value="maxPathDepth"
                @change="onUpdateMaxPathDepth(Number.parseInt(($event.target as HTMLSelectElement).value, 10))"
              >
                <option :value="3">3</option>
                <option :value="4">4</option>
                <option :value="5">5</option>
                <option :value="6">6</option>
              </select>
            </label>
            <label>
              <span>起点</span>
              <select
                :value="fromDocumentId"
                @change="onUpdateFromDocumentId(($event.target as HTMLSelectElement).value)"
              >
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
              <select
                :value="toDocumentId"
                @change="onUpdateToDocumentId(($event.target as HTMLSelectElement).value)"
              >
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
      <template v-else-if="detail.kind === 'ranking'">
        <RankingPanel
          variant="detail"
          :ranking="detail.ranking"
          :panel-count="detail.ranking.length"
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
      <template v-else-if="detail.kind === 'trends'">
        <div class="trend-stats">
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">当前窗口</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.current.referenceCount }}</strong>
          </article>
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">前一窗口</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.previous.referenceCount }}</strong>
          </article>
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">新增连接</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.connectionChanges.newCount }}</strong>
          </article>
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">断裂连接</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.connectionChanges.brokenCount }}</strong>
          </article>
        </div>

        <div class="trend-grid">
          <section class="trend-section-card trend-section-card--warm">
            <p class="trend-section-card__eyebrow">Document Heat</p>
            <h3 class="trend-section-card__title">升温文档</h3>
            <div
              v-if="detail.trends.risingDocuments.length"
              class="trend-list"
            >
              <article
                v-for="item in detail.trends.risingDocuments.slice(0, 5)"
                :key="item.documentId"
                class="trend-record"
              >
                <div class="trend-record__header">
                  <DocumentTitle
                    :document-id="item.documentId"
                    :title="item.title"
                    :open-document="openDocument"
                    :is-theme-document="themeDocumentIds.has(item.documentId)"
                  />
                  <span class="trend-record__delta trend-record__delta--positive">{{ formatDelta(item.delta) }}</span>
                </div>
                <p class="trend-record__meta">
                  当前窗口 {{ item.currentReferences }} · 前一窗口 {{ item.previousReferences }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              没有明显升温文档。
            </p>
          </section>

          <section class="trend-section-card trend-section-card--cool">
            <p class="trend-section-card__eyebrow">Document Cooling</p>
            <h3 class="trend-section-card__title">降温文档</h3>
            <div
              v-if="detail.trends.fallingDocuments.length"
              class="trend-list"
            >
              <article
                v-for="item in detail.trends.fallingDocuments.slice(0, 5)"
                :key="item.documentId"
                class="trend-record"
              >
                <div class="trend-record__header">
                  <DocumentTitle
                    :document-id="item.documentId"
                    :title="item.title"
                    :open-document="openDocument"
                    :is-theme-document="themeDocumentIds.has(item.documentId)"
                  />
                  <span class="trend-record__delta trend-record__delta--negative">{{ formatDelta(item.delta) }}</span>
                </div>
                <p class="trend-record__meta">
                  当前窗口 {{ item.currentReferences }} · 前一窗口 {{ item.previousReferences }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              没有明显降温文档。
            </p>
          </section>

          <section class="trend-section-card trend-section-card--accent">
            <p class="trend-section-card__eyebrow">Community Lift</p>
            <h3 class="trend-section-card__title">升温主题</h3>
            <div
              v-if="detail.trends.risingCommunities.length"
              class="trend-list"
            >
              <article
                v-for="community in detail.trends.risingCommunities.slice(0, 3)"
                :key="community.communityId"
                class="trend-record"
              >
                <div class="trend-record__header">
                  <button
                    class="trend-record__button"
                    type="button"
                    @click="selectCommunity(community.communityId)"
                  >
                    {{ community.topTags.join(' / ') || community.documentIds.map(resolveTitle).join(' / ') }}
                  </button>
                  <span class="trend-record__delta trend-record__delta--positive">{{ formatDelta(community.delta) }}</span>
                </div>
                <p class="trend-record__meta">
                  当前窗口 {{ community.currentReferences }} · 前一窗口 {{ community.previousReferences }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              没有明显升温主题。
            </p>
          </section>

          <section class="trend-section-card trend-section-card--muted">
            <p class="trend-section-card__eyebrow">Community Idle</p>
            <h3 class="trend-section-card__title">低活跃主题</h3>
            <div
              v-if="detail.trends.dormantCommunities.length"
              class="trend-list"
            >
              <article
                v-for="community in detail.trends.dormantCommunities.slice(0, 3)"
                :key="community.communityId"
                class="trend-record"
              >
                <div class="trend-record__header">
                  <button
                    class="trend-record__button"
                    type="button"
                    @click="selectCommunity(community.communityId)"
                  >
                    {{ community.topTags.join(' / ') || community.documentIds.map(resolveTitle).join(' / ') }}
                  </button>
                  <span class="trend-record__badge">低活跃</span>
                </div>
                <p class="trend-record__meta">
                  当前窗口 {{ community.currentReferences }} · 前一窗口 {{ community.previousReferences }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              没有明显低活跃主题。
            </p>
          </section>

          <section class="trend-section-card trend-section-card--neutral">
            <p class="trend-section-card__eyebrow">Broken Paths</p>
            <h3 class="trend-section-card__title">断裂连接</h3>
            <div
              v-if="detail.trends.connectionChanges.brokenEdges.length"
              class="trend-list"
            >
              <article
                v-for="edge in detail.trends.connectionChanges.brokenEdges.slice(0, 3)"
                :key="edge.documentIds.join('-')"
                class="trend-record"
              >
                <div class="trend-record__header">
                  <button
                    class="trend-record__button"
                    type="button"
                    @click="openDocument(edge.documentIds[0])"
                  >
                    {{ edge.documentIds.map(resolveTitle).join(' → ') }}
                  </button>
                  <span class="trend-record__badge">{{ edge.referenceCount }} 条</span>
                </div>
                <p class="trend-record__meta">
                  点击打开路径起点文档，回溯断裂前后的关联关系。
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              没有明显断裂连接。
            </p>
          </section>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { OrphanSort } from '@/analytics/analysis'
import type { OrphanAiSuggestionState } from '@/analytics/ai-link-suggestions'
import type { LinkDirection } from '@/analytics/link-sync'
import type { DetailSuggestion, SummaryDetailSection as SummaryDetailSectionType } from '@/analytics/summary-details'
import type { ReadCardMode } from '@/analytics/read-status'
import type { ThemeDocumentMatch } from '@/analytics/theme-documents'
import type { PathScope } from '@/composables/use-analytics-derived'
import DocumentTitle from '@/components/DocumentTitle.vue'
import DormantDetailPanel from '@/components/DormantDetailPanel.vue'
import OrphanDetailPanel from '@/components/OrphanDetailPanel.vue'
import RankingPanel from '@/components/RankingPanel.vue'
import SuggestionCallout from '@/components/SuggestionCallout.vue'

type DetailItemWithThemeSuggestions = {
  documentId: string
  title: string
  meta: string
  badge?: string
  isThemeDocument?: boolean
  suggestions?: Array<{ label: string, text: string }>
  themeSuggestions: ThemeDocumentMatch[]
}

const props = defineProps<{
  detail: SummaryDetailSectionType
  selectedSummaryCount: number
  isExpanded: boolean
  onTogglePanel: () => void
  orphanDetailItems: DetailItemWithThemeSuggestions[]
  orphanThemeSuggestions: Map<string, ThemeDocumentMatch[]>
  orphanSort: OrphanSort
  onUpdateOrphanSort: (value: OrphanSort) => void
  dormantDays: number
  onUpdateDormantDays: (value: number) => void
  openDocument: (documentId: string) => void
  toggleOrphanThemeSuggestion: (orphanDocumentId: string, themeDocumentId: string) => Promise<void>
  isThemeSuggestionActive: (orphanDocumentId: string, themeDocumentId: string) => boolean
  aiEnabled: boolean
  aiLinkSuggestionConfigReady: boolean
  orphanAiSuggestionStates: Map<string, OrphanAiSuggestionState>
  generateOrphanAiSuggestion: (documentId: string) => Promise<void>
  readCardMode: ReadCardMode
  pathScope: PathScope
  onUpdatePathScope: (value: PathScope) => void
  maxPathDepth: number
  onUpdateMaxPathDepth: (value: number) => void
  fromDocumentId: string
  onUpdateFromDocumentId: (value: string) => void
  toDocumentId: string
  onUpdateToDocumentId: (value: string) => void
  pathOptions: Array<{ id: string, title: string }>
  pathChain: string[]
  resolveTitle: (documentId: string) => string
  snapshotLabel: string
  formatTimestamp: (timestamp?: string) => string
  toggleLinkPanel: (documentId: string) => void
  isLinkPanelExpanded: (documentId: string) => boolean
  resolveLinkAssociations: (documentId: string) => { outbound: any[], inbound: any[], childDocuments: any[] }
  toggleLinkGroup: (documentId: string, direction: LinkDirection) => void
  isLinkGroupExpanded: (documentId: string, direction: LinkDirection) => boolean
  isSyncing: (coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) => boolean
  syncAssociation: (coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) => Promise<void>
  formatDelta: (delta: number) => string
  themeDocumentIds: Set<string>
  selectCommunity: (communityId: string) => void
}>()

const listItems = computed<DetailItemWithThemeSuggestions[]>(() => {
  if (props.detail.kind !== 'list') {
    return []
  }

  if (props.detail.key === 'read' && props.readCardMode === 'unread') {
    return props.detail.items.map(item => ({
      ...item,
      themeSuggestions: props.orphanThemeSuggestions.get(item.documentId) ?? [],
    }))
  }

  return props.detail.items.map(item => ({
    ...item,
    themeSuggestions: [],
  }))
})

function hasSuggestionCallout(item: DetailItemWithThemeSuggestions): boolean {
  return Boolean(item.suggestions?.length || item.themeSuggestions.length)
}

function buildSuggestionCalloutItems(item: DetailItemWithThemeSuggestions): DetailSuggestion[] {
  const suggestions = item.suggestions ?? []
  if (!item.themeSuggestions.length) {
    return suggestions
  }

  return suggestions.map((suggestion) => {
    if (suggestion.label !== '补齐链接') {
      return suggestion
    }

    const text = suggestion.text.replace(/[。；，,\s]*$/, '')
    return {
      ...suggestion,
      text: `${text}，建议链接以下主题文档（点击添加）：`,
    }
  })
}
</script>

<style scoped>
.panel {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.panel-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
}

.panel-header p,
.meta-text {
  margin: 0;
  color: var(--panel-muted);
  font-size: 13px;
}

.meta-text {
  font-size: 12px;
  white-space: nowrap;
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

.summary-detail-list {
  display: grid;
  gap: 12px;
}

.summary-detail-item {
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s;
}

.summary-detail-item:hover {
  background: var(--surface-card-soft);
}

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

.summary-detail-item__meta {
  margin: 0;
  font-size: 12px;
  color: var(--panel-muted);
}

.badge,
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

.detail-theme-section {
  display: grid;
  gap: 6px;
}

.detail-theme-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-theme-tag {
  border: 0;
  border-radius: 999px;
  padding: 7px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 58%, transparent);
  background: color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  transition: background-color 0.2s, color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0;
  max-width: 100%;
}

.detail-theme-tag:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 14%, transparent);
  color: var(--b3-theme-primary);
}

.detail-theme-tag--active {
  background: color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);
  color: var(--b3-theme-primary);
}

.detail-theme-name {
  font-weight: 600;
}

.propagation-path {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.propagation-path__header {
  display: grid;
  gap: 4px;
}

.propagation-path__header h3,
.propagation-path__header p {
  margin: 0;
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

select {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font-size: 14px;
}

.path-chain {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.path-node {
  border: 0;
  background: var(--surface-chip-cool);
  font: inherit;
  font-size: 13px;
  color: color-mix(in srgb, var(--accent-cool) 70%, var(--b3-theme-on-background));
  cursor: pointer;
}

.path-node:hover {
  background: color-mix(in srgb, var(--surface-chip-cool) 80%, var(--b3-theme-primary));
}

.summary-card {
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
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

.trend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
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
  margin: 0;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--card-accent, var(--b3-theme-primary)) 52%, var(--panel-muted));
  font-weight: 700;
}

.trend-section-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.trend-section-card__empty {
  margin: 0;
  padding: 16px 14px;
  border-radius: 12px;
  border: 1px dashed var(--panel-border);
  background: color-mix(in srgb, var(--surface-card) 78%, transparent);
  color: var(--panel-muted);
  font-size: 13px;
}

.trend-list {
  display: grid;
  gap: 10px;
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

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--panel-muted);
  background: var(--surface-card);
  border-radius: 12px;
  border: 1px dashed var(--panel-border);
}
</style>
