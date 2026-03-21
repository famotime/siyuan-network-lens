import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

vi.mock('@/api', () => ({
  lsNotebooks: async () => ({
    notebooks: [],
  }),
  sql: async () => [],
}))

import SettingPanel from './SettingPanel.vue'

describe('SettingPanel', () => {
  it('renders setting groups in the expected order and lists the current summary card toggles', async () => {
    const app = createSSRApp({
      render: () => h(SettingPanel, {
        config: {
          showSummaryCards: true,
          showDocuments: true,
          showRead: true,
          showReferences: true,
          showRanking: true,
          showCommunities: true,
          showTrends: true,
          showOrphans: true,
          showDormant: true,
          showBridges: true,
          showPropagation: true,
          themeNotebookId: 'box-1',
          themeDocumentPath: '/专题',
          themeNamePrefix: '主题-',
          themeNameSuffix: '-索引',
          readTagNames: ['已读'],
          readTitlePrefixes: '已读-|三星-',
          readTitleSuffixes: '-五星',
          readPaths: '/已读|/归档',
        },
      }),
    })

    const html = await renderToString(app)

    expect(html.indexOf('主题文档')).toBeLessThan(html.indexOf('已读标记'))
    expect(html.indexOf('已读标记')).toBeLessThan(html.indexOf('统计卡片'))
    expect(html.indexOf('已读标记')).toBeLessThan(html.indexOf('传播与链路'))
    expect(html).toContain('主题文档路径')
    expect(html).toContain('已读目录')
    expect(html).toContain('已读标签')
    expect(html).toContain('标题前缀')
    expect(html).toContain('标题后缀')
    expect(html).toContain('文档样本卡片')
    expect(html).toContain('已读/未读文档卡片')
    expect(html).toContain('活跃关系卡片')
    expect(html).toContain('核心文档卡片')
    expect(html).toContain('趋势观察卡片')
    expect(html).toContain('主题社区卡片')
    expect(html).toContain('孤立文档卡片')
    expect(html).toContain('沉没文档卡片')
    expect(html).toContain('桥接节点卡片')
    expect(html).toContain('传播节点卡片')
    expect(html).not.toContain('核心文档排行卡片')
    expect(html).not.toContain('孤立与桥接卡片')
    expect(html).not.toContain('整理建议卡片')
  })
})
