import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

vi.mock('@/api', () => ({
  lsNotebooks: async () => ({
    notebooks: [],
  }),
}))

import SettingPanel from './SettingPanel.vue'

describe('SettingPanel', () => {
  it('renders topic document settings', async () => {
    const app = createSSRApp({
      render: () => h(SettingPanel, {
        config: {
          showSummaryCards: true,
          showRanking: true,
          showSuggestions: true,
          showCommunities: true,
          showOrphanBridge: true,
          showTrends: true,
          showPropagation: true,
          themeNotebookId: 'box-1',
          themeDocumentPath: '/专题',
          themeNamePrefix: '主题-',
          themeNameSuffix: '-索引',
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('主题文档')
    expect(html).toContain('主题文档路径')
    expect(html).toContain('名称前缀')
    expect(html).toContain('名称后缀')
  })
})
