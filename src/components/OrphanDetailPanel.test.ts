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
            meta: 'meta',
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
    expect(html).toContain('建议与主题文档建立链接：')
    expect(html).toContain('AI')
    expect(html).not.toContain('主题-AI-索引</span>')
  })
})
