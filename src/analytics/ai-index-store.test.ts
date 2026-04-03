import { describe, expect, it } from 'vitest'

import type { DocumentRecord, OrphanItem } from './analysis'
import { createAiDocumentIndexStore } from './ai-index-store'
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

describe('ai index store', () => {
  it('keeps suggestion profile summaries separate from document summaries', async () => {
    const storage = createMemoryStorage()
    const store = createAiDocumentIndexStore(storage)

    await store.saveSuggestionIndex({
      config: {
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument: baseDocument,
      orphan: baseOrphan,
      themeDocuments: [],
      filters: {},
      timeRange: '7d',
      result: baseSuggestionResult,
    })

    const profile = await store.getSemanticProfile('doc-1')

    expect(profile).toEqual(expect.objectContaining({
      documentId: 'doc-1',
      summaryShort: '优先补到主题页。',
      summaryMedium: '优先补到主题页。 主题归属明确，补到主题页后更容易回查。',
      documentSummaryShort: undefined,
      documentSummaryMedium: undefined,
    }))
  })

  it('saves and reads a real document summary profile by document id', async () => {
    const storage = createMemoryStorage()
    const store = createAiDocumentIndexStore(storage)

    await store.saveDocumentSummary({
      config: {
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument: baseDocument,
      summaryShort: '这篇文档概述了 AI 索引页的组织思路。',
      summaryMedium: '这篇文档概述了 AI 索引页的组织思路，并说明了主题页、标签和回查入口之间的关系。',
      keywords: ['AI', '索引', '主题页'],
      evidenceSnippets: ['这是第一段。', '这是第二段。'],
      updatedAt: '2026-04-03T12:05:00.000Z',
    })

    const profile = await store.getSemanticProfile('doc-1')

    expect(profile).toEqual(expect.objectContaining({
      documentId: 'doc-1',
      sourceUpdatedAt: '20260403120000',
      documentSummaryShort: '这篇文档概述了 AI 索引页的组织思路。',
      documentSummaryMedium: '这篇文档概述了 AI 索引页的组织思路，并说明了主题页、标签和回查入口之间的关系。',
      documentSummaryUpdatedAt: '2026-04-03T12:05:00.000Z',
    }))
    expect(profile?.documentKeywordsJson).toBe(JSON.stringify(['AI', '索引', '主题页']))
    expect(profile?.documentEvidenceSnippetsJson).toBe(JSON.stringify(['这是第一段。', '这是第二段。']))
  })

  it('returns a fresh semantic profile only when sourceUpdatedAt matches', async () => {
    const storage = createMemoryStorage()
    const store = createAiDocumentIndexStore(storage)

    await store.saveDocumentSummary({
      config: {
        aiModel: 'gpt-test',
        aiEmbeddingModel: 'embed-test',
      },
      sourceDocument: baseDocument,
      summaryShort: '这是正文摘要。',
    })

    await expect(store.getFreshSemanticProfile('doc-1', '20260403120000')).resolves.toEqual(
      expect.objectContaining({
        documentId: 'doc-1',
        documentSummaryShort: '这是正文摘要。',
      }),
    )
    await expect(store.getFreshSemanticProfile('doc-1', '20260404120000')).resolves.toBeNull()
  })

  it('loads a legacy snapshot without document summary fields', async () => {
    const storage = createMemoryStorage({
      schemaVersion: 1,
      semanticProfiles: {
        'doc-legacy': {
          documentId: 'doc-legacy',
          sourceUpdatedAt: '20260401120000',
          sourceHash: 'hash-1',
          profileVersion: 1,
          modelVersion: 'gpt-test',
          title: '旧文档',
          path: '/legacy.sy',
          hpath: '/旧文档',
          tagsJson: '[]',
          summaryShort: '旧补链摘要',
          summaryMedium: '旧补链摘要 理由',
          keywordsJson: '[]',
          topicCandidatesJson: '[]',
          entitiesJson: '[]',
          roleHintsJson: '[]',
          embeddingJson: '[]',
          evidenceSnippetsJson: '[]',
          updatedAt: '2026-04-03T12:00:00.000Z',
        },
      },
      suggestionCache: {},
    })
    const store = createAiDocumentIndexStore(storage)

    const profile = await store.getSemanticProfile('doc-legacy')

    expect(profile).toEqual(expect.objectContaining({
      documentId: 'doc-legacy',
      summaryShort: '旧补链摘要',
      documentSummaryShort: undefined,
      documentSummaryMedium: undefined,
    }))
  })
})
