import { describe, expect, it } from 'vitest'

import {
  AI_WIKI_INDEX_SCHEMA_VERSION,
  AI_WIKI_INDEX_STORAGE_NAME,
  buildWikiPageStorageKey,
  createAiWikiStore,
} from './wiki-store'

function createMemoryStorage(initialValue?: any) {
  let snapshot = initialValue

  return {
    async loadData(storageName: string) {
      expect(storageName).toBe(AI_WIKI_INDEX_STORAGE_NAME)
      return snapshot
    },
    async saveData(storageName: string, value: any) {
      expect(storageName).toBe(AI_WIKI_INDEX_STORAGE_NAME)
      snapshot = value
    },
    read() {
      return snapshot
    },
  }
}

describe('wiki store', () => {
  it('creates an empty snapshot with the current schema version', async () => {
    const storage = createMemoryStorage()
    const store = createAiWikiStore(storage)

    await expect(store.loadSnapshot()).resolves.toEqual({
      schemaVersion: AI_WIKI_INDEX_SCHEMA_VERSION,
      pages: {},
    })
  })

  it('saves and reloads a normalized page record keyed by page type and theme mapping', async () => {
    const storage = createMemoryStorage()
    const store = createAiWikiStore(storage)

    await store.savePageRecord({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      themeDocumentId: 'theme-ai',
      themeDocumentTitle: '主题-AI-索引',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      pageFingerprint: 'page-hash',
      managedFingerprint: 'managed-hash',
      lastGeneratedAt: '2026-04-09T10:00:00.000Z',
      lastPreview: {
        generatedAt: '2026-04-09T10:00:00.000Z',
        status: 'update',
        sourceDocumentIds: ['doc-1', 'doc-2'],
        managedFingerprint: 'preview-managed',
      },
      lastApply: {
        appliedAt: '2026-04-09T10:10:00.000Z',
        result: 'updated',
        sourceDocumentIds: ['doc-1', 'doc-2'],
        managedFingerprint: 'apply-managed',
      },
    })

    const pageKey = buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      themeDocumentId: 'theme-ai',
    })

    await expect(store.getPageRecord(pageKey)).resolves.toEqual({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      themeDocumentId: 'theme-ai',
      themeDocumentTitle: '主题-AI-索引',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      sourceDocumentEntries: [],
      sourceDocumentTimestamps: undefined,
      pageFingerprint: 'page-hash',
      managedFingerprint: 'managed-hash',
      lastGeneratedAt: '2026-04-09T10:00:00.000Z',
      lastPreview: {
        generatedAt: '2026-04-09T10:00:00.000Z',
        status: 'update',
        sourceDocumentIds: ['doc-1', 'doc-2'],
        pageFingerprint: undefined,
        managedFingerprint: 'preview-managed',
      },
      lastApply: {
        appliedAt: '2026-04-09T10:10:00.000Z',
        result: 'updated',
        sourceDocumentIds: ['doc-1', 'doc-2'],
        pageFingerprint: undefined,
        managedFingerprint: 'apply-managed',
      },
    })
  })

  it('saves and reloads sourceDocumentTimestamps in the page record', async () => {
    const storage = createMemoryStorage()
    const store = createAiWikiStore(storage)

    await store.savePageRecord({
      pageType: 'theme',
      pageTitle: 'test-llm-wiki',
      themeDocumentId: 'theme-1',
      themeDocumentTitle: 'Test Theme',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      sourceDocumentTimestamps: {
        'doc-1': '2026-05-07T10:00',
        'doc-2': '2026-05-06T15:30',
      },
      lastGeneratedAt: '2026-05-07T12:00:00.000Z',
    })

    const pageKey = buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle: 'test-llm-wiki',
      themeDocumentId: 'theme-1',
    })

    const record = await store.getPageRecord(pageKey)
    expect(record?.sourceDocumentTimestamps).toEqual({
      'doc-1': '2026-05-07T10:00',
      'doc-2': '2026-05-06T15:30',
    })
    expect(record?.sourceDocumentEntries).toEqual([])
  })

  it('saves and reloads sourceDocumentEntries with normalized link types', async () => {
    const storage = createMemoryStorage()
    const store = createAiWikiStore(storage)

    await store.savePageRecord({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      themeDocumentId: 'theme-ai',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      sourceDocumentEntries: [
        { documentId: 'doc-1', title: 'Alpha', linkTypes: ['inbound', 'outbound', 'inbound'] },
        { documentId: 'doc-2', title: 'Beta', linkTypes: ['child'] },
      ],
    })

    const pageKey = buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      themeDocumentId: 'theme-ai',
    })

    const record = await store.getPageRecord(pageKey)
    expect(record?.sourceDocumentEntries).toEqual([
      { documentId: 'doc-1', title: 'Alpha', linkTypes: ['inbound', 'outbound'] },
      { documentId: 'doc-2', title: 'Beta', linkTypes: ['child'] },
    ])
  })

  it('normalizes malformed stored data into a safe snapshot shape', async () => {
    const storage = createMemoryStorage({
      schemaVersion: 0,
      pages: {
        broken: {
          pageType: 'unknown',
          pageTitle: 123,
          sourceDocumentIds: ['doc-1', '', 2],
          lastPreview: {
            status: 'weird',
          },
        },
      },
    })
    const store = createAiWikiStore(storage)

    await expect(store.loadSnapshot()).resolves.toEqual({
      schemaVersion: AI_WIKI_INDEX_SCHEMA_VERSION,
      pages: {
        broken: {
          pageType: 'theme',
          pageTitle: '',
          themeDocumentId: undefined,
          themeDocumentTitle: undefined,
          pageId: undefined,
          sourceDocumentIds: ['doc-1'],
          sourceDocumentEntries: [],
          sourceDocumentTimestamps: undefined,
          pageFingerprint: undefined,
          managedFingerprint: undefined,
          lastGeneratedAt: undefined,
          lastPreview: undefined,
          lastApply: undefined,
        },
      },
    })
  })
})
