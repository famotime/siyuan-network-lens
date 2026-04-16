import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import DormantDetailPanel from './DormantDetailPanel.vue'

describe('DormantDetailPanel', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('renders dormant threshold control and items', async () => {
    const app = createSSRApp({
      render: () => h(DormantDetailPanel, {
        items: [
          {
            documentId: 'doc-a',
            title: 'Alpha',
            isThemeDocument: true,
            meta: 'meta',
            suggestions: [
              { label: '归档沉没', text: '建议归档或补齐索引入口。' },
            ],
          },
        ],
        dormantDays: 30,
        onUpdateDormantDays: vi.fn(),
        openDocument: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Dormant threshold')
    expect(html).toContain('30 days')
    expect(html).toContain('Alpha')
    expect(html).toContain('Topic doc')
    expect(html).toContain('归档沉没')
    expect(html).toContain('建议归档或补齐索引入口。')
  })

  it('switches empty-state copy to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const app = createSSRApp({
      render: () => h(DormantDetailPanel, {
        items: [],
        dormantDays: 90,
        onUpdateDormantDays: vi.fn(),
        openDocument: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('沉没阈值')
    expect(html).toContain('90 天')
    expect(html).toContain('当前卡片下暂无文档。')
  })
})
