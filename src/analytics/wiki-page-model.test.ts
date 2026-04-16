import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  WIKI_APPLY_RESULTS,
  WIKI_BLOCK_ATTR_KEYS,
  WIKI_PAGE_HEADINGS,
  WIKI_PAGE_TYPES,
  WIKI_PREVIEW_STATUSES,
  WIKI_SECTION_KEYS,
  buildThemeWikiPageTitle,
  isWikiDocumentTitle,
} from './wiki-page-model'

afterEach(() => {
  delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  vi.resetModules()
})

describe('wiki page model', () => {
  it('exposes stable page types, sections and headings for managed wiki pages', () => {
    expect(WIKI_PAGE_TYPES).toEqual(['theme', 'index', 'log'])
    expect(WIKI_SECTION_KEYS).toEqual([
      'meta',
      'overview',
      'keyDocuments',
      'structureObservations',
      'evidence',
      'actions',
      'manualNotes',
    ])
    expect(WIKI_PREVIEW_STATUSES).toEqual(['create', 'update', 'unchanged', 'conflict'])
    expect(WIKI_APPLY_RESULTS).toEqual(['created', 'updated', 'skipped', 'conflict'])
    expect(WIKI_PAGE_HEADINGS).toEqual({
      managedRoot: 'AI managed area',
      manualNotes: 'Manual notes',
      meta: 'Page meta',
      overview: 'Topic overview',
      keyDocuments: 'Key documents',
      structureObservations: 'Structure observations',
      evidence: 'Relationship evidence',
      actions: 'Cleanup actions',
    })
    expect(WIKI_BLOCK_ATTR_KEYS).toEqual({
      pageType: 'custom-network-lens-wiki-page-type',
      region: 'custom-network-lens-wiki-region',
      section: 'custom-network-lens-wiki-section',
      themeDocumentId: 'custom-network-lens-wiki-theme-document-id',
    })
  })

  it('builds and identifies wiki document titles by suffix', () => {
    expect(buildThemeWikiPageTitle('主题-AI-索引', '-llm-wiki')).toBe('主题-AI-索引-llm-wiki')
    expect(isWikiDocumentTitle('主题-AI-索引-llm-wiki', '-llm-wiki')).toBe(true)
    expect(isWikiDocumentTitle('主题-AI-索引', '-llm-wiki')).toBe(false)
    expect(isWikiDocumentTitle('主题-AI-索引-llm-wiki', '   ')).toBe(false)
  })

  it('loads Chinese headings when the workspace locale is zh_CN', async () => {
    ;(globalThis as typeof globalThis & {
      siyuan?: {
        config?: {
          lang?: string
        }
      }
    }).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    vi.resetModules()

    const { WIKI_PAGE_HEADINGS: zhHeadings } = await import('./wiki-page-model')

    expect(zhHeadings).toEqual({
      managedRoot: 'AI 管理区',
      manualNotes: '人工备注',
      meta: '页面头信息',
      overview: '主题概览',
      keyDocuments: '关键文档',
      structureObservations: '结构观察',
      evidence: '关系证据',
      actions: '整理动作',
    })
  })
})
