import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import OrphanDetailPanel from './OrphanDetailPanel.vue'

describe('OrphanDetailPanel', () => {
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
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('孤立排序')
    expect(html).toContain('按更新时间')
    expect(html).toContain('Alpha')
    expect(html).toContain('主题文档')
    expect(html).toContain('补齐链接')
    expect(html).toContain('建议补充至少一条出链或入链，建议链接以下主题文档（点击添加）：')
    expect(html).toContain('AI')
    expect(html).not.toContain('主题-AI-索引</span>')
    expect(html).not.toContain('建议与主题文档建立链接：')
  })
})
