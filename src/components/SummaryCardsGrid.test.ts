import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SummaryCardsGrid from './SummaryCardsGrid.vue'

describe('SummaryCardsGrid', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('renders draggable summary cards and toggle buttons for mode-switchable cards', async () => {
    const app = createSSRApp({
      render: () => h(SummaryCardsGrid, {
        cards: [
          { key: 'documents', label: '文档样本', value: '8', hint: '命中当前筛选条件的文档数' },
          { key: 'read', label: '已读文档', value: '3', hint: '命中已读标记规则的文档数' },
          { key: 'largeDocuments', label: '大文档·资源', value: '4.0 KB', hint: '按文档本体与内嵌资源占用查看当前筛选结果中的 Top 10' },
        ],
        selectedSummaryCardKey: 'read',
        readCardMode: 'read',
        largeDocumentCardMode: 'storage',
        onSelectSummaryCard: vi.fn(),
        onToggleReadCardMode: vi.fn(),
        onToggleLargeDocumentCardMode: vi.fn(),
        onReorderSummaryCard: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('summary-grid')
    expect(html).toContain('draggable="true"')
    expect(html).toContain('summary-card__toggle')
    expect(html).toContain('Switch to unread docs')
    expect(html).toContain('Switch to text size mode')
    expect(html).toContain('文档样本')
    expect(html).toContain('已读文档')
    expect(html).toContain('大文档·资源')
  })

  it('switches toggle labels to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const app = createSSRApp({
      render: () => h(SummaryCardsGrid, {
        cards: [
          { key: 'read', label: '已读文档', value: '3', hint: '命中已读标记规则的文档数' },
          { key: 'largeDocuments', label: '大文档·资源', value: '4.0 KB', hint: '按文档本体与内嵌资源占用查看当前筛选结果中的 Top 10' },
        ],
        selectedSummaryCardKey: 'read',
        readCardMode: 'read',
        largeDocumentCardMode: 'storage',
        onSelectSummaryCard: vi.fn(),
        onToggleReadCardMode: vi.fn(),
        onToggleLargeDocumentCardMode: vi.fn(),
        onReorderSummaryCard: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('切换为未读文档')
    expect(html).toContain('切换为按文字统计')
    expect(html).toContain('大文档·资源')
  })
})
