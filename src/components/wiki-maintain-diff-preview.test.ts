import { describe, expect, it } from 'vitest'

import { buildSuggestionSnippetPreview } from './wiki-maintain-diff-preview'

describe('buildSuggestionSnippetPreview', () => {
  it('marks removed and added lines for local section diff preview', () => {
    const preview = buildSuggestionSnippetPreview({
      suggestion: {
        type: 'outdated-section',
        description: '更新概述',
        sectionHeading: '概述',
      },
      currentMarkdown: [
        '# 页面',
        '',
        '## 概述',
        '旧概述内容',
        '- [《AI 旧核心》](siyuan://blocks/doc-ai-old-core)',
      ].join('\n'),
      revisedMarkdown: [
        '# 页面',
        '',
        '## 概述',
        '新概述内容',
        '- [《AI 核心》](siyuan://blocks/doc-ai-core)',
      ].join('\n'),
    })

    expect(preview.hasDiff).toBe(true)
    expect(preview.currentDiffHtml).toContain('suggestion-card__diff-line suggestion-card__diff-line--removed')
    expect(preview.currentDiffHtml).toContain('旧概述内容')
    expect(preview.currentDiffHtml).toContain('《AI 旧核心》')
    expect(preview.revisedDiffHtml).toContain('suggestion-card__diff-line suggestion-card__diff-line--added')
    expect(preview.revisedDiffHtml).toContain('新概述内容')
    expect(preview.revisedDiffHtml).toContain('《AI 核心》')
  })
})
