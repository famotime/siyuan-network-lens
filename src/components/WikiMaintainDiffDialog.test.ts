import { readFile } from 'node:fs/promises'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const translations: Record<string, string> = {
  'llmWiki.maintain.brokenLink': '失效链接',
  'llmWiki.maintain.outdatedSection': '过时段落',
  'llmWiki.maintain.missingReference': '缺失引用',
  'llmWiki.maintain.showMore': '展开更多',
  'llmWiki.maintain.showLess': '收起内容',
  'llmWiki.maintain.targetSection': '命中段落',
  'llmWiki.maintain.currentContent': '当前内容',
  'llmWiki.maintain.suggestedContent': '建议内容',
  'llmWiki.maintain.diffTitle': '维护变更预览',
  'llmWiki.maintain.reviewing': '评审中...',
  'llmWiki.maintain.noSuggestions': '无维护建议，页面内容已是最新。',
  'llmWiki.maintain.applyAll': '全部采纳',
  'llmWiki.maintain.applySelected': '采纳所选',
  'llmWiki.maintain.cancel': '取消',
  'llmWiki.chat.close': '关闭',
}

vi.mock('@/i18n/ui', () => ({
  t: vi.fn((key: string) => translations[key] ?? key),
}))

describe('WikiMaintainDiffDialog', () => {
  it('renders maintenance snippets with markdown html, localized type labels, section highlight, and expand control', async () => {
    const { default: WikiMaintainDiffDialog } = await import('./WikiMaintainDiffDialog.vue')

    const app = createSSRApp({
      render: () => h(WikiMaintainDiffDialog, {
        pageTitle: '主题-AI-索引-llm-wiki',
        currentMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## 概述',
          '旧概述内容',
          '- [《AI 旧核心》](siyuan://blocks/doc-ai-old-core)',
          '',
          '## 参考资料',
          '1. 旧参考条目',
        ].join('\n'),
        suggestions: [
          {
            type: 'outdated-section',
            description: '概述段落需要更新',
            sectionHeading: '概述',
          },
          {
            type: 'broken-link',
            description: '修复失效引用',
            sectionHeading: '参考资料',
          },
        ],
        revisedMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## 概述',
          '引用<sup>[1]</sup>文本',
          '- [《AI 核心》](siyuan://blocks/doc-ai-core)',
          '正文((block-id "2"))结束',
          '<div>补充 <span>说明</span></div>',
          '补充第 4 行',
          '补充第 5 行',
          '补充第 6 行',
          '补充第 7 行',
          '',
          '## 参考资料',
          '1. 修复链接条目',
        ].join('\n'),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('suggestion-card__snippet markdown-body')
    expect(html).toContain('过时段落')
    expect(html).toContain('失效链接')
    expect(html).toContain('suggestion-card__snippet-heading')
    expect(html).toContain('命中段落')
    expect(html).toContain('suggestion-card__diff-preview')
    expect(html).toContain('当前内容')
    expect(html).toContain('建议内容')
    expect(html).toContain('<p>旧概述内容</p>')
    expect(html).toContain('<li>《AI 旧核心》</li>')
    expect(html).toContain('<p>引用文本</p>')
    expect(html).toContain('<li>《AI 核心》</li>')
    expect(html).toContain('<p>正文结束</p>')
    expect(html).toContain('<p>补充 说明</p>')
    expect(html).toContain('suggestion-card__snippet--collapsed')
    expect(html).toContain('展开更多')
    expect(html).not.toContain('<pre')
    expect(html).not.toContain('doc-ai-core')
    expect(html).not.toContain('&lt;sup&gt;')
    expect(html).not.toContain('&lt;div&gt;')
  })

  it('keeps markdown renderer import and snippet html binding in source', async () => {
    const source = await readFile(new URL('./WikiMaintainDiffDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain("import { renderSimpleMarkdown } from '@/utils/markdown'")
    expect(source).toContain('v-html="suggestionSnippetHtml[index]"')
    expect(source).toContain('resolveSuggestionTypeLabel(suggestion.type)')
    expect(source).toContain('suggestion-card__snippet-heading')
    expect(source).toContain('suggestion-card__diff-preview')
    expect(source).toContain("t('llmWiki.maintain.currentContent')")
    expect(source).toContain("t('llmWiki.maintain.suggestedContent')")
    expect(source).toContain('suggestion-card__snippet-toggle')
    expect(source).toContain('@click.stop="toggleSnippetExpanded(index)"')
    expect(source).toContain("t('llmWiki.maintain.showMore')")
    expect(source).toContain("t('llmWiki.maintain.showLess')")
    expect(source).not.toContain('<pre\n          v-if="suggestionSnippets[index]"')
  })
})
