import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDocumentSummary, ensureDocumentSummary } from './ai-document-summary'
import type { DocumentRecord } from './analysis'

const sourceDocument: DocumentRecord = {
  id: 'doc-1',
  box: 'box-1',
  path: '/notes/doc-1.sy',
  hpath: '/笔记/AI 索引实践',
  title: 'AI 索引实践',
  content: '第一段内容。\n第二段内容。\n第三段内容。',
  tags: ['AI', '知识管理'],
  updated: '20260403120000',
}

describe('ai document summary', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('builds a deterministic local summary from title, content, path and tags', () => {
    expect(buildDocumentSummary(sourceDocument)).toEqual({
      summaryShort: '第一段内容。 第二段内容。 第三段内容。',
      summaryMedium: 'Title: AI 索引实践; Path: /笔记/AI 索引实践; Key points: 第一段内容。 第二段内容。',
      keywords: ['AI', '知识管理', '索引实践'],
      evidenceSnippets: ['第一段内容。', '第二段内容。'],
    })
  })

  it('reuses a fresh stored summary instead of rebuilding it', async () => {
    const store = {
      getFreshDocumentSummary: vi.fn(async () => ({
        summaryShort: '缓存短摘要',
        summaryMedium: '缓存中摘要',
        keywords: ['缓存关键词'],
        evidenceSnippets: ['缓存证据'],
        updatedAt: '2026-04-03T12:05:00.000Z',
      })),
      saveDocumentSummary: vi.fn(async () => undefined),
    }

    await expect(ensureDocumentSummary({
      config: {
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument,
      indexStore: store as any,
    })).resolves.toEqual({
      summaryShort: '缓存短摘要',
      summaryMedium: '缓存中摘要',
      keywords: ['缓存关键词'],
      evidenceSnippets: ['缓存证据'],
      updatedAt: '2026-04-03T12:05:00.000Z',
      fromCache: true,
    })

    expect(store.getFreshDocumentSummary).toHaveBeenCalledWith('doc-1', '20260403120000')
    expect(store.saveDocumentSummary).not.toHaveBeenCalled()
  })

  it('rebuilds and saves the summary when the cache is missing or stale', async () => {
    const store = {
      getFreshDocumentSummary: vi.fn(async () => null),
      saveDocumentSummary: vi.fn(async () => undefined),
    }

    const result = await ensureDocumentSummary({
      config: {
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument,
      indexStore: store as any,
      updatedAt: '2026-04-03T12:05:00.000Z',
    })

    expect(result).toEqual({
      summaryShort: '第一段内容。 第二段内容。 第三段内容。',
      summaryMedium: 'Title: AI 索引实践; Path: /笔记/AI 索引实践; Key points: 第一段内容。 第二段内容。',
      keywords: ['AI', '知识管理', '索引实践'],
      evidenceSnippets: ['第一段内容。', '第二段内容。'],
      updatedAt: '2026-04-03T12:05:00.000Z',
      fromCache: false,
    })
    expect(store.saveDocumentSummary).toHaveBeenCalledWith(expect.objectContaining({
      sourceDocument: expect.objectContaining({ id: 'doc-1' }),
      summaryShort: '第一段内容。 第二段内容。 第三段内容。',
      summaryMedium: 'Title: AI 索引实践; Path: /笔记/AI 索引实践; Key points: 第一段内容。 第二段内容。',
      keywords: ['AI', '知识管理', '索引实践'],
      evidenceSnippets: ['第一段内容。', '第二段内容。'],
      updatedAt: '2026-04-03T12:05:00.000Z',
    }))
  })

  it('switches rebuilt summaries to Chinese when the workspace locale is zh_CN', () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    expect(buildDocumentSummary(sourceDocument).summaryMedium)
      .toBe('标题：AI 索引实践；路径：/笔记/AI 索引实践；正文要点：第一段内容。 第二段内容。')
  })
})
