import { describe, expect, it } from 'vitest'

import { collectReadMatches } from './read-status'

const documents = [
  {
    id: 'doc-read-tag',
    box: 'box-1',
    path: '/read-tag.sy',
    hpath: '/Read Tag',
    title: '普通文档',
    tags: ['已读', '学习'],
  },
  {
    id: 'doc-read-prefix',
    box: 'box-1',
    path: '/read-prefix.sy',
    hpath: '/Read Prefix',
    title: '已读-图分析',
    tags: ['学习'],
  },
  {
    id: 'doc-read-suffix',
    box: 'box-1',
    path: '/read-suffix.sy',
    hpath: '/Read Suffix',
    title: '图分析-五星',
    tags: [],
  },
  {
    id: 'doc-unread',
    box: 'box-1',
    path: '/unread.sy',
    hpath: '/Unread',
    title: '未命中文档',
    tags: ['学习'],
  },
  {
    id: 'doc-read-directory',
    box: 'box-1',
    path: '/已读/归档/目录命中.sy',
    hpath: '/已读/归档/目录命中',
    title: '目录命中文档',
    tags: ['学习'],
  },
  {
    id: 'doc-read-notebook-path',
    box: 'box-1',
    path: '/read/archive/notebook-scope.sy',
    hpath: '/已读/归档/笔记本路径命中',
    title: '笔记本路径命中文档',
    tags: ['学习'],
  },
  {
    id: 'doc-other-notebook',
    box: 'box-2',
    path: '/read/archive/notebook-scope.sy',
    hpath: '/已读/归档/其他笔记本',
    title: '其他笔记本文档',
    tags: ['学习'],
  },
] as const

describe('collectReadMatches', () => {
  it('marks documents as read when any selected tag, prefix, suffix, or directory matches', () => {
    const matches = collectReadMatches({
      documents: documents.filter(document => !['doc-read-notebook-path', 'doc-other-notebook'].includes(document.id)),
      config: {
        readTagNames: ['已读', '五星'],
        readTitlePrefixes: '已读-|三星-',
        readTitleSuffixes: '-五星| -归档 ',
        readPaths: '/已读| /archive ',
      } as any,
    })

    expect(matches.map(item => item.documentId)).toEqual([
      'doc-read-directory',
      'doc-read-prefix',
      'doc-read-suffix',
      'doc-read-tag',
    ])
    expect(matches.find(item => item.documentId === 'doc-read-directory')).toEqual(expect.objectContaining({
      matchedTags: [],
      matchedPrefixes: [],
      matchedSuffixes: [],
      matchedPaths: ['/已读'],
    }))
    expect(matches.find(item => item.documentId === 'doc-read-tag')).toEqual(expect.objectContaining({
      matchedTags: ['已读'],
      matchedPrefixes: [],
      matchedSuffixes: [],
      matchedPaths: [],
    }))
    expect(matches.find(item => item.documentId === 'doc-read-prefix')).toEqual(expect.objectContaining({
      matchedTags: [],
      matchedPrefixes: ['已读-'],
      matchedSuffixes: [],
      matchedPaths: [],
    }))
    expect(matches.find(item => item.documentId === 'doc-read-suffix')).toEqual(expect.objectContaining({
      matchedTags: [],
      matchedPrefixes: [],
      matchedSuffixes: ['-五星'],
      matchedPaths: [],
    }))
  })

  it('returns an empty list when no read rule is configured', () => {
    expect(collectReadMatches({
      documents: [...documents],
      config: {
        readTagNames: [],
        readTitlePrefixes: ' | ',
        readTitleSuffixes: '',
        readPaths: ' | ',
      } as any,
    })).toEqual([])
  })

  it('supports full read paths that include the notebook name', () => {
    const matches = collectReadMatches({
      documents: [...documents],
      notebooks: [
        { id: 'box-1', name: '知识库' },
        { id: 'box-2', name: '工作台' },
      ],
      config: {
        readTagNames: [],
        readTitlePrefixes: '',
        readTitleSuffixes: '',
        readPaths: '/知识库/已读/归档/笔记本路径命中',
      } as any,
    })

    expect(matches.map(item => item.documentId)).toEqual([
      'doc-read-notebook-path',
    ])
    expect(matches[0]).toEqual(expect.objectContaining({
      matchedPaths: ['/知识库/已读/归档/笔记本路径命中'],
    }))
  })
})
