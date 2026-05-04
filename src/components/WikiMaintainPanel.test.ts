import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { readFile } from 'node:fs/promises'

import WikiMaintainPanel from './WikiMaintainPanel.vue'

afterEach(() => {
  delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  vi.resetModules()
})

describe('WikiMaintainPanel', () => {
  it('uses keyed i18n entries instead of inline uiText pairs', async () => {
    const source = await readFile(new URL('./WikiMaintainPanel.vue', import.meta.url), 'utf8')

    expect(source).toContain("import { t } from '@/i18n/ui'")
    expect(source).toContain("{{ t('wikiMaintain.title') }}")
    expect(source).toContain("{{ previewLoading ? t('wikiMaintain.generating') : t('wikiMaintain.generatePreview') }}")
    expect(source).not.toContain('uiText(')
  })

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
              themeDocumentId: 'theme-ai',
              themeDocumentTitle: '主题-AI-索引',
              themeDocumentBox: 'box-1',
              themeDocumentHPath: '/专题/主题-AI-索引',
              sourceDocumentIds: ['doc-a', 'doc-b', 'doc-c'],
              preview: {
                pageType: 'theme',
                pageTitle: '主题-AI-索引-llm-wiki',
                status: 'update',
                affectedSections: ['intro', 'core_principles', 'sources'],
                sourceDocumentCount: 3,
                lastGeneratedAt: '2026-04-10T08:00:00.000Z',
                pageFingerprint: 'w1',
                managedFingerprint: 'w2',
                oldSummary: '旧摘要',
                newSummary: '新摘要',
              },
              diagnosis: {
                templateType: 'tech_topic',
                confidence: 'high',
                reason: '技术主题特征明确',
                enabledModules: ['intro', 'highlights', 'core_principles', 'sources'],
                suppressedModules: [],
                evidenceSummary: '来源文档聚焦技术概念与原则。',
              },
              pagePlan: {
                templateType: 'tech_topic',
                confidence: 'high',
                coreSections: ['intro', 'highlights', 'sources'],
                optionalSections: ['core_principles'],
                sectionOrder: ['intro', 'highlights', 'core_principles', 'sources'],
                sectionGoals: {
                  intro: '概览主题定位',
                  core_principles: '提炼核心原则',
                },
                sectionFormats: {
                  intro: 'overview',
                  highlights: 'structured',
                  core_principles: 'structured',
                  sources: 'catalog',
                },
              },
              affectedSectionHeadings: [
                'Topic overview',
                'Core principles',
                'Relationship evidence',
              ],
              hasManualNotes: true,
              draft: {
                managedMarkdown: '# draft',
                fullMarkdown: '# draft',
                sectionMetadata: [
                  { key: 'intro', heading: 'Topic overview', markdown: 'overview body' },
                  { key: 'highlights', heading: 'Highlights', markdown: 'highlight body' },
                  { key: 'core_principles', heading: 'Core principles', markdown: 'principles body' },
                  { key: 'sources', heading: 'Relationship evidence', markdown: 'evidence body' },
                ],
              },
            },
            {
              pageTitle: '主题-ML-索引-llm-wiki',
              themeName: '机器学习',
              themeDocumentId: 'theme-ml',
              themeDocumentTitle: '主题-机器学习-索引',
              themeDocumentBox: 'box-1',
              themeDocumentHPath: '/专题/主题-机器学习-索引',
              sourceDocumentIds: ['doc-d'],
              preview: {
                pageType: 'theme',
                pageTitle: '主题-ML-索引-llm-wiki',
                status: 'conflict',
                affectedSections: ['comparison'],
                sourceDocumentCount: 1,
                lastGeneratedAt: '2026-04-10T08:00:00.000Z',
                pageFingerprint: 'w3',
                managedFingerprint: 'w4',
                oldSummary: '冲突前摘要',
                newSummary: '冲突后摘要',
                conflictReason: '当前 AI 管理区内容与上次插件写入指纹不一致。',
              },
              diagnosis: {
                templateType: 'social_topic',
                confidence: 'medium',
                reason: '需要保留不同观点的对比关系',
                enabledModules: ['intro', 'highlights', 'comparison', 'sources'],
                suppressedModules: [],
                evidenceSummary: '文档内容包含多方观点。',
              },
              pagePlan: {
                templateType: 'social_topic',
                confidence: 'medium',
                coreSections: ['intro', 'highlights', 'sources'],
                optionalSections: ['comparison'],
                sectionOrder: ['intro', 'comparison', 'sources'],
                sectionGoals: {
                  comparison: '比较不同观点',
                },
                sectionFormats: {
                  intro: 'overview',
                  comparison: 'debate',
                  sources: 'catalog',
                },
              },
              affectedSectionHeadings: ['Comparison'],
              hasManualNotes: false,
              draft: {
                managedMarkdown: '# draft',
                fullMarkdown: '# draft',
                sectionMetadata: [
                  { key: 'intro', heading: 'Introduction', markdown: 'intro body' },
                  { key: 'comparison', heading: 'Comparison', markdown: 'comparison body' },
                  { key: 'sources', heading: 'Sources', markdown: 'sources body' },
                ],
              },
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
    expect(html).toContain('Template: Tech topic')
    expect(html).toContain('Template: Social topic')
    expect(html).toContain('Confidence: HIGH')
    expect(html).toContain('Confidence: MEDIUM')
    expect(html).toContain('Affected sections: Topic overview, Core principles, Relationship evidence')
    expect(html).toContain('Affected sections: Comparison')
    expect(html).toContain('Section order: Topic overview, Highlights, Core principles, Relationship evidence')
    expect(html).toContain('Section order: Introduction, Comparison, Sources')
    expect(html).toContain('Manual notes: Existing')
    expect(html).toContain('Manual notes: Created on first write')
    expect(html).toContain('Diagnosis reason:</strong> 技术主题特征明确')
    expect(html).toContain('Diagnosis evidence:</strong> 来源文档聚焦技术概念与原则。')
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
          themePages: [
            {
              pageTitle: '主题-AI-索引-llm-wiki',
              themeName: 'AI',
              themeDocumentId: 'theme-ai',
              themeDocumentTitle: '主题-AI-索引',
              themeDocumentBox: 'box-1',
              themeDocumentHPath: '/专题/主题-AI-索引',
              sourceDocumentIds: ['doc-a'],
              preview: {
                pageType: 'theme',
                pageTitle: '主题-AI-索引-llm-wiki',
                status: 'update',
                affectedSections: ['intro'],
                sourceDocumentCount: 1,
                lastGeneratedAt: '2026-04-10T08:00:00.000Z',
                pageFingerprint: 'w1',
                managedFingerprint: 'w2',
                oldSummary: '旧摘要',
                newSummary: '新摘要',
              },
              diagnosis: {
                templateType: 'tech_topic',
                confidence: 'high',
                reason: '技术主题特征明确',
                enabledModules: ['intro', 'sources'],
                suppressedModules: [],
                evidenceSummary: '来源文档聚焦技术概念。',
              },
              pagePlan: {
                templateType: 'tech_topic',
                confidence: 'high',
                coreSections: ['intro', 'highlights', 'sources'],
                optionalSections: [],
                sectionOrder: ['intro', 'sources'],
                sectionGoals: {
                  intro: '概览主题定位',
                },
                sectionFormats: {
                  intro: 'overview',
                  sources: 'catalog',
                },
              },
              affectedSectionHeadings: ['主题概览'],
              hasManualNotes: false,
              draft: {
                managedMarkdown: '# draft',
                fullMarkdown: '# draft',
                sectionMetadata: [],
              },
            },
          ],
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
    expect(html).toContain('模板')
    expect(html).toContain('置信度')
    expect(html).toContain('技术主题')
    expect(html).toContain('高')
  })
})
