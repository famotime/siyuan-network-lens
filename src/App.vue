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
      <div class="summary-grid">
        <button
          v-for="card in summaryCards"
          :key="card.label"
          :class="['summary-card', 'summary-card--interactive', { 'summary-card--active': card.key === selectedSummaryCardKey }]"
          type="button"
          @click="selectSummaryCard(card.key)"
        >
          <span class="summary-card__label">{{ card.label }}</span>
          <strong class="summary-card__value">{{ card.value }}</strong>
          <span class="summary-card__hint">{{ card.hint }}</span>
        </button>
      </div>

      <section
        v-if="selectedSummaryDetail"
        class="panel"
      >
        <div class="panel-header">
          <div>
            <h2>{{ selectedSummaryDetail.title }}</h2>
            <p>{{ selectedSummaryDetail.description }}</p>
          </div>
          <div class="panel-header__actions">
            <span class="meta-text">{{ selectedSummaryDetail.items.length }} 篇文档</span>
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
        </div>
      </section>

      <div class="layout-grid">
        <section class="panel panel--primary">
          <div class="panel-header">
            <div>
              <h2>核心文档排行</h2>
              <p>按文档级被引用次数、引用文档数和最近活跃时间排序。</p>
            </div>
            <div class="panel-header__actions">
              <span class="meta-text">最近刷新 {{ snapshotLabel }}</span>
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('ranking')"
                :aria-label="isPanelExpanded('ranking') ? '折叠详情' : '展开详情'"
                @click="togglePanel('ranking')"
              >
                {{ isPanelExpanded('ranking') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('ranking')"
            class="panel-body"
          >
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
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>整理建议</h2>
              <p>把结构信号直接转成整理动作。</p>
            </div>
            <div class="panel-header__actions">
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('suggestions')"
                :aria-label="isPanelExpanded('suggestions') ? '折叠详情' : '展开详情'"
                @click="togglePanel('suggestions')"
              >
                {{ isPanelExpanded('suggestions') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('suggestions')"
            class="panel-body"
          >
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
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>主题社区</h2>
              <p>按桥接节点拆分后的文档簇，并补充标签语义与主题页缺口提示。</p>
            </div>
            <div class="panel-header__actions">
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('communities')"
                :aria-label="isPanelExpanded('communities') ? '折叠详情' : '展开详情'"
                @click="togglePanel('communities')"
              >
                {{ isPanelExpanded('communities') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('communities')"
            class="panel-body"
          >
            <div
              v-if="report.communities.length"
              class="community-list"
            >
              <article
                v-for="community in report.communities"
                :key="community.id"
                :class="['community-item', { 'community-item--active': community.id === selectedCommunity?.id }]"
              >
                <div class="community-item__header">
                  <button
                    class="ghost-button"
                    type="button"
                    @click="selectCommunity(community.id)"
                  >
                    {{ community.documentIds.length }} 篇文档
                  </button>
                  <span>核心文档：{{ community.hubDocumentIds.map(resolveTitle).join(' / ') }}</span>
                </div>
                <p class="community-item__meta">
                  标签语义：{{ community.topTags.join(' / ') || '未提取到高频标签' }}
                </p>
                <p class="community-item__meta">
                  分布笔记本：{{ community.notebookIds.map(resolveNotebookName).join(' / ') }}
                </p>
                <p
                  v-if="community.missingTopicPage"
                  class="community-item__warning"
                >
                  当前社区缺少明显的索引/总览页，适合补一篇主题页。
                </p>
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
              v-if="selectedCommunity && selectedCommunityTrend"
              class="community-detail"
            >
              <div class="community-detail__header">
                <strong>当前社区详情</strong>
                <span>{{ selectedCommunityTrend.currentReferences }}/{{ selectedCommunityTrend.previousReferences }}，变化 {{ formatDelta(selectedCommunityTrend.delta) }}</span>
              </div>
              <p>
                主题标签：{{ selectedCommunity.topTags.join(' / ') || '未提取到高频标签' }}
              </p>
              <p>
                笔记本分布：{{ selectedCommunity.notebookIds.map(resolveNotebookName).join(' / ') }}
              </p>
            </div>
            <div
              v-else
              class="empty-state"
            >
              还没有形成可解释的主题社区。
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>孤立与桥接</h2>
              <p>识别当前断裂内容、历史零散证据与长期沉没资料。</p>
            </div>
            <div class="panel-header__actions">
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('orphan-bridge')"
                :aria-label="isPanelExpanded('orphan-bridge') ? '折叠详情' : '展开详情'"
                @click="togglePanel('orphan-bridge')"
              >
                {{ isPanelExpanded('orphan-bridge') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('orphan-bridge')"
            class="panel-body"
          >
            <div class="split-block">
              <div>
                <h3>孤立文档</h3>
                <div
                  v-if="report.orphans.length"
                  class="mini-list"
                >
                  <article
                    v-for="item in report.orphans"
                    :key="item.documentId"
                    class="mini-list__entry"
                  >
                    <button
                      class="mini-list__item"
                      type="button"
                      @click="openDocument(item.documentId)"
                    >
                      {{ item.title }}
                    </button>
                    <p class="mini-list__meta">
                      最近更新时间：{{ formatTimestamp(item.updatedAt) }}
                    </p>
                    <p
                      v-if="item.hasSparseEvidence"
                      class="mini-list__meta"
                    >
                      历史上还有 {{ item.historicalReferenceCount }} 条零散证据，最后一次出现在 {{ formatTimestamp(item.lastHistoricalAt) }}
                    </p>
                  </article>
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
                  <article
                    v-for="item in report.bridgeDocuments"
                    :key="item.documentId"
                    class="mini-list__entry"
                  >
                    <button
                      class="mini-list__item"
                      type="button"
                      @click="openDocument(item.documentId)"
                    >
                      {{ item.title }}
                    </button>
                    <p class="mini-list__meta">
                      连接度：{{ item.degree }}
                    </p>
                  </article>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  没有识别到桥接文档。
                </p>
              </div>
              <div>
                <h3>沉没文档</h3>
                <div
                  v-if="report.dormantDocuments.length"
                  class="mini-list"
                >
                  <article
                    v-for="item in report.dormantDocuments"
                    :key="item.documentId"
                    class="mini-list__entry"
                  >
                    <button
                      class="mini-list__item"
                      type="button"
                      @click="openDocument(item.documentId)"
                    >
                      {{ item.title }}
                    </button>
                    <p class="mini-list__meta">
                      {{ item.inactivityDays }} 天未产生连接，最近活动 {{ formatTimestamp(item.lastConnectedAt || item.updatedAt) }}
                    </p>
                    <p
                      v-if="item.hasSparseEvidence"
                      class="mini-list__meta"
                    >
                      仍保留 {{ item.historicalReferenceCount }} 条历史入链/出链记录。
                    </p>
                  </article>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  没有达到沉没阈值的文档。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>趋势观察</h2>
              <p>同时观察文档升降温、主题活跃度，以及新增/断裂连接。</p>
            </div>
            <div class="panel-header__actions">
              <span class="meta-text">{{ trendLabel }}</span>
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('trends')"
                :aria-label="isPanelExpanded('trends') ? '折叠详情' : '展开详情'"
                @click="togglePanel('trends')"
              >
                {{ isPanelExpanded('trends') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('trends')"
            class="panel-body"
          >
            <div class="trend-stats">
              <div>
                <span>当前窗口</span>
                <strong>{{ trends.current.referenceCount }}</strong>
              </div>
              <div>
                <span>前一窗口</span>
                <strong>{{ trends.previous.referenceCount }}</strong>
              </div>
              <div>
                <span>新增连接</span>
                <strong>{{ trends.connectionChanges.newCount }}</strong>
              </div>
              <div>
                <span>断裂连接</span>
                <strong>{{ trends.connectionChanges.brokenCount }}</strong>
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

            <div class="split-block">
              <div>
                <h3>升温主题</h3>
                <div
                  v-if="trends.risingCommunities.length"
                  class="trend-list"
                >
                  <article
                    v-for="community in trends.risingCommunities.slice(0, 3)"
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
                  v-if="trends.dormantCommunities.length"
                  class="trend-list"
                >
                  <article
                    v-for="community in trends.dormantCommunities.slice(0, 3)"
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
                  v-if="trends.connectionChanges.brokenEdges.length"
                  class="trend-list"
                >
                  <article
                    v-for="edge in trends.connectionChanges.brokenEdges.slice(0, 3)"
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
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>关系传播路径</h2>
              <p>支持限定路径深度与范围，查看文档如何跨主题建立连接。</p>
            </div>
            <div class="panel-header__actions">
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('paths')"
                :aria-label="isPanelExpanded('paths') ? '折叠详情' : '展开详情'"
                @click="togglePanel('paths')"
              >
                {{ isPanelExpanded('paths') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('paths')"
            class="panel-body"
          >
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
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>高传播价值节点</h2>
              <p>统计哪些中间文档最常出现在核心文档、桥接文档和社区枢纽之间的最短路径上。</p>
            </div>
            <div class="panel-header__actions">
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('propagation')"
                :aria-label="isPanelExpanded('propagation') ? '折叠详情' : '展开详情'"
                @click="togglePanel('propagation')"
              >
                {{ isPanelExpanded('propagation') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('propagation')"
            class="panel-body"
          >
            <div
              v-if="report.propagationNodes.length"
              class="propagation-list"
            >
              <article
                v-for="item in report.propagationNodes.slice(0, 8)"
                :key="item.documentId"
                class="propagation-item"
              >
                <div class="propagation-item__header">
                  <button
                    class="propagation-item__title"
                    type="button"
                    @click="selectEvidence(item.documentId)"
                  >
                    {{ item.title }}
                  </button>
                  <span class="badge">{{ item.score }} 分</span>
                </div>
                <p class="propagation-item__meta">
                  参与 {{ item.pathPairCount }} 对关键文档的最短路径，覆盖 {{ item.focusDocumentCount }} 个焦点文档
                </p>
                <p class="propagation-item__meta">
                  社区跨度：{{ item.communitySpan || 1 }}{{ item.bridgeRole ? '，同时是桥接节点' : '' }}
                </p>
              </article>
            </div>
            <div
              v-else
              class="empty-state"
            >
              当前筛选条件下还没有明显的传播节点。
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>文档详情</h2>
              <p>围绕当前选中文档汇总其社区位置、桥接角色与沉没风险。</p>
            </div>
            <div class="panel-header__actions">
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('document-detail')"
                :aria-label="isPanelExpanded('document-detail') ? '折叠详情' : '展开详情'"
                @click="togglePanel('document-detail')"
              >
                {{ isPanelExpanded('document-detail') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('document-detail')"
            class="panel-body"
          >
            <div
              v-if="selectedDocumentDetail"
              class="detail-grid"
            >
              <div class="detail-card">
                <span>当前文档</span>
                <strong>{{ resolveTitle(selectedDocumentDetail.documentId) }}</strong>
              </div>
              <div class="detail-card">
                <span>所属社区</span>
                <strong>{{ selectedDocumentDetail.community?.topTags.join(' / ') || '未归入主题社区' }}</strong>
              </div>
              <div class="detail-card">
                <span>桥接角色</span>
                <strong>{{ selectedDocumentDetail.bridge ? `是，连接度 ${selectedDocumentDetail.bridge.degree}` : '否' }}</strong>
              </div>
              <div
                v-if="selectedDocumentDetail.propagation"
                class="detail-card"
              >
                <span>传播价值</span>
                <strong>
                  {{ selectedDocumentDetail.propagation.score }} 分，参与 {{ selectedDocumentDetail.propagation.pathPairCount }} 对关键最短路径
                </strong>
              </div>
              <div class="detail-card">
                <span>趋势变化</span>
                <strong>
                  {{
                    selectedDocumentDetail.trend
                      ? `${formatDelta(selectedDocumentDetail.trend.delta)} (${selectedDocumentDetail.trend.currentReferences}/${selectedDocumentDetail.trend.previousReferences})`
                      : '当前窗口无明显变化'
                  }}
                </strong>
              </div>
              <div
                v-if="selectedDocumentDetail.orphan"
                class="detail-card"
              >
                <span>孤立状态</span>
                <strong>
                  {{
                    selectedDocumentDetail.orphan.hasSparseEvidence
                      ? `孤立，但仍有 ${selectedDocumentDetail.orphan.historicalReferenceCount} 条历史证据`
                      : '当前窗口内孤立'
                  }}
                </strong>
              </div>
              <div
                v-if="selectedDocumentDetail.dormant"
                class="detail-card"
              >
                <span>沉没风险</span>
                <strong>{{ selectedDocumentDetail.dormant.inactivityDays }} 天未产生有效连接</strong>
              </div>
            </div>
            <div
              v-else
              class="empty-state"
            >
              当前没有可展示的文档详情。
            </div>
          </div>
        </section>

        <section class="panel panel--evidence">
          <div class="panel-header">
            <div>
              <h2>引用证据</h2>
              <p>解释为什么文档被识别为核心节点或连接节点。</p>
            </div>
            <div class="panel-header__actions">
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="isPanelExpanded('evidence')"
                :aria-label="isPanelExpanded('evidence') ? '折叠详情' : '展开详情'"
                @click="togglePanel('evidence')"
              >
                {{ isPanelExpanded('evidence') ? '折叠' : '展开' }}
                <span
                  class="panel-toggle__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-show="isPanelExpanded('evidence')"
            class="panel-body"
          >
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
  type OrphanSort,
  type TimeRange,
} from '@/analytics/analysis'
import {
  buildSummaryDetailSections,
  type SummaryCardItem,
  type SummaryCardKey,
} from '@/analytics/summary-details'
import {
  buildPanelCollapseState,
  togglePanelCollapse,
  type PanelCollapseState,
} from '@/analytics/panel-collapse'
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from '@/analytics/siyuan-data'

type PathScope = 'focused' | 'all' | 'community'
type SnapshotDocument = AnalyticsSnapshot['documents'][number]
const panelKeys = [
  'summary-detail',
  'ranking',
  'suggestions',
  'communities',
  'orphan-bridge',
  'trends',
  'paths',
  'propagation',
  'document-detail',
  'evidence',
] as const
type PanelKey = typeof panelKeys[number]

const props = defineProps<{
  plugin: Plugin
}>()

const suggestionTypeLabel = {
  'promote-hub': '升级为主题页',
  'repair-orphan': '补齐链接',
  'maintain-bridge': '重点维护',
  'archive-dormant': '归档沉没',
} as const

const loading = ref(false)
const errorMessage = ref('')
const snapshot = ref<AnalyticsSnapshot | null>(null)
const timeRange = ref<TimeRange>('all')
const selectedNotebook = ref('')
const selectedTag = ref('')
const keyword = ref('')
const orphanSort = ref<OrphanSort>('updated-desc')
const dormantDays = ref(30)
const analysisNow = ref(new Date())
const fromDocumentId = ref('')
const toDocumentId = ref('')
const selectedEvidenceDocument = ref('')
const selectedCommunityId = ref('')
const pathScope = ref<PathScope>('focused')
const maxPathDepth = ref(6)
const selectedSummaryCardKey = ref<SummaryCardKey>('documents')
const panelCollapseState = ref<PanelCollapseState<PanelKey>>(buildPanelCollapseState(panelKeys))

const filters = computed<AnalyticsFilters>(() => ({
  notebook: selectedNotebook.value || undefined,
  tag: selectedTag.value || undefined,
  keyword: keyword.value || undefined,
}))

const notebookOptions = computed(() => snapshot.value?.notebooks ?? [])
const tagOptions = computed(() => {
  const tagSet = new Set<string>()
  for (const document of snapshot.value?.documents ?? []) {
    for (const tag of normalizeTags(document.tags)) {
      tagSet.add(tag)
    }
  }
  return [...tagSet].sort((left, right) => left.localeCompare(right, 'zh-CN'))
})

const documentMap = computed(() => {
  return new Map((snapshot.value?.documents ?? []).map(document => [document.id, document]))
})

const filteredDocuments = computed(() => {
  return (snapshot.value?.documents ?? []).filter(document => matchesCurrentFilters(document))
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
    orphanSort: orphanSort.value,
    dormantDays: dormantDays.value,
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

const communityTrendMap = computed(() => {
  return new Map((trends.value?.communityTrends ?? []).map(item => [item.communityId, item]))
})

const selectedCommunity = computed(() => {
  if (!report.value?.communities.length) {
    return null
  }
  return report.value.communities.find(community => community.id === selectedCommunityId.value) ?? report.value.communities[0]
})

const selectedCommunityTrend = computed(() => {
  if (!selectedCommunity.value) {
    return null
  }
  return communityTrendMap.value.get(selectedCommunity.value.id) ?? null
})

const summaryCards = computed<SummaryCardItem[]>(() => {
  if (!report.value || !trends.value) {
    return []
  }
  return [
    {
      key: 'documents',
      label: '文档样本',
      value: report.value.summary.totalDocuments.toString(),
      hint: '命中当前筛选条件的文档数',
    },
    {
      key: 'references',
      label: '活跃关系',
      value: report.value.summary.totalReferences.toString(),
      hint: '当前窗口内的文档级引用次数',
    },
    {
      key: 'communities',
      label: '主题社区',
      value: report.value.summary.communityCount.toString(),
      hint: '按桥接节点拆分后的主题簇',
    },
    {
      key: 'orphans',
      label: '孤立文档',
      value: report.value.summary.orphanCount.toString(),
      hint: '历史上从未形成过文档级连接',
    },
    {
      key: 'dormant',
      label: '沉没文档',
      value: report.value.summary.dormantCount.toString(),
      hint: `超过 ${dormantDays.value} 天未产生有效连接`,
    },
    {
      key: 'bridges',
      label: '桥接节点',
      value: report.value.bridgeDocuments.length.toString(),
      hint: '断开后会削弱社区连接的文档',
    },
    {
      key: 'propagation',
      label: '传播节点',
      value: report.value.summary.propagationCount.toString(),
      hint: '出现在关键路径上的高传播价值节点',
    },
  ]
})

const summaryDetailSections = computed(() => {
  if (!snapshot.value || !report.value) {
    return null
  }

  return buildSummaryDetailSections({
    documents: snapshot.value.documents,
    references: snapshot.value.references,
    report: report.value,
    now: analysisNow.value,
    timeRange: timeRange.value,
    filters: filters.value,
    dormantDays: dormantDays.value,
  })
})

const selectedSummaryDetail = computed(() => {
  return summaryDetailSections.value?.[selectedSummaryCardKey.value] ?? null
})

const pathOptions = computed(() => {
  const ids = new Set<string>()

  if (pathScope.value === 'all') {
    for (const document of filteredDocuments.value) {
      ids.add(document.id)
    }
  } else if (pathScope.value === 'community') {
    for (const documentId of selectedCommunity.value?.documentIds ?? []) {
      ids.add(documentId)
    }
  } else {
    for (const item of report.value?.ranking ?? []) {
      ids.add(item.documentId)
    }
    for (const item of report.value?.bridgeDocuments ?? []) {
      ids.add(item.documentId)
    }
    for (const item of report.value?.propagationNodes ?? []) {
      ids.add(item.documentId)
    }
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
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
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
    maxDepth: maxPathDepth.value,
    filters: filters.value,
  })
})

const selectedEvidence = computed(() => {
  if (!report.value || !selectedEvidenceDocument.value) {
    return []
  }
  return report.value.evidenceByDocument[selectedEvidenceDocument.value] ?? []
})

const selectedDocumentDetail = computed(() => {
  if (!report.value || !selectedEvidenceDocument.value) {
    return null
  }

  const orphan = report.value.orphans.find(item => item.documentId === selectedEvidenceDocument.value) ?? null
  const dormant = report.value.dormantDocuments.find(item => item.documentId === selectedEvidenceDocument.value) ?? null
  const bridge = report.value.bridgeDocuments.find(item => item.documentId === selectedEvidenceDocument.value) ?? null
  const propagation = report.value.propagationNodes.find(item => item.documentId === selectedEvidenceDocument.value) ?? null
  const community = report.value.communities.find(item => item.documentIds.includes(selectedEvidenceDocument.value)) ?? null
  const trend = [
    ...(trends.value?.risingDocuments ?? []),
    ...(trends.value?.fallingDocuments ?? []),
  ].find(item => item.documentId === selectedEvidenceDocument.value) ?? null

  return {
    documentId: selectedEvidenceDocument.value,
    orphan,
    dormant,
    bridge,
    propagation,
    community,
    trend,
  }
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
  if (!nextReport) {
    selectedEvidenceDocument.value = ''
    selectedCommunityId.value = ''
    return
  }

  const preferredDocumentId = nextReport.ranking[0]?.documentId
    ?? nextReport.orphans[0]?.documentId
    ?? nextReport.bridgeDocuments[0]?.documentId
    ?? ''

  if (!preferredDocumentId) {
    selectedEvidenceDocument.value = ''
  } else if (!documentMap.value.has(selectedEvidenceDocument.value)) {
    selectedEvidenceDocument.value = preferredDocumentId
  }

  if (!nextReport.communities.some(item => item.id === selectedCommunityId.value)) {
    selectedCommunityId.value = nextReport.communities[0]?.id ?? ''
  }
}, { immediate: true })

watch(summaryCards, (cards) => {
  if (cards.length === 0) {
    return
  }
  if (!cards.some(card => card.key === selectedSummaryCardKey.value)) {
    selectedSummaryCardKey.value = cards[0].key
  }
}, { immediate: true })

watch([report, selectedEvidenceDocument], ([nextReport, documentId]) => {
  if (!nextReport || !documentId) {
    return
  }
  const community = nextReport.communities.find(item => item.documentIds.includes(documentId))
  if (community) {
    selectedCommunityId.value = community.id
  }
}, { immediate: true })

watch(pathScope, (scope) => {
  if (scope === 'community' && !selectedCommunity.value) {
    pathScope.value = 'focused'
  }
})

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

function selectCommunity(communityId: string) {
  selectedCommunityId.value = communityId
}

function selectSummaryCard(cardKey: SummaryCardKey) {
  selectedSummaryCardKey.value = cardKey
}

function togglePanel(key: PanelKey) {
  panelCollapseState.value = togglePanelCollapse(panelCollapseState.value, key)
}

function isPanelExpanded(key: PanelKey) {
  return panelCollapseState.value[key] ?? true
}

function resolveTitle(documentId: string) {
  return documentMap.value.get(documentId)?.title || documentId
}

function resolveNotebookName(notebookId: string) {
  return notebookOptions.value.find(notebook => notebook.id === notebookId)?.name ?? notebookId
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

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : delta.toString()
}

function matchesCurrentFilters(document: SnapshotDocument) {
  if (filters.value.notebook && document.box !== filters.value.notebook) {
    return false
  }
  const tags = normalizeTags(document.tags)
  if (filters.value.tag && !tags.includes(filters.value.tag)) {
    return false
  }
  if (filters.value.keyword) {
    const haystack = `${document.title ?? ''} ${document.hpath} ${tags.join(' ')}`.toLowerCase()
    if (!haystack.includes(filters.value.keyword.toLowerCase())) {
      return false
    }
  }
  return true
}

function normalizeTags(tags?: readonly string[] | string) {
  if (!tags) {
    return []
  }
  if (Array.isArray(tags)) {
    return tags
  }
  return tags
    .split(/[,\s#]+/)
    .map(tag => tag.trim())
    .filter(Boolean)
}
</script>

<style lang="scss" scoped>
.reference-analytics {
  --panel-border: color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
  --panel-strong: color-mix(in srgb, var(--b3-theme-primary) 18%, var(--b3-theme-surface));
  --panel-soft: color-mix(in srgb, var(--b3-theme-primary) 6%, var(--b3-theme-surface));
  --panel-muted: color-mix(in srgb, var(--b3-theme-on-surface) 72%, transparent);
  --surface-card: color-mix(in srgb, var(--b3-theme-surface) 94%, var(--b3-theme-background));
  --surface-card-strong: color-mix(in srgb, var(--b3-theme-surface) 88%, var(--b3-theme-background));
  --surface-card-soft: color-mix(in srgb, var(--b3-theme-surface) 82%, var(--b3-theme-background));
  --surface-chip-warm: color-mix(in srgb, var(--accent-warm) 22%, var(--b3-theme-surface));
  --surface-chip-cool: color-mix(in srgb, var(--accent-cool) 16%, var(--b3-theme-surface));
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
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin-bottom: 16px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card);
}

.filter-item span {
  font-size: 12px;
  color: var(--panel-muted);
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
  margin-bottom: 16px;
}

.summary-card,
.panel,
.state-banner {
  border-radius: 20px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 18px 38px -28px rgba(34, 52, 67, 0.35);
}

.summary-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.summary-card--interactive {
  width: 100%;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.summary-card--active {
  border-color: color-mix(in srgb, var(--accent-cool) 55%, transparent);
  background: color-mix(in srgb, var(--accent-cool) 10%, var(--b3-theme-surface));
}

.summary-card--interactive:hover {
  transform: translateY(-1px);
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
  grid-template-columns: 1fr;
  align-items: start;
}

.panel {
  padding: 18px;
}

.panel--primary,
.panel--evidence {
  grid-column: span 1;
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
.propagation-list,
.summary-detail-list,
.evidence-list {
  display: grid;
  gap: 10px;
}

.ranking-item,
.suggestion-item,
.community-item,
.propagation-item,
.summary-detail-item,
.evidence-item {
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-soft);
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
}

.ranking-item__title,
.suggestion-item__title,
.propagation-item__title,
.summary-detail-item__title,
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
.propagation-item__title,
.summary-detail-item__title,
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
.community-detail__header,
.propagation-item__header,
.summary-detail-item__header,
.path-controls,
.trend-stats,
.split-block,
.evidence-header {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.summary-detail-item__header {
  align-items: center;
  justify-content: space-between;
}

.panel-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.panel-toggle {
  border: 0;
  cursor: pointer;
  font: inherit;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  color: inherit;
  display: inline-flex;
  align-items: center;
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
  background: var(--surface-chip-warm);
  color: color-mix(in srgb, var(--accent-warm) 55%, var(--b3-theme-on-surface));
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
  background: var(--surface-chip-cool);
}

.split-block {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

.mini-list__entry,
.community-detail,
.detail-card {
  padding: 12px;
  border-radius: 14px;
  background: var(--surface-card);
}

.mini-list__item,
.trend-item button {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-card-soft);
}

.mini-list__entry {
  display: grid;
  gap: 8px;
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
  border-color: color-mix(in srgb, var(--accent-cool) 55%, transparent);
  box-shadow: 0 14px 32px -26px rgba(34, 124, 157, 0.45);
}

.community-item__warning {
  color: #8d431e;
}

.community-detail {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.trend-stats {
  margin-bottom: 12px;
}

.trend-stats div {
  flex: 1;
  min-width: 0;
  padding: 12px;
  border-radius: 14px;
  background: var(--surface-card);
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

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.detail-card {
  display: grid;
  gap: 8px;
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
