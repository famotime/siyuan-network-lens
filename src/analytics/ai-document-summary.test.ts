import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureDocumentSummary } from './ai-document-summary'
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

  it('throws when AI is not configured and cache is stale', async () => {
    const store = {
      getFreshDocumentSummary: vi.fn(async () => null),
      saveDocumentSummary: vi.fn(async () => undefined),
    }

    await expect(ensureDocumentSummary({
      config: {
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument,
      indexStore: store as any,
      updatedAt: '2026-04-03T12:05:00.000Z',
    })).rejects.toThrow()
  })

  it('throws when forwardProxy is missing', async () => {
    await expect(ensureDocumentSummary({
      config: {
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument,
    })).rejects.toThrow()
  })

  it('throws when AI config is incomplete', async () => {
    const forwardProxy = vi.fn()

    await expect(ensureDocumentSummary({
      config: {
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument,
      forwardProxy,
    })).rejects.toThrow()
  })
})
