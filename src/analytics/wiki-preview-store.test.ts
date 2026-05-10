import { describe, expect, it } from 'vitest'

import {
  AI_WIKI_PREVIEW_CACHE_SCHEMA_VERSION,
  AI_WIKI_PREVIEW_CACHE_STORAGE_NAME,
  createWikiPreviewCacheStore,
} from './wiki-preview-store'
import type { WikiPreviewState } from '@/composables/use-analytics-wiki'

function createMemoryStorage(initialValue?: any) {
  let snapshot = initialValue

  return {
    async loadData(storageName: string) {
      expect(storageName).toBe(AI_WIKI_PREVIEW_CACHE_STORAGE_NAME)
      return snapshot
    },
    async saveData(storageName: string, value: any) {
      expect(storageName).toBe(AI_WIKI_PREVIEW_CACHE_STORAGE_NAME)
      snapshot = value
    },
    read() {
      return snapshot
    },
  }
}

const TEST_PREVIEW: WikiPreviewState = {
  generatedAt: '2026-05-10T08:00:00.000Z',
  scope: {
    summary: {
      sourceDocumentCount: 3,
      generatedSectionCount: 4,
      referenceCount: 6,
      manualNotesParagraphCount: 0,
    },
    descriptionLines: ['- 范围来源：当前样本'],
  },
  themePages: [{
    pageTitle: '主题-AI-索引-llm-wiki',
    themeName: 'AI',
    themeDocumentId: 'theme-ai',
    themeDocumentTitle: '主题-AI-索引',
    themeDocumentBox: 'box-1',
    themeDocumentHPath: '/专题/主题-AI-索引',
    sourceDocumentIds: ['doc-1', 'doc-2'],
    preview: { status: 'create', pageFingerprint: 'fp', managedFingerprint: 'mfp', sourceDocumentCount: 2, oldSummary: undefined, conflictReason: undefined },
    diagnosis: { templateType: 'tech_topic', confidence: 'high', reason: 'test', enabledModules: [], suppressedModules: [], evidenceSummary: '' },
    pagePlan: { templateType: 'tech_topic', confidence: 'high', coreSections: [], optionalSections: [], sectionOrder: [], sectionGoals: {}, sectionFormats: {} },
    draft: { managedMarkdown: '# draft', fullMarkdown: '# full', sectionMetadata: [], pairedThemeDocumentId: 'theme-ai', pairedThemeTitle: '主题-AI-索引' },
    affectedSectionHeadings: ['主题概览'],
    hasManualNotes: false,
  }],
  unclassifiedDocuments: [],
  excludedWikiDocuments: [],
  deltaStats: { isIncremental: false, newCount: 2, changedCount: 0, unchangedCount: 0, deletedCount: 0, processingTimeMs: 1500 },
}

describe('wiki preview cache store', () => {
  it('returns null for an unknown theme document id', async () => {
    const store = createWikiPreviewCacheStore(createMemoryStorage())
    await expect(store.getPreview('unknown-id')).resolves.toBeNull()
  })

  it('saves and retrieves a preview by theme document id', async () => {
    const store = createWikiPreviewCacheStore(createMemoryStorage())

    await store.savePreview('theme-ai', TEST_PREVIEW)
    const result = await store.getPreview('theme-ai')

    expect(result).not.toBeNull()
    expect(result?.generatedAt).toBe('2026-05-10T08:00:00.000Z')
    expect(result?.themePages[0].pageTitle).toBe('主题-AI-索引-llm-wiki')
    expect(result?.scope.summary.sourceDocumentCount).toBe(3)
  })

  it('overwrites a previously saved preview for the same theme document id', async () => {
    const store = createWikiPreviewCacheStore(createMemoryStorage())

    await store.savePreview('theme-ai', TEST_PREVIEW)
    const updated = { ...TEST_PREVIEW, generatedAt: '2026-05-10T09:00:00.000Z' }
    await store.savePreview('theme-ai', updated)

    const result = await store.getPreview('theme-ai')
    expect(result?.generatedAt).toBe('2026-05-10T09:00:00.000Z')
  })

  it('clears a saved preview', async () => {
    const store = createWikiPreviewCacheStore(createMemoryStorage())

    await store.savePreview('theme-ai', TEST_PREVIEW)
    await store.clearPreview('theme-ai')

    await expect(store.getPreview('theme-ai')).resolves.toBeNull()
  })

  it('strips isCachedPreview when persisting', async () => {
    const storage = createMemoryStorage()
    const store = createWikiPreviewCacheStore(storage)

    const previewWithFlag = { ...TEST_PREVIEW, isCachedPreview: true }
    await store.savePreview('theme-ai', previewWithFlag)

    const result = await store.getPreview('theme-ai')
    expect(result?.isCachedPreview).toBeUndefined()

    const raw = storage.read()
    expect(raw.previews['theme-ai'].isCachedPreview).toBeUndefined()
  })

  it('skips malformed entries when loading', async () => {
    const storage = createMemoryStorage({
      schemaVersion: 1,
      previews: {
        'theme-valid': TEST_PREVIEW,
        'theme-broken': { notAValid: 'preview' },
      },
    })
    const store = createWikiPreviewCacheStore(storage)

    const valid = await store.getPreview('theme-valid')
    expect(valid?.generatedAt).toBe('2026-05-10T08:00:00.000Z')

    const broken = await store.getPreview('theme-broken')
    expect(broken).toBeNull()
  })
})
