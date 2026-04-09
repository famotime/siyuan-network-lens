import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import WikiMaintainPanel from './WikiMaintainPanel.vue'

describe('WikiMaintainPanel', () => {
  it('renders scope summary, preview rows and apply shortcuts', async () => {
    const app = createSSRApp({
      render: () => h(WikiMaintainPanel, {
        wikiEnabled: true,
        aiEnabled: true,
        aiConfigReady: true,
        previewLoading: false,
        applyLoading: false,
        error: '',
        preview: {
          generatedAt: '2026-04-10T08:00:00.000Z',
          scope: {
            summary: {
              themeDocumentCount: 2,
              sourceDocumentCount: 4,
              themeGroupCount: 1,
              excludedWikiDocumentCount: 1,
              unclassifiedDocumentCount: 1,
            },
            descriptionLines: [
              '- 时间窗口：7d',
              '- 主题筛选：AI',
            ],
          },
          themePages: [
            {
              pageTitle: '主题-AI-索引-llm-wiki',
              themeName: 'AI',
              themeDocumentTitle: '主题-AI-索引',
              preview: {
                pageType: 'theme',
                pageTitle: '主题-AI-索引-llm-wiki',
                status: 'update',
                affectedSections: ['overview', 'actions'],
                sourceDocumentCount: 3,
                lastGeneratedAt: '2026-04-10T08:00:00.000Z',
                pageFingerprint: 'w1',
                managedFingerprint: 'w2',
                oldSummary: '旧摘要',
                newSummary: '新摘要',
              },
              hasManualNotes: true,
            },
            {
              pageTitle: '主题-ML-索引-llm-wiki',
              themeName: '机器学习',
              themeDocumentTitle: '主题-机器学习-索引',
              preview: {
                pageType: 'theme',
                pageTitle: '主题-ML-索引-llm-wiki',
                status: 'conflict',
                affectedSections: ['overview'],
                sourceDocumentCount: 1,
                lastGeneratedAt: '2026-04-10T08:00:00.000Z',
                pageFingerprint: 'w3',
                managedFingerprint: 'w4',
                oldSummary: '冲突前摘要',
                newSummary: '冲突后摘要',
                conflictReason: '当前 AI 管理区内容与上次插件写入指纹不一致。',
              },
              hasManualNotes: false,
            },
          ],
          unclassifiedDocuments: [
            {
              documentId: 'doc-free',
              title: '零散记录',
            },
          ],
          applyResult: {
            indexPage: {
              pageId: 'index-1',
              pageTitle: 'LLM-Wiki-索引',
              result: 'updated',
            },
            logPage: {
              pageId: 'log-1',
              pageTitle: 'LLM-Wiki-维护日志',
              result: 'created',
            },
            themePages: [
              {
                pageId: 'wiki-ai',
                pageTitle: '主题-AI-索引-llm-wiki',
                result: 'updated',
              },
            ],
            counts: {
              created: 0,
              updated: 1,
              skipped: 0,
              conflict: 1,
            },
          },
        },
        prepareWikiPreview: () => undefined,
        applyWikiChanges: () => undefined,
        openWikiDocument: () => undefined,
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('LLM Wiki 维护')
    expect(html).toContain('生成预览')
    expect(html).toContain('确认写入')
    expect(html).toContain('命中源文档数')
    expect(html).toContain('主题-AI-索引-llm-wiki')
    expect(html).toContain('状态：更新')
    expect(html).toContain('状态：冲突')
    expect(html).toContain('overview')
    expect(html).toContain('actions')
    expect(html).toContain('人工备注区：已存在')
    expect(html).toContain('人工备注区：首次写入时创建')
    expect(html).toContain('零散记录')
    expect(html).toContain('打开索引页')
    expect(html).toContain('打开日志页')
    expect(html).toContain('打开最近更新页')
  })

  it('renders disabled states for missing configuration', async () => {
    const app = createSSRApp({
      render: () => h(WikiMaintainPanel, {
        wikiEnabled: false,
        aiEnabled: false,
        aiConfigReady: false,
        previewLoading: false,
        applyLoading: false,
        error: '请先启用 LLM Wiki',
        preview: {
          generatedAt: '2026-04-10T08:00:00.000Z',
          scope: {
            summary: {
              themeDocumentCount: 0,
              sourceDocumentCount: 0,
              themeGroupCount: 0,
              excludedWikiDocumentCount: 0,
              unclassifiedDocumentCount: 0,
            },
            descriptionLines: [],
          },
          themePages: [],
          unclassifiedDocuments: [],
        },
        prepareWikiPreview: () => undefined,
        applyWikiChanges: () => undefined,
        openWikiDocument: () => undefined,
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('请先启用 LLM Wiki')
  })
})
