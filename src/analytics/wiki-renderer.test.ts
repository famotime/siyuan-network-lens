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

  it('renders sources section entries as block references with titles', () => {
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

    expect(rendered.managedMarkdown).toContain('- ((doc-ai-bridge "《AI 桥接维护》")) - AI 桥接 -> AI 核心 在当前窗口新增 1 条连接。')
    expect(rendered.managedMarkdown).toContain('- ((doc-ai-core "《AI 核心概念》")) - AI 桥接 -> AI 核心 在当前窗口新增 1 条连接。')
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
    expect(rendered.managedMarkdown).toContain('### 自定义引言')
    expect(rendered.managedMarkdown).toContain('### 参考来源')
    expect(rendered.managedMarkdown).toContain('- 暂无内容')
    expect(rendered.fullMarkdown).toContain('## 人工备注')
    expect(rendered.fullMarkdown).toContain('> 这里保留给人工补充')
  })
})
