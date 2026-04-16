<template>
  <component :is="variant === 'panel' ? 'section' : 'div'" :class="variant === 'panel' ? 'panel panel--primary' : 'ranking-detail'">
    <div v-if="variant === 'panel'" class="panel-header">
      <div>
        <h2>{{ uiText('Core docs ranking', '核心文档排行') }}</h2>
        <p>{{ uiText('Ranked by doc-level inbound refs, source doc count, and recent activity.', '按文档级入链、来源文档数和近期活跃度排序。') }}</p>
      </div>
      <div class="panel-header__actions">
        <span class="meta-text">{{ uiText(`${panelCount} docs`, `${panelCount} 篇文档`) }}</span>
        <span class="meta-text">{{ uiText(`Last refreshed ${snapshotLabel}`, `最近刷新 ${snapshotLabel}`) }}</span>
        <button
          class="panel-toggle"
          type="button"
          :aria-expanded="isExpanded"
          :aria-label="isExpanded ? uiText('Collapse details', '收起详情') : uiText('Expand details', '展开详情')"
          @click="onTogglePanel"
        >
          {{ isExpanded ? uiText('Collapse', '收起') : uiText('Expand', '展开') }}
          <span
            class="panel-toggle__caret"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <div
      v-show="variant === 'detail' || isExpanded"
      class="panel-body"
    >
      <div
        v-if="ranking.length"
        class="ranking-list"
      >
        <div
          v-for="item in ranking.slice(0, 12)"
          :key="item.documentId"
          class="ranking-entry"
        >
          <article class="ranking-item">
            <DocumentTitle
              :document-id="item.documentId"
              :title="resolveTitle(item.documentId)"
              :open-document="openDocument"
              :is-theme-document="item.isThemeDocument"
            />
            <div class="ranking-item__meta">
              <span>{{ uiText(`${item.inboundReferences} inbound refs`, `${item.inboundReferences} 条入链`) }}</span>
              <span>{{ uiText(`${item.distinctSourceDocuments} source docs`, `${item.distinctSourceDocuments} 个来源文档`) }}</span>
              <span>{{ uiText(`${item.tagCount} tags`, `${item.tagCount} 个标签`) }}</span>
              <span>{{ uiText(`${item.outboundReferences} outbound refs`, `${item.outboundReferences} 条出链`) }}</span>
            </div>
            <div class="ranking-item__timestamps">
              <span>{{ uiText('Created', '创建') }}: {{ formatTimestamp(item.createdAt) }}</span>
              <span>{{ uiText('Updated', '更新') }}: {{ formatTimestamp(item.updatedAt) }}</span>
            </div>
            <div class="ranking-item__actions">
              <button
                class="ghost-button ghost-button--filled"
              type="button"
              @click="toggleLinkPanel(item.documentId)"
            >
                {{ isLinkPanelExpanded(item.documentId) ? uiText('Hide related refs/links', '收起关联引用/链接') : uiText('View related refs/links', '查看关联引用/链接') }}
              </button>
            </div>
            <div
              v-if="isLinkPanelExpanded(item.documentId)"
              class="link-association"
            >
              <div class="link-association__group">
                <button
                  :class="['link-association__toggle', { 'link-association__toggle--expanded': isLinkGroupExpanded(item.documentId, 'outbound') }]"
                  type="button"
                  :aria-expanded="isLinkGroupExpanded(item.documentId, 'outbound')"
                  @click="toggleLinkGroup(item.documentId, 'outbound')"
                >
                  <span class="link-association__caret" aria-hidden="true" />
                  {{ uiText('Outbound', '出链') }} {{ resolveAssociations(item.documentId).outbound.length }}
                </button>
                <div
                  v-show="isLinkGroupExpanded(item.documentId, 'outbound')"
                  class="link-association__list"
                >
                  <div
                    v-for="link in resolveAssociations(item.documentId).outbound"
                    :key="`outbound-${item.documentId}-${link.documentId}`"
                    class="link-association__item"
                  >
                    <button
                      class="link-association__doc"
                      :class="{ 'link-association__doc--highlight': !link.isOverlap }"
                      type="button"
                      @click="openDocument(link.documentId)"
                    >
                      {{ link.title }}
                    </button>
                    <button
                      v-if="!link.isOverlap"
                      class="ghost-button"
                      type="button"
                      :disabled="isSyncing(item.documentId, link.documentId, 'outbound')"
                      @click="syncAssociation(item.documentId, link.documentId, 'outbound')"
                    >
                      {{ isSyncing(item.documentId, link.documentId, 'outbound') ? uiText('Syncing...', '同步中...') : uiText('Sync', '同步') }}
                    </button>
                  </div>
                  <p
                    v-if="resolveAssociations(item.documentId).outbound.length === 0"
                    class="empty-inline"
                  >
                    {{ uiText('No outbound links.', '暂无出链。') }}
                  </p>
                </div>
              </div>
              <div class="link-association__group">
                <button
                  :class="['link-association__toggle', { 'link-association__toggle--expanded': isLinkGroupExpanded(item.documentId, 'inbound') }]"
                  type="button"
                  :aria-expanded="isLinkGroupExpanded(item.documentId, 'inbound')"
                  @click="toggleLinkGroup(item.documentId, 'inbound')"
                >
                  <span class="link-association__caret" aria-hidden="true" />
                  {{ uiText('Inbound', '入链') }} {{ resolveAssociations(item.documentId).inbound.length }}
                </button>
                <div
                  v-show="isLinkGroupExpanded(item.documentId, 'inbound')"
                  class="link-association__list"
                >
                  <div
                    v-for="link in resolveAssociations(item.documentId).inbound"
                    :key="`inbound-${item.documentId}-${link.documentId}`"
                    class="link-association__item"
                  >
                    <button
                      class="link-association__doc"
                      :class="{ 'link-association__doc--highlight': !link.isOverlap }"
                      type="button"
                      @click="openDocument(link.documentId)"
                    >
                      {{ link.title }}
                    </button>
                    <button
                      v-if="!link.isOverlap"
                      class="ghost-button"
                      type="button"
                      :disabled="isSyncing(item.documentId, link.documentId, 'inbound')"
                      @click="syncAssociation(item.documentId, link.documentId, 'inbound')"
                    >
                      {{ isSyncing(item.documentId, link.documentId, 'inbound') ? uiText('Syncing...', '同步中...') : uiText('Sync', '同步') }}
                    </button>
                  </div>
                  <p
                    v-if="resolveAssociations(item.documentId).inbound.length === 0"
                    class="empty-inline"
                  >
                    {{ uiText('No inbound links.', '暂无入链。') }}
                  </p>
                </div>
              </div>
              <div class="link-association__group">
                <button
                  :class="['link-association__toggle', { 'link-association__toggle--expanded': isLinkGroupExpanded(item.documentId, 'child') }]"
                  type="button"
                  :aria-expanded="isLinkGroupExpanded(item.documentId, 'child')"
                  @click="toggleLinkGroup(item.documentId, 'child')"
                >
                  <span class="link-association__caret" aria-hidden="true" />
                  {{ uiText('Child docs (deduped)', '子文档（去重）') }} {{ resolveAssociations(item.documentId).childDocuments.length }}
                </button>
                <div
                  v-show="isLinkGroupExpanded(item.documentId, 'child')"
                  class="link-association__list"
                >
                  <div
                    v-for="link in resolveAssociations(item.documentId).childDocuments"
                    :key="`child-${item.documentId}-${link.documentId}`"
                    class="link-association__item"
                  >
                    <button
                      class="link-association__doc"
                      :class="{ 'link-association__doc--highlight': true }"
                      type="button"
                      @click="openDocument(link.documentId)"
                    >
                      {{ link.title }}
                    </button>
                    <button
                      class="ghost-button"
                      type="button"
                      :disabled="isSyncing(item.documentId, link.documentId, 'child')"
                      @click="syncAssociation(item.documentId, link.documentId, 'child')"
                    >
                      {{ isSyncing(item.documentId, link.documentId, 'child') ? uiText('Linking...', '链接中...') : uiText('Link', '补链') }}
                    </button>
                  </div>
                  <p
                    v-if="resolveAssociations(item.documentId).childDocuments.length === 0"
                    class="empty-inline"
                  >
                    {{ uiText('No child doc links available to add.', '没有可补充的子文档链接。') }}
                  </p>
                </div>
              </div>
            </div>
            <SuggestionCallout :suggestions="item.suggestions ?? []" />
          </article>
          <div
            v-if="showWikiPanelActions"
            class="ranking-item__wiki"
          >
            <button
              class="ghost-button ghost-button--filled"
              type="button"
              @click="toggleCoreDocumentWikiPanel(item.documentId)"
            >
              {{ isWikiPanelVisibleForCoreDocument(item.documentId) ? uiText('Hide LLM Wiki', '收起 LLM Wiki') : uiText('Maintain LLM Wiki', '维护 LLM Wiki') }}
            </button>
            <WikiMaintainPanel
              v-if="isWikiPanelVisibleForCoreDocument(item.documentId)"
              v-bind="wikiPanelProps"
            />
          </div>
        </div>
      </div>
      <div
        v-else
        class="empty-state"
      >
        {{ uiText('No doc-level reference relationships matched the current filters.', '当前筛选下没有命中文档级引用关系。') }}
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import type { RankingDetailItem } from '@/analytics/summary-details'
import type { LinkAssociations } from '@/analytics/link-associations'
import type { LinkDirection } from '@/analytics/link-sync'
import type { WikiPreviewState } from '@/composables/use-analytics'
import { pickUiText } from '@/i18n/ui'
import DocumentTitle from './DocumentTitle.vue'
import SuggestionCallout from './SuggestionCallout.vue'
import WikiMaintainPanel from './WikiMaintainPanel.vue'

const props = withDefaults(defineProps<{
  ranking: RankingDetailItem[]
  panelCount: number
  snapshotLabel: string
  isExpanded: boolean
  onTogglePanel: () => void
  resolveTitle: (documentId: string) => string
  formatTimestamp: (timestamp?: string) => string
  openDocument: (documentId: string) => void
  toggleLinkPanel: (documentId: string) => void
  isLinkPanelExpanded: (documentId: string) => boolean
  resolveLinkAssociations: (documentId: string) => LinkAssociations
  toggleLinkGroup: (documentId: string, direction: LinkDirection) => void
  isLinkGroupExpanded: (documentId: string, direction: LinkDirection) => boolean
  isSyncing: (coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) => boolean
  syncAssociation: (coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) => void
  wikiPanelProps: {
    wikiEnabled: boolean
    aiEnabled: boolean
    aiConfigReady: boolean
    previewLoading: boolean
    applyLoading: boolean
    error: string
    preview: WikiPreviewState | null
    prepareWikiPreview: () => void | Promise<void>
    applyWikiChanges: (overwriteConflicts?: boolean) => void | Promise<void>
    openWikiDocument: (documentId: string) => void
  }
  isWikiPanelVisibleForCoreDocument: (documentId: string) => boolean
  toggleCoreDocumentWikiPanel: (documentId: string) => void | Promise<void>
  showWikiPanelActions?: boolean
  variant?: 'panel' | 'detail'
}>(), {
  showWikiPanelActions: true,
  variant: 'panel',
})

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

function resolveAssociations(documentId: string): LinkAssociations {
  const associations = props.resolveLinkAssociations(documentId)
  return {
    outbound: associations.outbound ?? [],
    inbound: associations.inbound ?? [],
    childDocuments: associations.childDocuments ?? [],
  }
}
</script>

<style scoped>
.panel {
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
  padding: 24px;
}

.panel--primary {
  grid-column: span 1;
}

.ranking-detail {
  display: block;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
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
.ranking-item__meta,
.ranking-item__timestamps {
  color: var(--panel-muted);
  font-size: 13px;
}

.panel-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.meta-text {
  font-size: 12px;
  white-space: nowrap;
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

.ranking-list {
  display: grid;
  gap: 12px;
}

.ranking-entry {
  display: grid;
  gap: 10px;
}

.ranking-item {
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s;
  display: grid;
  gap: 10px;
}

.ranking-item:hover {
  background: var(--surface-card-soft);
}

.ranking-item__meta,
.ranking-item__timestamps,
.ranking-item__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.ranking-item__wiki {
  display: grid;
  gap: 12px;
}

.ranking-item__timestamps {
  row-gap: 4px;
}

.ghost-button {
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.ghost-button:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
}

.ghost-button--filled {
  background: color-mix(in srgb, var(--b3-theme-primary) 9%, var(--surface-card));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 50%, transparent);
}

.ghost-button--filled:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 16%, var(--surface-card));
}

.ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--panel-muted);
  background: var(--surface-card);
  border-radius: 12px;
  border: 1px dashed var(--panel-border);
}

.link-association {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed var(--panel-border);
  background: var(--surface-card-soft);
  display: grid;
  gap: 12px;
}

.link-association__toggle {
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.link-association__toggle--expanded {
  color: color-mix(in srgb, var(--accent-cool) 75%, var(--b3-theme-on-background));
}

.link-association__caret {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.2s ease;
}

.link-association__toggle--expanded .link-association__caret {
  transform: rotate(45deg);
}

.link-association__list {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.link-association__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.link-association__doc {
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  color: var(--b3-theme-primary);
  cursor: pointer;
  text-align: left;
}

.link-association__doc:hover {
  color: color-mix(in srgb, var(--b3-theme-primary) 70%, transparent);
}

.link-association__doc--highlight {
  color: color-mix(in srgb, var(--accent-warm) 75%, var(--b3-theme-on-background));
  font-weight: 600;
}

.link-association__doc--highlight:hover {
  color: color-mix(in srgb, var(--accent-warm) 60%, var(--b3-theme-on-background));
}
</style>
