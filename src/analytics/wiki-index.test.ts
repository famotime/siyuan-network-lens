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
  it('从 markdown 链接中提取标题以 suffix 结尾的文档', () => {
    const kramdown = `
- [页面A-llm-wiki](siyuan://blocks/aaa111 "页面A-llm-wiki")
- [页面B-llm-wiki](siyuan://blocks/bbb222 "页面B-llm-wiki")
- [页面A重复-llm-wiki](siyuan://blocks/aaa111 "页面A重复-llm-wiki")
`
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(2)
    expect(pages[0].documentId).toBe('aaa111')
    expect(pages[0].title).toBe('页面A-llm-wiki')
    expect(pages[1].documentId).toBe('bbb222')
    expect(pages[1].title).toBe('页面B-llm-wiki')
  })

  it('从 block reference 中提取引号内标题以 suffix 结尾的文档', () => {
    const kramdown = '((ccc333 "页面C-llm-wiki"))'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('ccc333')
    expect(pages[0].title).toBe('页面C-llm-wiki')
  })

  it('无标题的 block reference 使用 documentId 作为标题', () => {
    const kramdown = '((ddd444))'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(0)
  })

  it('裸 siyuan:// URL 使用 documentId 作为标题', () => {
    const kramdown = '参见 siyuan://blocks/eee555 获取详情'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(0)
  })

  it('markdown 链接优先于裸 URL（同一 documentId 去重）', () => {
    const kramdown = `
[深度学习-llm-wiki](siyuan://blocks/fff666)
siyuan://blocks/fff666
`
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('fff666')
    expect(pages[0].title).toBe('深度学习-llm-wiki')
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

  it('仅解析标题以 suffix 结尾的文档，过滤不匹配的', () => {
    const kramdown = `
- [Vue 入门-llm-wiki](siyuan://blocks/aaa111 "Vue 入门-llm-wiki")
- [React 基础](siyuan://blocks/bbb222 "React 基础")
- [Go 指南-llm-wiki](siyuan://blocks/ccc333 "Go 指南-llm-wiki")
`
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(2)
    expect(pages[0].documentId).toBe('aaa111')
    expect(pages[0].themeDocumentTitle).toBe('Vue 入门')
    expect(pages[1].documentId).toBe('ccc333')
    expect(pages[1].themeDocumentTitle).toBe('Go 指南')
  })

  it('空 suffix 时解析所有文档', () => {
    const kramdown = `
- [Vue 入门](siyuan://blocks/aaa111 "Vue 入门")
- [React 基础](siyuan://blocks/bbb222 "React 基础")
`
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '',
    })
    expect(pages).toHaveLength(2)
  })

  it('block reference 标题不以 suffix 结尾时被过滤', () => {
    const kramdown = '((ccc333 "页面C"))'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(0)
  })

  it('新增字段在解析时为 undefined', () => {
    const kramdown = '[Vue 入门-llm-wiki](siyuan://blocks/aaa111)'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].inboundReferences).toBeUndefined()
    expect(pages[0].outboundReferences).toBeUndefined()
    expect(pages[0].childDocumentCount).toBeUndefined()
    expect(pages[0].createdAt).toBeUndefined()
    expect(pages[0].updatedAt).toBeUndefined()
  })
})
