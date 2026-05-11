import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderThemeWikiDraft } from './wiki-renderer'
import type { WikiPagePlan, WikiSectionDraft, WikiTemplateDiagnosis } from './wiki-template-model'

afterEach(() => {
  delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  vi.resetModules()
})

describe('wiki renderer', () => {
  const diagnosis: WikiTemplateDiagnosis = {
    templateType: 'tech_topic',
    confidence: 'high',
    reason: '当前主题更适合技术主题模板。',
    enabledModules: ['intro', 'highlights', 'core_principles', 'sources'],
    suppressedModules: [],
    evidenceSummary: '证据集中在核心概念与资料来源。',
  }

  const pagePlan: WikiPagePlan = {
    templateType: 'tech_topic',
    confidence: 'high',
    coreSections: ['intro', 'highlights', 'sources'],
    optionalSections: ['core_principles'],
    sectionOrder: ['intro', 'highlights', 'core_principles', 'sources'],
    sectionGoals: {
      intro: '概括主题范围。',
      highlights: '列出重点入口。',
      core_principles: '说明核心原则。',
      sources: '沉淀关键来源。',
    },
    sectionFormats: {
      intro: 'overview',
      highlights: 'structured',
      core_principles: 'structured',
      sources: 'catalog',
    },
  }

  const sections: WikiSectionDraft[] = [
    {
      sectionType: 'intro',
      title: '主题概览',
      format: 'overview',
      blocks: [
        {
          text: '当前主题聚焦 AI 索引和桥接维护。',
          sourceRefs: ['doc-ai-core'],
        },
      ],
      sourceRefs: ['doc-ai-core'],
    },
    {
      sectionType: 'highlights',
      title: '重点亮点',
      format: 'structured',
      blocks: [
        {
          text: '优先阅读 AI 核心。',
          sourceRefs: ['doc-ai-core'],
        },
      ],
      sourceRefs: ['doc-ai-core'],
    },
    {
      sectionType: 'core_principles',
      title: '核心原则',
      format: 'structured',
      blocks: [
        {
          text: '先保留证据，再下结论。',
          sourceRefs: ['doc-ai-bridge'],
        },
      ],
      sourceRefs: ['doc-ai-bridge'],
    },
    {
      sectionType: 'sources',
      title: '来源与证据',
      format: 'catalog',
      blocks: [
        {
          text: 'AI 桥接 -> AI 核心 在当前窗口新增 1 条连接。',
          sourceRefs: ['doc-ai-bridge', 'doc-ai-core'],
        },
      ],
      sourceRefs: ['doc-ai-bridge', 'doc-ai-core'],
    },
  ]

  const sourceDocumentTitleMap: Record<string, string> = {
    'doc-ai-core': 'AI 核心概念',
    'doc-ai-bridge': 'AI 桥接维护',
  }

  it('renders a stable managed markdown region and preserves a manual notes placeholder', () => {
    const rendered = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeDocumentId: '20260409120000-abcdef0',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 2,
      diagnosis,
      pagePlan,
      sections,
      sourceDocumentTitleMap,
    })

    expect(rendered.managedMarkdown).toContain('- Paired topic page: ((20260409120000-abcdef0 "主题-AI-索引"))')
    expect(rendered.sectionMetadata.map(item => item.key)).toEqual([
      'meta',
      'intro',
      'highlights',
      'core_principles',
      'sources',
    ])
    expect(rendered.managedMarkdown).toContain('## AI managed area')
    expect(rendered.managedMarkdown).toContain('### Page meta')
    expect(rendered.managedMarkdown).toContain('### 主题概览')
    expect(rendered.managedMarkdown).toContain('### 核心原则')
    expect(rendered.managedMarkdown).toContain('<!-- network-lens-wiki-section:intro -->')
    expect(rendered.managedMarkdown).toContain('### References')
    expect(rendered.fullMarkdown).toContain('## Manual notes')
    expect(rendered.fullMarkdown).toContain('> Reserved for manual notes')
  })

  it('appends inline superscript source references to body blocks', () => {
    const rendered = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeDocumentId: '20260409120000-abcdef0',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 2,
      diagnosis,
      pagePlan,
      sections,
      sourceDocumentTitleMap,
    })

    expect(rendered.managedMarkdown).toContain('<sup>((doc-ai-core "1"))</sup>')
    expect(rendered.managedMarkdown).toContain('<sup>((doc-ai-bridge "2"))</sup>')
    expect(rendered.managedMarkdown).toContain('当前主题聚焦 AI 索引和桥接维护。 <sup>((doc-ai-core "1"))</sup>')
    expect(rendered.managedMarkdown).toContain('- 优先阅读 AI 核心。 <sup>((doc-ai-core "1"))</sup>')
    expect(rendered.managedMarkdown).toContain('- 先保留证据，再下结论。 <sup>((doc-ai-bridge "2"))</sup>')
  })

  it('renders sources section entries grouped by document title', () => {
    const rendered = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeDocumentId: '20260409120000-abcdef0',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 2,
      diagnosis,
      pagePlan,
      sections,
      sourceDocumentTitleMap,
    })

    expect(rendered.managedMarkdown).toContain('- ((doc-ai-bridge "《AI 桥接维护》"))：AI 桥接 -> AI 核心 在当前窗口新增 1 条连接。')
    expect(rendered.managedMarkdown).toContain('- ((doc-ai-core "《AI 核心概念》"))：AI 桥接 -> AI 核心 在当前窗口新增 1 条连接。')
  })

  it('deduplicates sources entries when multiple blocks reference the same document', () => {
    const duplicateSections: WikiSectionDraft[] = [
      {
        sectionType: 'intro',
        title: '概览',
        format: 'overview',
        blocks: [{ text: '概览。', sourceRefs: ['doc-1'] }],
        sourceRefs: ['doc-1'],
      },
      {
        sectionType: 'sources',
        title: '来源与证据',
        format: 'catalog',
        blocks: [
          { text: '引用一。', sourceRefs: ['doc-1'] },
          { text: '引用二。', sourceRefs: ['doc-1'] },
          { text: '引用三。', sourceRefs: ['doc-2'] },
        ],
        sourceRefs: ['doc-1', 'doc-2'],
      },
    ]

    const rendered = renderThemeWikiDraft({
      pageTitle: 'test-llm-wiki',
      pairedThemeDocumentId: 'theme-1',
      pairedThemeTitle: 'Test',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'test',
      sourceDocumentCount: 2,
      diagnosis,
      pagePlan: {
        ...pagePlan,
        sectionOrder: ['intro', 'sources'],
        optionalSections: [],
      },
      sections: duplicateSections,
      sourceDocumentTitleMap: { 'doc-1': '文档一', 'doc-2': '文档二' },
    })

    expect(rendered.managedMarkdown).toContain('- ((doc-1 "《文档一》"))：引用一。；引用二。')
    expect(rendered.managedMarkdown).toContain('- ((doc-2 "《文档二》"))：引用三。')
  })

  it('renders generatedAt in a user-friendly datetime format', () => {
    const rendered = renderThemeWikiDraft({
      pageTitle: 'test-llm-wiki',
      pairedThemeDocumentId: 'theme-1',
      pairedThemeTitle: 'Test',
      generatedAt: '2026-04-09T14:30:00.000Z',
      model: 'test',
      sourceDocumentCount: 0,
      diagnosis,
      pagePlan: {
        ...pagePlan,
        sectionOrder: ['intro', 'sources'],
        optionalSections: [],
      },
      sections: [
        { sectionType: 'intro', title: '概览', format: 'overview', blocks: [], sourceRefs: [] },
        { sectionType: 'sources', title: '来源', format: 'catalog', blocks: [], sourceRefs: [] },
      ],
    })

    // Should contain a formatted datetime, not raw ISO string
    expect(rendered.managedMarkdown).not.toContain('2026-04-09T14:30:00.000Z')
    // Should match YYYY-MM-DD HH:mm pattern (locale-dependent label)
    expect(rendered.managedMarkdown).toMatch(/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/)
  })

  it('skips rendering a conflict section when blocks are empty', () => {
    const conflictPagePlan: WikiPagePlan = {
      ...pagePlan,
      sectionOrder: ['intro', 'conflict', 'sources'],
      optionalSections: ['conflict'],
    }

    const conflictSections: WikiSectionDraft[] = [
      {
        sectionType: 'intro',
        title: '主题概览',
        format: 'overview',
        blocks: [{ text: '概览内容。', sourceRefs: ['doc-1'] }],
        sourceRefs: ['doc-1'],
      },
      {
        sectionType: 'conflict',
        title: '冲突内容',
        format: 'debate',
        blocks: [],
        sourceRefs: [],
      },
      {
        sectionType: 'sources',
        title: '来源与证据',
        format: 'catalog',
        blocks: [],
        sourceRefs: [],
      },
    ]

    const rendered = renderThemeWikiDraft({
      pageTitle: 'test-llm-wiki',
      pairedThemeDocumentId: 'theme-1',
      pairedThemeTitle: 'Test Theme',
      generatedAt: '2026-05-07T12:00:00.000Z',
      model: 'test-model',
      sourceDocumentCount: 1,
      diagnosis,
      pagePlan: conflictPagePlan,
      sections: conflictSections,
    })

    // Section marker and heading exist (for diff tracking) but no placeholder content rendered
    expect(rendered.managedMarkdown).toContain('<!-- network-lens-wiki-section:conflict -->')
    expect(rendered.managedMarkdown).toContain('### 冲突内容')
    expect(rendered.managedMarkdown).not.toContain('暂无内容')
    expect(rendered.managedMarkdown).not.toContain('No content yet')
    expect(rendered.sectionMetadata.find(s => s.key === 'conflict')?.markdown).toBe('')
  })

  it('renders a conflict section with debate format when blocks are non-empty', () => {
    const conflictPagePlan: WikiPagePlan = {
      ...pagePlan,
      sectionOrder: ['intro', 'conflict', 'sources'],
      optionalSections: ['conflict'],
    }

    const conflictSections: WikiSectionDraft[] = [
      {
        sectionType: 'intro',
        title: '主题概览',
        format: 'overview',
        blocks: [{ text: '概览内容。', sourceRefs: ['doc-1'] }],
        sourceRefs: ['doc-1'],
      },
      {
        sectionType: 'conflict',
        title: '冲突内容',
        format: 'debate',
        blocks: [
          { text: '观点A：应采用 X 方案。', sourceRefs: ['doc-1'] },
          { text: '观点B：应采用 Y 方案。', sourceRefs: ['doc-2'] },
        ],
        sourceRefs: ['doc-1', 'doc-2'],
      },
      {
        sectionType: 'sources',
        title: '来源与证据',
        format: 'catalog',
        blocks: [],
        sourceRefs: [],
      },
    ]

    const rendered = renderThemeWikiDraft({
      pageTitle: 'test-llm-wiki',
      pairedThemeDocumentId: 'theme-1',
      pairedThemeTitle: 'Test Theme',
      generatedAt: '2026-05-07T12:00:00.000Z',
      model: 'test-model',
      sourceDocumentCount: 2,
      diagnosis,
      pagePlan: conflictPagePlan,
      sections: conflictSections,
      sourceDocumentTitleMap: { 'doc-1': '文档一', 'doc-2': '文档二' },
    })

    expect(rendered.managedMarkdown).toContain('### 冲突内容')
    expect(rendered.managedMarkdown).toContain('- 观点A：应采用 X 方案。')
    expect(rendered.managedMarkdown).toContain('- 观点B：应采用 Y 方案。')
    expect(rendered.managedMarkdown).toContain('<sup>((doc-1 "1"))</sup>')
    expect(rendered.managedMarkdown).toContain('<sup>((doc-2 "2"))</sup>')
  })

  it('renders section titles from staged drafts and placeholders when the workspace locale is zh_CN', async () => {
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

    const rendered = renderZhThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeDocumentId: '20260409120000-abcdef0',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 2,
      diagnosis,
      pagePlan,
      sections: [
        {
          sectionType: 'intro',
          title: '自定义引言',
          format: 'overview',
          blocks: [],
          sourceRefs: [],
        },
        {
          sectionType: 'sources',
          title: '资料目录',
          format: 'catalog',
          blocks: [],
          sourceRefs: [],
        },
      ],
    })

    expect(rendered.managedMarkdown).toContain('## AI 管理区')
    expect(rendered.managedMarkdown).toContain('### 页面头信息')
    // Empty blocks → heading rendered (for diff tracking) but no placeholder
    expect(rendered.managedMarkdown).toContain('### 自定义引言')
    expect(rendered.managedMarkdown).toContain('### 参考来源')
    expect(rendered.managedMarkdown).not.toContain('- 暂无内容')
    expect(rendered.fullMarkdown).toContain('## 人工备注')
    expect(rendered.fullMarkdown).toContain('> 这里保留给人工补充')
  })
})
