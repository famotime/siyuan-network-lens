import { describe, expect, it } from 'vitest'

import { renderSimpleMarkdown } from './markdown'

describe('renderSimpleMarkdown', () => {
  it('renders headings, blockquotes, emphasis and inline code', () => {
    const html = renderSimpleMarkdown([
      '# 标题',
      '',
      '> 引用内容',
      '',
      '普通段落，包含 **加粗**、*斜体* 和 `code`。',
    ].join('\n'))

    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<blockquote>引用内容</blockquote>')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<em>斜体</em>')
    expect(html).toContain('<code>code</code>')
  })

  it('renders ordered lists as list markup', () => {
    const html = renderSimpleMarkdown([
      '1. 第一项',
      '2. 第二项',
      '3. 第三项',
    ].join('\n'))

    expect(html).toContain('<ol>')
    expect(html).toContain('<li>第一项</li>')
    expect(html).toContain('<li>第二项</li>')
    expect(html).toContain('<li>第三项</li>')
    expect(html).toContain('</ol>')
  })

  it('escapes raw html before formatting inline markdown', () => {
    const html = renderSimpleMarkdown('**<script>alert(1)</script>**')

    expect(html).toContain('<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})
