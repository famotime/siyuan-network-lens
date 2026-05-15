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

  it('strips <sup> tags and their content', () => {
    const html = renderSimpleMarkdown('正文内容 <sup>((block-id "1"))</sup> 继续')

    expect(html).not.toContain('<sup>')
    expect(html).not.toContain('&lt;sup&gt;')
    expect(html).toContain('正文内容')
    expect(html).toContain('继续')
  })

  it('strips <sup> tags with plain text content', () => {
    const html = renderSimpleMarkdown('引用<sup>[1]</sup>文本')

    expect(html).not.toContain('sup')
    expect(html).toContain('引用')
    expect(html).toContain('文本')
  })

  it('preserves meaningful document titles from block references', () => {
    const html = renderSimpleMarkdown('- ((doc-ai-core "《AI 核心》"))：引用内容。')

    expect(html).toContain('《AI 核心》')
    expect(html).toContain('引用内容')
    expect(html).not.toContain('((')
  })

  it('strips numeric-only block reference labels', () => {
    const html = renderSimpleMarkdown('正文((block-id "2"))结束')

    expect(html).toContain('正文')
    expect(html).toContain('结束')
    expect(html).not.toContain('2')
    expect(html).not.toContain('((')
  })

  it('removes duplicate list markers from list item content', () => {
    const html = renderSimpleMarkdown([
      '- - 嵌套列表项',
      '- * 另一项',
    ].join('\n'))

    expect(html).toContain('<li>嵌套列表项</li>')
    expect(html).toContain('<li>另一项</li>')
    expect(html).not.toContain('- 嵌套')
    expect(html).not.toContain('* 另一')
  })

  it('preserves link labels while stripping SiYuan block ids', () => {
    const html = renderSimpleMarkdown('- [《AI 核心》](siyuan://blocks/doc-ai-core)', {
      preserveSiyuanLinkLabels: true,
    })

    expect(html).toContain('《AI 核心》')
    expect(html).not.toContain('doc-ai-core')
    expect(html).not.toContain('siyuan://blocks')
  })

  it('strips generic html tags while keeping readable text content', () => {
    const html = renderSimpleMarkdown('<div>补充 <span>说明</span></div>', {
      stripHtmlTags: true,
    })

    expect(html).toContain('补充 说明')
    expect(html).not.toContain('&lt;div&gt;')
    expect(html).not.toContain('&lt;span&gt;')
    expect(html).not.toContain('<div>')
    expect(html).not.toContain('<span>')
  })
})
