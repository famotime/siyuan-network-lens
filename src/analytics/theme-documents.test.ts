import { describe, expect, it } from 'vitest'

import { collectThemeDocuments, countThemeMatchesForDocument, documentMatchesSelectedThemes } from './theme-documents'
import type { PluginConfig } from '@/types/config'

const config: PluginConfig = {
  showSummaryCards: true,
  showRanking: true,
  showSuggestions: true,
  showCommunities: true,
  showOrphanBridge: true,
  showTrends: true,
  showPropagation: true,
  themeNotebookId: 'box-1',
  themeDocumentPath: '/专题',
  themeNamePrefix: '主题-',
  themeNameSuffix: '-索引',
}

const documents = [
  { id: 'doc-root', box: 'box-1', path: '/topics.sy', hpath: '/专题', title: '专题总览', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-ml', box: 'box-1', path: '/topics/theme-ml.sy', hpath: '/专题/主题-机器学习-索引', title: '主题-机器学习-索引', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-ignore', box: 'box-1', path: '/topics/theme-ignore.sy', hpath: '/专题/无前后缀', title: '无前后缀', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-other-box', box: 'box-2', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], created: '20260301090000', updated: '20260301120000' },
] as const

describe('theme documents', () => {
  it('collects configured topic documents and strips prefix and suffix from theme names', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
    })

    expect(themeDocuments).toHaveLength(2)
    expect(themeDocuments).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentId: 'doc-theme-ai', themeName: 'AI' }),
      expect.objectContaining({ documentId: 'doc-theme-ml', themeName: '机器学习' }),
    ]))
  })

  it('counts theme matches in document title, path and tags and sorts by match count', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
    })

    const matches = countThemeMatchesForDocument({
      document: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/AI-and-ml.sy',
        hpath: '/笔记/AI 与 机器学习',
        title: 'AI 机器学习 AI',
        tags: ['AI', '知识整理'],
      },
      themeDocuments,
    })

    expect(matches.map(item => ({ theme: item.themeName, count: item.matchCount }))).toEqual([
      { theme: 'AI', count: 5 },
      { theme: '机器学习', count: 2 },
    ])
  })

  it('matches selected themes as an OR filter', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
    })

    expect(documentMatchesSelectedThemes({
      document: {
        id: 'doc-topic',
        box: 'box-1',
        path: '/notes/random.sy',
        hpath: '/笔记/机器学习实验',
        title: '随机笔记',
        tags: ['数据'],
      },
      selectedThemes: ['AI', '机器学习'],
      themeDocuments,
    })).toBe(true)

    expect(documentMatchesSelectedThemes({
      document: {
        id: 'doc-unmatched',
        box: 'box-1',
        path: '/notes/random.sy',
        hpath: '/笔记/杂项',
        title: '随机笔记',
        tags: ['数据'],
      },
      selectedThemes: ['AI', '机器学习'],
      themeDocuments,
    })).toBe(false)
  })
})
