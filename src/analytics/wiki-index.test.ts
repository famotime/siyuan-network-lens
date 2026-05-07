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
  it('从 kramdown 中提取去重的 wiki 页面', () => {
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
    expect(pages[1].documentId).toBe('bbb222')
  })

  it('解析 block reference 格式', () => {
    const kramdown = '((ccc333 "页面C"))'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('ccc333')
  })

  it('空内容返回空数组', () => {
    const pages = parseWikiIndexPages({
      kramdown: '',
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(0)
  })
})
