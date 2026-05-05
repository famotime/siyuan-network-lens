import { describe, expect, it } from 'vitest'

import { buildWikiPreview, fingerprintWikiContent } from './wiki-diff'
import { renderThemeWikiDraft } from './wiki-renderer'
import type { WikiPageSnapshotRecord } from './wiki-store'
import type { WikiPagePlan, WikiTemplateDiagnosis } from './wiki-template-model'

const nextDraft = {
  managedMarkdown: [
    '# 主题-AI-索引-llm-wiki',
    '',
    '## AI 管理区',
    '',
    '<!-- network-lens-wiki-section:meta -->',
    '### 页面头信息',
    '- 配对主题页：((20260409120000-abcdef0 "主题-AI-索引"))',
    '',
    '<!-- network-lens-wiki-section:intro -->',
    '### 自定义引言',
    '新的概览',
    '',
    '<!-- network-lens-wiki-section:highlights -->',
    '### 重点亮点',
    '- AI 核心',
  ].join('\n'),
  fullMarkdown: 'unused',
  sectionMetadata: [
    { key: 'meta', heading: '页面头信息', markdown: '- 配对主题页：((20260409120000-abcdef0 "主题-AI-索引"))' },
    { key: 'intro', heading: '自定义引言', markdown: '新的概览' },
    { key: 'highlights', heading: '重点亮点', markdown: '- AI 核心' },
  ],
}

const testDiagnosis: WikiTemplateDiagnosis = {
  templateType: 'tech_topic',
  confidence: 'high',
  reason: '测试诊断',
  enabledModules: ['intro', 'sources'],
  suppressedModules: [],
  evidenceSummary: '测试证据',
}

const testPagePlan: WikiPagePlan = {
  templateType: 'tech_topic',
  confidence: 'high',
  coreSections: ['intro', 'sources', 'highlights'],
  optionalSections: [],
  sectionOrder: ['intro', 'sources'],
  sectionGoals: {
    intro: '主题概览',
    sources: '资料目录',
  },
  sectionFormats: {
    intro: 'overview',
    sources: 'catalog',
  },
}

describe('wiki diff', () => {
  it('marks a missing page as create and exposes affected sections', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
    })

    expect(preview.status).toBe('create')
    expect(preview.affectedSections).toEqual(['meta', 'intro', 'highlights'])
    expect(preview.sourceDocumentCount).toBe(2)
    expect(preview.oldSummary).toBe('')
    expect(preview.newSummary).toContain('新的概览')
  })

  it('marks an unchanged page when the current managed region already matches the next draft', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: nextDraft.managedMarkdown,
      },
    })

    expect(preview.status).toBe('unchanged')
    expect(preview.affectedSections).toEqual([])
  })

  it('marks a changed page as update and limits affected sections to real section changes', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '<!-- network-lens-wiki-section:meta -->',
          '### 页面头信息',
          '- 配对主题页：((20260409120000-abcdef0 "主题-AI-索引"))',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### 自定义引言',
          '旧概览',
          '',
          '<!-- network-lens-wiki-section:highlights -->',
          '### 重点亮点',
          '- AI 核心',
        ].join('\n'),
      },
    })

    expect(preview.status).toBe('update')
    expect(preview.affectedSections).toEqual(['intro'])
  })

  it('treats a heading change under the same dynamic section key as an affected section', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '<!-- network-lens-wiki-section:meta -->',
          '### 页面头信息',
          '- 配对主题页：((20260409120000-abcdef0 "主题-AI-索引"))',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### 旧引言标题',
          '新的概览',
          '',
          '<!-- network-lens-wiki-section:highlights -->',
          '### 重点亮点',
          '- AI 核心',
        ].join('\n'),
      },
    })

    expect(preview.status).toBe('update')
    expect(preview.affectedSections).toEqual(['intro'])
  })

  it('marks a removed dynamic section as affected when it exists in the old managed page only', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '<!-- network-lens-wiki-section:meta -->',
          '### 页面头信息',
          '- 配对主题页：((20260409120000-abcdef0 "主题-AI-索引"))',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### 自定义引言',
          '新的概览',
          '',
          '<!-- network-lens-wiki-section:highlights -->',
          '### 重点亮点',
          '- AI 核心',
          '',
          '<!-- network-lens-wiki-section:core_principles -->',
          '### 核心原则',
          '- 先保留证据，再下结论。',
        ].join('\n'),
      },
    })

    expect(preview.status).toBe('update')
    expect(preview.affectedSections).toEqual(['core_principles'])
  })

  it('does not mark an unchanged empty section as affected when both sides render the same placeholder', () => {
    const draftWithEmptySection = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeDocumentId: '20260409120000-abcdef0',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 1,
      diagnosis: testDiagnosis,
      pagePlan: testPagePlan,
      sections: [
        {
          sectionType: 'intro',
          title: '自定义引言',
          format: 'overview',
          blocks: [{ text: '新的概览', sourceRefs: ['doc-1'] }],
          sourceRefs: ['doc-1'],
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
    const existingManagedMarkdown = draftWithEmptySection.managedMarkdown.replace('新的概览', '旧概览')

    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft: draftWithEmptySection,
      existingPage: {
        managedMarkdown: existingManagedMarkdown,
      },
    })

    expect(preview.status).toBe('update')
    expect(preview.affectedSections).toEqual(['intro'])
  })

  it('marks a page as conflict when the live managed fingerprint diverges from the last applied fingerprint', () => {
    const storedRecord: WikiPageSnapshotRecord = {
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      lastApply: {
        appliedAt: '2026-04-09T11:00:00.000Z',
        result: 'updated',
        sourceDocumentIds: ['doc-1', 'doc-2'],
        managedFingerprint: fingerprintWikiContent('old-managed'),
      },
    }

    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: 'live-managed',
      },
      storedRecord,
    })

    expect(preview.status).toBe('conflict')
    expect(preview.conflictReason).toContain('The current AI managed area')
  })
})
