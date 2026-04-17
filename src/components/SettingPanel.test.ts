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
          analysisExcludedPaths: '/知识库/排除区|/归档/临时',
          analysisExcludedNamePrefixes: '临时-|草稿-',
          analysisExcludedNameSuffixes: '-忽略',
          themeDocumentPath: '/知识库/专题|/归档/主题',
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

    expect(html.indexOf('Analysis scope')).toBeLessThan(html.indexOf('Topic docs'))
    expect(html.indexOf('Topic docs')).toBeLessThan(html.indexOf('Read rules'))
    expect(html.indexOf('Read rules')).toBeLessThan(html.indexOf('Summary cards'))
    expect(html.indexOf('Summary cards')).toBeLessThan(html.indexOf('AI settings'))
    expect(html.indexOf('AI settings')).toBeLessThan(html.indexOf('Debug'))
    expect(html.indexOf('Read rules')).toBeLessThan(html.indexOf('Propagation and paths'))
    expect(html).toContain('Analysis scope')
    expect(html).toContain('Excluded paths')
    expect(html).toContain('Topic doc paths')
    expect(html).toContain('Read paths')
    expect(html).toContain('Read tags')
    expect(html).toContain('Title prefixes')
    expect(html).toContain('Title suffixes')
    expectCardSettingVisibility(html, 'documents', 'Doc sample card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'read', 'Read / unread card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'references', 'Active links card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'ranking', 'Core docs card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'trends', 'Trend watch card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'communities', 'Topic clusters card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'orphans', 'Orphan docs card', hiddenSummaryCardKeys)
    expect(html).toContain('Separate multiple paths with |')
    expect(html).not.toContain('Today suggestions card')
    expectCardSettingVisibility(html, 'dormant', 'Dormant docs card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'bridges', 'Bridge docs card', hiddenSummaryCardKeys)
    expectCardSettingVisibility(html, 'propagation', 'Propagation nodes card', hiddenSummaryCardKeys)
    expect(html).toContain('AI settings')
    expect(html).toContain('AI provider')
    expect(html).toContain('Import settings')
    expect(html).toContain('Export settings')
    expect(html).toContain('SiliconFlow')
    expect(html).toContain('OpenAI')
    expect(html).toContain('Gemini')
    expect(html).toContain('Custom')
    expect(html).toContain('Enable today suggestions')
    expect(html).toContain('Base URL')
    expect(html).toContain('https://api.siliconflow.cn/v1')
    expect(html).toContain('API Key')
    expect(html).toContain('aria-label="Show API Key"')
    expect(html).toContain('type="password"')
    expect(html).toContain('setting-input-with-action setting-input-with-action--overlay')
    expect(html).toContain('setting-icon-button setting-icon-button--inline')
    expect(html).toContain('<svg')
    expect(html).not.toContain('setting-icon-button__text')
    expect(html).toContain('Model')
    expect(html).toContain('Embedding Model (optional)')
    expect(html).toContain('BAAI/bge-m3')
    expect(html).toContain('Timeout')
    expect(html).toContain('Max tokens')
    expect(html).toContain('Temperature')
    expect(html).toContain('Max context messages')
    expect(html).toContain('Context capacity')
    expect(html).toContain('Compact')
    expect(html).toContain('Test connection')
    expect(html).toContain('Debug')
    expect(html).toContain('Print logs in console')
    expect(html).toContain('Error logs are always kept; other levels follow this toggle')
    expectSettingVisibility(html, 'llm-wiki', 'Enable LLM Wiki', hiddenSettingKeys)
    expectSettingVisibility(html, 'llm-wiki', 'Page suffix', hiddenSettingKeys)
    expectSettingVisibility(html, 'llm-wiki', 'Index page title', hiddenSettingKeys)
    expectSettingVisibility(html, 'llm-wiki', 'Log page title', hiddenSettingKeys)
    expect(html).toContain('title="OpenAI-compatible services usually require a /v1 suffix, for example https://api.siliconflow.cn/v1"')
    expect(html).toContain('title="The max_tokens value sent to the API, used to limit generated output length"')
    expect(html).toContain('title="The temperature value sent to the API, used to control randomness"')
    expect(html).toContain('setting-item-wrapper setting-item-grid')
    expect(html).toContain('setting-item--nested setting-item--grid')
    expect(html).not.toContain('<small')
    expect(html).not.toContain('核心文档排行卡片')
    expect(html).not.toContain('孤立与桥接卡片')
    expect(html).not.toContain('整理建议卡片')
    expect(html).not.toContain('主题笔记本')
  })

  it('starts moving section copy to keyed i18n entries', async () => {
    const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./SettingPanel.vue', import.meta.url), 'utf8'))

    expect(source).toContain("import { t } from '@/i18n/ui'")
    expect(source).toContain("{{ t('settings.analysisScope.title') }}")
    expect(source).toContain("{{ t('settings.analysisScope.description') }}")
    expect(source).toContain("{{ t('settings.topicDocs.title') }}")
    expect(source).toContain("{{ t('settings.readRules.title') }}")
    expect(source).toContain("{{ t('settings.summaryCards.title') }}")
    expect(source).toContain("const aiSettingsTitle = showAiServiceSettings ? t('settings.ai.title') : 'LLM Wiki'")
    expect(source).toContain("{{ t('settings.analysisScope.excludedPaths') }}")
    expect(source).toContain("{{ t('settings.topicDocs.pathLabel') }}")
    expect(source).toContain("{{ t('settings.readRules.readPaths') }}")
    expect(source).toContain("{{ t('settings.summaryCards.topSummaryCards') }}")
    expect(source).toContain("{{ t('settings.ai.enableTodaySuggestions') }}")
    expect(source).toContain("{{ t('settings.debug.title') }}")
    expect(source).toContain("{{ t('settings.propagation.title') }}")
    expect(source).not.toContain('uiText(')
    expect(source).not.toContain("<h3>{{ uiText('Analysis scope', '分析范围') }}</h3>")
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
            analysisExcludedPaths: '',
            analysisExcludedNamePrefixes: '',
            analysisExcludedNameSuffixes: '',
            themeDocumentPath: '/知识库/专题',
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

      expect(html).not.toContain('Trend watch card')
      expect(html).not.toContain('Today suggestions card')
      expect(html).not.toContain('AI provider')
      expect(html).not.toContain('Enable today suggestions')
      expect(html).not.toContain('Enable LLM Wiki')
      expect(html).not.toContain('Page suffix')
      expect(html).not.toContain('Index page title')
      expect(html).not.toContain('Log page title')
      expect(html).not.toContain('Test connection')
      expect(html).toContain('Core docs card')
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
          analysisExcludedPaths: '',
          analysisExcludedNamePrefixes: '',
          analysisExcludedNameSuffixes: '',
          themeDocumentPath: '/知识库/专题',
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

    expect(html).toContain('Click to load chat models')
    expect(html).toContain('Click to load embedding models')
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
