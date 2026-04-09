import type { WikiApplyRecord, WikiPageType, WikiPreviewRecord } from './wiki-page-model'

export const AI_WIKI_INDEX_STORAGE_NAME = 'ai-wiki-index.json'
export const AI_WIKI_INDEX_SCHEMA_VERSION = 1

type PluginStorageLike = {
  loadData?: (storageName: string) => Promise<any>
  saveData?: (storageName: string, value: any) => Promise<void> | void
}

export interface WikiPageSnapshotRecord {
  pageType: WikiPageType
  pageTitle: string
  pageId?: string
  themeDocumentId?: string
  themeDocumentTitle?: string
  sourceDocumentIds: string[]
  pageFingerprint?: string
  managedFingerprint?: string
  lastGeneratedAt?: string
  lastPreview?: WikiPreviewRecord
  lastApply?: WikiApplyRecord
}

export interface AiWikiIndexSnapshot {
  schemaVersion: number
  pages: Record<string, WikiPageSnapshotRecord>
}

export interface AiWikiStore {
  loadSnapshot: () => Promise<AiWikiIndexSnapshot>
  saveSnapshot: (snapshot: AiWikiIndexSnapshot) => Promise<void>
  getPageRecord: (pageKey: string) => Promise<WikiPageSnapshotRecord | null>
  savePageRecord: (record: WikiPageSnapshotRecord) => Promise<void>
}

export function createAiWikiStoreFromPlugin(plugin: PluginStorageLike | null | undefined): AiWikiStore | null {
  if (!plugin?.loadData || !plugin?.saveData) {
    return null
  }

  return createAiWikiStore(plugin)
}

export function createAiWikiStore(storage: PluginStorageLike): AiWikiStore {
  return {
    async loadSnapshot() {
      return loadSnapshot(storage)
    },
    async saveSnapshot(snapshot) {
      await saveSnapshot(storage, snapshot)
    },
    async getPageRecord(pageKey) {
      const snapshot = await loadSnapshot(storage)
      return snapshot.pages[pageKey] ?? null
    },
    async savePageRecord(record) {
      const snapshot = await loadSnapshot(storage)
      const pageKey = buildWikiPageStorageKey({
        pageType: record.pageType,
        pageTitle: record.pageTitle,
        themeDocumentId: record.themeDocumentId,
      })
      snapshot.pages[pageKey] = normalizePageRecord(record)
      await saveSnapshot(storage, snapshot)
    },
  }
}

export function buildWikiPageStorageKey(params: {
  pageType: WikiPageType
  pageTitle: string
  themeDocumentId?: string
}): string {
  const identity = params.pageType === 'theme'
    ? normalizeOptionalString(params.themeDocumentId) || normalizeOptionalString(params.pageTitle)
    : normalizeOptionalString(params.pageTitle)

  return `${params.pageType}:${identity}`
}

async function loadSnapshot(storage: PluginStorageLike): Promise<AiWikiIndexSnapshot> {
  const data = await storage.loadData?.(AI_WIKI_INDEX_STORAGE_NAME)
  if (!isRecord(data)) {
    return createEmptySnapshot()
  }

  return {
    schemaVersion: AI_WIKI_INDEX_SCHEMA_VERSION,
    pages: isRecord(data.pages)
      ? Object.fromEntries(
          Object.entries(data.pages).map(([pageKey, record]) => [pageKey, normalizePageRecord(record)]),
        )
      : {},
  }
}

async function saveSnapshot(storage: PluginStorageLike, snapshot: AiWikiIndexSnapshot) {
  await storage.saveData?.(AI_WIKI_INDEX_STORAGE_NAME, {
    schemaVersion: AI_WIKI_INDEX_SCHEMA_VERSION,
    pages: Object.fromEntries(
      Object.entries(snapshot.pages).map(([pageKey, record]) => [pageKey, normalizePageRecord(record)]),
    ),
  })
}

function createEmptySnapshot(): AiWikiIndexSnapshot {
  return {
    schemaVersion: AI_WIKI_INDEX_SCHEMA_VERSION,
    pages: {},
  }
}

function normalizePageRecord(value: unknown): WikiPageSnapshotRecord {
  const record = isRecord(value) ? value : {}

  return {
    pageType: normalizePageType(record.pageType),
    pageTitle: normalizeOptionalString(record.pageTitle),
    pageId: normalizeOptionalString(record.pageId) || undefined,
    themeDocumentId: normalizeOptionalString(record.themeDocumentId) || undefined,
    themeDocumentTitle: normalizeOptionalString(record.themeDocumentTitle) || undefined,
    sourceDocumentIds: normalizeStringList(record.sourceDocumentIds),
    pageFingerprint: normalizeOptionalString(record.pageFingerprint) || undefined,
    managedFingerprint: normalizeOptionalString(record.managedFingerprint) || undefined,
    lastGeneratedAt: normalizeOptionalString(record.lastGeneratedAt) || undefined,
    lastPreview: normalizePreviewRecord(record.lastPreview),
    lastApply: normalizeApplyRecord(record.lastApply),
  }
}

function normalizePageType(value: unknown): WikiPageType {
  if (value === 'theme' || value === 'index' || value === 'log') {
    return value
  }
  return 'theme'
}

function normalizePreviewRecord(value: unknown): WikiPreviewRecord | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  if (
    value.status !== 'create'
    && value.status !== 'update'
    && value.status !== 'unchanged'
    && value.status !== 'conflict'
  ) {
    return undefined
  }

  return {
    generatedAt: normalizeOptionalString(value.generatedAt),
    status: value.status,
    sourceDocumentIds: normalizeStringList(value.sourceDocumentIds),
    pageFingerprint: normalizeOptionalString(value.pageFingerprint) || undefined,
    managedFingerprint: normalizeOptionalString(value.managedFingerprint) || undefined,
  }
}

function normalizeApplyRecord(value: unknown): WikiApplyRecord | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  if (
    value.result !== 'created'
    && value.result !== 'updated'
    && value.result !== 'skipped'
    && value.result !== 'conflict'
  ) {
    return undefined
  }

  return {
    appliedAt: normalizeOptionalString(value.appliedAt),
    result: value.result,
    sourceDocumentIds: normalizeStringList(value.sourceDocumentIds),
    pageFingerprint: normalizeOptionalString(value.pageFingerprint) || undefined,
    managedFingerprint: normalizeOptionalString(value.managedFingerprint) || undefined,
  }
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
