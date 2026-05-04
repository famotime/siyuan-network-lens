import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  WIKI_APPLY_RESULTS,
  WIKI_BLOCK_ATTR_KEYS,
  WIKI_PAGE_HEADINGS,
  WIKI_PAGE_TYPES,
  WIKI_PREVIEW_STATUSES,
  buildThemeWikiPageTitle,
  isWikiDocumentTitle,
  resolveWikiSectionKeyFromHeading,
} from './wiki-page-model'

afterEach(() => {
  delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  vi.resetModules()
})

describe('wiki page model', () => {
  it('exposes stable page shell headings for managed wiki pages', () => {
    expect(WIKI_PAGE_TYPES).toEqual(['theme', 'index', 'log'])
    expect(WIKI_PREVIEW_STATUSES).toEqual(['create', 'update', 'unchanged', 'conflict'])
    expect(WIKI_APPLY_RESULTS).toEqual(['created', 'updated', 'skipped', 'conflict'])
    expect(WIKI_PAGE_HEADINGS).toEqual({
      managedRoot: 'AI managed area',
      manualNotes: 'Manual notes',
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
    })
  })

  it('keeps heading compatibility for parsing historical managed wiki content', async () => {
    expect(Object.keys(WIKI_PAGE_HEADINGS)).toEqual(['managedRoot', 'manualNotes'])
    expect((WIKI_PAGE_HEADINGS as Record<string, string>).meta).toBeUndefined()
    expect(resolveWikiSectionKeyFromHeading('Page meta')).toBe('meta')
    expect(resolveWikiSectionKeyFromHeading('Topic overview')).toBe('intro')
    expect(resolveWikiSectionKeyFromHeading('Key documents')).toBe('highlights')
    expect(resolveWikiSectionKeyFromHeading('Relationship evidence')).toBe('sources')
    expect(resolveWikiSectionKeyFromHeading('Structure observations')).toBe('structureObservations')
    expect(resolveWikiSectionKeyFromHeading('Cleanup actions')).toBe('actions')

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

    const zhModule = await import('./wiki-page-model')

    expect(Object.keys(zhModule.WIKI_PAGE_HEADINGS)).toEqual(['managedRoot', 'manualNotes'])
    expect((zhModule.WIKI_PAGE_HEADINGS as Record<string, string>).meta).toBeUndefined()
    expect(zhModule.resolveWikiSectionKeyFromHeading('页面头信息')).toBe('meta')
    expect(zhModule.resolveWikiSectionKeyFromHeading('主题概览')).toBe('intro')
    expect(zhModule.resolveWikiSectionKeyFromHeading('关键文档')).toBe('highlights')
    expect(zhModule.resolveWikiSectionKeyFromHeading('关系证据')).toBe('sources')
  })
})
