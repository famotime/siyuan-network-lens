import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  WIKI_APPLY_RESULTS,
  WIKI_BLOCK_ATTR_KEYS,
  WIKI_PAGE_HEADINGS,
  WIKI_PAGE_TYPES,
  WIKI_PREVIEW_STATUSES,
  resolveWikiSectionKeyFromHeading,
  buildThemeWikiPageTitle,
  isWikiDocumentTitle,
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

  it('keeps legacy managed section headings available for downstream compatibility', async () => {
    expect(Object.keys(WIKI_PAGE_HEADINGS)).toEqual(['managedRoot', 'manualNotes'])
    expect((WIKI_PAGE_HEADINGS as Record<string, string>).meta).toBe('Page meta')
    expect((WIKI_PAGE_HEADINGS as Record<string, string>).overview).toBe('Topic overview')
    expect((WIKI_PAGE_HEADINGS as Record<string, string>).keyDocuments).toBe('Key documents')
    expect((WIKI_PAGE_HEADINGS as Record<string, string>).structureObservations).toBe('Structure observations')
    expect((WIKI_PAGE_HEADINGS as Record<string, string>).evidence).toBe('Relationship evidence')
    expect((WIKI_PAGE_HEADINGS as Record<string, string>).actions).toBe('Cleanup actions')
    expect(resolveWikiSectionKeyFromHeading('Page meta')).toBe('meta')
    expect(resolveWikiSectionKeyFromHeading('Topic overview')).toBe('overview')
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
    const zhHeadings = zhModule.WIKI_PAGE_HEADINGS as Record<string, string>

    expect(Object.keys(zhModule.WIKI_PAGE_HEADINGS)).toEqual(['managedRoot', 'manualNotes'])
    expect(zhHeadings.meta).toBe('页面头信息')
    expect(zhHeadings.overview).toBe('主题概览')
    expect(zhModule.resolveWikiSectionKeyFromHeading('页面头信息')).toBe('meta')
    expect(zhModule.resolveWikiSectionKeyFromHeading('主题概览')).toBe('overview')
  })
})
