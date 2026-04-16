import { afterEach, describe, expect, it } from 'vitest'

import {
  compareSiyuanTimestamps,
  formatCompactDate,
  isTimestampInTrailingWindow,
  normalizeTags,
  resolveDocumentTitle,
} from './document-utils'

describe('document-utils', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('normalizes tags from strings and arrays using the same split rules', () => {
    expect(normalizeTags(' AI,知识 #整理  机器学习 ')).toEqual(['AI', '知识', '整理', '机器学习'])
    expect(normalizeTags([' AI ', '', '知识 '])).toEqual(['AI', '知识'])
    expect(normalizeTags(null)).toEqual([])
  })

  it('resolves document title with a stable fallback order', () => {
    expect(resolveDocumentTitle({
      id: 'doc-title',
      title: '显式标题',
      name: '名称',
      content: '正文',
      hpath: '/路径',
      path: '/path.sy',
    })).toBe('显式标题')

    expect(resolveDocumentTitle({
      id: 'doc-name',
      title: '',
      name: '名称',
      content: '正文',
      hpath: '/路径',
      path: '/path.sy',
    })).toBe('名称')

    expect(resolveDocumentTitle({
      id: 'doc-content',
      title: '',
      name: '',
      content: '正文',
      hpath: '/路径',
      path: '/path.sy',
    })).toBe('正文')

    expect(resolveDocumentTitle({
      id: 'doc-hpath',
      title: '',
      name: '',
      content: '',
      hpath: '/路径',
      path: '/path.sy',
    })).toBe('/路径')

    expect(resolveDocumentTitle({
      id: 'doc-path',
      title: '',
      name: '',
      content: '',
      hpath: '',
      path: '/path.sy',
    })).toBe('/path.sy')

    expect(resolveDocumentTitle({
      id: 'doc-id',
      title: '',
      name: '',
      content: '',
      hpath: '',
      path: '',
    })).toBe('doc-id')
  })

  it('parses and compares SiYuan timestamps in local time semantics', () => {
    const now = new Date('2026-03-13T22:02:45+08:00')

    expect(isTimestampInTrailingWindow('20260313213430', now, 7)).toBe(true)
    expect(isTimestampInTrailingWindow('20260313213430', new Date('2026-03-13T21:00:00+08:00'), 7)).toBe(false)
    expect(compareSiyuanTimestamps('20260313213430', '20260313203300')).toBeGreaterThan(0)
  })

  it('formats compact dates directly from SiYuan timestamps', () => {
    expect(formatCompactDate('20260313213430')).toBe('2026-03-13')
    expect(formatCompactDate('')).toBe('Unknown time')
  })

  it('switches unknown-time fallback to Chinese when the workspace locale is zh_CN', () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    expect(formatCompactDate('')).toBe('未知时间')
  })
})
