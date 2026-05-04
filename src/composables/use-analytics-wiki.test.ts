import { describe, expect, it } from 'vitest'

import { resolveAffectedSectionHeadings } from './use-analytics-wiki'

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
