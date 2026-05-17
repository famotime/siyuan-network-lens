import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/analytics/wiki-documents', () => ({
  applyWikiDocuments: vi.fn(),
}))

import { applyWikiDocuments } from '@/analytics/wiki-documents'

import { createAnalyticsWikiActionsController } from './use-analytics-wiki-actions'

describe('createAnalyticsWikiActionsController', () => {
  it('restores cached previews by theme document id and clears wiki error', () => {
    const wikiError = ref('previous error')
    const cachedPreview = {
      generatedAt: '2026-05-05T10:00:00.000Z',
      scope: {
        summary: {
          sourceDocumentCount: 2,
          generatedSectionCount: 3,
          referenceCount: 4,
          manualNotesParagraphCount: 0,
        },
        descriptionLines: ['- 范围来源：历史预览'],
      },
      themePages: [],
      unclassifiedDocuments: [],
      excludedWikiDocuments: [],
    } as any

    const controller = createAnalyticsWikiActionsController({
      config: { wikiEnabled: true, aiEnabled: true } as any,
      appliedConfig: computed(() => ({
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        wikiIndexTitle: 'LLM-Wiki-Index',
        wikiLogTitle: 'LLM-Wiki-Maintenance-Log',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerPath: '/box-1/LLM Wiki',
      } as any)),
      snapshot: ref(null),
      report: computed(() => null),
      trends: computed(() => null),
      filters: computed(() => ({} as any)),
      timeRange: ref('7d' as const),
      filteredDocuments: computed(() => []),
      associationDocumentMap: computed(() => new Map()),
      themeDocuments: computed(() => []),
      aiConfigReady: computed(() => true),
      wikiPreviewLoading: ref(false),
      wikiApplyLoading: ref(false),
      wikiError,
      wikiPreview: ref(null),
      wikiPreviewCache: ref(new Map([['theme-doc-1', cachedPreview]])),
      aiIndexStore: null,
      aiWikiStore: null,
      aiWikiService: null,
      forwardProxy: undefined,
      getChildBlocks: vi.fn(),
      getBlockKramdown: vi.fn(),
      createDocWithMd: undefined,
      getIDsByHPath: undefined,
      prependBlock: vi.fn(),
      appendBlock: vi.fn(),
      updateBlock: vi.fn(),
      deleteBlock: vi.fn(),
      getBlockAttrs: undefined,
      setBlockAttrs: undefined,
      resolveNotebookName: vi.fn((notebookId: string) => notebookId),
      notify: vi.fn(),
    })

    controller.restoreCachedWikiPreview('theme-doc-1')

    expect(wikiError.value).toBe('')
    expect(controller.wikiPreview.value).toStrictEqual(cachedPreview)
  })

  it('applies the current wiki preview through applyWikiDocuments and stores the batch result', async () => {
    const applyResult = {
      themePages: [{ pageTitle: '主题-AI-索引-llm-wiki', pageId: 'page-1', result: 'updated' }],
      indexPage: { pageTitle: 'LLM-Wiki-Index', pageId: 'index-1', result: 'updated' },
      logPage: { pageTitle: 'LLM-Wiki-Maintenance-Log', pageId: 'log-1', result: 'updated' },
      counts: { created: 0, updated: 1, skipped: 0, conflict: 0 },
    }
    vi.mocked(applyWikiDocuments).mockResolvedValue(applyResult as any)

    const wikiPreview = ref({
      generatedAt: '2026-05-05T10:00:00.000Z',
      scope: {
        summary: {
          sourceDocumentCount: 3,
          generatedSectionCount: 4,
          referenceCount: 6,
          manualNotesParagraphCount: 0,
        },
        descriptionLines: ['- 范围来源：当前样本'],
      },
      themePages: [{
        pageTitle: '主题-AI-索引-llm-wiki',
        themeName: 'AI',
        themeDocumentId: 'theme-doc-1',
        themeDocumentTitle: '主题-AI-索引',
        themeDocumentBox: 'box-1',
        themeDocumentHPath: '/专题/主题-AI-索引',
        sourceDocumentIds: ['doc-a', 'doc-b'],
        preview: { status: 'update' },
        draft: { managedMarkdown: '# draft', fullMarkdown: '# full', sectionMetadata: [] },
      }],
      unclassifiedDocuments: [],
      excludedWikiDocuments: [],
    } as any)

    const controller = createAnalyticsWikiActionsController({
      config: { wikiEnabled: true, aiEnabled: true } as any,
      appliedConfig: computed(() => ({
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        wikiIndexTitle: 'LLM-Wiki-Index',
        wikiLogTitle: 'LLM-Wiki-Maintenance-Log',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerPath: '/box-1/LLM Wiki',
      } as any)),
      snapshot: ref({ notebooks: [{ id: 'box-1', name: 'Notebook 1' }] } as any),
      report: computed(() => null),
      trends: computed(() => null),
      filters: computed(() => ({} as any)),
      timeRange: ref('7d' as const),
      filteredDocuments: computed(() => []),
      associationDocumentMap: computed(() => new Map()),
      themeDocuments: computed(() => []),
      aiConfigReady: computed(() => true),
      wikiPreviewLoading: ref(false),
      wikiApplyLoading: ref(false),
      wikiError: ref(''),
      wikiPreview,
      wikiPreviewCache: ref(new Map()),
      aiIndexStore: null,
      aiWikiStore: {
        getPageRecord: vi.fn(async () => null),
        savePageRecord: vi.fn(async () => undefined),
      } as any,
      aiWikiService: null,
      forwardProxy: undefined,
      getChildBlocks: vi.fn(async () => []),
      getBlockKramdown: vi.fn(async () => ({ id: '', kramdown: '' })),
      createDocWithMd: vi.fn(async () => 'page-1'),
      getIDsByHPath: vi.fn(async () => []),
      prependBlock: vi.fn(async () => undefined),
      appendBlock: vi.fn(async () => undefined),
      updateBlock: vi.fn(async () => undefined),
      deleteBlock: vi.fn(async () => undefined),
      getBlockAttrs: vi.fn(async () => ({})),
      setBlockAttrs: vi.fn(async () => undefined),
      resolveNotebookName: vi.fn((notebookId: string) => notebookId),
      notify: vi.fn(),
    })

    await controller.applyWikiChanges(true)

    expect(applyWikiDocuments).toHaveBeenCalledWith(expect.objectContaining({
      overwriteConflicts: true,
      scopeDescriptionLines: ['- 范围来源：当前样本'],
      scopeSummary: expect.objectContaining({
        sourceDocumentCount: 3,
        themeGroupCount: 1,
      }),
      themePages: [expect.objectContaining({
        pageTitle: '主题-AI-索引-llm-wiki',
        themeDocumentId: 'theme-doc-1',
        sourceDocumentIds: ['doc-a', 'doc-b'],
      })],
    }))
    expect(controller.wikiPreview.value?.applyResult).toEqual(applyResult)
    expect(controller.wikiApplyLoading.value).toBe(false)
  })

  it('includes uncapped full document content in wiki payloads when full-content input is enabled', async () => {
    const kramdown = '# Alpha\n' + 'A'.repeat(7000)
    const getBlockKramdown = vi.fn(async (id: string) => ({ id, kramdown }))
    let savedProfile: any = null
    const forwardProxy = vi.fn(async (url: string) => ({
      body: JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              positioning: '定位',
              propositions: [{ text: '命题', sourceBlockIds: ['blk-1'] }],
              keywords: ['AI'],
            }),
          },
        }],
      }),
      contentType: 'application/json',
      elapsed: 1,
      headers: {},
      status: 200,
      url,
    }))
    const diagnoseThemeTemplate = vi.fn(async ({ payload }: any) => ({
      templateType: 'tech_topic',
      confidence: 'high',
      reason: '测试诊断',
      enabledModules: ['intro'],
      suppressedModules: [],
      evidenceSummary: payload.sourceDocuments[0]?.fullContent ?? '',
    }))
    const planThemePage = vi.fn(async () => ({
      templateType: 'tech_topic',
      confidence: 'high',
      coreSections: ['intro'],
      optionalSections: [],
      sectionOrder: ['intro'],
      sectionGoals: { intro: '主题概览' },
      sectionFormats: { intro: 'overview' },
    }))
    const generateThemeSection = vi.fn(async () => ({
      sectionType: 'intro',
      title: '主题概览',
      format: 'overview',
      blocks: [{ text: '正文', sourceRefs: ['doc-a'] }],
      sourceRefs: ['doc-a'],
    }))

    const controller = createAnalyticsWikiActionsController({
      config: {
        wikiEnabled: true,
        aiEnabled: true,
        wikiIncrementalEnabled: false,
        wikiFullContentEnabled: true,
      } as any,
      appliedConfig: computed(() => ({
        themeNotebookId: 'box-1',
        themeDocumentPath: '/专题',
        wikiIndexTitle: 'LLM-Wiki-Index',
        wikiLogTitle: 'LLM-Wiki-Maintenance-Log',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerPath: '/box-1/LLM Wiki',
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-test',
      } as any)),
      snapshot: ref({ notebooks: [{ id: 'box-1', name: 'Notebook 1' }] } as any),
      report: computed(() => ({
        ranking: [{ documentId: 'doc-a' }],
        bridgeDocuments: [],
        propagationNodes: [],
        orphans: [],
        evidenceByDocument: {},
      } as any)),
      trends: computed(() => ({
        risingDocuments: [],
        fallingDocuments: [],
      } as any)),
      filters: computed(() => ({} as any)),
      timeRange: ref('7d' as const),
      filteredDocuments: computed(() => [{
        id: 'doc-a',
        box: 'box-1',
        path: '/notes/a.sy',
        hpath: '/笔记/Alpha',
        title: 'Alpha',
        updated: '20260517090000',
      }] as any),
      associationDocumentMap: computed(() => new Map([['doc-a', {
        id: 'doc-a',
        box: 'box-1',
        path: '/notes/a.sy',
        hpath: '/笔记/Alpha',
        title: 'Alpha',
        updated: '20260517090000',
      }]])),
      themeDocuments: computed(() => [{
        documentId: 'theme-doc-1',
        title: '主题-AI-索引',
        themeName: 'AI',
        box: 'box-1',
        hpath: '/专题/主题-AI-索引',
      }] as any),
      aiConfigReady: computed(() => true),
      wikiPreviewLoading: ref(false),
      wikiApplyLoading: ref(false),
      wikiError: ref(''),
      wikiPreview: ref(null),
      wikiPreviewCache: ref(new Map()),
      aiIndexStore: {
        getFreshDocumentProfile: vi.fn(async () => savedProfile),
        getDocumentProfile: vi.fn(async () => savedProfile),
        saveDocumentIndex: vi.fn(async (params: any) => {
          savedProfile = {
            title: params.sourceDocument.title,
            positioning: params.positioning,
            propositionsJson: JSON.stringify(params.propositions),
            keywordsJson: JSON.stringify(params.keywords),
            primarySourceBlocksJson: JSON.stringify(params.primarySourceBlocks),
            secondarySourceBlocksJson: JSON.stringify(params.secondarySourceBlocks),
            sourceUpdatedAt: params.sourceDocument.updated,
            generatedAt: params.generatedAt,
          }
        }),
      } as any,
      aiWikiStore: {
        getPageRecord: vi.fn(async () => null),
        savePageRecord: vi.fn(async () => undefined),
      } as any,
      aiWikiService: {
        diagnoseThemeTemplate,
        planThemePage,
        generateThemeSection,
      } as any,
      forwardProxy,
      getChildBlocks: vi.fn(async () => [{ id: 'blk-1', type: 'p' }]),
      getBlockKramdown,
      createDocWithMd: undefined,
      getIDsByHPath: vi.fn(async () => []),
      prependBlock: vi.fn(),
      appendBlock: vi.fn(),
      updateBlock: vi.fn(),
      deleteBlock: vi.fn(),
      getBlockAttrs: vi.fn(async () => ({})),
      setBlockAttrs: vi.fn(async () => undefined),
      resolveNotebookName: vi.fn((notebookId: string) => notebookId),
      notify: vi.fn(),
    })

    await controller.prepareWikiPreview({
      themeDocumentId: 'theme-doc-1',
      sourceDocumentIds: ['doc-a'],
      scopeDescriptionLine: '- 范围来源：主题《AI》关联范围',
    })

    expect(getBlockKramdown.mock.calls.map(call => call[0])).toContain('doc-a')
    expect(diagnoseThemeTemplate).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        sourceDocuments: [
          expect.objectContaining({
            documentId: 'doc-a',
            fullContent: kramdown,
          }),
        ],
      }),
    }))
    expect((diagnoseThemeTemplate.mock.calls[0]?.[0] as any).payload.sourceDocuments[0].fullContent.length).toBe(kramdown.length)
    expect((diagnoseThemeTemplate.mock.calls[0]?.[0] as any).payload.sourceDocuments[0].fullContent.length).toBeGreaterThan(5000)
    expect(forwardProxy).toHaveBeenCalled()
  })
})
