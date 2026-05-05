import { describe, expect, it } from 'vitest'

import { buildWikiPreviewSummary, resolveAffectedSectionHeadings } from './use-analytics-wiki'

describe('resolveAffectedSectionHeadings', () => {
  it('prefers current draft headings for affected sections that still exist in the draft', () => {
    const headings = resolveAffectedSectionHeadings({
      preview: {
        affectedSections: ['intro', 'sources'],
      } as any,
      draft: {
        sectionMetadata: [
          { key: 'intro', heading: '主题概览' },
          { key: 'sources', heading: '关系证据' },
        ],
      } as any,
    })

    expect(headings).toEqual(['主题概览', '关系证据'])
  })

  it('uses the previous managed-page heading for removed sections when the draft no longer has them', () => {
    const headings = resolveAffectedSectionHeadings({
      preview: {
        affectedSections: ['comparison'],
      } as any,
      draft: {
        sectionMetadata: [
          { key: 'intro', heading: '主题概览' },
        ],
      } as any,
      existingManagedMarkdown: [
        '# 主题-AI-索引-llm-wiki',
        '',
        '## AI 管理区',
        '',
        '<!-- network-lens-wiki-section:intro -->',
        '### 主题概览',
        '概览正文',
        '',
        '<!-- network-lens-wiki-section:comparison -->',
        '### 旧版对比视角',
        '- 旧对比内容',
      ].join('\n'),
    })

    expect(headings).toEqual(['旧版对比视角'])
  })

  it('falls back to a humanized section id only when neither draft nor previous managed page provides a heading', () => {
    const headings = resolveAffectedSectionHeadings({
      preview: {
        affectedSections: ['core_principles'],
      } as any,
      draft: {
        sectionMetadata: [],
      } as any,
      existingManagedMarkdown: [
        '# 主题-AI-索引-llm-wiki',
        '',
        '## AI 管理区',
        '',
        '<!-- network-lens-wiki-section:intro -->',
        '### 主题概览',
        '概览正文',
      ].join('\n'),
    })

    expect(headings).toEqual(['Core Principles'])
  })
})

describe('buildWikiPreviewSummary', () => {
  it('counts generated sections, document refs, and manual note paragraphs for a theme wiki page', () => {
    const summary = buildWikiPreviewSummary({
      sourceDocumentCount: 3,
      draft: {
        managedMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '<!-- network-lens-wiki-section:meta -->',
          '### 页面头信息',
          '- 生成时间：2026-05-05',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### 主题概览',
          '概览引用 ((doc-a "Alpha"))',
          '',
          '<!-- network-lens-wiki-section:sources -->',
          '### 关系证据',
          '- ((doc-b "Beta")) - 证据 1',
        ].join('\n'),
        fullMarkdown: '',
        sectionMetadata: [
          { key: 'meta', heading: '页面头信息', markdown: '- 生成时间：2026-05-05' },
          { key: 'intro', heading: '主题概览', markdown: '概览引用 ((doc-a "Alpha"))' },
          { key: 'sources', heading: '关系证据', markdown: '- ((doc-b "Beta")) - 证据 1' },
        ],
      } as any,
      existingFullMarkdown: [
        '# 主题-AI-索引-llm-wiki',
        '',
        '## AI 管理区',
        '',
        '<!-- network-lens-wiki-section:intro -->',
        '### 主题概览',
        '概览正文',
        '',
        '## 人工备注',
        '',
        '第一段备注',
        '',
        '第二段备注',
      ].join('\n'),
    })

    expect(summary).toEqual({
      sourceDocumentCount: 3,
      generatedSectionCount: 2,
      referenceCount: 2,
      manualNotesParagraphCount: 2,
    })
  })

  it('ignores the reserved placeholder line when counting manual note paragraphs', () => {
    const summary = buildWikiPreviewSummary({
      sourceDocumentCount: 1,
      draft: {
        managedMarkdown: '',
        fullMarkdown: '',
        sectionMetadata: [
          { key: 'meta', heading: '页面头信息', markdown: '- 生成时间：2026-05-05' },
        ],
      } as any,
      existingFullMarkdown: [
        '# 主题-AI-索引-llm-wiki',
        '',
        '## 人工备注',
        '',
        '> 这里保留给人工补充，后续自动维护不会覆盖本区内容。',
        '',
      ].join('\n'),
    })

    expect(summary.manualNotesParagraphCount).toBe(0)
  })
})
