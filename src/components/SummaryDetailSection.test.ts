import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import SummaryDetailSection from './SummaryDetailSection.vue'

const baseProps = {
  selectedSummaryCount: 1,
  isExpanded: true,
  onTogglePanel: vi.fn(),
  aiSuggestionEnabled: true,
  aiSuggestionConfigured: true,
  aiSuggestionLoading: false,
  aiSuggestionError: '',
  generateAiInbox: vi.fn(),
  orphanDetailItems: [],
  orphanThemeSuggestions: new Map<string, Array<{ themeDocumentId: string, themeDocumentTitle: string, themeName: string, matchCount: number }>>(),
  orphanSort: 'updated-desc' as const,
  onUpdateOrphanSort: vi.fn(),
  dormantDays: 30,
  onUpdateDormantDays: vi.fn(),
  openDocument: vi.fn(),
  toggleOrphanThemeSuggestion: vi.fn(),
  isThemeSuggestionActive: vi.fn(() => false),
  toggleOrphanAiLinkSuggestion: vi.fn(),
  isAiLinkSuggestionActive: vi.fn(() => false),
  toggleOrphanAiTagSuggestion: vi.fn(),
  isAiTagSuggestionActive: vi.fn(() => false),
  aiEnabled: true,
  aiLinkSuggestionConfigReady: true,
  orphanAiSuggestionStates: new Map(),
  generateOrphanAiSuggestion: vi.fn(),
  readCardMode: 'unread' as const,
  pathScope: 'focused' as const,
  onUpdatePathScope: vi.fn(),
  maxPathDepth: 4,
  onUpdateMaxPathDepth: vi.fn(),
  fromDocumentId: 'doc-a',
  onUpdateFromDocumentId: vi.fn(),
  toDocumentId: 'doc-b',
  onUpdateToDocumentId: vi.fn(),
  pathOptions: [
    { id: 'doc-a', title: 'Alpha' },
    { id: 'doc-b', title: 'Beta' },
  ],
  pathChain: ['doc-a', 'doc-b'],
  resolveTitle: (documentId: string) => ({ 'doc-a': 'Alpha', 'doc-b': 'Beta' }[documentId] ?? documentId),
  snapshotLabel: '03-14 11:00',
  formatTimestamp: (timestamp?: string) => timestamp ?? '未知时间',
  toggleLinkPanel: vi.fn(),
  isLinkPanelExpanded: vi.fn(() => false),
  resolveLinkAssociations: vi.fn(() => ({ outbound: [], inbound: [], childDocuments: [] })),
  toggleLinkGroup: vi.fn(),
  isLinkGroupExpanded: vi.fn(() => false),
  isSyncing: vi.fn(() => false),
  syncAssociation: vi.fn(),
  formatDelta: (delta: number) => delta > 0 ? `+${delta}` : String(delta),
  themeDocumentIds: new Set<string>(['doc-a']),
  selectCommunity: vi.fn(),
}

describe('SummaryDetailSection', () => {
  it('renders generic list details inside a collapsible panel', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        detail: {
          key: 'documents',
          title: '文档样本详情',
          description: '当前筛选条件命中的文档。',
          kind: 'list',
          items: [
            {
              documentId: 'doc-a',
              title: 'Alpha',
              meta: '/Alpha · 最近更新 2026-03-14',
              badge: '主题文档',
              isThemeDocument: true,
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)
    const toggleMarkup = html.match(/<button class="panel-toggle"[\s\S]*?<\/button>/)?.[0] ?? ''

    expect(html).toContain('文档样本详情')
    expect(html).toContain('summary-detail-item')
    expect(html).toContain('Alpha')
    expect(html).toContain('主题文档')
    expect(toggleMarkup).toContain('aria-label="折叠详情"')
    expect(toggleMarkup).toContain('panel-toggle__caret')
    expect(toggleMarkup).not.toMatch(/>\s*折叠\s*<span/)
    expect(toggleMarkup).not.toMatch(/>\s*展开\s*<span/)
  })

  it('renders propagation detail items and path controls', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        detail: {
          key: 'propagation',
          title: '传播节点详情',
          description: '高频出现在关键最短路径上的文档。',
          kind: 'propagation',
          items: [
            {
              documentId: 'doc-a',
              title: 'Alpha',
              meta: '覆盖 2 个焦点文档 · 社区跨度 1',
              badge: '3 分',
              isThemeDocument: true,
              suggestions: [{ label: '传播优化', text: '建议补充路径说明。' }],
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('传播节点详情')
    expect(html).toContain('关系传播路径')
    expect(html).toContain('核心 + 桥接')
    expect(html).toContain('Alpha')
    expect(html).toContain('3 分')
    expect(html).toContain('path-node')
  })

  it('renders orphan-style theme suggestions inside unread detail items', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        orphanThemeSuggestions: new Map([
          ['doc-orphan', [
            { themeDocumentId: 'doc-theme-ai', themeDocumentTitle: '主题-AI-索引', themeName: 'AI', matchCount: 2 },
          ]],
        ]),
        detail: {
          key: 'read',
          title: '未读文档详情',
          description: '未命中已读规则的文档。',
          kind: 'list',
          items: [
            {
              documentId: 'doc-orphan',
              title: 'Alpha',
              meta: '创建于 2026-03-14',
              badge: '待标记',
              suggestions: [{ label: '补齐链接', text: '当前没有文档级连接。' }],
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('未读文档详情')
    expect(html).toContain('创建于 2026-03-14')
    expect(html).toContain('补齐链接')
    expect(html).toContain('当前没有文档级连接，建议链接以下主题文档（点击添加）：')
    expect(html).toContain('AI')
  })

  it('renders today suggestions inside the shared detail panel and uses reanalyze action text', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        selectedSummaryCount: 2,
        detail: {
          key: 'todaySuggestions',
          title: '今日建议详情',
          description: '按优先级提供建议',
          kind: 'aiInbox',
          result: {
            generatedAt: '2026-04-03T08:00:00.000Z',
            summary: '今天先补 AI 主题连接。',
            items: [
              {
                id: 'task-doc-1',
                type: 'document',
                title: '修复孤立文档：AI 与机器学习整理',
                priority: 'P1',
                action: '先补到主题-AI-索引，再补到主题-机器学习-索引。\n可归入 AI 主题：((doc-a "主题-AI-索引"))',
                reason: '当前窗口内孤立，但和 AI 主题页、机器学习主题页都有明显匹配。能移出孤立文档，并把主题社区规模从 8 提升到 9。',
                documentIds: ['doc-a'],
                recommendedTargets: [
                  {
                    documentId: 'doc-a',
                    title: '主题-AI-索引',
                    reason: '承担主题入口角色',
                    kind: 'theme-document',
                  },
                ],
                evidence: ['当前窗口内孤立', '主题匹配命中 4 次'],
                expectedChanges: ['孤立文档数预计减少 1'],
              },
            ],
          },
        },
        aiSuggestionEnabled: true,
        aiSuggestionConfigured: true,
        aiSuggestionLoading: false,
        aiSuggestionError: '',
        generateAiInbox: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('2 项建议')
    expect(html).toContain('重新分析')
    expect(html).toContain('今天先补 AI 主题连接。')
    expect(html).toContain('document-title__button--default')
    expect(html).not.toContain('打开文档')
    expect(html).toContain('推荐目标')
    expect(html).toContain('推荐动作')
    expect(html).toContain('推荐理由')
    expect(html).toContain('先补到主题-AI-索引，再补到主题-机器学习-索引。')
    expect(html).toContain('可归入 AI 主题：((doc-a &quot;主题-AI-索引&quot;))')
    expect(html).toContain('当前窗口内孤立，但和 AI 主题页、机器学习主题页都有明显匹配。')
    expect(html).toContain('能移出孤立文档，并把主题社区规模从 8 提升到 9。')
    expect(html).toContain('当前窗口内孤立')
    expect(html).toContain('孤立文档数预计减少 1')
    expect(html.indexOf('推荐目标')).toBeLessThan(html.indexOf('推荐动作'))
    expect(html.indexOf('推荐动作')).toBeLessThan(html.indexOf('推荐理由'))
    expect(html).not.toContain('为什么先做')
    expect(html).not.toContain('预估收益')
    expect(html).not.toContain('建议草稿')
    expect(html).toContain('主题-AI-索引')
    expect(html).not.toContain('>证据<')
    expect(html).not.toContain('>处理后变化<')
    expect(html).not.toContain('测试连接')
  })
})
