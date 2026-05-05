import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildWikiPreview, fingerprintWikiContent } from './wiki-diff'
import { buildDocLinkMarkdown } from './link-sync'
import { WIKI_BLOCK_ATTR_KEYS } from './wiki-page-model'
import { renderThemeWikiDraft } from './wiki-renderer'
import { applyWikiDocuments } from './wiki-documents'
import { buildWikiPageStorageKey, createAiWikiStore } from './wiki-store'
import type { WikiPagePlan, WikiSectionDraft, WikiTemplateDiagnosis } from './wiki-template-model'

afterEach(() => {
  delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  vi.resetModules()
})

const TEST_DIAGNOSIS: WikiTemplateDiagnosis = {
  templateType: 'tech_topic',
  confidence: 'high',
  reason: '当前主题适合技术主题模板。',
  enabledModules: ['intro', 'highlights', 'core_principles', 'sources'],
  suppressedModules: [],
  evidenceSummary: '核心证据来自主题页与来源文档。',
}

const TEST_PAGE_PLAN: WikiPagePlan = {
  templateType: 'tech_topic',
  confidence: 'high',
  coreSections: ['intro', 'highlights', 'sources'],
  optionalSections: ['core_principles'],
  sectionOrder: ['intro', 'highlights', 'core_principles', 'sources'],
  sectionGoals: {
    intro: '概括主题范围。',
    highlights: '列出关键入口。',
    core_principles: '沉淀核心原则。',
    sources: '保留来源证据。',
  },
  sectionFormats: {
    intro: 'overview',
    highlights: 'structured',
    core_principles: 'structured',
    sources: 'catalog',
  },
}

describe('wiki documents', () => {
  it('derives wiki target notebook and directory from the first configured theme full path', async () => {
    const kernel = createFakeWikiKernel()
    const store = createMemoryWikiStore()
    const themeDraft = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 1,
      diagnosis: TEST_DIAGNOSIS,
      pagePlan: TEST_PAGE_PLAN,
      sections: buildThemeSections({
        intro: '主题概览',
        highlights: ['AI 核心'],
        corePrinciples: ['结构观察'],
        sources: ['引用证据'],
      }),
    })
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-ai-core'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft: themeDraft,
    })

    await applyWikiDocuments({
      config: {
        themeDocumentPath: '/知识库/专题|/归档/主题',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerName: 'LLM Wiki',
      },
      notebooks: [
        { id: 'notebook-theme', name: '知识库' },
      ],
      generatedAt: '2026-04-09T12:05:00.000Z',
      scopeSummary: {
        sourceDocumentCount: 1,
        themeGroupCount: 1,
        unclassifiedDocumentCount: 0,
        excludedWikiDocumentCount: 0,
      },
      scopeDescriptionLines: ['- 时间窗口：7d'],
      themePages: [
        {
          pageTitle: '主题-AI-索引-llm-wiki',
          themeName: 'AI',
          themeDocumentId: 'doc-theme-ai',
          themeDocumentTitle: '主题-AI-索引',
          themeDocumentBox: 'notebook-theme',
          themeDocumentHPath: '/专题/主题-AI-索引',
          sourceDocumentIds: ['doc-ai-core'],
          preview,
          draft: themeDraft,
        },
      ],
      unclassifiedDocuments: [],
      overwriteConflicts: false,
      store,
      api: kernel.api,
    })

    expect(kernel.api.createDocWithMd).toHaveBeenCalledWith(
      'notebook-theme',
      '/专题/LLM Wiki/LLM-Wiki-索引',
      expect.any(String),
    )
    expect(kernel.api.createDocWithMd).toHaveBeenCalledWith(
      'notebook-theme',
      '/专题/LLM Wiki/LLM-Wiki-维护日志',
      expect.any(String),
    )
  })

  it('creates missing theme wiki pages and refreshes index and log documents', async () => {
    const kernel = createFakeWikiKernel()
    const store = createMemoryWikiStore()
    const themeDraft = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 2,
      diagnosis: TEST_DIAGNOSIS,
      pagePlan: TEST_PAGE_PLAN,
      sections: buildThemeSections({
        intro: '当前主题聚焦 AI 索引编排。',
        highlights: ['优先阅读 AI 核心。'],
        corePrinciples: ['桥接点仍集中在 AI 导航页。'],
        sources: ['AI 导航 -> AI 核心 在本窗口新增 1 条引用。'],
      }),
    })
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-ai-core', 'doc-ai-bridge'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft: themeDraft,
    })

    const result = await applyWikiDocuments({
      config: {
        themeNotebookId: 'notebook-theme',
        themeDocumentPath: '/主题',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerName: 'LLM Wiki',
      },
      generatedAt: '2026-04-09T12:05:00.000Z',
      scopeSummary: {
        sourceDocumentCount: 2,
        themeGroupCount: 1,
        unclassifiedDocumentCount: 1,
        excludedWikiDocumentCount: 0,
      },
      scopeDescriptionLines: [
        '- 时间窗口：7d',
        '- 主题筛选：AI',
      ],
      themePages: [
        {
          pageTitle: '主题-AI-索引-llm-wiki',
          themeName: 'AI',
          themeDocumentId: 'doc-theme-ai',
          themeDocumentTitle: '主题-AI-索引',
          themeDocumentBox: 'notebook-theme',
          themeDocumentHPath: '/主题/主题-AI-索引',
          sourceDocumentIds: ['doc-ai-core', 'doc-ai-bridge'],
          preview,
          draft: themeDraft,
        },
      ],
      unclassifiedDocuments: [
        {
          documentId: 'doc-unclassified',
          title: '零散记录',
        },
      ],
      overwriteConflicts: false,
      store,
      api: kernel.api,
    })

    expect(result.themePages).toEqual([
      {
        pageTitle: '主题-AI-索引-llm-wiki',
        pageId: 'doc-1',
        result: 'created',
      },
    ])
    expect(result.indexPage).toEqual({
      pageTitle: 'LLM-Wiki-索引',
      pageId: 'doc-2',
      result: 'created',
    })
    expect(result.logPage).toEqual({
      pageTitle: 'LLM-Wiki-维护日志',
      pageId: 'doc-3',
      result: 'created',
    })
    expect(result.counts).toEqual({
      created: 1,
      updated: 0,
      skipped: 0,
      conflict: 0,
    })

    expect(kernel.api.createDocWithMd).toHaveBeenCalledWith(
      'notebook-theme',
      '/主题/LLM Wiki/主题-AI-索引-llm-wiki',
      themeDraft.fullMarkdown,
    )
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-索引')).toContain(buildDocLinkMarkdown('doc-1', '主题-AI-索引-llm-wiki'))
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-索引')).toContain(buildDocLinkMarkdown('doc-theme-ai', '主题-AI-索引'))
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-索引')).toContain('当前主题聚焦 AI 索引编排。')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-索引')).toContain('零散记录')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-维护日志')).toContain('- Created pages: 1')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-维护日志')).toContain('主题-AI-索引-llm-wiki')

    const snapshot = await store.loadSnapshot()
    const themeRecord = snapshot.pages[buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      themeDocumentId: 'doc-theme-ai',
    })]
    expect(themeRecord?.pageId).toBe('doc-1')
    expect(themeRecord?.managedFingerprint).toBe(fingerprintWikiContent(themeDraft.managedMarkdown))
    expect(themeRecord?.lastApply?.result).toBe('created')

    const rootAttrs = kernel.getBlockAttrsSnapshot('doc-1')
    expect(rootAttrs).toMatchObject({
      [WIKI_BLOCK_ATTR_KEYS.pageType]: 'theme',
      [WIKI_BLOCK_ATTR_KEYS.themeDocumentId]: 'doc-theme-ai',
    })
  })

  it('updates only the AI managed region and preserves manual notes', async () => {
    const existingMarkdown = [
      '# 主题-AI-索引-llm-wiki',
      '',
      '## AI 管理区',
      '',
      '### 页面头信息',
      '- 配对主题页：主题-AI-索引',
      '',
      '### 主题概览',
      '旧概览',
      '',
      '## 人工备注',
      '',
      '- 保留这段人工补充',
    ].join('\n')
    const kernel = createFakeWikiKernel([
      {
        id: 'wiki-theme-ai',
        notebook: 'notebook-theme',
        hpath: '/主题/LLM Wiki/主题-AI-索引-llm-wiki',
        markdown: existingMarkdown,
      },
    ])
    const store = createMemoryWikiStore({
      pages: {
        [buildWikiPageStorageKey({
          pageType: 'theme',
          pageTitle: '主题-AI-索引-llm-wiki',
          themeDocumentId: 'doc-theme-ai',
        })]: {
          pageType: 'theme',
          pageTitle: '主题-AI-索引-llm-wiki',
          pageId: 'wiki-theme-ai',
          themeDocumentId: 'doc-theme-ai',
          themeDocumentTitle: '主题-AI-索引',
          sourceDocumentIds: ['doc-ai-core'],
          managedFingerprint: fingerprintWikiContent([
            '# 主题-AI-索引-llm-wiki',
            '',
            '## AI 管理区',
            '',
            '### 页面头信息',
            '- 配对主题页：主题-AI-索引',
            '',
            '### 主题概览',
            '旧概览',
          ].join('\n')),
          lastApply: {
            appliedAt: '2026-04-09T11:00:00.000Z',
            result: 'updated',
            sourceDocumentIds: ['doc-ai-core'],
            managedFingerprint: fingerprintWikiContent([
              '# 主题-AI-索引-llm-wiki',
              '',
              '## AI 管理区',
              '',
              '### 页面头信息',
              '- 配对主题页：主题-AI-索引',
              '',
              '### 主题概览',
              '旧概览',
            ].join('\n')),
          },
        },
      },
    })
    const themeDraft = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 1,
      diagnosis: TEST_DIAGNOSIS,
      pagePlan: TEST_PAGE_PLAN,
      sections: buildThemeSections({
        intro: '新的概览',
        highlights: ['AI 核心'],
        corePrinciples: ['桥接点仍偏少'],
        sources: ['AI 导航 -> AI 核心'],
      }),
    })
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-ai-core'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft: themeDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '### 页面头信息',
          '- 配对主题页：主题-AI-索引',
          '',
          '### 主题概览',
          '旧概览',
        ].join('\n'),
      },
      storedRecord: (await store.getPageRecord(buildWikiPageStorageKey({
        pageType: 'theme',
        pageTitle: '主题-AI-索引-llm-wiki',
        themeDocumentId: 'doc-theme-ai',
      }))) ?? undefined,
    })

    const result = await applyWikiDocuments({
      config: {
        themeNotebookId: 'notebook-theme',
        themeDocumentPath: '/主题',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerName: 'LLM Wiki',
      },
      generatedAt: '2026-04-09T12:05:00.000Z',
      scopeSummary: {
        sourceDocumentCount: 1,
        themeGroupCount: 1,
        unclassifiedDocumentCount: 0,
        excludedWikiDocumentCount: 0,
      },
      scopeDescriptionLines: ['- 时间窗口：7d'],
      themePages: [
        {
          pageTitle: '主题-AI-索引-llm-wiki',
          themeName: 'AI',
          themeDocumentId: 'doc-theme-ai',
          themeDocumentTitle: '主题-AI-索引',
          themeDocumentBox: 'notebook-theme',
          themeDocumentHPath: '/主题/主题-AI-索引',
          sourceDocumentIds: ['doc-ai-core'],
          preview,
          draft: themeDraft,
        },
      ],
      unclassifiedDocuments: [],
      overwriteConflicts: false,
      store,
      api: kernel.api,
    })

    expect(result.themePages[0]).toEqual({
      pageTitle: '主题-AI-索引-llm-wiki',
      pageId: 'wiki-theme-ai',
      result: 'updated',
    })
    expect(kernel.api.prependBlock).toHaveBeenCalledWith(
      'markdown',
      expect.not.stringContaining('# 主题-AI-索引-llm-wiki'),
      'wiki-theme-ai::managed',
    )
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/主题-AI-索引-llm-wiki')).toContain('新的概览')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/主题-AI-索引-llm-wiki')).toContain('- 保留这段人工补充')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/主题-AI-索引-llm-wiki')).not.toContain('旧概览')
  })

  it('skips unchanged and conflicting pages by default while still recording batch results', async () => {
    const unchangedMarkdown = [
      '# 主题-稳定-llm-wiki',
      '',
      '## AI 管理区',
      '',
      '### 主题概览',
      '稳定内容',
      '',
      '## 人工备注',
      '',
      '- 稳定备注',
    ].join('\n')
    const conflictMarkdown = [
      '# 主题-冲突-llm-wiki',
      '',
      '## AI 管理区',
      '',
      '### 主题概览',
      '外部修改后的内容',
      '',
      '## 人工备注',
      '',
      '- 冲突备注',
    ].join('\n')
    const kernel = createFakeWikiKernel([
      {
        id: 'wiki-stable',
        notebook: 'notebook-theme',
        hpath: '/主题/LLM Wiki/主题-稳定-llm-wiki',
        markdown: unchangedMarkdown,
      },
      {
        id: 'wiki-conflict',
        notebook: 'notebook-theme',
        hpath: '/主题/LLM Wiki/主题-冲突-llm-wiki',
        markdown: conflictMarkdown,
      },
    ])
    const store = createMemoryWikiStore({
      pages: {
        [buildWikiPageStorageKey({
          pageType: 'theme',
          pageTitle: '主题-稳定-llm-wiki',
          themeDocumentId: 'doc-theme-stable',
        })]: {
          pageType: 'theme',
          pageTitle: '主题-稳定-llm-wiki',
          pageId: 'wiki-stable',
          themeDocumentId: 'doc-theme-stable',
          themeDocumentTitle: '主题-稳定',
          sourceDocumentIds: ['doc-stable'],
          managedFingerprint: fingerprintWikiContent([
            '# 主题-稳定-llm-wiki',
            '',
            '## AI 管理区',
            '',
            '### 主题概览',
            '稳定内容',
          ].join('\n')),
          lastApply: {
            appliedAt: '2026-04-09T11:00:00.000Z',
            result: 'updated',
            sourceDocumentIds: ['doc-stable'],
            managedFingerprint: fingerprintWikiContent([
              '# 主题-稳定-llm-wiki',
              '',
              '## AI 管理区',
              '',
              '### 主题概览',
              '稳定内容',
            ].join('\n')),
          },
        },
        [buildWikiPageStorageKey({
          pageType: 'theme',
          pageTitle: '主题-冲突-llm-wiki',
          themeDocumentId: 'doc-theme-conflict',
        })]: {
          pageType: 'theme',
          pageTitle: '主题-冲突-llm-wiki',
          pageId: 'wiki-conflict',
          themeDocumentId: 'doc-theme-conflict',
          themeDocumentTitle: '主题-冲突',
          sourceDocumentIds: ['doc-conflict'],
          managedFingerprint: fingerprintWikiContent('old-managed'),
          lastApply: {
            appliedAt: '2026-04-09T11:00:00.000Z',
            result: 'updated',
            sourceDocumentIds: ['doc-conflict'],
            managedFingerprint: fingerprintWikiContent('old-managed'),
          },
        },
      },
    })
    const stableDraft = buildStaticThemeDraft('主题-稳定-llm-wiki', '主题-稳定', '稳定内容')
    const unchangedPreview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-稳定-llm-wiki',
      sourceDocumentIds: ['doc-stable'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft: stableDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-稳定-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### 主题概览',
          '稳定内容',
        ].join('\n'),
      },
    })
    const conflictDraft = buildStaticThemeDraft('主题-冲突-llm-wiki', '主题-冲突', '插件新生成内容')
    const conflictPreview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-冲突-llm-wiki',
      sourceDocumentIds: ['doc-conflict'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft: conflictDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-冲突-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### 主题概览',
          '外部修改后的内容',
        ].join('\n'),
      },
      storedRecord: (await store.getPageRecord(buildWikiPageStorageKey({
        pageType: 'theme',
        pageTitle: '主题-冲突-llm-wiki',
        themeDocumentId: 'doc-theme-conflict',
      }))) ?? undefined,
    })

    const result = await applyWikiDocuments({
      config: {
        themeNotebookId: 'notebook-theme',
        themeDocumentPath: '/主题',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerName: 'LLM Wiki',
      },
      generatedAt: '2026-04-09T12:05:00.000Z',
      scopeSummary: {
        sourceDocumentCount: 2,
        themeGroupCount: 2,
        unclassifiedDocumentCount: 0,
        excludedWikiDocumentCount: 0,
      },
      scopeDescriptionLines: ['- 时间窗口：7d'],
      themePages: [
        {
          pageTitle: '主题-稳定-llm-wiki',
          themeName: '稳定',
          themeDocumentId: 'doc-theme-stable',
          themeDocumentTitle: '主题-稳定',
          themeDocumentBox: 'notebook-theme',
          themeDocumentHPath: '/主题/主题-稳定',
          sourceDocumentIds: ['doc-stable'],
          preview: unchangedPreview,
          draft: stableDraft,
        },
        {
          pageTitle: '主题-冲突-llm-wiki',
          themeName: '冲突',
          themeDocumentId: 'doc-theme-conflict',
          themeDocumentTitle: '主题-冲突',
          themeDocumentBox: 'notebook-theme',
          themeDocumentHPath: '/主题/主题-冲突',
          sourceDocumentIds: ['doc-conflict'],
          preview: conflictPreview,
          draft: conflictDraft,
        },
      ],
      unclassifiedDocuments: [],
      overwriteConflicts: false,
      store,
      api: kernel.api,
    })

    expect(result.themePages).toEqual([
      {
        pageTitle: '主题-稳定-llm-wiki',
        pageId: 'wiki-stable',
        result: 'skipped',
      },
      {
        pageTitle: '主题-冲突-llm-wiki',
        pageId: 'wiki-conflict',
        result: 'conflict',
      },
    ])
    expect(result.counts).toEqual({
      created: 0,
      updated: 0,
      skipped: 1,
      conflict: 1,
    })
    expect(kernel.api.updateBlock).not.toHaveBeenCalledWith('markdown', conflictDraft.managedMarkdown, 'wiki-conflict::managed')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/主题-冲突-llm-wiki')).toContain('外部修改后的内容')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-维护日志')).toContain('- Unchanged pages: 1')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-维护日志')).toContain('- Conflict pages: 1')

    const snapshot = await store.loadSnapshot()
    expect(snapshot.pages[buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle: '主题-稳定-llm-wiki',
      themeDocumentId: 'doc-theme-stable',
    })]?.lastApply?.result).toBe('skipped')
    expect(snapshot.pages[buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle: '主题-冲突-llm-wiki',
      themeDocumentId: 'doc-theme-conflict',
    })]?.lastApply?.result).toBe('conflict')
  })

  it('overwrites a conflicting page only when explicitly allowed', async () => {
    const existingMarkdown = [
      '# 主题-冲突-llm-wiki',
      '',
      '## AI 管理区',
      '',
      '### 主题概览',
      '外部修改后的内容',
      '',
      '## 人工备注',
      '',
      '- 冲突备注',
    ].join('\n')
    const kernel = createFakeWikiKernel([
      {
        id: 'wiki-conflict',
        notebook: 'notebook-theme',
        hpath: '/主题/LLM Wiki/主题-冲突-llm-wiki',
        markdown: existingMarkdown,
      },
    ])
    const store = createMemoryWikiStore({
      pages: {
        [buildWikiPageStorageKey({
          pageType: 'theme',
          pageTitle: '主题-冲突-llm-wiki',
          themeDocumentId: 'doc-theme-conflict',
        })]: {
          pageType: 'theme',
          pageTitle: '主题-冲突-llm-wiki',
          pageId: 'wiki-conflict',
          themeDocumentId: 'doc-theme-conflict',
          themeDocumentTitle: '主题-冲突',
          sourceDocumentIds: ['doc-conflict'],
          managedFingerprint: fingerprintWikiContent('old-managed'),
          lastApply: {
            appliedAt: '2026-04-09T11:00:00.000Z',
            result: 'updated',
            sourceDocumentIds: ['doc-conflict'],
            managedFingerprint: fingerprintWikiContent('old-managed'),
          },
        },
      },
    })
    const nextDraft = buildStaticThemeDraft('主题-冲突-llm-wiki', '主题-冲突', '插件新生成内容')
    const conflictPreview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-冲突-llm-wiki',
      sourceDocumentIds: ['doc-conflict'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-冲突-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '### 主题概览',
          '外部修改后的内容',
        ].join('\n'),
      },
      storedRecord: (await store.getPageRecord(buildWikiPageStorageKey({
        pageType: 'theme',
        pageTitle: '主题-冲突-llm-wiki',
        themeDocumentId: 'doc-theme-conflict',
      }))) ?? undefined,
    })

    const result = await applyWikiDocuments({
      config: {
        themeNotebookId: 'notebook-theme',
        themeDocumentPath: '/主题',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerName: 'LLM Wiki',
      },
      generatedAt: '2026-04-09T12:05:00.000Z',
      scopeSummary: {
        sourceDocumentCount: 1,
        themeGroupCount: 1,
        unclassifiedDocumentCount: 0,
        excludedWikiDocumentCount: 0,
      },
      scopeDescriptionLines: ['- 时间窗口：7d'],
      themePages: [
        {
          pageTitle: '主题-冲突-llm-wiki',
          themeName: '冲突',
          themeDocumentId: 'doc-theme-conflict',
          themeDocumentTitle: '主题-冲突',
          themeDocumentBox: 'notebook-theme',
          themeDocumentHPath: '/主题/主题-冲突',
          sourceDocumentIds: ['doc-conflict'],
          preview: conflictPreview,
          draft: nextDraft,
        },
      ],
      unclassifiedDocuments: [],
      overwriteConflicts: true,
      store,
      api: kernel.api,
    })

    expect(result.themePages[0]).toEqual({
      pageTitle: '主题-冲突-llm-wiki',
      pageId: 'wiki-conflict',
      result: 'updated',
    })
    expect(kernel.api.deleteBlock).not.toHaveBeenCalledWith('wiki-conflict::managed')
    expect(kernel.api.deleteBlock).not.toHaveBeenCalledWith('wiki-conflict::manual')
    expect(kernel.api.prependBlock).toHaveBeenCalledWith(
      'markdown',
      expect.not.stringContaining('# 主题-冲突-llm-wiki'),
      'wiki-conflict::managed',
    )
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/主题-冲突-llm-wiki')).toContain('插件新生成内容')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/主题-冲突-llm-wiki')).toContain('- 冲突备注')
  })

  it('writes Chinese index and log content when the workspace locale is zh_CN', async () => {
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

    const { renderThemeWikiDraft: renderZhThemeWikiDraft } = await import('./wiki-renderer')
    const { applyWikiDocuments: applyZhWikiDocuments } = await import('./wiki-documents')

    const kernel = createFakeWikiKernel()
    const store = createMemoryWikiStore()
    const themeDraft = renderZhThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 1,
      diagnosis: TEST_DIAGNOSIS,
      pagePlan: TEST_PAGE_PLAN,
      sections: buildThemeSections({
        intro: '主题概览',
        highlights: ['AI 核心'],
        corePrinciples: ['结构观察'],
        sources: ['引用证据'],
      }),
    })
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-ai-core'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft: themeDraft,
    })

    await applyZhWikiDocuments({
      config: {
        themeNotebookId: 'notebook-theme',
        themeDocumentPath: '/主题',
        wikiIndexTitle: 'LLM-Wiki-索引',
        wikiLogTitle: 'LLM-Wiki-维护日志',
        wikiPageSuffix: '-llm-wiki',
        wikiContainerName: 'LLM Wiki',
      },
      generatedAt: '2026-04-09T12:05:00.000Z',
      scopeSummary: {
        sourceDocumentCount: 1,
        themeGroupCount: 1,
        unclassifiedDocumentCount: 0,
        excludedWikiDocumentCount: 0,
      },
      scopeDescriptionLines: ['- 时间窗口：7d'],
      themePages: [
        {
          pageTitle: '主题-AI-索引-llm-wiki',
          themeName: 'AI',
          themeDocumentId: 'doc-theme-ai',
          themeDocumentTitle: '主题-AI-索引',
          themeDocumentBox: 'notebook-theme',
          themeDocumentHPath: '/主题/主题-AI-索引',
          sourceDocumentIds: ['doc-ai-core'],
          preview,
          draft: themeDraft,
        },
      ],
      unclassifiedDocuments: [],
      overwriteConflicts: false,
      store,
      api: kernel.api,
    })

    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-索引')).toContain('### 页面概览')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-索引')).toContain('- 最近维护时间：2026-04-09T12:05:00.000Z')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-维护日志')).toContain('- 新建页面数：1')
    expect(kernel.getDocumentMarkdownByPath('/主题/LLM Wiki/LLM-Wiki-维护日志')).toContain('### 本次触达页面')
  })
})

function buildStaticThemeDraft(pageTitle: string, pairedThemeTitle: string, overview: string) {
  return {
    managedMarkdown: [
      `# ${pageTitle}`,
      '',
      '## AI 管理区',
      '',
      '<!-- network-lens-wiki-section:intro -->',
      '### 主题概览',
      overview,
    ].join('\n'),
    fullMarkdown: [
      `# ${pageTitle}`,
      '',
      '## AI 管理区',
      '',
      '<!-- network-lens-wiki-section:intro -->',
      '### 主题概览',
      overview,
      '',
      '## 人工备注',
      '',
      '> 手工补充',
    ].join('\n'),
    sectionMetadata: [
      {
        key: 'intro',
        heading: '主题概览',
        markdown: overview,
      },
    ],
    pairedThemeTitle,
  }
}

function buildThemeSections(params: {
  intro: string
  highlights: string[]
  corePrinciples: string[]
  sources: string[]
}): WikiSectionDraft[] {
  return [
    {
      sectionType: 'intro',
      title: '主题概览',
      format: 'overview',
      blocks: params.intro
        ? [{ text: params.intro, sourceRefs: ['doc-ai-core'] }]
        : [],
      sourceRefs: ['doc-ai-core'],
    },
    {
      sectionType: 'highlights',
      title: '关键文档',
      format: 'structured',
      blocks: params.highlights.map(text => ({ text, sourceRefs: ['doc-ai-core'] })),
      sourceRefs: ['doc-ai-core'],
    },
    {
      sectionType: 'core_principles',
      title: '核心原则',
      format: 'structured',
      blocks: params.corePrinciples.map(text => ({ text, sourceRefs: ['doc-ai-bridge'] })),
      sourceRefs: ['doc-ai-bridge'],
    },
    {
      sectionType: 'sources',
      title: '关系证据',
      format: 'catalog',
      blocks: params.sources.map(text => ({ text, sourceRefs: ['doc-ai-bridge', 'doc-ai-core'] })),
      sourceRefs: ['doc-ai-bridge', 'doc-ai-core'],
    },
  ]
}

function createMemoryWikiStore(initialSnapshot?: any) {
  const storage = new Map<string, any>()
  if (initialSnapshot) {
    storage.set('ai-wiki-index.json', initialSnapshot)
  }

  return createAiWikiStore({
    async loadData(storageName: string) {
      return storage.get(storageName)
    },
    async saveData(storageName: string, value: any) {
      storage.set(storageName, value)
    },
  })
}

function createFakeWikiKernel(initialDocuments?: Array<{
  id: string
  notebook: string
  hpath: string
  markdown: string
}>) {
  type BlockDescriptor = {
    id: string
    markdown: string
    type: 'h'
    role?: 'managed' | 'manual'
  }

  type DocumentDescriptor = {
    id: string
    notebook: string
    hpath: string
    markdown: string
    childBlocks: BlockDescriptor[]
  }

  const documentsById = new Map<string, DocumentDescriptor>()
  const documentIdsByPath = new Map<string, string>()
  const attrsByBlockId = new Map<string, Record<string, string>>()
  let nextDocumentId = 1
  const managedHeadingPattern = '(?:AI managed area|AI 管理区)'
  const manualHeadingPattern = '(?:Manual notes|人工备注)'

  const refreshDocumentBlocks = (document: DocumentDescriptor) => {
    const childBlocks: BlockDescriptor[] = []
    const managedMatch = document.markdown.match(new RegExp(`(^## ${managedHeadingPattern}[\\s\\S]*?)(?=^## ${manualHeadingPattern}$|$)`, 'm'))
    if (managedMatch) {
      childBlocks.push({
        id: `${document.id}::managed`,
        markdown: managedMatch[1].trim(),
        type: 'h',
        role: 'managed',
      })
    }
    const manualMatch = document.markdown.match(new RegExp(`(^## ${manualHeadingPattern}[\\s\\S]*)$`, 'm'))
    if (manualMatch) {
      childBlocks.push({
        id: `${document.id}::manual`,
        markdown: manualMatch[1].trim(),
        type: 'h',
        role: 'manual',
      })
    }
    document.childBlocks = childBlocks
  }

  const registerDocument = (params: { id?: string, notebook: string, hpath: string, markdown: string }) => {
    const id = params.id ?? `doc-${nextDocumentId++}`
    const document: DocumentDescriptor = {
      id,
      notebook: params.notebook,
      hpath: params.hpath,
      markdown: params.markdown,
      childBlocks: [],
    }
    refreshDocumentBlocks(document)
    documentsById.set(id, document)
    documentIdsByPath.set(`${params.notebook}:${params.hpath}`, id)
    return id
  }

  for (const document of initialDocuments ?? []) {
    registerDocument(document)
  }

  const api = {
    createDocWithMd: vi.fn(async (notebook: string, path: string, markdown: string) => {
      const existingId = documentIdsByPath.get(`${notebook}:${path}`)
      if (existingId) {
        return existingId
      }
      return registerDocument({ notebook, hpath: path, markdown })
    }),
    getIDsByHPath: vi.fn(async (notebook: string, path: string) => {
      const existingId = documentIdsByPath.get(`${notebook}:${path}`)
      return existingId ? [existingId] : []
    }),
    prependBlock: vi.fn(async (dataType: 'markdown' | 'dom', data: string, parentID: string) => {
      if (dataType !== 'markdown') {
        return []
      }
      if (parentID.includes('::')) {
        const [documentId, role] = parentID.split('::')
        const document = documentsById.get(documentId)
        if (!document) {
          return []
        }
        if (role === 'managed') {
          document.markdown = [
            extractTitleBlock(document.markdown),
            data,
            extractManualBlock(document.markdown),
          ].filter(Boolean).join('\n\n')
        } else if (role === 'manual') {
          document.markdown = [
            extractManagedBlock(document.markdown),
            data,
          ].filter(Boolean).join('\n\n')
        }
        refreshDocumentBlocks(document)
        return []
      }
      const document = documentsById.get(parentID)
      if (!document) {
        return []
      }
      const hasManualBlock = document.childBlocks.some(block => block.role === 'manual')
      const manualBlock = hasManualBlock ? extractManualBlock(document.markdown) : ''
      document.markdown = [extractTitleBlock(document.markdown), data, manualBlock]
        .filter(Boolean)
        .join('\n\n')
      refreshDocumentBlocks(document)
      return [
        {
          doOperations: [
            {
              id: `${parentID}::managed`,
            },
          ],
        },
      ]
    }),
    appendBlock: vi.fn(async (dataType: 'markdown' | 'dom', data: string, parentID: string) => {
      const document = documentsById.get(parentID)
      if (!document || dataType !== 'markdown') {
        return []
      }
      document.markdown = [document.markdown, data].filter(Boolean).join('\n\n')
      refreshDocumentBlocks(document)
      return []
    }),
    updateBlock: vi.fn(async (dataType: 'markdown' | 'dom', data: string, id: string) => {
      if (dataType !== 'markdown') {
        return []
      }
      if (documentsById.has(id)) {
        const document = documentsById.get(id)!
        document.markdown = data
        refreshDocumentBlocks(document)
        return []
      }

      const [documentId, role] = id.split('::')
      const document = documentsById.get(documentId)
      if (!document || (role !== 'managed' && role !== 'manual')) {
        return []
      }

      if (role === 'managed') {
        document.markdown = [data, extractManualBlock(document.markdown)]
          .filter(Boolean)
          .join('\n\n')
      } else {
        document.markdown = [extractManagedBlock(document.markdown), data]
          .filter(Boolean)
          .join('\n\n')
      }
      refreshDocumentBlocks(document)
      return []
    }),
    deleteBlock: vi.fn(async (id: string) => {
      const [documentId] = id.split('::')
      const document = documentsById.get(documentId)
      if (!document) {
        return []
      }
      document.childBlocks = document.childBlocks.filter(block => block.id !== id)
      return []
    }),
    getChildBlocks: vi.fn(async (id: string) => {
      return documentsById.get(id)?.childBlocks.map(block => ({
        id: block.id,
        type: block.type,
      })) ?? []
    }),
    getBlockKramdown: vi.fn(async (id: string) => {
      const document = documentsById.get(id)
      if (document) {
        return {
          id,
          kramdown: document.markdown,
        }
      }

      for (const candidate of documentsById.values()) {
        const block = candidate.childBlocks.find(item => item.id === id)
        if (block) {
          return {
            id,
            kramdown: block.markdown,
          }
        }
      }

      throw new Error(`missing block: ${id}`)
    }),
    getBlockAttrs: vi.fn(async (id: string) => ({
      ...(attrsByBlockId.get(id) ?? {}),
    })),
    setBlockAttrs: vi.fn(async (id: string, attrs: Record<string, string>) => {
      attrsByBlockId.set(id, {
        ...(attrsByBlockId.get(id) ?? {}),
        ...attrs,
      })
      return null
    }),
  }

  return {
    api,
    getDocumentMarkdownByPath(path: string) {
      const documentId = documentIdsByPath.get(`notebook-theme:${path}`)
      return documentId ? documentsById.get(documentId)?.markdown ?? '' : ''
    },
    getBlockAttrsSnapshot(id: string) {
      return {
        ...(attrsByBlockId.get(id) ?? {}),
      }
    },
  }
}

function extractTitleBlock(markdown: string): string {
  const match = markdown.match(/(^# .+?)(?=\n## |\n*$)/ms)
  return match?.[1]?.trim() ?? ''
}

function extractManagedBlock(markdown: string): string {
  return markdown.match(/(^# [\s\S]*?^## (?:AI managed area|AI 管理区)[\s\S]*?)(?=^## (?:Manual notes|人工备注)$|$)/m)?.[1]?.trim() ?? ''
}

function extractManualBlock(markdown: string): string {
  return markdown.match(/(^## (?:Manual notes|人工备注)[\s\S]*)$/m)?.[1]?.trim() ?? ''
}
