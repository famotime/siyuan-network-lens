<template>
  <section class="panel">
    <div class="panel-header">
      <div class="panel-header__main">
        <div class="panel-header__content">
          <h2>{{ detail.title }}</h2>
          <p>{{ detail.description }}</p>
        </div>
        <div class="panel-header__actions">
          <span class="meta-text">{{ summaryCountLabel }}</span>
          <button
            class="panel-toggle"
            type="button"
            :aria-expanded="isExpanded"
            :aria-label="isExpanded ? t('summaryDetail.collapseDetails') : t('summaryDetail.expandDetails')"
            @click="onTogglePanel()"
          >
            <span
              class="panel-toggle__caret"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      <div
        v-if="detail.kind === 'aiInbox' && isExpanded"
        class="panel-header__ai-toolbar"
      >
        <div class="panel-header__ai-history-slot">
          <div
            v-if="aiInboxHistory.length"
            class="panel-header__ai-history-group"
          >
            <span class="panel-header__ai-history-label">{{ t('summaryDetail.historyLabel') }}</span>
            <div class="panel-header__ai-history-buttons">
              <button
                v-for="(entry, index) in aiInboxHistory"
                :key="entry.id"
                :class="[
                  'ai-history-button',
                  { 'history-button--active': entry.id === selectedAiInboxHistoryId },
                ]"
                type="button"
                :title="buildAiInboxHistoryTooltip(entry)"
                @click="selectAiInboxHistory(entry.id)"
              >
                {{ index + 1 }}
              </button>
            </div>
          </div>
        </div>
        <button
          class="action-button panel-header__action-button"
          type="button"
          :disabled="aiSuggestionLoading || !aiSuggestionEnabled || !aiSuggestionConfigured"
          @click="generateAiInbox()"
        >
          {{ aiSuggestionLoading ? t('summaryDetail.analyzing') : detail.result ? t('summaryDetail.reanalyze') : t('summaryDetail.todaySuggestions') }}
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
          :on-toggle-ai-link-suggestion="toggleOrphanAiLinkSuggestion"
          :is-ai-link-suggestion-active="isAiLinkSuggestionActive"
          :on-toggle-ai-tag-suggestion="toggleOrphanAiTagSuggestion"
          :is-ai-tag-suggestion-active="isAiTagSuggestionActive"
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
      <template v-else-if="detail.kind === 'aiInbox'">
        <div class="ai-suggestion-panel">
          <p
            v-if="aiSuggestionError"
            class="ai-suggestion-panel__status ai-suggestion-panel__status--error"
          >
            {{ aiSuggestionError }}
          </p>

          <div
            v-if="!aiSuggestionEnabled"
            class="empty-state"
          >
            {{ t('summaryDetail.aiEmpty.enableAi') }}
          </div>

          <div
            v-else-if="!aiSuggestionConfigured"
            class="empty-state"
          >
            {{ t('summaryDetail.aiEmpty.incompleteConfig') }}
          </div>

          <div
            v-else-if="aiSuggestionLoading && !detail.result"
            class="ai-suggestion-panel__loading"
            aria-hidden="true"
          >
            <div class="ai-suggestion-panel__loading-line loading-shimmer" />
            <div class="ai-suggestion-panel__loading-line ai-suggestion-panel__loading-line--short loading-shimmer" />
            <div class="ai-suggestion-panel__loading-card loading-shimmer" />
            <div class="ai-suggestion-panel__loading-card loading-shimmer" />
          </div>

          <div
            v-else-if="detail.result"
            class="ai-suggestion-panel__result"
          >
            <div class="ai-suggestion-panel__summary">
              <p>{{ detail.result.summary }}</p>
              <span class="meta-text">{{ t('summaryDetail.counts.suggestions', { count: detail.result.items.length }) }}</span>
            </div>

            <div class="ai-suggestion-panel__list">
              <article
                v-for="item in detail.result.items"
                :key="item.id"
                class="ai-suggestion-panel__item"
              >
                <div class="ai-suggestion-panel__item-top">
                  <div class="ai-suggestion-panel__badges">
                    <span class="badge badge--cool">{{ resolveAiInboxTypeLabel(item.type) }}</span>
                    <span class="badge">{{ item.priority }}</span>
                  </div>
                </div>
                <div
                  v-if="resolveAiInboxItemDocumentId(item)"
                  class="ai-suggestion-panel__source-title"
                >
                  <span
                    v-if="resolveAiInboxItemTitleParts(item.title).prefix"
                    class="ai-suggestion-panel__source-prefix"
                  >
                    {{ resolveAiInboxItemTitleParts(item.title).prefix }}
                  </span>
                  <DocumentTitle
                    :document-id="resolveAiInboxItemDocumentId(item)"
                    :title="resolveAiInboxItemTitleParts(item.title).documentTitle"
                    :open-document="openDocument"
                  />
                </div>
                <h3 v-else>{{ item.title }}</h3>

                <div
                  v-if="item.recommendedTargets?.length"
                  class="ai-suggestion-panel__detail-group"
                >
                  <p class="ai-suggestion-panel__detail-title">{{ t('summaryDetail.aiSection.suggestedTargets') }}</p>
                  <div class="ai-suggestion-panel__targets">
                    <div
                      v-for="target in item.recommendedTargets"
                      :key="`${item.id}-${target.title}`"
                      class="ai-suggestion-panel__target"
                    >
                      <DocumentTitle
                        v-if="target.documentId"
                        :document-id="target.documentId"
                        :title="target.title"
                        :open-document="openDocument"
                        variant="compact"
                      />
                      <span v-else class="ai-suggestion-panel__target-label">{{ target.title }}</span>
                      <p>{{ target.reason }}</p>
                    </div>
                  </div>
                </div>

                <div class="ai-suggestion-panel__detail-group">
                  <p class="ai-suggestion-panel__detail-title">{{ t('summaryDetail.aiSection.recommendedAction') }}</p>
                  <div
                    v-if="resolveAiInboxActionTargets(item).length"
                    class="ai-suggestion-panel__action-pills"
                  >
                    <button
                      v-for="target in resolveAiInboxActionTargets(item)"
                      :key="`${item.id}-${target.title}-action`"
                      :class="[
                        'ai-suggestion-panel__action-pill',
                        { 'ai-suggestion-panel__action-pill--active': isAiInboxTargetActive(item, target) },
                      ]"
                      type="button"
                      @click="handleAiInboxActionTargetClick(item, target)"
                    >
                      {{ target.title }}
                    </button>
                  </div>
                  <p
                    v-for="line in resolveAiInboxActionLines(item.action)"
                    :key="`${item.id}-${line}`"
                    class="ai-suggestion-panel__merged-copy"
                  >
                    {{ line }}
                  </p>
                </div>

                <div class="ai-suggestion-panel__detail-group">
                  <p class="ai-suggestion-panel__detail-title">{{ t('summaryDetail.aiSection.whyFirst') }}</p>
                  <p class="ai-suggestion-panel__merged-copy">{{ item.reason }}</p>
                  <ul v-if="item.evidence?.length || item.expectedChanges?.length" class="ai-suggestion-panel__detail-list">
                    <li v-for="evidence in item.evidence ?? []" :key="`${item.id}-${evidence}`">
                      {{ evidence }}
                    </li>
                    <li v-for="change in item.expectedChanges ?? []" :key="`${item.id}-${change}`">
                      {{ change }}
                    </li>
                  </ul>
                </div>

              </article>
            </div>
          </div>

          <div
            v-else
            class="empty-state"
          >
            {{ t('summaryDetail.aiEmpty.openTodaySuggestions') }}
          </div>
        </div>
      </template>
      <template v-else-if="detail.kind === 'list'">
        <template v-if="listItems.length">
          <div class="summary-detail-list">
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
                      :title="t('summaryDetail.themeSuggestionTooltip', { title: suggestion.themeDocumentTitle, count: suggestion.matchCount })"
                      @click="toggleOrphanThemeSuggestion(item.documentId, suggestion.themeDocumentId)"
                    >
                      <span class="detail-theme-name">{{ suggestion.themeName }}</span>
                    </button>
                  </div>
                </div>
              </SuggestionCallout>
            </article>
          </div>
        </template>
        <div
          v-else
          class="empty-state"
        >
          {{ t('summaryDetail.empty.noDocs') }}
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
          {{ t('summaryDetail.empty.noPropagationNodes') }}
        </div>

        <div class="propagation-path">
          <div class="propagation-path__header">
            <h3>{{ t('summaryDetail.propagation.title') }}</h3>
            <p>{{ t('summaryDetail.propagation.description') }}</p>
          </div>
          <div class="path-controls">
            <label>
              <span>{{ t('summaryDetail.propagation.scopeLabel') }}</span>
              <select
                :value="pathScope"
                @change="onUpdatePathScope(($event.target as HTMLSelectElement).value as PathScope)"
              >
                <option value="focused">{{ t('summaryDetail.propagation.scopeFocused') }}</option>
                <option value="all">{{ t('summaryDetail.propagation.scopeAll') }}</option>
                <option value="community">{{ t('summaryDetail.propagation.scopeCommunity') }}</option>
              </select>
            </label>
            <label>
              <span>{{ t('summaryDetail.propagation.maxDepth') }}</span>
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
              <span>{{ t('summaryDetail.propagation.fromLabel') }}</span>
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
              <span>{{ t('summaryDetail.propagation.toLabel') }}</span>
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
            {{ t('summaryDetail.empty.noExplainablePath') }}
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
          :wiki-panel-props="wikiPanelProps"
          :is-wiki-panel-visible-for-core-document="isCoreDocumentWikiPanelVisible"
          :toggle-core-document-wiki-panel="toggleCoreDocumentWikiPanel"
          :show-wiki-panel-actions="showWikiPanelActions"
        />
      </template>
      <template v-else-if="detail.kind === 'trends'">
        <div class="trend-stats">
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">{{ t('summaryDetail.trends.currentWindow') }}</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.current.referenceCount }}</strong>
          </article>
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">{{ t('summaryDetail.trends.previousWindow') }}</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.previous.referenceCount }}</strong>
          </article>
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">{{ t('summaryDetail.trends.newLinks') }}</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.connectionChanges.newCount }}</strong>
          </article>
          <article class="trend-stats__card summary-card">
            <span class="trend-stats__label summary-card__label">{{ t('summaryDetail.trends.brokenLinks') }}</span>
            <strong class="trend-stats__value summary-card__value">{{ detail.trends.connectionChanges.brokenCount }}</strong>
          </article>
        </div>

        <div class="trend-grid">
          <section class="trend-section-card trend-section-card--warm">
            <p class="trend-section-card__eyebrow">{{ t('summaryDetail.trends.documentHeat') }}</p>
            <h3 class="trend-section-card__title">{{ t('summaryDetail.trends.risingDocs') }}</h3>
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
                  {{ t('summaryDetail.trends.currentPrevious', { current: item.currentReferences, previous: item.previousReferences }) }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              {{ t('summaryDetail.trends.noClearlyRisingDocs') }}
            </p>
          </section>

          <section class="trend-section-card trend-section-card--cool">
            <p class="trend-section-card__eyebrow">{{ t('summaryDetail.trends.documentCooling') }}</p>
            <h3 class="trend-section-card__title">{{ t('summaryDetail.trends.coolingDocs') }}</h3>
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
                  {{ t('summaryDetail.trends.currentPrevious', { current: item.currentReferences, previous: item.previousReferences }) }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              {{ t('summaryDetail.trends.noClearlyCoolingDocs') }}
            </p>
          </section>

          <section class="trend-section-card trend-section-card--accent">
            <p class="trend-section-card__eyebrow">{{ t('summaryDetail.trends.communityLift') }}</p>
            <h3 class="trend-section-card__title">{{ t('summaryDetail.trends.risingTopics') }}</h3>
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
                  {{ t('summaryDetail.trends.currentPrevious', { current: community.currentReferences, previous: community.previousReferences }) }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              {{ t('summaryDetail.trends.noClearlyRisingTopics') }}
            </p>
          </section>

          <section class="trend-section-card trend-section-card--muted">
            <p class="trend-section-card__eyebrow">{{ t('summaryDetail.trends.communityIdle') }}</p>
            <h3 class="trend-section-card__title">{{ t('summaryDetail.trends.lowActivityTopics') }}</h3>
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
                  <span class="trend-record__badge">{{ t('summaryDetail.trends.lowActivity') }}</span>
                </div>
                <p class="trend-record__meta">
                  {{ t('summaryDetail.trends.currentPrevious', { current: community.currentReferences, previous: community.previousReferences }) }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              {{ t('summaryDetail.trends.noClearlyLowActivityTopics') }}
            </p>
          </section>

          <section class="trend-section-card trend-section-card--neutral">
            <p class="trend-section-card__eyebrow">{{ t('summaryDetail.trends.brokenPaths') }}</p>
            <h3 class="trend-section-card__title">{{ t('summaryDetail.trends.brokenLinks') }}</h3>
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
                  <span class="trend-record__badge">{{ t('summaryDetail.trends.referenceCount', { count: edge.referenceCount }) }}</span>
                </div>
                <p class="trend-record__meta">
                  {{ t('summaryDetail.trends.brokenPathDescription') }}
                </p>
              </article>
            </div>
            <p
              v-else
              class="trend-section-card__empty"
            >
              {{ t('summaryDetail.trends.noClearlyBrokenLinks') }}
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
import type { AiInboxItemType } from '@/analytics/ai-inbox'
import type { OrphanAiSuggestionState } from '@/analytics/ai-link-suggestions'
import type { LinkDirection } from '@/analytics/link-sync'
import type { DetailSuggestion, SummaryDetailSection as SummaryDetailSectionType } from '@/analytics/summary-details'
import type { ReadCardMode } from '@/analytics/read-status'
import type { TodaySuggestionHistoryEntry } from '@/analytics/today-suggestion-history-store'
import type { ThemeDocument, ThemeDocumentMatch } from '@/analytics/theme-documents'
import type { PathScope } from '@/composables/use-analytics-derived'
import { t } from '@/i18n/ui'
import {
  resolveAiInboxActionTargets as resolveAiInboxActionTargetsFromData,
  resolveAiInboxActionLines,
  resolveAiInboxItemDocumentId,
  resolveAiInboxTargetIntent,
  splitAiInboxItemTitle,
} from '@/components/ai-inbox-detail'
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

const props = withDefaults(defineProps<{
  detail: SummaryDetailSectionType
  selectedSummaryCount: number
  isExpanded: boolean
  onTogglePanel: () => void
  aiSuggestionEnabled: boolean
  aiSuggestionConfigured: boolean
  aiSuggestionLoading: boolean
  aiSuggestionError: string
  generateAiInbox: () => void | Promise<void>
  aiInboxHistory: TodaySuggestionHistoryEntry[]
  selectedAiInboxHistoryId: string
  selectAiInboxHistory: (historyId: string) => void
  orphanDetailItems: DetailItemWithThemeSuggestions[]
  orphanThemeSuggestions: Map<string, ThemeDocumentMatch[]>
  orphanSort: OrphanSort
  onUpdateOrphanSort: (value: OrphanSort) => void
  dormantDays: number
  onUpdateDormantDays: (value: number) => void
  openDocument: (documentId: string) => void
  toggleOrphanThemeSuggestion: (orphanDocumentId: string, themeDocumentId: string) => Promise<void>
  isThemeSuggestionActive: (orphanDocumentId: string, themeDocumentId: string) => boolean
  toggleOrphanAiLinkSuggestion: (orphanDocumentId: string, targetDocumentId: string, targetDocumentTitle: string) => Promise<void>
  isAiLinkSuggestionActive: (orphanDocumentId: string, targetDocumentId: string) => boolean
  toggleOrphanAiTagSuggestion: (documentId: string, tag: string) => Promise<void>
  isAiTagSuggestionActive: (documentId: string, tag: string) => boolean
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
  themeDocuments: ThemeDocument[]
  selectCommunity: (communityId: string) => void
  isCoreDocumentWikiPanelVisible: (documentId: string) => boolean
  toggleCoreDocumentWikiPanel: (documentId: string) => void | Promise<void>
  showWikiPanelActions?: boolean
  wikiPanelProps: {
    wikiEnabled: boolean
    aiEnabled: boolean
    aiConfigReady: boolean
    previewLoading: boolean
    applyLoading: boolean
    error: string
    preview: any
    prepareWikiPreview: () => void | Promise<void>
    applyWikiChanges: (overwriteConflicts?: boolean) => void | Promise<void>
    openWikiDocument: (documentId: string) => void
  }
}>(), {
  showWikiPanelActions: true,
})

const summaryCountLabel = computed(() => props.detail.kind === 'aiInbox'
  ? t('summaryDetail.counts.suggestions', { count: props.selectedSummaryCount })
  : t('summaryDetail.counts.docs', { count: props.selectedSummaryCount }))

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
    if (suggestion.label !== t('summaryDetail.labels.repairLinks')) {
      return suggestion
    }

    const text = suggestion.text.replace(/[.。；，,\s]*$/, '')
    return {
      ...suggestion,
      text: t('summaryDetail.labels.repairLinksWithTopics', { text }),
    }
  })
}

function resolveAiInboxTypeLabel(type: AiInboxItemType) {
  if (type === 'connection') {
    return t('summaryDetail.labels.repairLinks')
  }
  if (type === 'topic-page') {
    return t('summaryDetail.labels.buildTopicPage')
  }
  if (type === 'bridge-risk') {
    return t('summaryDetail.labels.bridgeRisk')
  }
  return t('summaryDetail.labels.documentCleanup')
}

function resolveAiInboxItemTitleParts(title: string) {
  return splitAiInboxItemTitle(title)
}

function resolveAiInboxActionTargets(item: NonNullable<SummaryDetailSectionType & { kind: 'aiInbox' }>['result']['items'][number]) {
  return resolveAiInboxActionTargetsFromData({
    item,
    themeDocuments: props.themeDocuments,
  }).filter(target => Boolean(target.documentId?.trim()))
}

function buildAiInboxHistoryTooltip(entry: TodaySuggestionHistoryEntry) {
  return [
    t('summaryDetail.historyTooltip.generated', { value: entry.generatedAt || t('summaryDetail.historyTooltip.unknownTime') }),
    t('summaryDetail.historyTooltip.window', { value: entry.timeRange }),
    t('summaryDetail.historyTooltip.count', { value: entry.summaryCount }),
    t('summaryDetail.historyTooltip.notebook', { value: entry.filters.notebook || t('summaryDetail.historyTooltip.all') }),
    t('summaryDetail.historyTooltip.tags', { value: entry.filters.tags?.join(' / ') || t('summaryDetail.historyTooltip.all') }),
    t('summaryDetail.historyTooltip.topics', { value: entry.filters.themeNames?.join(' / ') || t('summaryDetail.historyTooltip.all') }),
    t('summaryDetail.historyTooltip.keyword', { value: entry.filters.keyword || t('summaryDetail.historyTooltip.none') }),
  ].join('\n')
}

function isAiInboxTargetActive(item: NonNullable<SummaryDetailSectionType & { kind: 'aiInbox' }>['result']['items'][number], target: NonNullable<SummaryDetailSectionType & { kind: 'aiInbox' }>['result']['items'][number]['recommendedTargets'][number]) {
  const intent = resolveAiInboxTargetIntent(item, target)
  return intent.kind === 'toggle-link'
    ? props.isAiLinkSuggestionActive(intent.sourceDocumentId, intent.targetDocumentId)
    : false
}

async function handleAiInboxActionTargetClick(
  item: NonNullable<SummaryDetailSectionType & { kind: 'aiInbox' }>['result']['items'][number],
  target: NonNullable<SummaryDetailSectionType & { kind: 'aiInbox' }>['result']['items'][number]['recommendedTargets'][number],
) {
  const intent = resolveAiInboxTargetIntent(item, target)
  if (intent.kind === 'toggle-link') {
    await props.toggleOrphanAiLinkSuggestion(intent.sourceDocumentId, intent.targetDocumentId, intent.targetTitle)
    return
  }
  if (intent.kind === 'open-document') {
    props.openDocument(intent.documentId)
  }
}
</script>

<style scoped>
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

.panel {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
}

.panel-header {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

.panel-header__main {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.panel-header__content {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}

.panel-header__ai-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.panel-header__ai-history-slot {
  flex: 1;
  min-width: 0;
}

.panel-header__ai-history-group {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  max-width: 100%;
  width: 100%;
}

.panel-header__ai-history-label {
  color: var(--panel-muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.panel-header__ai-history-buttons {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.panel-header__action-button {
  width: fit-content;
  max-width: 100%;
  flex-shrink: 0;
}

.ai-history-button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 12%, var(--panel-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 8%, var(--surface-card));
  color: var(--panel-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.ai-history-button:hover {
  color: var(--b3-theme-primary);
  border-color: color-mix(in srgb, var(--b3-theme-primary) 28%, var(--panel-border));
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, var(--surface-card));
}

.history-button--active {
  color: var(--b3-theme-primary);
  border-color: color-mix(in srgb, var(--b3-theme-primary) 32%, var(--panel-border));
  background: color-mix(in srgb, var(--b3-theme-primary) 16%, var(--surface-card));
}

.panel-toggle {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--panel-border);
  cursor: pointer;
  font: inherit;
  border-radius: 999px;
  background: transparent;
  color: var(--b3-theme-on-background);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.panel-toggle:hover {
  background: var(--surface-card-soft);
  border-color: color-mix(in srgb, var(--b3-theme-primary) 22%, var(--panel-border));
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

.ai-suggestion-panel,
.ai-suggestion-panel__result,
.ai-suggestion-panel__list {
  display: grid;
  gap: 14px;
}

.ai-suggestion-panel__status,
.ai-suggestion-panel__summary,
.ai-suggestion-panel__item,
.ai-suggestion-panel__loading-card {
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card);
}

.ai-suggestion-panel__status,
.ai-suggestion-panel__summary,
.ai-suggestion-panel__item {
  padding: 16px;
}

.ai-suggestion-panel__status {
  margin: 0;
}

.ai-suggestion-panel__status--error {
  color: var(--b3-theme-error);
  background: color-mix(in srgb, var(--b3-theme-error) 6%, var(--surface-card));
}

.ai-suggestion-panel__summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.ai-suggestion-panel__summary p {
  margin: 0;
  line-height: 1.7;
}

.ai-suggestion-panel__item {
  display: grid;
  gap: 10px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-warm) 6%, transparent), transparent 44%),
    var(--surface-card);
}

.ai-suggestion-panel__item h3,
.ai-suggestion-panel__item p {
  margin: 0;
}

.ai-suggestion-panel__item p {
  line-height: 1.7;
}

.ai-suggestion-panel__merged-copy {
  white-space: pre-wrap;
}

.ai-suggestion-panel__source-title {
  display: flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
}

.ai-suggestion-panel__source-prefix {
  font-weight: 600;
  color: color-mix(in srgb, var(--b3-theme-on-background) 76%, transparent);
}

.ai-suggestion-panel__item-top,
.ai-suggestion-panel__badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.ai-suggestion-panel__item-top {
  justify-content: space-between;
}

.ai-suggestion-panel__detail-group {
  display: grid;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
}

.ai-suggestion-panel__detail-title {
  font-size: 12px;
  font-weight: 700;
  color: color-mix(in srgb, var(--accent-cool) 72%, var(--b3-theme-on-background));
}

.ai-suggestion-panel__targets {
  display: grid;
  gap: 10px;
}

.ai-suggestion-panel__target {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-cool) 6%, var(--surface-card-soft));
}

.ai-suggestion-panel__target-label {
  width: fit-content;
}

.ai-suggestion-panel__target :deep(.document-title__button--compact) {
  font-size: 12px;
}

.ai-suggestion-panel__action-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-suggestion-panel__action-pill {
  border: 0;
  border-radius: 999px;
  padding: 7px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  transition: background-color 0.2s, color 0.2s, transform 0.2s;
}

.ai-suggestion-panel__action-pill:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);
}

.ai-suggestion-panel__action-pill--active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
}

.ai-suggestion-panel__target-label {
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.ai-suggestion-panel__detail-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.ai-suggestion-panel__detail-list li {
  line-height: 1.6;
}

.ai-suggestion-panel__loading {
  display: grid;
  gap: 12px;
}

.ai-suggestion-panel__loading-line,
.ai-suggestion-panel__loading-card {
  min-height: 16px;
}

.ai-suggestion-panel__loading-line {
  width: 100%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-card-soft) 88%, transparent);
}

.ai-suggestion-panel__loading-line--short {
  width: 56%;
}

.ai-suggestion-panel__loading-card {
  min-height: 120px;
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
  animation: ai-suggestion-shimmer 1.8s ease-in-out infinite;
}

@keyframes ai-suggestion-shimmer {
  to {
    transform: translateX(100%);
  }
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

.badge--cool {
  background: var(--surface-chip-cool);
  color: color-mix(in srgb, var(--accent-cool) 70%, var(--b3-theme-on-background));
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

@media (max-width: 720px) {
  .panel-header__main,
  .panel-header__ai-toolbar {
    flex-direction: column;
  }

  .panel-header__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .panel-header__ai-toolbar {
    align-items: stretch;
  }

  .panel-header__ai-history-group {
    justify-content: flex-start;
  }

  .ai-suggestion-panel__summary,
  .ai-suggestion-panel__item-top {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
