import { describe, expect, it } from 'vitest'

import {
  TODAY_SUGGESTION_HISTORY_SCHEMA_VERSION,
  TODAY_SUGGESTION_HISTORY_STORAGE_NAME,
  createTodaySuggestionHistoryStore,
} from './today-suggestion-history-store'

function createMemoryStorage(initialValue?: any) {
  let snapshot = initialValue

  return {
    async loadData(storageName: string) {
      expect(storageName).toBe(TODAY_SUGGESTION_HISTORY_STORAGE_NAME)
      return snapshot
    },
    async saveData(storageName: string, value: any) {
      expect(storageName).toBe(TODAY_SUGGESTION_HISTORY_STORAGE_NAME)
      snapshot = value
    },
    read() {
      return snapshot
    },
  }
}

function buildHistoryEntry(generatedAt: string) {
  return {
    id: `history-${generatedAt}`,
    generatedAt,
    timeRange: '7d',
    filters: {
      notebook: 'box-1',
      tags: ['AI'],
      themeNames: ['AI'],
      keyword: '机器学习',
    },
    summaryCount: 1,
    result: {
      generatedAt,
      summary: `生成于 ${generatedAt} 的建议`,
      items: [
        {
          id: `item-${generatedAt}`,
          type: 'document',
          title: '修复孤立文档：AI 与机器学习',
          priority: 'P1',
          action: '补到主题-AI-索引',
          reason: '当前窗口内孤立。',
        },
      ],
    },
  }
}

describe('today suggestion history store', () => {
  it('creates an empty snapshot with the current schema version', async () => {
    const storage = createMemoryStorage()
    const store = createTodaySuggestionHistoryStore(storage)

    await expect(store.loadSnapshot()).resolves.toEqual({
      schemaVersion: TODAY_SUGGESTION_HISTORY_SCHEMA_VERSION,
      entries: [],
    })
  })

  it('keeps the latest three valid history snapshots in newest-first order', async () => {
    const storage = createMemoryStorage()
    const store = createTodaySuggestionHistoryStore(storage)

    await store.saveEntry(buildHistoryEntry('2026-04-13T08:00:00.000Z'))
    await store.saveEntry(buildHistoryEntry('2026-04-13T09:00:00.000Z'))
    await store.saveEntry(buildHistoryEntry('2026-04-13T10:00:00.000Z'))
    await store.saveEntry(buildHistoryEntry('2026-04-13T11:00:00.000Z'))

    await expect(store.loadSnapshot()).resolves.toEqual({
      schemaVersion: TODAY_SUGGESTION_HISTORY_SCHEMA_VERSION,
      entries: [
        expect.objectContaining({ generatedAt: '2026-04-13T11:00:00.000Z' }),
        expect.objectContaining({ generatedAt: '2026-04-13T10:00:00.000Z' }),
        expect.objectContaining({ generatedAt: '2026-04-13T09:00:00.000Z' }),
      ],
    })
  })

  it('normalizes malformed stored data into a safe snapshot shape', async () => {
    const storage = createMemoryStorage({
      schemaVersion: 0,
      entries: [
        {
          id: 1,
          generatedAt: '',
          result: null,
        },
        {
          id: 'history-valid',
          generatedAt: '2026-04-13T10:00:00.000Z',
          timeRange: '7d',
          filters: {
            notebook: 'box-1',
            tags: ['AI', ''],
            themeNames: ['AI'],
            keyword: '机器学习',
          },
          summaryCount: '2',
          result: {
            generatedAt: '2026-04-13T10:00:00.000Z',
            summary: '有效结果',
            items: [
              {
                id: 'item-1',
                type: 'document',
                title: 'AI 与机器学习',
                priority: 'P1',
                action: '补到主题-AI-索引',
                reason: '当前窗口内孤立。',
              },
            ],
          },
        },
      ],
    })
    const store = createTodaySuggestionHistoryStore(storage)

    await expect(store.loadSnapshot()).resolves.toEqual({
      schemaVersion: TODAY_SUGGESTION_HISTORY_SCHEMA_VERSION,
      entries: [
        expect.objectContaining({
          id: 'history-valid',
          generatedAt: '2026-04-13T10:00:00.000Z',
          summaryCount: 2,
        }),
      ],
    })
  })
})
