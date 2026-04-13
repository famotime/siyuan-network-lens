import { describe, expect, it } from 'vitest'

import { collectThemeDocuments, countThemeMatchesForDocument, documentMatchesSelectedThemes } from './theme-documents'
import type { PluginConfig } from '@/types/config'

const config: PluginConfig = {
  showSummaryCards: true,
  showRanking: true,
  showCommunities: true,
  showOrphanBridge: true,
  showTrends: true,
  showPropagation: true,
  themeDocumentPath: '/知识库/专题|/Research Vault/专题',
  themeNamePrefix: '主题-',
  themeNameSuffix: '-索引',
  wikiPageSuffix: '-llm-wiki',
}

const documents = [
  { id: 'doc-root', box: 'box-1', path: '/topics.sy', hpath: '/专题', title: '专题总览', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', name: '人工智能', alias: 'AIGC,智能体', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-ai-wiki', box: 'box-1', path: '/topics/theme-ai-wiki.sy', hpath: '/专题/主题-AI-索引-llm-wiki', title: '主题-AI-索引-llm-wiki', name: '人工智能', alias: 'AIGC,智能体', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-ml', box: 'box-1', path: '/topics/theme-ml.sy', hpath: '/专题/主题-机器学习-索引', title: '主题-机器学习-索引', name: '机器学习', alias: 'ML', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-skills', box: 'box-1', path: '/topics/theme-skills.sy', hpath: '/专题/主题-Skills-索引', title: '主题-Skills-索引', name: 'skill', alias: 'abc,def', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-theme-ignore', box: 'box-1', path: '/topics/theme-ignore.sy', hpath: '/专题/无前后缀', title: '无前后缀', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-other-box', box: 'box-2', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], created: '20260301090000', updated: '20260301120000' },
  { id: 'doc-other-box-ml', box: 'box-2', path: '/topics/theme-ml.sy', hpath: '/专题/主题-机器学习-索引', title: '主题-机器学习-索引', tags: [], created: '20260301090000', updated: '20260301120000' },
] as const

describe('theme documents', () => {
  it('collects configured topic documents from multiple full paths and strips prefix and suffix from theme names', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
      notebooks: [
        { id: 'box-1', name: '知识库' },
        { id: 'box-2', name: 'Research Vault' },
      ],
    })

    expect(themeDocuments).toHaveLength(3)
    expect(themeDocuments).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentId: 'doc-theme-ai', themeName: 'AI' }),
      expect.objectContaining({ documentId: 'doc-theme-ml', themeName: '机器学习' }),
      expect.objectContaining({ documentId: 'doc-theme-skills', themeName: 'Skills' }),
    ]))
    expect(themeDocuments.some(item => item.documentId === 'doc-theme-ai-wiki')).toBe(false)
    expect(themeDocuments.some(item => item.documentId === 'doc-other-box')).toBe(false)
    expect(themeDocuments.some(item => item.documentId === 'doc-other-box-ml')).toBe(false)
  })

  it('counts theme matches in document title, path and tags and sorts by match count', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
      notebooks: [
        { id: 'box-1', name: '知识库' },
        { id: 'box-2', name: 'Research Vault' },
      ],
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
      { theme: '机器学习', count: 3 },
    ])
  })

  it('matches theme documents when an orphan only mentions the configured name or an alias', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
      notebooks: [
        { id: 'box-1', name: '知识库' },
        { id: 'box-2', name: 'Research Vault' },
      ],
    })

    const matches = countThemeMatchesForDocument({
      document: {
        id: 'doc-orphan-alias',
        box: 'box-1',
        path: '/notes/agents.sy',
        hpath: '/笔记/智能体',
        title: '人工智能实践',
        tags: ['知识卡片'],
      },
      themeDocuments,
    })

    expect(matches).toEqual([
      expect.objectContaining({ themeName: 'AI', matchCount: 2 }),
    ])
  })

  it('matches theme documents when an orphan only mentions the name or alias in document content', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
      notebooks: [
        { id: 'box-1', name: '知识库' },
        { id: 'box-2', name: 'Research Vault' },
      ],
    })

    const matches = countThemeMatchesForDocument({
      document: {
        id: 'doc-orphan-content',
        box: 'box-1',
        path: '/notes/content-only.sy',
        hpath: '/笔记/随想',
        title: '别名测试',
        content: 'skill abc def',
        tags: [],
      },
      themeDocuments,
    })

    expect(matches).toEqual([
      expect.objectContaining({ themeName: 'Skills', matchCount: 3 }),
    ])
  })

  it('matches selected themes as an OR filter', () => {
    const themeDocuments = collectThemeDocuments({
      documents: [...documents],
      config,
      notebooks: [
        { id: 'box-1', name: '知识库' },
        { id: 'box-2', name: 'Research Vault' },
      ],
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
