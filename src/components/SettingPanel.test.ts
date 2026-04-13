import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

vi.mock('@/api', () => ({
  lsNotebooks: async () => ({
    notebooks: [],
  }),
  sql: async () => [],
  forwardProxy: async () => ({
    body: JSON.stringify({
      choices: [
        {
          message: {
            content: 'OK',
          },
        },
      ],
    }),
    contentType: 'application/json',
    elapsed: 12,
    headers: {},
    status: 200,
    url: 'https://api.example.com/v1/chat/completions',
  }),
}))

import SettingPanel from './SettingPanel.vue'
import { ALPHA_FEATURE_HIDE_CONFIG } from '@/plugin/alpha-feature-config'

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
          aiEnabled: true,
          aiBaseUrl: 'https://api.example.com/v1',
          aiApiKey: 'sk-test',
          aiModel: 'gpt-4.1-mini',
          aiEmbeddingModel: 'BAAI/bge-m3',
          aiRequestTimeoutSeconds: 30,
          aiMaxTokens: 10240,
          aiTemperature: 0.7,
          aiMaxContextMessages: 7,
          aiContextCapacity: 'compact',
          enableConsoleLogging: false,
          wikiEnabled: true,
          wikiPageSuffix: '-llm-wiki',
          wikiIndexTitle: 'LLM-Wiki-索引',
          wikiLogTitle: 'LLM-Wiki-维护日志',
        },
      }),
    })

    const html = await renderToString(app)
    const hiddenSummaryCardKeys = new Set(ALPHA_FEATURE_HIDE_CONFIG.hiddenSummaryCardKeys)
    const hiddenSettingKeys = new Set(ALPHA_FEATURE_HIDE_CONFIG.hiddenSettingKeys)

    expect(html.indexOf('主题文档')).toBeLessThan(html.indexOf('已读标记'))
    expect(html.indexOf('已读标记')).toBeLessThan(html.indexOf('统计卡片'))
    expect(html.indexOf('统计卡片')).toBeLessThan(html.indexOf('AI 接入'))
    expect(html.indexOf('AI 接入')).toBeLessThan(html.indexOf('调试'))
    expect(html.indexOf('已读标记')).toBeLessThan(html.indexOf('传播与链路'))
    expect(html).toContain('主题文档路径')
    expect(html).toContain('已读目录')
    expect(html).toContain('已读标签')
    expect(html).toContain('标题前缀')
    expect(html).toContain('标题后缀')
    expectCardSettingVisibility(html, 'documents', '文档样本卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'read', '已读/未读文档卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'references', '活跃关系卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'ranking', '核心文档卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'trends', '趋势观察卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'communities', '主题社区卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'orphans', '孤立文档卡片', hiddenSummaryCardKeys)
    expect(html).not.toContain('今日建议卡片')
    expectCardSettingVisibility(html, 'dormant', '沉没文档卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'bridges', '桥接节点卡片', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'propagation', '传播节点卡片', hiddenSummaryCardKeys)
    expect(html).toContain('AI 接入')
    expect(html).toContain('AI 服务商')
    expect(html).toContain('导入设置')
    expect(html).toContain('导出设置')
    expect(html).toContain('硅基流动')
    expect(html).toContain('OpenAI')
    expect(html).toContain('Gemini')
    expect(html).toContain('自定义')
    expect(html).toContain('启用 AI 今日建议')
    expect(html).toContain('Base URL')
    expect(html).toContain('https://api.siliconflow.cn/v1')
    expect(html).toContain('API Key')
    expect(html).toContain('aria-label="显示 API Key"')
    expect(html).toContain('type="password"')
    expect(html).toContain('setting-input-with-action setting-input-with-action--overlay')
    expect(html).toContain('setting-icon-button setting-icon-button--inline')
    expect(html).toContain('<svg')
    expect(html).not.toContain('setting-icon-button__text')
    expect(html).toContain('Model')
    expect(html).toContain('Embedding Model（可选）')
    expect(html).toContain('BAAI/bge-m3')
    expect(html).toContain('超时时间')
    expect(html).toContain('最大 Token 数')
    expect(html).toContain('温度')
    expect(html).toContain('最大上下文数')
    expect(html).toContain('上下文容量')
    expect(html).toContain('紧凑')
    expect(html).toContain('测试连接')
    expect(html).toContain('调试')
    expect(html).toContain('在控制台打印日志')
    expect(html).toContain('error 日志始终保留，其他级别受此开关控制')
    expectSettingVisibility(html, 'llm-wiki', '启用 LLM Wiki', hiddenSettingKeys)
    expectSettingVisibility(html, 'llm-wiki', '页面后缀', hiddenSettingKeys)
    expectSettingVisibility(html, 'llm-wiki', '索引页标题', hiddenSettingKeys)
    expectSettingVisibility(html, 'llm-wiki', '日志页标题', hiddenSettingKeys)
    expect(html).toContain('title="OpenAI 兼容服务通常需要填写到 /v1，例如 https://api.siliconflow.cn/v1"')
    expect(html).toContain('title="请求 API 时传入的 max_tokens 参数，用于控制生成的文本长度"')
    expect(html).toContain('title="请求 API 时传入的 temperature 参数，用于控制生成的文本随机性"')
    expect(html).toContain('setting-item-wrapper setting-item-grid')
    expect(html).toContain('setting-item--nested setting-item--grid')
    expect(html).not.toContain('<small')
    expect(html).not.toContain('核心文档排行卡片')
    expect(html).not.toContain('孤立与桥接卡片')
    expect(html).not.toContain('整理建议卡片')
  })

  it('hides alpha summary card settings and independent AI or wiki settings when configured', async () => {
    const previousHiddenSummaryCardKeys = [...ALPHA_FEATURE_HIDE_CONFIG.hiddenSummaryCardKeys]
    const previousHiddenSettingKeys = [...ALPHA_FEATURE_HIDE_CONFIG.hiddenSettingKeys]

    ALPHA_FEATURE_HIDE_CONFIG.hiddenSummaryCardKeys = ['trends', 'todaySuggestions']
    ALPHA_FEATURE_HIDE_CONFIG.hiddenSettingKeys = ['ai-service', 'llm-wiki']

    try {
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
            aiEnabled: true,
            aiBaseUrl: 'https://api.example.com/v1',
            aiApiKey: 'sk-test',
            aiModel: 'gpt-4.1-mini',
            aiEmbeddingModel: 'BAAI/bge-m3',
            aiRequestTimeoutSeconds: 30,
            aiMaxTokens: 10240,
            aiTemperature: 0.7,
            aiMaxContextMessages: 7,
            aiContextCapacity: 'compact',
            enableConsoleLogging: false,
            wikiEnabled: true,
            wikiPageSuffix: '-llm-wiki',
            wikiIndexTitle: 'LLM-Wiki-索引',
            wikiLogTitle: 'LLM-Wiki-维护日志',
          },
        }),
      })

      const html = await renderToString(app)

      expect(html).not.toContain('趋势观察卡片')
      expect(html).not.toContain('今日建议卡片')
      expect(html).not.toContain('AI 服务商')
      expect(html).not.toContain('启用 AI 今日建议')
      expect(html).not.toContain('启用 LLM Wiki')
      expect(html).not.toContain('页面后缀')
      expect(html).not.toContain('索引页标题')
      expect(html).not.toContain('日志页标题')
      expect(html).not.toContain('测试连接')
      expect(html).toContain('核心文档卡片')
    } finally {
      ALPHA_FEATURE_HIDE_CONFIG.hiddenSummaryCardKeys = previousHiddenSummaryCardKeys
      ALPHA_FEATURE_HIDE_CONFIG.hiddenSettingKeys = previousHiddenSettingKeys
    }
  })

  it('renders siliconflow model list controls when siliconflow preset is active', async () => {
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
          aiEnabled: true,
          aiBaseUrl: 'https://api.siliconflow.cn/v1',
          aiApiKey: 'sk-test',
          aiModel: '',
          aiEmbeddingModel: '',
          aiRequestTimeoutSeconds: 30,
          aiMaxTokens: 10240,
          aiTemperature: 0.7,
          aiMaxContextMessages: 7,
          aiContextCapacity: 'compact',
          enableConsoleLogging: false,
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('点击加载聊天模型')
    expect(html).toContain('点击加载 embedding 模型')
    expect(html).not.toContain('>模型清单<')
    expect(html).not.toContain('加载模型列表')
  })
})

function expectCardSettingVisibility(
  html: string,
  key: string,
  label: string,
  hiddenSummaryCardKeys: Set<string>,
) {
  if (hiddenSummaryCardKeys.has(key)) {
    expect(html).not.toContain(label)
    return
  }

  expect(html).toContain(label)
}

function expectSettingVisibility(
  html: string,
  key: string,
  label: string,
  hiddenSettingKeys: Set<string>,
) {
  if (hiddenSettingKeys.has(key)) {
    expect(html).not.toContain(label)
    return
  }

  expect(html).toContain(label)
}
