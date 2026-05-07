import { describe, expect, it } from 'vitest'
import { parseWikiIndexPages, resolveThemeDocumentIdFromTitle } from './wiki-index'

describe('resolveThemeDocumentIdFromTitle', () => {
  it('去除 wikiPageSuffix 后缀得到主题文档标题', () => {
    expect(resolveThemeDocumentIdFromTitle('Vue 入门-llm-wiki', '-llm-wiki')).toBe('Vue 入门')
  })

  it('无后缀时返回原标题', () => {
    expect(resolveThemeDocumentIdFromTitle('Vue 入门', '-llm-wiki')).toBe('Vue 入门')
  })

  it('空标题返回空字符串', () => {
    expect(resolveThemeDocumentIdFromTitle('', '-llm-wiki')).toBe('')
  })
})

describe('parseWikiIndexPages', () => {
  it('从 markdown 链接中提取链接文本作为标题', () => {
    const kramdown = `
- [页面A](siyuan://blocks/aaa111 "页面A")
- [页面B](siyuan://blocks/bbb222 "页面B")
- [页面A重复](siyuan://blocks/aaa111 "页面A")
`
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(2)
    expect(pages[0].documentId).toBe('aaa111')
    expect(pages[0].title).toBe('页面A')
    expect(pages[1].documentId).toBe('bbb222')
    expect(pages[1].title).toBe('页面B')
  })

  it('从 block reference 中提取引号内的标题', () => {
    const kramdown = '((ccc333 "页面C"))'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('ccc333')
    expect(pages[0].title).toBe('页面C')
  })

  it('无标题的 block reference 使用 documentId 作为标题', () => {
    const kramdown = '((ddd444))'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('ddd444')
    expect(pages[0].title).toBe('ddd444')
  })

  it('裸 siyuan:// URL 使用 documentId 作为标题', () => {
    const kramdown = '参见 siyuan://blocks/eee555 获取详情'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('eee555')
    expect(pages[0].title).toBe('eee555')
  })

  it('markdown 链接优先于裸 URL（同一 documentId 去重）', () => {
    const kramdown = `
[深度学习](siyuan://blocks/fff666)
siyuan://blocks/fff666
`
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('fff666')
    expect(pages[0].title).toBe('深度学习')
  })

  it('带 themeDocumentTitle 属性', () => {
    const kramdown = '[Vue 入门-llm-wiki](siyuan://blocks/ggg777)'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].title).toBe('Vue 入门-llm-wiki')
    expect(pages[0].themeDocumentTitle).toBe('Vue 入门')
  })

  it('空内容返回空数组', () => {
    const pages = parseWikiIndexPages({
      kramdown: '',
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(0)
  })
})
