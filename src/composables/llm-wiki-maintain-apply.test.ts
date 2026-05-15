import { describe, expect, it } from 'vitest'

import { resolveAppliedMaintenanceMarkdown } from './llm-wiki-maintain-apply'

const CURRENT_MARKDOWN = [
  '# 主题-AI-索引-llm-wiki',
  '',
  '## AI managed area',
  '',
  '<!-- network-lens-wiki-section:meta -->',
  '### Page meta',
  '旧 meta',
  '',
  '<!-- network-lens-wiki-section:intro -->',
  '### Topic overview',
  '旧概述',
  '',
  '<!-- network-lens-wiki-section:highlights -->',
  '### Highlights',
  '- 旧亮点 A',
  '',
  '## Manual notes',
  '人工备注保持',
].join('\n')

const REVISED_MARKDOWN = [
  '# 主题-AI-索引-llm-wiki',
  '',
  '## AI managed area',
  '',
  '<!-- network-lens-wiki-section:meta -->',
  '### Page meta',
  '新 meta',
  '',
  '<!-- network-lens-wiki-section:intro -->',
  '### Topic overview',
  '新概述',
  '',
  '<!-- network-lens-wiki-section:highlights -->',
  '### Highlights',
  '- 新亮点 A',
  '',
  '## Manual notes',
  '模型改写的人工备注',
].join('\n')

describe('resolveAppliedMaintenanceMarkdown', () => {
  it('merges only the selected wiki sections into the current markdown', () => {
    const result = resolveAppliedMaintenanceMarkdown({
      currentMarkdown: CURRENT_MARKDOWN,
      revisedMarkdown: REVISED_MARKDOWN,
      selectedSuggestions: [
        {
          type: 'outdated-section',
          description: '更新概述',
          sectionHeading: 'Topic overview',
        },
      ],
    })

    expect(result).toContain('### Topic overview\n新概述')
    expect(result).toContain('### Highlights\n- 旧亮点 A')
    expect(result).toContain('## Manual notes\n人工备注保持')
    expect(result).not.toContain('模型改写的人工备注')
    expect(result).not.toContain('### Highlights\n- 新亮点 A')
  })

  it('falls back to the full revised markdown when the selected suggestions cannot be mapped to sections', () => {
    const result = resolveAppliedMaintenanceMarkdown({
      currentMarkdown: CURRENT_MARKDOWN,
      revisedMarkdown: REVISED_MARKDOWN,
      selectedSuggestions: [
        {
          type: 'broken-link',
          description: '修复坏链',
        },
      ],
    })

    expect(result).toBe(REVISED_MARKDOWN)
  })
})
