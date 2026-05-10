import type { WikiPreviewState } from '@/composables/use-analytics-wiki'

export const AI_WIKI_PREVIEW_CACHE_STORAGE_NAME = 'ai-wiki-preview-cache.json'
export const AI_WIKI_PREVIEW_CACHE_SCHEMA_VERSION = 1

type PluginStorageLike = {
  loadData?: (storageName: string) => Promise<any>
  saveData?: (storageName: string, value: any) => Promise<void> | void
}

export interface WikiPreviewCacheSnapshot {
  schemaVersion: number
  previews: Record<string, WikiPreviewState>
}

export interface WikiPreviewCacheStore {
  getPreview: (themeDocumentId: string) => Promise<WikiPreviewState | null>
  savePreview: (themeDocumentId: string, preview: WikiPreviewState) => Promise<void>
  clearPreview: (themeDocumentId: string) => Promise<void>
}

export function createWikiPreviewCacheStoreFromPlugin(plugin: PluginStorageLike | null | undefined): WikiPreviewCacheStore | null {
  if (!plugin?.loadData || !plugin?.saveData) {
    return null
  }

  return createWikiPreviewCacheStore(plugin)
}

export function createWikiPreviewCacheStore(storage: PluginStorageLike): WikiPreviewCacheStore {
  return {
    async getPreview(themeDocumentId) {
      const snapshot = await loadSnapshot(storage)
      return snapshot.previews[themeDocumentId] ?? null
    },

    async savePreview(themeDocumentId, preview) {
      const snapshot = await loadSnapshot(storage)
      snapshot.previews[themeDocumentId] = sanitizePreview(preview)
      await saveSnapshot(storage, snapshot)
    },

    async clearPreview(themeDocumentId) {
      const snapshot = await loadSnapshot(storage)
      delete snapshot.previews[themeDocumentId]
      await saveSnapshot(storage, snapshot)
    },
  }
}

async function loadSnapshot(storage: PluginStorageLike): Promise<WikiPreviewCacheSnapshot> {
  const data = await storage.loadData?.(AI_WIKI_PREVIEW_CACHE_STORAGE_NAME)
  if (!isRecord(data)) {
    return createEmptySnapshot()
  }

  const previews: Record<string, WikiPreviewState> = {}
  if (isRecord(data.previews)) {
    for (const [key, value] of Object.entries(data.previews)) {
      if (typeof key === 'string' && isValidPreview(value)) {
        previews[key] = value as WikiPreviewState
      }
    }
  }

  return {
    schemaVersion: AI_WIKI_PREVIEW_CACHE_SCHEMA_VERSION,
    previews,
  }
}

async function saveSnapshot(storage: PluginStorageLike, snapshot: WikiPreviewCacheSnapshot) {
  await storage.saveData?.(AI_WIKI_PREVIEW_CACHE_STORAGE_NAME, {
    schemaVersion: AI_WIKI_PREVIEW_CACHE_SCHEMA_VERSION,
    previews: snapshot.previews,
  })
}

function createEmptySnapshot(): WikiPreviewCacheSnapshot {
  return {
    schemaVersion: AI_WIKI_PREVIEW_CACHE_SCHEMA_VERSION,
    previews: {},
  }
}

function sanitizePreview(value: unknown): WikiPreviewState {
  if (!isValidPreview(value)) {
    return value as WikiPreviewState
  }
  const preview = value as WikiPreviewState
  return {
    ...preview,
    isCachedPreview: undefined,
  }
}

function isValidPreview(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  return typeof value.generatedAt === 'string'
    && isRecord(value.scope)
    && Array.isArray(value.themePages)
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
