import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import OrphanDetailPanel from './OrphanDetailPanel.vue'

describe('OrphanDetailPanel', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('renders orphan sort control and items', async () => {
    const app = createSSRApp({
      render: () => h(OrphanDetailPanel, {
        items: [
          {
            documentId: 'doc-a',
            title: 'Alpha',
            isThemeDocument: true,
            meta: 'meta',
            suggestions: [
              { label: '补齐链接', text: '建议补充至少一条出链或入链。' },
            ],
            themeSuggestions: [
              { themeDocumentId: 'theme-ai', themeDocumentTitle: '主题-AI-索引', themeName: 'AI', matchCount: 2 },
            ],
          },
        ],
        orphanSort: 'updated-desc',
        onUpdateOrphanSort: vi.fn(),
        openDocument: vi.fn(),
        onToggleThemeSuggestion: vi.fn(),
        isThemeSuggestionActive: vi.fn().mockReturnValue(false),
        onToggleAiLinkSuggestion: vi.fn(),
        isAiLinkSuggestionActive: vi.fn().mockImplementation((_documentId, targetDocumentId) => targetDocumentId === 'theme-ai'),
        onToggleAiTagSuggestion: vi.fn(),
        isAiTagSuggestionActive: vi.fn().mockImplementation((_documentId, tag) => tag === 'AI'),
        aiEnabled: true,
        aiConfigReady: true,
        aiSuggestionStates: new Map([
          ['doc-a', {
            loading: true,
            statusMessage: '正在分析文档语义并生成 embedding…',
            error: '',
            result: null,
          }],
        ]),
        onGenerateAiSuggestion: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Orphan sort')
    expect(html).toContain('By updated time')
    expect(html).toContain('Alpha')
    expect(html).toContain('Topic doc')
    expect(html).toContain('补齐链接')
    expect(html).toContain('建议补充至少一条出链或入链, suggested topic docs below (click to add):')
    expect(html).toContain('AI')
    expect(html).toContain('AI suggestions')
    expect(html).toContain('正在分析文档语义并生成 embedding')
    expect(html).not.toContain('主题-AI-索引</span>')
    expect(html).not.toContain('Suggest linking to these topic docs:')
  })

  it('renders concise AI suggestions with merged reason and tag suggestions', async () => {
    const app = createSSRApp({
      render: () => h(OrphanDetailPanel, {
        items: [
          {
            documentId: 'doc-a',
            title: 'Alpha',
            meta: 'meta',
            themeSuggestions: [],
          },
        ],
        orphanSort: 'updated-desc',
        onUpdateOrphanSort: vi.fn(),
        openDocument: vi.fn(),
        onToggleThemeSuggestion: vi.fn(),
        isThemeSuggestionActive: vi.fn().mockReturnValue(false),
        onToggleAiLinkSuggestion: vi.fn(),
        isAiLinkSuggestionActive: vi.fn().mockReturnValue(false),
        onToggleAiTagSuggestion: vi.fn(),
        isAiTagSuggestionActive: vi.fn().mockReturnValue(false),
        aiEnabled: true,
        aiConfigReady: true,
        aiSuggestionStates: new Map([
          ['doc-a', {
            loading: false,
            statusMessage: '',
            error: '',
            result: {
              generatedAt: '2026-04-03T08:00:00.000Z',
              summary: '优先补到主题页。',
              suggestions: [
                {
                  targetDocumentId: 'theme-ai',
                  targetTitle: '主题-AI-索引',
                  targetType: 'theme-document',
                  confidence: 'high',
                  reason: '主题匹配和结构角色都很强，补链后更容易回到 AI 主题网络。',
                  draftText: '可归入 AI 主题：((theme-ai "主题-AI-索引"))',
                  tagSuggestions: [
                    { tag: 'AI', source: 'existing', reason: '当前标签集合里已有该标签。' },
                    { tag: 'AI 工具', source: 'new', reason: '更贴合工具实践语义。' },
                  ],
                },
              ],
            },
          }],
        ]),
        onGenerateAiSuggestion: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Link suggestions')
    expect(html).toContain('Tag suggestions')
    expect(html).toContain('主题-AI-索引')
    expect(html).toContain('补链后更容易回到 AI 主题网络')
    expect(html).not.toContain('预估收益')
    expect(html).toContain('当前标签集合里已有该标签')
    expect(html).toContain('AI 工具')
    expect(html).toContain('New tag')
    expect(html).toContain('Existing tag')
    expect(html).not.toContain('orphan-detail__ai-card')
    expect(html).toContain('orphan-detail__ai-item--elevated')
  })

  it('switches panel controls to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const app = createSSRApp({
      render: () => h(OrphanDetailPanel, {
        items: [],
        orphanSort: 'updated-desc',
        onUpdateOrphanSort: vi.fn(),
        openDocument: vi.fn(),
        onToggleThemeSuggestion: vi.fn(),
        isThemeSuggestionActive: vi.fn().mockReturnValue(false),
        onToggleAiLinkSuggestion: vi.fn(),
        isAiLinkSuggestionActive: vi.fn().mockReturnValue(false),
        onToggleAiTagSuggestion: vi.fn(),
        isAiTagSuggestionActive: vi.fn().mockReturnValue(false),
        aiEnabled: false,
        aiConfigReady: false,
        aiSuggestionStates: new Map(),
        onGenerateAiSuggestion: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('孤立排序')
    expect(html).toContain('按更新时间')
    expect(html).toContain('当前卡片下暂无文档。')
    expect(html).not.toContain('No docs to show under this card.')
  })
})
