import { describe, expect, it } from 'vitest'

import type { DocumentRecord, OrphanItem } from './analysis'
import { createAiLinkRepairStore } from './ai-link-repair-store'
import type { AiLinkSuggestionResult } from './ai-link-suggestions'

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

const baseOrphan: OrphanItem = {
  documentId: 'doc-1',
  title: '文档 1',
  degree: 0,
  createdAt: '20260401120000',
  updatedAt: '20260403120000',
  historicalReferenceCount: 1,
  lastHistoricalAt: '20260402120000',
  hasSparseEvidence: true,
}

const baseSuggestionResult: AiLinkSuggestionResult = {
  generatedAt: '2026-04-03T12:00:00.000Z',
  summary: '优先补到主题页。',
  suggestions: [
    {
      targetDocumentId: 'theme-ai',
      targetTitle: '主题-AI-索引',
      targetType: 'theme-document',
      confidence: 'high',
      reason: '主题归属明确，补到主题页后更容易回查。',
      draftText: '可归入主题-AI-索引。',
    },
  ],
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

describe('ai link repair store', () => {
  it('saves and reads a suggestion index', async () => {
    const storage = createMemoryStorage()
    const store = createAiLinkRepairStore(storage)

    await store.saveSuggestionIndex({
      config: { aiModel: 'gpt-test' },
      sourceDocument: baseDocument,
      orphan: baseOrphan,
      themeDocuments: [],
      filters: {},
      timeRange: '7d',
      result: baseSuggestionResult,
    })

    const profile = await store.getRepairProfile('doc-1')

    expect(profile).toEqual(expect.objectContaining({
      documentId: 'doc-1',
      summary: '优先补到主题页。',
      sourceUpdatedAt: '20260403120000',
    }))

    const candidateTargets = JSON.parse(profile!.candidateTargetsJson)
    expect(candidateTargets).toHaveLength(1)
    expect(candidateTargets[0].targetDocumentId).toBe('theme-ai')

    const roleHints = JSON.parse(profile!.roleHintsJson)
    expect(roleHints).toContain('orphan-document')
    expect(roleHints).toContain('sparse-evidence')
    expect(roleHints).toContain('theme-reconnect')
  })

  it('invalidates suggestion cache for a document', async () => {
    const storage = createMemoryStorage()
    const store = createAiLinkRepairStore(storage)

    await store.saveSuggestionIndex({
      config: { aiModel: 'gpt-test' },
      sourceDocument: baseDocument,
      orphan: baseOrphan,
      themeDocuments: [],
      filters: {},
      timeRange: '7d',
      result: baseSuggestionResult,
    })

    const savedSnapshot = storage.read()
    const cacheKeys = Object.keys(savedSnapshot.suggestionCache)
    expect(cacheKeys.length).toBeGreaterThan(0)

    await store.invalidateSuggestionCache('doc-1')

    const clearedSnapshot = storage.read()
    expect(Object.keys(clearedSnapshot.suggestionCache)).toHaveLength(0)
    // repair profile should remain
    expect(clearedSnapshot.repairProfiles['doc-1']).toBeDefined()
  })

  it('returns null for non-existent repair profile', async () => {
    const storage = createMemoryStorage()
    const store = createAiLinkRepairStore(storage)

    const profile = await store.getRepairProfile('non-existent')
    expect(profile).toBeNull()
  })

  it('handles empty storage gracefully', async () => {
    const store = createAiLinkRepairStore(createMemoryStorage())

    await store.invalidateSuggestionCache('doc-1')

    const profile = await store.getRepairProfile('doc-1')
    expect(profile).toBeNull()
  })
})
