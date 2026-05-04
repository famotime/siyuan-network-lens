import type { DocumentRecord } from './analysis'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import type { PluginConfig } from '@/types/config'

const AI_INDEX_STORAGE_NAME = 'ai-document-index.json'
const AI_INDEX_SCHEMA_VERSION = 3
const EMPTY_JSON_ARRAY = JSON.stringify([])

type AiConfig = Pick<PluginConfig, 'aiModel'>

type PluginStorageLike = {
  loadData?: (storageName: string) => Promise<any>
  saveData?: (storageName: string, value: any) => Promise<void> | void
}

export interface PropositionItem {
  text: string
  sourceBlockIds: string[]
}

export interface SourceBlockItem {
  blockId: string
  text: string
}

export interface DocumentIndexProfile {
  documentId: string
  sourceUpdatedAt: string
  sourceHash: string
  title: string
  path: string
  hpath: string
  tagsJson: string
  positioning: string
  propositionsJson: string
  keywordsJson: string
  primarySourceBlocksJson: string
  secondarySourceBlocksJson: string
  generatedAt: string
}

export interface DocumentSummarySnapshot {
  summaryShort: string
  summaryMedium: string
  keywords: string[]
  evidenceSnippets: string[]
  updatedAt: string
}

export interface AiDocumentIndexSnapshot {
  schemaVersion: number
  documentProfiles: Record<string, DocumentIndexProfile>
}

export interface AiDocumentIndexStore {
  saveDocumentIndex: (params: {
    config: AiConfig
    sourceDocument: DocumentRecord
    positioning: string
    propositions: PropositionItem[]
    keywords: string[]
    primarySourceBlocks: SourceBlockItem[]
    secondarySourceBlocks: SourceBlockItem[]
    generatedAt?: string
  }) => Promise<void>
  getDocumentProfile: (documentId: string) => Promise<DocumentIndexProfile | null>
  getFreshDocumentProfile: (documentId: string, sourceUpdatedAt: string) => Promise<DocumentIndexProfile | null>
  getFreshDocumentSummary: (documentId: string, sourceUpdatedAt: string) => Promise<DocumentSummarySnapshot | null>
  deleteDocumentIndex: (documentIds: string[]) => Promise<void>
}

export function createAiDocumentIndexStore(storage: PluginStorageLike): AiDocumentIndexStore {
  return {
    async saveDocumentIndex(params) {
      const snapshot = await loadSnapshot(storage)
      const generatedAt = params.generatedAt || new Date().toISOString()
      const title = resolveDocumentTitle(params.sourceDocument)
      const tags = normalizeTags(params.sourceDocument.tags)

      snapshot.documentProfiles[params.sourceDocument.id] = {
        documentId: params.sourceDocument.id,
        sourceUpdatedAt: params.sourceDocument.updated ?? '',
        sourceHash: simpleHash([
          params.sourceDocument.id,
          params.sourceDocument.updated ?? '',
          title,
          params.sourceDocument.path ?? '',
          params.sourceDocument.hpath ?? '',
          tags.join(','),
          params.sourceDocument.content ?? '',
        ].join('\n')),
        title,
        path: params.sourceDocument.path ?? '',
        hpath: params.sourceDocument.hpath ?? '',
        tagsJson: JSON.stringify(tags),
        positioning: params.positioning,
        propositionsJson: JSON.stringify(params.propositions),
        keywordsJson: JSON.stringify(deduplicateStrings(params.keywords)),
        primarySourceBlocksJson: JSON.stringify(params.primarySourceBlocks),
        secondarySourceBlocksJson: JSON.stringify(params.secondarySourceBlocks),
        generatedAt,
      }

      await saveSnapshot(storage, snapshot)
    },
    async getDocumentProfile(documentId) {
      const snapshot = await loadSnapshot(storage)
      return snapshot.documentProfiles[documentId] ?? null
    },
    async getFreshDocumentProfile(documentId, sourceUpdatedAt) {
      const snapshot = await loadSnapshot(storage)
      const profile = snapshot.documentProfiles[documentId]
      if (!profile) {
        return null
      }
      return profile.sourceUpdatedAt === sourceUpdatedAt ? profile : null
    },
    async getFreshDocumentSummary(documentId, sourceUpdatedAt) {
      const snapshot = await loadSnapshot(storage)
      const profile = snapshot.documentProfiles[documentId]
      if (!profile || profile.sourceUpdatedAt !== sourceUpdatedAt) {
        return null
      }

      return buildDocumentSummarySnapshotFromProfile(profile)
    },
    async deleteDocumentIndex(documentIds) {
      if (!documentIds.length) {
        return
      }
      const snapshot = await loadSnapshot(storage)
      let changed = false
      for (const documentId of documentIds) {
        if (snapshot.documentProfiles[documentId]) {
          delete snapshot.documentProfiles[documentId]
          changed = true
        }
      }
      if (changed) {
        await saveSnapshot(storage, snapshot)
      }
    },
  }
}

function buildDocumentSummarySnapshotFromProfile(profile: DocumentIndexProfile): DocumentSummarySnapshot {
  const propositions: PropositionItem[] = parseJsonArray(profile.propositionsJson)
  const primaryBlocks: SourceBlockItem[] = parseJsonArray(profile.primarySourceBlocksJson)
  const secondaryBlocks: SourceBlockItem[] = parseJsonArray(profile.secondarySourceBlocksJson)

  return {
    summaryShort: profile.positioning || '',
    summaryMedium: propositions.map(p => p.text).join(' '),
    keywords: parseStringArray(profile.keywordsJson),
    evidenceSnippets: [...primaryBlocks, ...secondaryBlocks].map(block => block.text).slice(0, 6),
    updatedAt: profile.generatedAt,
  }
}

export function createAiDocumentIndexStoreFromPlugin(plugin: PluginStorageLike | null | undefined): AiDocumentIndexStore | null {
  if (!plugin?.loadData || !plugin?.saveData) {
    return null
  }

  return createAiDocumentIndexStore(plugin)
}

async function loadSnapshot(storage: PluginStorageLike): Promise<AiDocumentIndexSnapshot> {
  const data = await storage.loadData?.(AI_INDEX_STORAGE_NAME)
  if (!data || typeof data !== 'object') {
    return createEmptySnapshot()
  }

  const schemaVersion = Number.isFinite(data.schemaVersion) ? data.schemaVersion : 0
  if (schemaVersion < AI_INDEX_SCHEMA_VERSION) {
    return createEmptySnapshot()
  }

  return {
    schemaVersion: AI_INDEX_SCHEMA_VERSION,
    documentProfiles: isRecord(data.documentProfiles)
      ? Object.fromEntries(
          Object.entries(data.documentProfiles).map(([documentId, record]) => [
            documentId,
            normalizeDocumentIndexProfile(record),
          ]),
        )
      : {},
  }
}

async function saveSnapshot(storage: PluginStorageLike, snapshot: AiDocumentIndexSnapshot) {
  await storage.saveData?.(AI_INDEX_STORAGE_NAME, snapshot)
}

function createEmptySnapshot(): AiDocumentIndexSnapshot {
  return {
    schemaVersion: AI_INDEX_SCHEMA_VERSION,
    documentProfiles: {},
  }
}

function normalizeDocumentIndexProfile(value: unknown): DocumentIndexProfile {
  const record = (isRecord(value) ? value : {}) as Partial<DocumentIndexProfile>

  return {
    documentId: typeof record.documentId === 'string' ? record.documentId : '',
    sourceUpdatedAt: typeof record.sourceUpdatedAt === 'string' ? record.sourceUpdatedAt : '',
    sourceHash: typeof record.sourceHash === 'string' ? record.sourceHash : '',
    title: typeof record.title === 'string' ? record.title : '',
    path: typeof record.path === 'string' ? record.path : '',
    hpath: typeof record.hpath === 'string' ? record.hpath : '',
    tagsJson: typeof record.tagsJson === 'string' ? record.tagsJson : EMPTY_JSON_ARRAY,
    positioning: typeof record.positioning === 'string' ? record.positioning : '',
    propositionsJson: typeof record.propositionsJson === 'string' ? record.propositionsJson : EMPTY_JSON_ARRAY,
    keywordsJson: typeof record.keywordsJson === 'string' ? record.keywordsJson : EMPTY_JSON_ARRAY,
    primarySourceBlocksJson: typeof record.primarySourceBlocksJson === 'string' ? record.primarySourceBlocksJson : EMPTY_JSON_ARRAY,
    secondarySourceBlocksJson: typeof record.secondarySourceBlocksJson === 'string' ? record.secondarySourceBlocksJson : EMPTY_JSON_ARRAY,
    generatedAt: typeof record.generatedAt === 'string' ? record.generatedAt : '',
  }
}

function deduplicateStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function parseStringArray(value?: string): string[] {
  if (!value) {
    return []
  }

  try {
    return Array.isArray(JSON.parse(value))
      ? JSON.parse(value).filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function simpleHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `h${(hash >>> 0).toString(16)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
