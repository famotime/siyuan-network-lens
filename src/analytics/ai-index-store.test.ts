import { describe, expect, it } from 'vitest'

import type { DocumentRecord } from './analysis'
import { createAiDocumentIndexStore } from './ai-index-store'

const baseDocument: DocumentRecord = {
  id: 'doc-1',
  box: 'box-1',
  path: '/notes/doc-1.sy',
  hpath: '/笔记/文档 1',
  title: '文档 1',
  content: '这是第一段。\n这是第二段。',
  tags: ['AI', '索引'],
  updated: '20260403120000',
}

function createMemoryStorage(initialValue?: any) {
  let snapshot = initialValue

  return {
    async loadData() {
      return snapshot
    },
    async saveData(_storageName: string, value: any) {
      snapshot = value
    },
    read() {
      return snapshot
    },
  }
}

describe('ai index store', () => {
  it('saves and reads a document index profile by document id', async () => {
    const storage = createMemoryStorage()
    const store = createAiDocumentIndexStore(storage)

    await store.saveDocumentIndex({
      config: {
        aiModel: 'gpt-test',
      },
      sourceDocument: baseDocument,
      positioning: '本文记录了 AI 索引页的组织思路。',
      propositions: [
        { text: '主题页是索引入口', sourceBlockIds: ['b1'] },
        { text: '标签帮助回查', sourceBlockIds: ['b2'] },
      ],
      keywords: ['AI', '索引', '主题页'],
      primarySourceBlocks: [
        { blockId: 'b1', text: '主题页是组织知识的核心入口。' },
      ],
      secondarySourceBlocks: [
        { blockId: 'b2', text: '标签系统提供回查便利。' },
      ],
      generatedAt: '2026-04-03T12:05:00.000Z',
    })

    const profile = await store.getDocumentProfile('doc-1')

    expect(profile).toEqual(expect.objectContaining({
      documentId: 'doc-1',
      sourceUpdatedAt: '20260403120000',
      positioning: '本文记录了 AI 索引页的组织思路。',
      generatedAt: '2026-04-03T12:05:00.000Z',
    }))
    expect(profile?.propositionsJson).toBe(JSON.stringify([
      { text: '主题页是索引入口', sourceBlockIds: ['b1'] },
      { text: '标签帮助回查', sourceBlockIds: ['b2'] },
    ]))
    expect(profile?.keywordsJson).toBe(JSON.stringify(['AI', '索引', '主题页']))
    expect(profile?.primarySourceBlocksJson).toBe(JSON.stringify([
      { blockId: 'b1', text: '主题页是组织知识的核心入口。' },
    ]))
  })

  it('returns a fresh document profile only when sourceUpdatedAt matches', async () => {
    const storage = createMemoryStorage()
    const store = createAiDocumentIndexStore(storage)

    await store.saveDocumentIndex({
      config: { aiModel: 'gpt-test' },
      sourceDocument: baseDocument,
      positioning: '定位描述。',
      propositions: [{ text: '命题一', sourceBlockIds: [] }],
      keywords: ['AI'],
      primarySourceBlocks: [],
      secondarySourceBlocks: [],
    })

    await expect(store.getFreshDocumentProfile('doc-1', '20260403120000')).resolves.toEqual(
      expect.objectContaining({
        documentId: 'doc-1',
        positioning: '定位描述。',
      }),
    )
    await expect(store.getFreshDocumentProfile('doc-1', '20260404120000')).resolves.toBeNull()
  })

  it('returns a fresh document summary snapshot via compatibility bridge', async () => {
    const storage = createMemoryStorage()
    const store = createAiDocumentIndexStore(storage)

    await store.saveDocumentIndex({
      config: { aiModel: 'gpt-test' },
      sourceDocument: baseDocument,
      positioning: '这是正文定位。',
      propositions: [
        { text: '命题一', sourceBlockIds: ['b1'] },
        { text: '命题二', sourceBlockIds: ['b2'] },
      ],
      keywords: ['AI', '索引'],
      primarySourceBlocks: [
        { blockId: 'b1', text: '这是第一段。' },
      ],
      secondarySourceBlocks: [],
      generatedAt: '2026-04-03T12:05:00.000Z',
    })

    const summary = await store.getFreshDocumentSummary('doc-1', '20260403120000')
    expect(summary).toEqual({
      summaryShort: '这是正文定位。',
      summaryMedium: '命题一 命题二',
      keywords: ['AI', '索引'],
      evidenceSnippets: ['这是第一段。'],
      updatedAt: '2026-04-03T12:05:00.000Z',
    })

    await expect(store.getFreshDocumentSummary('doc-1', '20260404120000')).resolves.toBeNull()
  })

  it('returns null for legacy snapshot with schemaVersion < 3', async () => {
    const storage = createMemoryStorage({
      schemaVersion: 1,
      semanticProfiles: {
        'doc-legacy': {
          documentId: 'doc-legacy',
          sourceUpdatedAt: '20260401120000',
          summaryShort: '旧摘要',
        },
      },
    })
    const store = createAiDocumentIndexStore(storage)

    const profile = await store.getDocumentProfile('doc-legacy')
    expect(profile).toBeNull()
  })

  it('deletes document index entries', async () => {
    const storage = createMemoryStorage()
    const store = createAiDocumentIndexStore(storage)

    await store.saveDocumentIndex({
      config: { aiModel: 'gpt-test' },
      sourceDocument: baseDocument,
      positioning: '定位描述。',
      propositions: [],
      keywords: [],
      primarySourceBlocks: [],
      secondarySourceBlocks: [],
    })

    const before = await store.getDocumentProfile('doc-1')
    expect(before).not.toBeNull()

    await store.deleteDocumentIndex(['doc-1'])

    const after = await store.getDocumentProfile('doc-1')
    expect(after).toBeNull()
  })
})
