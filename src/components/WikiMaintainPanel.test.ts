import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import WikiMaintainPanel from './WikiMaintainPanel.vue'

afterEach(() => {
  delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  vi.resetModules()
})

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

    expect(html).toContain('LLM Wiki maintenance')
    expect(html).toContain('Generate preview')
    expect(html).toContain('Apply changes')
    expect(html).toContain('Matched source docs')
    expect(html).toContain('主题-AI-索引-llm-wiki')
    expect(html).toContain('Status: Update')
    expect(html).toContain('Status: Conflict')
    expect(html).toContain('overview')
    expect(html).toContain('actions')
    expect(html).toContain('Manual notes: Existing')
    expect(html).toContain('Manual notes: Created on first write')
    expect(html).toContain('零散记录')
    expect(html).toContain('Open index page')
    expect(html).toContain('Open log page')
    expect(html).toContain('Open latest updated page')
  })

  it('renders disabled states for missing configuration', async () => {
    const app = createSSRApp({
      render: () => h(WikiMaintainPanel, {
        wikiEnabled: false,
        aiEnabled: false,
        aiConfigReady: false,
        previewLoading: false,
        applyLoading: false,
        error: 'Enable LLM Wiki first',
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

    expect(html).toContain('Enable LLM Wiki first')
  })

  it('renders Chinese labels when the workspace locale is zh_CN', async () => {
    ;(globalThis as typeof globalThis & {
      siyuan?: {
        config?: {
          lang?: string
        }
      }
    }).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    vi.resetModules()

    const { default: ZhWikiMaintainPanel } = await import('./WikiMaintainPanel.vue')
    const app = createSSRApp({
      render: () => h(ZhWikiMaintainPanel, {
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
              themeDocumentCount: 1,
              sourceDocumentCount: 2,
              themeGroupCount: 1,
              excludedWikiDocumentCount: 0,
              unclassifiedDocumentCount: 0,
            },
            descriptionLines: ['- 时间窗口：7d'],
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

    expect(html).toContain('LLM Wiki 维护')
    expect(html).toContain('生成预览')
    expect(html).toContain('应用变更')
    expect(html).toContain('允许覆盖冲突页面')
    expect(html).toContain('命中源文档')
  })
})
