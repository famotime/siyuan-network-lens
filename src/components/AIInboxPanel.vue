<template>
  <section class="panel ai-inbox-panel">
    <div class="panel-header">
      <div class="ai-inbox-panel__header-copy">
        <p class="ai-inbox-panel__eyebrow">AI Inbox</p>
        <h2>AI 整理收件箱</h2>
        <p class="ai-inbox-panel__description">
          今天先处理什么？
        </p>
      </div>
      <div class="panel-header__actions">
        <button
          v-if="isConfigured"
          class="ghost-button"
          type="button"
          :disabled="testingConnection"
          @click="onTestConnection"
        >
          {{ testingConnection ? '测试中...' : '测试连接' }}
        </button>
        <button
          class="action-button"
          type="button"
          :disabled="loading || !enabled || !isConfigured"
          @click="onGenerate"
        >
          {{ loading ? '生成中...' : '今日建议' }}
        </button>
        <button
          class="panel-toggle"
          type="button"
          :aria-expanded="isExpanded"
          @click="onTogglePanel"
        >
          <span class="panel-toggle__caret" aria-hidden="true" />
          {{ isExpanded ? '折叠' : '展开' }}
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="ai-inbox-panel__body">
      <p v-if="connectionMessage" class="ai-inbox-panel__status ai-inbox-panel__status--success">
        {{ connectionMessage }}
      </p>

      <p v-if="error" class="ai-inbox-panel__status ai-inbox-panel__status--error">
        {{ error }}
      </p>

      <div
        v-if="!enabled"
        class="ai-inbox-panel__empty"
      >
        在设置页启用 AI 整理收件箱后，这里会基于当前筛选结果生成今日优先待办。
      </div>

      <div
        v-else-if="!isConfigured"
        class="ai-inbox-panel__empty"
      >
        还缺少 OpenAI 兼容配置。请在设置页补充 Base URL、API Key 和 Model。
      </div>

      <div
        v-else-if="loading && !result"
        class="ai-inbox-panel__loading"
        aria-hidden="true"
      >
        <div class="ai-inbox-panel__loading-line loading-shimmer" />
        <div class="ai-inbox-panel__loading-line ai-inbox-panel__loading-line--short loading-shimmer" />
        <div class="ai-inbox-panel__loading-card loading-shimmer" />
        <div class="ai-inbox-panel__loading-card loading-shimmer" />
      </div>

      <div
        v-else-if="result"
        class="ai-inbox-panel__result"
      >
        <div class="ai-inbox-panel__summary">
          <p>{{ result.summary }}</p>
          <span class="ai-inbox-panel__meta">共 {{ result.items.length }} 项待办</span>
        </div>

        <div class="ai-inbox-panel__list">
          <article
            v-for="item in result.items"
            :key="item.id"
            class="ai-inbox-panel__item"
          >
            <div class="ai-inbox-panel__item-top">
              <div class="ai-inbox-panel__badges">
                <span class="badge">{{ resolveTypeLabel(item.type) }}</span>
                <span class="badge badge--priority">{{ item.priority }}</span>
              </div>
              <button
                v-if="item.documentIds?.length"
                class="ghost-button ai-inbox-panel__open-button"
                type="button"
                @click="openDocument(item.documentIds[0])"
              >
                打开文档
              </button>
            </div>
            <div
              v-if="resolveAiInboxItemDocumentId(item)"
              class="ai-inbox-panel__source-title"
            >
              <span
                v-if="resolveAiInboxItemTitleParts(item.title).prefix"
                class="ai-inbox-panel__source-prefix"
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

            <div class="ai-inbox-panel__detail-group">
              <p class="ai-inbox-panel__detail-title">推荐动作</p>
              <div v-if="resolveAiInboxActionTargets(item).length" class="ai-inbox-panel__action-pills">
                <button
                  v-for="target in resolveAiInboxActionTargets(item)"
                  :key="`${item.id}-${target.title}-action`"
                  :class="[
                    'ai-inbox-panel__action-pill',
                    { 'ai-inbox-panel__action-pill--active': isAiInboxTargetActive(item, target) },
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
                class="ai-inbox-panel__merged-copy"
              >
                {{ line }}
              </p>
            </div>

            <p class="ai-inbox-panel__merged-copy"><strong>推荐理由：</strong>{{ item.reason }}</p>

            <div v-if="item.recommendedTargets?.length" class="ai-inbox-panel__detail-group">
              <p class="ai-inbox-panel__detail-title">推荐目标</p>
              <div class="ai-inbox-panel__targets">
                <div
                  v-for="target in item.recommendedTargets"
                  :key="`${item.id}-${target.title}`"
                  class="ai-inbox-panel__target"
                >
                  <button
                    v-if="target.documentId"
                    class="ghost-button ai-inbox-panel__target-button"
                    type="button"
                    @click="openDocument(target.documentId)"
                  >
                    {{ target.title }}
                  </button>
                  <span v-else class="ai-inbox-panel__target-label">{{ target.title }}</span>
                  <p>{{ target.reason }}</p>
                </div>
              </div>
            </div>

            <div v-if="item.evidence?.length" class="ai-inbox-panel__detail-group">
              <p class="ai-inbox-panel__detail-title">证据</p>
              <ul class="ai-inbox-panel__detail-list">
                <li v-for="evidence in item.evidence" :key="`${item.id}-${evidence}`">
                  {{ evidence }}
                </li>
              </ul>
            </div>

            <div v-if="item.expectedChanges?.length" class="ai-inbox-panel__detail-group">
              <p class="ai-inbox-panel__detail-title">处理后变化</p>
              <ul class="ai-inbox-panel__detail-list">
                <li v-for="change in item.expectedChanges" :key="`${item.id}-${change}`">
                  {{ change }}
                </li>
              </ul>
            </div>

          </article>
        </div>
      </div>

      <div
        v-else
        class="ai-inbox-panel__empty"
      >
        点击“今日建议”，把当前卡片与详情中的信号收束成统一优先级列表。
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AiInboxItemType, AiInboxResult } from '@/analytics/ai-inbox'
import {
  resolveAiInboxActionLines,
  resolveAiInboxItemDocumentId,
  resolveAiInboxTargetIntent,
  splitAiInboxItemTitle,
} from '@/components/ai-inbox-detail'
import DocumentTitle from '@/components/DocumentTitle.vue'

const props = defineProps<{
  enabled: boolean
  isConfigured: boolean
  isExpanded: boolean
  loading: boolean
  testingConnection: boolean
  error: string
  connectionMessage: string
  result: AiInboxResult | null
  onGenerate: () => void | Promise<void>
  onTestConnection: () => void | Promise<void>
  onTogglePanel: () => void
  openDocument: (documentId: string) => void
  toggleAiLinkSuggestion?: (sourceDocumentId: string, targetDocumentId: string, targetDocumentTitle: string) => void | Promise<void>
  isAiLinkSuggestionActive?: (sourceDocumentId: string, targetDocumentId: string) => boolean
}>()

function resolveTypeLabel(type: AiInboxItemType) {
  if (type === 'connection') {
    return '补连接'
  }
  if (type === 'topic-page') {
    return '建主题页'
  }
  if (type === 'bridge-risk') {
    return '桥接风险'
  }
  return '整理文档'
}

function resolveAiInboxItemTitleParts(title: string) {
  return splitAiInboxItemTitle(title)
}

function resolveAiInboxActionTargets(item: NonNullable<AiInboxResult>['items'][number]) {
  return (item.recommendedTargets ?? []).filter(target => Boolean(target.documentId?.trim()))
}

function isAiInboxTargetActive(
  item: NonNullable<AiInboxResult>['items'][number],
  target: NonNullable<AiInboxResult>['items'][number]['recommendedTargets'][number],
) {
  const intent = resolveAiInboxTargetIntent(item, target)
  return intent.kind === 'toggle-link'
    ? props.isAiLinkSuggestionActive?.(intent.sourceDocumentId, intent.targetDocumentId) ?? false
    : false
}

async function handleAiInboxActionTargetClick(
  item: NonNullable<AiInboxResult>['items'][number],
  target: NonNullable<AiInboxResult>['items'][number]['recommendedTargets'][number],
) {
  const intent = resolveAiInboxTargetIntent(item, target)
  if (intent.kind === 'toggle-link') {
    await props.toggleAiLinkSuggestion?.(intent.sourceDocumentId, intent.targetDocumentId, intent.targetTitle)
    return
  }

  if (intent.kind === 'open-document') {
    props.openDocument(intent.documentId)
  }
}
</script>

<style scoped>
.panel {
  border-radius: 16px;
  border: 1px solid var(--panel-border, color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent));
  background: var(--surface-card-strong, var(--b3-theme-surface));
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
  padding: 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.panel-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action-button,
.ghost-button,
.panel-toggle {
  border: 0;
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s, color 0.2s;
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

.panel-toggle {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-card-soft, color-mix(in srgb, var(--b3-theme-primary) 8%, transparent));
  color: var(--b3-theme-on-background);
  gap: 6px;
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

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: color-mix(in srgb, var(--accent-cool, var(--b3-theme-primary)) 12%, var(--surface-card, var(--b3-theme-surface)));
  color: color-mix(in srgb, var(--accent-cool, var(--b3-theme-primary)) 72%, var(--b3-theme-on-background));
}

.ai-inbox-panel {
  margin-top: 16px;
}

.ai-inbox-panel__header-copy {
  display: grid;
  gap: 6px;
}

.ai-inbox-panel__eyebrow {
  margin: 0;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-cool, var(--b3-theme-primary)) 64%, var(--panel-muted, var(--b3-theme-on-background)));
  font-weight: 700;
}

.ai-inbox-panel__description,
.ai-inbox-panel__meta {
  color: var(--panel-muted, color-mix(in srgb, var(--b3-theme-on-background) 60%, transparent));
  font-size: 13px;
}

.ai-inbox-panel__body,
.ai-inbox-panel__result,
.ai-inbox-panel__list {
  display: grid;
  gap: 14px;
}

.ai-inbox-panel__status,
.ai-inbox-panel__empty,
.ai-inbox-panel__summary,
.ai-inbox-panel__item,
.ai-inbox-panel__loading-card {
  border-radius: 14px;
  border: 1px solid var(--panel-border, color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent));
  background: var(--surface-card, var(--b3-theme-surface));
}

.ai-inbox-panel__status,
.ai-inbox-panel__empty,
.ai-inbox-panel__summary,
.ai-inbox-panel__item {
  padding: 16px;
}

.ai-inbox-panel__status {
  margin: 0;
}

.ai-inbox-panel__status--success {
  color: color-mix(in srgb, var(--accent-cool, var(--b3-theme-primary)) 72%, var(--b3-theme-on-background));
  background: color-mix(in srgb, var(--accent-cool, var(--b3-theme-primary)) 8%, var(--surface-card, var(--b3-theme-surface)));
}

.ai-inbox-panel__status--error {
  color: var(--b3-theme-error);
  background: color-mix(in srgb, var(--b3-theme-error) 6%, var(--surface-card, var(--b3-theme-surface)));
}

.ai-inbox-panel__summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.ai-inbox-panel__summary p {
  margin: 0;
  line-height: 1.7;
}

.ai-inbox-panel__item {
  display: grid;
  gap: 10px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-warm, var(--b3-theme-primary)) 6%, transparent), transparent 44%),
    var(--surface-card, var(--b3-theme-surface));
}

.ai-inbox-panel__item h3,
.ai-inbox-panel__item p {
  margin: 0;
}

.ai-inbox-panel__item p {
  line-height: 1.7;
}

.ai-inbox-panel__merged-copy {
  white-space: pre-wrap;
}

.ai-inbox-panel__source-title {
  display: flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
}

.ai-inbox-panel__source-prefix {
  font-weight: 600;
  color: color-mix(in srgb, var(--b3-theme-on-background) 76%, transparent);
}

.ai-inbox-panel__detail-group {
  display: grid;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
}

.ai-inbox-panel__detail-title {
  font-size: 12px;
  font-weight: 700;
  color: color-mix(in srgb, var(--accent-cool, var(--b3-theme-primary)) 72%, var(--b3-theme-on-background));
}

.ai-inbox-panel__targets {
  display: grid;
  gap: 10px;
}

.ai-inbox-panel__action-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-inbox-panel__action-pill {
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

.ai-inbox-panel__action-pill:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);
}

.ai-inbox-panel__action-pill--active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
}

.ai-inbox-panel__target {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-cool, var(--b3-theme-primary)) 6%, var(--surface-card-soft, var(--b3-theme-surface)));
}

.ai-inbox-panel__target-button,
.ai-inbox-panel__target-label {
  width: fit-content;
}

.ai-inbox-panel__target-label {
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.ai-inbox-panel__detail-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.ai-inbox-panel__detail-list li {
  line-height: 1.6;
}

.ai-inbox-panel__item-top,
.ai-inbox-panel__badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.ai-inbox-panel__item-top {
  justify-content: space-between;
}

.badge--priority {
  background: color-mix(in srgb, var(--accent-warm, var(--b3-theme-primary)) 14%, var(--surface-card, var(--b3-theme-surface)));
  color: color-mix(in srgb, var(--accent-warm, var(--b3-theme-primary)) 72%, var(--b3-theme-on-background));
}

.ai-inbox-panel__open-button {
  min-width: auto;
}

.ai-inbox-panel__loading {
  display: grid;
  gap: 12px;
}

.ai-inbox-panel__loading-line,
.ai-inbox-panel__loading-card {
  min-height: 16px;
}

.ai-inbox-panel__loading-line {
  width: 100%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-card-soft, var(--b3-theme-surface)) 88%, transparent);
}

.ai-inbox-panel__loading-line--short {
  width: 56%;
}

.ai-inbox-panel__loading-card {
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
  animation: ai-inbox-shimmer 1.8s ease-in-out infinite;
}

@keyframes ai-inbox-shimmer {
  to {
    transform: translateX(100%);
  }
}

@media (max-width: 720px) {
  .panel-header {
    flex-direction: column;
  }

  .panel-header__actions {
    justify-content: flex-start;
  }

  .ai-inbox-panel__summary,
  .ai-inbox-panel__item-top {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
