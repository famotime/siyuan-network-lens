import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureDocumentIndex, ensureDocumentSummary } from './ai-document-summary'
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

const baseChildBlocks = [
  { id: 'b1', type: 'p' },
  { id: 'b2', type: 'p' },
]

const baseBlockKramdownMap: Record<string, string> = {
  b1: '这是第一段足够长的内容，用于通过最低字数阈值的过滤检查。',
  b2: '这是第二段同样足够长的内容，讨论知识管理和 AI 索引的实践方法。',
}

function makeForwardProxy(responseBody: string) {
  return async () => ({
    body: responseBody,
    contentType: 'application/json',
    elapsed: 1,
    headers: {},
    status: 200,
    url: 'https://api.example.com/v1/chat/completions',
  })
}

const validAiContent = JSON.stringify({
  positioning: '本文记录了 AI 索引的实践方法。',
  propositions: [
    { text: 'AI 索引能提升知识管理效率', sourceBlockIds: ['b1'] },
    { text: '证据块是索引的核心组成', sourceBlockIds: ['b2'] },
  ],
  keywords: ['AI', '索引', '知识管理'],
})

const validAiResponse = JSON.stringify({
  choices: [{ message: { content: validAiContent } }],
})

describe('ensureDocumentIndex', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('calls saveDocumentIndex with evidence compilation result', async () => {
    const store = {
      getFreshDocumentProfile: vi.fn(async () => null),
      saveDocumentIndex: vi.fn(async () => undefined),
    }

    const forwardProxy = vi.fn(async () => ({
      body: validAiResponse,
      contentType: 'application/json',
      elapsed: 1,
      headers: {},
      status: 200,
      url: 'https://api.example.com/v1/chat/completions',
    }))

    const result = await ensureDocumentIndex({
      config: {
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-test',
      },
      sourceDocument,
      indexStore: store,
      forwardProxy,
      getChildBlocks: async () => baseChildBlocks,
      getBlockKramdown: async (id) => ({ id, kramdown: baseBlockKramdownMap[id] || '' }),
      force: true,
      updatedAt: '2026-04-03T12:05:00.000Z',
    })

    expect(result.fromCache).toBe(false)
    expect(result.updatedAt).toBe('2026-04-03T12:05:00.000Z')
    expect(store.saveDocumentIndex).toHaveBeenCalledTimes(1)

    const saveArgs = store.saveDocumentIndex.mock.calls[0][0]
    expect(saveArgs.positioning).toBe('本文记录了 AI 索引的实践方法。')
    expect(saveArgs.propositions).toHaveLength(2)
    expect(saveArgs.keywords).toEqual(['AI', '索引', '知识管理'])
    expect(saveArgs.primarySourceBlocks).toBeDefined()
    expect(saveArgs.secondarySourceBlocks).toBeDefined()
  })

  it('returns cached result when profile is fresh', async () => {
    const store = {
      getFreshDocumentProfile: vi.fn(async () => ({
        documentId: 'doc-1',
        positioning: '缓存定位',
        generatedAt: '2026-04-03T12:05:00.000Z',
      })),
      saveDocumentIndex: vi.fn(async () => undefined),
    }

    const result = await ensureDocumentIndex({
      config: { aiBaseUrl: 'https://api.example.com/v1', aiApiKey: 'sk-test', aiModel: 'gpt-test' },
      sourceDocument,
      indexStore: store,
      forwardProxy: makeForwardProxy(validAiResponse),
      getChildBlocks: async () => baseChildBlocks,
      getBlockKramdown: async (id) => ({ id, kramdown: '' }),
    })

    expect(result.fromCache).toBe(true)
    expect(store.saveDocumentIndex).not.toHaveBeenCalled()
  })

  it('throws when AI config is incomplete', async () => {
    await expect(ensureDocumentIndex({
      config: { aiModel: 'gpt-test' },
      sourceDocument,
      indexStore: { getFreshDocumentProfile: vi.fn(async () => null), saveDocumentIndex: vi.fn() },
      forwardProxy: makeForwardProxy(validAiResponse),
      getChildBlocks: async () => [],
      getBlockKramdown: async (id) => ({ id, kramdown: '' }),
      force: true,
    })).rejects.toThrow()
  })
})

describe('ensureDocumentSummary', () => {
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
      saveDocumentIndex: vi.fn(async () => undefined),
    }

    await expect(ensureDocumentSummary({
      config: { aiModel: 'gpt-test' },
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
    expect(store.saveDocumentIndex).not.toHaveBeenCalled()
  })

  it('throws when forwardProxy is missing', async () => {
    await expect(ensureDocumentSummary({
      config: {
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-test',
      },
      sourceDocument,
    })).rejects.toThrow()
  })

  it('throws when AI config is incomplete', async () => {
    const forwardProxy = makeForwardProxy(validAiResponse)

    await expect(ensureDocumentSummary({
      config: { aiModel: 'gpt-test' },
      sourceDocument,
      forwardProxy,
      getChildBlocks: async () => [],
      getBlockKramdown: async (id) => ({ id, kramdown: '' }),
    })).rejects.toThrow()
  })
})
