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
          <option value="all">全部时间</option>
          <option value="7d">近 7 天</option>
          <option value="30d">近 30 天</option>
          <option value="90d">近 90 天</option>
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
      <div class="summary-grid">
        <article
          v-for="card in summaryCards"
          :key="card.label"
          class="summary-card"
        >
          <span class="summary-card__label">{{ card.label }}</span>
          <strong class="summary-card__value">{{ card.value }}</strong>
          <span class="summary-card__hint">{{ card.hint }}</span>
        </article>
      </div>

      <div class="layout-grid">
        <section class="panel panel--primary">
          <div class="panel-header">
            <div>
              <h2>核心文档排行</h2>
              <p>按文档级被引用次数、引用文档数和最近活跃时间排序。</p>
            </div>
            <span class="meta-text">最近刷新 {{ snapshotLabel }}</span>
          </div>

          <div
            v-if="report.ranking.length"
            class="ranking-list"
          >
            <article
              v-for="item in report.ranking.slice(0, 12)"
              :key="item.documentId"
              class="ranking-item"
            >
              <button
                class="ranking-item__title"
                type="button"
                @click="openDocument(item.documentId)"
              >
                {{ resolveTitle(item.documentId) }}
              </button>
              <div class="ranking-item__meta">
                <span>{{ item.inboundReferences }} 次引用</span>
                <span>{{ item.distinctSourceDocuments }} 个来源文档</span>
                <span>{{ formatTimestamp(item.lastActiveAt) }}</span>
              </div>
              <div class="ranking-item__actions">
                <button
                  class="ghost-button"
                  type="button"
                  @click="selectEvidence(item.documentId)"
                >
                  查看证据
                </button>
              </div>
            </article>
          </div>
          <div
            v-else
            class="empty-state"
          >
            当前筛选条件下没有命中的文档级引用关系。
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>整理建议</h2>
              <p>把结构信号直接转成整理动作。</p>
            </div>
          </div>

          <div
            v-if="report.suggestions.length"
            class="suggestion-list"
          >
            <article
              v-for="item in report.suggestions"
              :key="`${item.type}-${item.documentId}`"
              class="suggestion-item"
            >
              <span class="badge">{{ suggestionTypeLabel[item.type] }}</span>
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
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>主题社区</h2>
              <p>按桥接节点拆分后的文档簇，用于发现已经成形的主题结构。</p>
            </div>
          </div>

          <div
            v-if="report.communities.length"
            class="community-list"
          >
            <article
              v-for="community in report.communities"
              :key="community.id"
              class="community-item"
            >
              <div class="community-item__header">
                <strong>{{ community.documentIds.length }} 篇文档</strong>
                <span>核心文档：{{ community.hubDocumentIds.map(resolveTitle).join(' / ') }}</span>
              </div>
              <div class="community-tags">
                <button
                  v-for="documentId in community.documentIds"
                  :key="documentId"
                  class="community-tag"
                  type="button"
                  @click="openDocument(documentId)"
                >
                  {{ resolveTitle(documentId) }}
                </button>
              </div>
            </article>
          </div>
          <div
            v-else
            class="empty-state"
          >
            还没有形成可解释的主题社区。
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>孤立与桥接</h2>
              <p>识别沉没内容与关键桥梁节点。</p>
            </div>
          </div>

          <div class="split-block">
            <div>
              <h3>孤立文档</h3>
              <div
                v-if="report.orphans.length"
                class="mini-list"
              >
                <button
                  v-for="item in report.orphans"
                  :key="item.documentId"
                  class="mini-list__item"
                  type="button"
                  @click="openDocument(item.documentId)"
                >
                  {{ item.title }}
                </button>
              </div>
              <p
                v-else
                class="empty-inline"
              >
                没有孤立文档。
              </p>
            </div>
            <div>
              <h3>桥接文档</h3>
              <div
                v-if="report.bridgeDocuments.length"
                class="mini-list"
              >
                <button
                  v-for="item in report.bridgeDocuments"
                  :key="item.documentId"
                  class="mini-list__item"
                  type="button"
                  @click="openDocument(item.documentId)"
                >
                  {{ item.title }}
                </button>
              </div>
              <p
                v-else
                class="empty-inline"
              >
                没有识别到桥接文档。
              </p>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>趋势观察</h2>
              <p>基于引用源块更新时间近似计算最近活跃与前一窗口的变化。</p>
            </div>
            <span class="meta-text">{{ trendLabel }}</span>
          </div>

          <div class="trend-stats">
            <div>
              <span>当前窗口</span>
              <strong>{{ trends.current.referenceCount }}</strong>
            </div>
            <div>
              <span>前一窗口</span>
              <strong>{{ trends.previous.referenceCount }}</strong>
            </div>
          </div>

          <div class="split-block">
            <div>
              <h3>升温文档</h3>
              <div
                v-if="trends.risingDocuments.length"
                class="trend-list"
              >
                <article
                  v-for="item in trends.risingDocuments.slice(0, 5)"
                  :key="item.documentId"
                  class="trend-item"
                >
                  <button
                    type="button"
                    @click="openDocument(item.documentId)"
                  >
                    {{ item.title }}
                  </button>
                  <span>+{{ item.delta }} ({{ item.currentReferences }}/{{ item.previousReferences }})</span>
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
                v-if="trends.fallingDocuments.length"
                class="trend-list"
              >
                <article
                  v-for="item in trends.fallingDocuments.slice(0, 5)"
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
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>关系传播路径</h2>
              <p>用于理解两个核心文档之间经过哪些桥梁节点建立连接。</p>
            </div>
          </div>

          <div class="path-controls">
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
        </section>

        <section class="panel panel--evidence">
          <div class="panel-header">
            <div>
              <h2>引用证据</h2>
              <p>解释为什么文档被识别为核心节点或连接节点。</p>
            </div>
          </div>

          <div
            v-if="selectedEvidenceDocument"
            class="evidence-header"
          >
            <strong>{{ resolveTitle(selectedEvidenceDocument) }}</strong>
            <button
              class="ghost-button"
              type="button"
              @click="openDocument(selectedEvidenceDocument)"
            >
              打开文档
            </button>
          </div>

          <div
            v-if="selectedEvidence.length"
            class="evidence-list"
          >
            <article
              v-for="item in selectedEvidence"
              :key="item.id"
              class="evidence-item"
            >
              <button
                class="evidence-item__source"
                type="button"
                @click="openDocument(item.sourceDocumentId)"
              >
                {{ resolveTitle(item.sourceDocumentId) }}
              </button>
              <p>{{ item.content || '未读取到块级锚文本' }}</p>
              <span>{{ formatTimestamp(item.sourceUpdated) }}</span>
            </article>
          </div>
          <div
            v-else
            class="empty-state"
          >
            选择一篇核心文档后可查看原始引用证据。
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { openTab, showMessage, type Plugin } from 'siyuan'

import {
  analyzeReferenceGraph,
  analyzeTrends,
  findReferencePath,
  type AnalyticsFilters,
  type TimeRange,
} from '@/analytics/analysis'
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from '@/analytics/siyuan-data'

const props = defineProps<{
  plugin: Plugin
}>()

const suggestionTypeLabel = {
  'promote-hub': '升级为主题页',
  'repair-orphan': '补齐链接',
  'maintain-bridge': '重点维护',
} as const

const loading = ref(false)
const errorMessage = ref('')
const snapshot = ref<AnalyticsSnapshot | null>(null)
const timeRange = ref<TimeRange>('all')
const selectedNotebook = ref('')
const selectedTag = ref('')
const keyword = ref('')
const analysisNow = ref(new Date())
const fromDocumentId = ref('')
const toDocumentId = ref('')
const selectedEvidenceDocument = ref('')

const filters = computed<AnalyticsFilters>(() => ({
  notebook: selectedNotebook.value || undefined,
  tag: selectedTag.value || undefined,
  keyword: keyword.value || undefined,
}))

const notebookOptions = computed(() => snapshot.value?.notebooks ?? [])
const tagOptions = computed(() => {
  const tagSet = new Set<string>()
  for (const document of snapshot.value?.documents ?? []) {
    for (const tag of Array.isArray(document.tags) ? document.tags : []) {
      tagSet.add(tag)
    }
  }
  return [...tagSet].sort((left, right) => left.localeCompare(right, 'zh-CN'))
})

const documentMap = computed(() => {
  return new Map((snapshot.value?.documents ?? []).map(document => [document.id, document]))
})

const report = computed(() => {
  if (!snapshot.value) {
    return null
  }
  return analyzeReferenceGraph({
    documents: snapshot.value.documents,
    references: snapshot.value.references,
    now: analysisNow.value,
    timeRange: timeRange.value,
    filters: filters.value,
  })
})

const trendDays = computed(() => {
  if (timeRange.value === 'all') {
    return 30
  }
  return Number.parseInt(timeRange.value, 10)
})

const trendLabel = computed(() => `对比近 ${trendDays.value} 天与前一窗口`)

const trends = computed(() => {
  if (!snapshot.value) {
    return null
  }
  return analyzeTrends({
    documents: snapshot.value.documents,
    references: snapshot.value.references,
    now: analysisNow.value,
    days: trendDays.value,
    filters: filters.value,
  })
})

const summaryCards = computed(() => {
  if (!report.value || !trends.value) {
    return []
  }
  return [
    {
      label: '文档样本',
      value: report.value.summary.totalDocuments.toString(),
      hint: '命中当前筛选条件的文档数',
    },
    {
      label: '活跃关系',
      value: report.value.summary.totalReferences.toString(),
      hint: '文档级引用聚合后的边数量',
    },
    {
      label: '主题社区',
      value: report.value.summary.communityCount.toString(),
      hint: '已形成结构的文档簇',
    },
    {
      label: '孤立文档',
      value: report.value.summary.orphanCount.toString(),
      hint: '当前窗口内无文档级连接',
    },
    {
      label: '升温信号',
      value: trends.value.risingDocuments.length.toString(),
      hint: '较前一窗口活跃度提升的文档',
    },
    {
      label: '桥接节点',
      value: report.value.bridgeDocuments.length.toString(),
      hint: '断开后会削弱社区连接的文档',
    },
  ]
})

const pathOptions = computed(() => {
  const ids = new Set<string>()
  for (const item of report.value?.ranking ?? []) {
    ids.add(item.documentId)
  }
  for (const item of report.value?.bridgeDocuments ?? []) {
    ids.add(item.documentId)
  }
  return [...ids]
    .map((id) => {
      const document = documentMap.value.get(id)
      return document
        ? {
            id,
            title: resolveTitle(id),
          }
        : null
    })
    .filter((item): item is { id: string, title: string } => item !== null)
})

const pathChain = computed(() => {
  if (!snapshot.value || !fromDocumentId.value || !toDocumentId.value || fromDocumentId.value === toDocumentId.value) {
    return []
  }
  return findReferencePath({
    documents: snapshot.value.documents,
    references: snapshot.value.references,
    fromDocumentId: fromDocumentId.value,
    toDocumentId: toDocumentId.value,
    maxDepth: 6,
    filters: filters.value,
  })
})

const selectedEvidence = computed(() => {
  if (!report.value || !selectedEvidenceDocument.value) {
    return []
  }
  return report.value.evidenceByDocument[selectedEvidenceDocument.value] ?? []
})

const snapshotLabel = computed(() => {
  if (!snapshot.value) {
    return '--'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(snapshot.value.fetchedAt))
})

watch(pathOptions, (options) => {
  if (options.length === 0) {
    fromDocumentId.value = ''
    toDocumentId.value = ''
    return
  }
  if (!options.some(option => option.id === fromDocumentId.value)) {
    fromDocumentId.value = options[0]?.id ?? ''
  }
  if (!options.some(option => option.id === toDocumentId.value) || toDocumentId.value === fromDocumentId.value) {
    toDocumentId.value = options.find(option => option.id !== fromDocumentId.value)?.id ?? ''
  }
}, { immediate: true })

watch(report, (nextReport) => {
  if (!nextReport?.ranking.length) {
    selectedEvidenceDocument.value = ''
    return
  }
  if (!nextReport.ranking.some(item => item.documentId === selectedEvidenceDocument.value)) {
    selectedEvidenceDocument.value = nextReport.ranking[0].documentId
  }
}, { immediate: true })

onMounted(() => {
  refresh()
})

async function refresh() {
  loading.value = true
  errorMessage.value = ''
  analysisNow.value = new Date()
  try {
    snapshot.value = await loadAnalyticsSnapshot()
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取思源数据失败'
    errorMessage.value = message
    showMessage(message, 5000, 'error')
  } finally {
    loading.value = false
  }
}

function selectEvidence(documentId: string) {
  selectedEvidenceDocument.value = documentId
}

function resolveTitle(documentId: string) {
  return documentMap.value.get(documentId)?.title || documentId
}

function openDocument(documentId: string) {
  openTab({
    app: props.plugin.app,
    doc: {
      id: documentId,
      zoomIn: true,
    },
  })
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp || timestamp.length < 8) {
    return '未知时间'
  }
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`
}
</script>

<style lang="scss" scoped>
.reference-analytics {
  --panel-border: color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
  --panel-strong: color-mix(in srgb, var(--b3-theme-primary) 18%, var(--b3-theme-surface));
  --panel-soft: color-mix(in srgb, var(--b3-theme-primary) 6%, var(--b3-theme-surface));
  --panel-muted: color-mix(in srgb, var(--b3-theme-on-surface) 72%, transparent);
  --accent-warm: #e77b45;
  --accent-cool: #227c9d;
  height: 100%;
  overflow: auto;
  padding: 18px;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--b3-theme-primary) 22%, transparent), transparent 30%),
    linear-gradient(180deg, color-mix(in srgb, var(--b3-theme-background) 92%, #f4efe8), var(--b3-theme-background));
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
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-cool);
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: 24px;
  line-height: 1.15;
}

.hero-copy {
  margin-top: 8px;
  max-width: 44ch;
  color: var(--panel-muted);
  line-height: 1.5;
}

.filter-panel,
.summary-grid,
.layout-grid {
  display: grid;
  gap: 12px;
}

.filter-panel {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 16px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--b3-theme-surface) 90%, white);
}

.filter-item span {
  font-size: 12px;
  color: var(--panel-muted);
}

.filter-item--wide {
  grid-column: span 1;
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
  margin-bottom: 16px;
}

.summary-card,
.panel,
.state-banner {
  border-radius: 20px;
  border: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--b3-theme-surface) 92%, white);
  box-shadow: 0 18px 38px -28px rgba(34, 52, 67, 0.35);
}

.summary-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-card__label {
  font-size: 12px;
  color: var(--panel-muted);
}

.summary-card__value {
  font-size: 28px;
  line-height: 1;
}

.summary-card__hint {
  color: var(--panel-muted);
  font-size: 12px;
}

.layout-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.panel {
  padding: 18px;
}

.panel--primary,
.panel--evidence {
  grid-column: span 2;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.panel-header p,
.meta-text,
.empty-inline,
.evidence-item span,
.ranking-item__meta,
.trend-item span {
  color: var(--panel-muted);
}

.meta-text {
  font-size: 12px;
  white-space: nowrap;
}

.ranking-list,
.suggestion-list,
.community-list,
.evidence-list {
  display: grid;
  gap: 10px;
}

.ranking-item,
.suggestion-item,
.community-item,
.evidence-item {
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-soft);
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
}

.ranking-item__title,
.suggestion-item__title,
.evidence-item__source,
.trend-item button,
.mini-list__item,
.community-tag,
.path-node {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.ranking-item__title,
.suggestion-item__title,
.evidence-item__source {
  font-weight: 600;
}

.ranking-item {
  display: grid;
  gap: 8px;
}

.ranking-item__meta,
.ranking-item__actions,
.community-item__header,
.path-controls,
.trend-stats,
.split-block,
.evidence-header {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.badge,
.community-tag,
.path-node {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 10px;
}

.badge {
  width: fit-content;
  font-size: 12px;
  background: color-mix(in srgb, var(--accent-warm) 18%, white);
  color: #8d431e;
}

.community-tags,
.path-chain {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.community-tag,
.path-node {
  background: color-mix(in srgb, var(--accent-cool) 12%, white);
}

.split-block {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.split-block h3 {
  margin-bottom: 8px;
  font-size: 14px;
}

.mini-list,
.trend-list {
  display: grid;
  gap: 8px;
}

.mini-list__item,
.trend-item button {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--b3-theme-background) 84%, white);
}

.trend-stats {
  margin-bottom: 12px;
}

.trend-stats div {
  flex: 1;
  min-width: 0;
  padding: 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--b3-theme-background) 88%, white);
}

.trend-stats span {
  display: block;
  font-size: 12px;
  color: var(--panel-muted);
}

.trend-stats strong {
  font-size: 20px;
}

.trend-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.path-controls label {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}

.path-controls span {
  font-size: 12px;
  color: var(--panel-muted);
}

.action-button,
.ghost-button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.action-button {
  padding: 10px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent-cool), var(--accent-warm));
  color: white;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.ghost-button {
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  color: var(--b3-theme-primary);
}

.state-banner,
.empty-state {
  padding: 18px;
}

.state-banner--error {
  color: var(--b3-theme-error);
}

.evidence-header {
  justify-content: space-between;
  margin-bottom: 12px;
}

@media (max-width: 980px) {
  .filter-panel,
  .summary-grid,
  .layout-grid,
  .split-block {
    grid-template-columns: 1fr;
  }

  .panel--primary,
  .panel--evidence {
    grid-column: span 1;
  }

  .hero {
    flex-direction: column;
  }
}
</style>
