import type { DocumentRecord, OrphanItem, TimeRange } from './analysis'
import type { AiLinkSuggestionResult } from './ai-link-suggestions'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import type { ThemeDocument } from './theme-documents'
import { pickUiText } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'

const AI_INDEX_STORAGE_NAME = 'ai-document-index.json'
const AI_INDEX_SCHEMA_VERSION = 2
const AI_PROFILE_VERSION = 1
const EMPTY_JSON_ARRAY = JSON.stringify([])
const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

type AiConfig = Pick<
  PluginConfig,
  | 'aiModel'
  | 'aiEmbeddingModel'
>

type AnalyticsFiltersLike = {
  notebook?: string
  tags?: string[]
  themeNames?: string[]
  keyword?: string
}

type PluginStorageLike = {
  loadData?: (storageName: string) => Promise<any>
  saveData?: (storageName: string, value: any) => Promise<void> | void
}

export interface DocumentSemanticProfileRecord {
  documentId: string
  sourceUpdatedAt: string
  sourceHash: string
  profileVersion: number
  modelVersion: string
  title: string
  path: string
  hpath: string
  tagsJson: string
  summaryShort: string
  summaryMedium: string
  keywordsJson: string
  topicCandidatesJson: string
  entitiesJson: string
  roleHintsJson: string
  embeddingJson: string
  evidenceSnippetsJson: string
  documentSummaryShort?: string
  documentSummaryMedium?: string
  documentKeywordsJson?: string
  documentEvidenceSnippetsJson?: string
  documentSummaryUpdatedAt?: string
  updatedAt: string
}

export interface DocumentLinkSuggestionCacheRecord {
  sourceDocumentId: string
  cacheKey: string
  modelVersion: string
  suggestionsJson: string
  createdAt: string
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
  semanticProfiles: Record<string, DocumentSemanticProfileRecord>
  suggestionCache: Record<string, DocumentLinkSuggestionCacheRecord>
}

export interface AiDocumentIndexStore {
  saveSuggestionIndex: (params: {
    config: AiConfig
    sourceDocument: DocumentRecord
    orphan: OrphanItem
    themeDocuments: ThemeDocument[]
    filters: AnalyticsFiltersLike
    timeRange: TimeRange
    result: AiLinkSuggestionResult
  }) => Promise<void>
  saveDocumentSummary: (params: {
    config: AiConfig
    sourceDocument: DocumentRecord
    summaryShort: string
    summaryMedium?: string
    keywords?: string[]
    evidenceSnippets?: string[]
    updatedAt?: string
  }) => Promise<void>
  getSemanticProfile: (documentId: string) => Promise<DocumentSemanticProfileRecord | null>
  getFreshSemanticProfile: (documentId: string, sourceUpdatedAt: string) => Promise<DocumentSemanticProfileRecord | null>
  getFreshDocumentSummary: (documentId: string, sourceUpdatedAt: string) => Promise<DocumentSummarySnapshot | null>
  invalidateSuggestionCache: (documentId: string) => Promise<void>
}

export function createAiDocumentIndexStore(storage: PluginStorageLike): AiDocumentIndexStore {
  return {
    async saveSuggestionIndex(params) {
      const snapshot = await loadSnapshot(storage)
      const modelVersion = buildModelVersion(params.config)
      const updatedAt = params.result.generatedAt || new Date().toISOString()
      const cacheKey = buildSuggestionCacheKey({
        config: params.config,
        sourceDocument: params.sourceDocument,
        themeDocuments: params.themeDocuments,
        filters: params.filters,
        timeRange: params.timeRange,
      })

      snapshot.semanticProfiles[params.sourceDocument.id] = buildSemanticProfileRecord({
        config: params.config,
        sourceDocument: params.sourceDocument,
        orphan: params.orphan,
        result: params.result,
        existing: snapshot.semanticProfiles[params.sourceDocument.id],
        updatedAt,
      })
      snapshot.suggestionCache[buildSuggestionCacheStorageKey(params.sourceDocument.id, cacheKey)] = {
        sourceDocumentId: params.sourceDocument.id,
        cacheKey,
        modelVersion,
        suggestionsJson: JSON.stringify({
          generatedAt: params.result.generatedAt,
          summary: params.result.summary,
          suggestions: params.result.suggestions,
        }),
        createdAt: updatedAt,
      }

      await saveSnapshot(storage, snapshot)
    },
    async saveDocumentSummary(params) {
      const snapshot = await loadSnapshot(storage)
      const updatedAt = params.updatedAt || new Date().toISOString()

      snapshot.semanticProfiles[params.sourceDocument.id] = buildDocumentSummaryProfileRecord({
        config: params.config,
        sourceDocument: params.sourceDocument,
        existing: snapshot.semanticProfiles[params.sourceDocument.id],
        summaryShort: params.summaryShort,
        summaryMedium: params.summaryMedium,
        keywords: params.keywords,
        evidenceSnippets: params.evidenceSnippets,
        updatedAt,
      })

      await saveSnapshot(storage, snapshot)
    },
    async getSemanticProfile(documentId) {
      const snapshot = await loadSnapshot(storage)
      return snapshot.semanticProfiles[documentId] ?? null
    },
    async getFreshSemanticProfile(documentId, sourceUpdatedAt) {
      const snapshot = await loadSnapshot(storage)
      const profile = snapshot.semanticProfiles[documentId]
      if (!profile) {
        return null
      }
      return profile.sourceUpdatedAt === sourceUpdatedAt ? profile : null
    },
    async getFreshDocumentSummary(documentId, sourceUpdatedAt) {
      const snapshot = await loadSnapshot(storage)
      const profile = snapshot.semanticProfiles[documentId]
      if (!profile || profile.sourceUpdatedAt !== sourceUpdatedAt) {
        return null
      }

      return buildFreshDocumentSummarySnapshot(profile)
    },
    async invalidateSuggestionCache(documentId) {
      const snapshot = await loadSnapshot(storage)
      const keys = Object.keys(snapshot.suggestionCache)
        .filter(key => snapshot.suggestionCache[key]?.sourceDocumentId === documentId)

      if (!keys.length) {
        return
      }

      for (const key of keys) {
        delete snapshot.suggestionCache[key]
      }

      await saveSnapshot(storage, snapshot)
    },
  }
}

function buildFreshDocumentSummarySnapshot(profile: DocumentSemanticProfileRecord): DocumentSummarySnapshot | null {
  if (!profile.documentSummaryShort || !profile.documentSummaryMedium) {
    return null
  }

  return {
    summaryShort: profile.documentSummaryShort,
    summaryMedium: profile.documentSummaryMedium,
    keywords: parseStringArray(profile.documentKeywordsJson),
    evidenceSnippets: parseStringArray(profile.documentEvidenceSnippetsJson),
    updatedAt: profile.documentSummaryUpdatedAt ?? profile.updatedAt,
  }
}

export function createAiDocumentIndexStoreFromPlugin(plugin: PluginStorageLike | null | undefined): AiDocumentIndexStore | null {
  if (!plugin?.loadData || !plugin?.saveData) {
    return null
  }

  return createAiDocumentIndexStore(plugin)
}

export function buildSuggestionCacheKey(params: {
  config: AiConfig
  sourceDocument: Pick<DocumentRecord, 'id' | 'updated'>
  themeDocuments: ThemeDocument[]
  filters: AnalyticsFiltersLike
  timeRange: TimeRange
}): string {
  const payload = {
    documentId: params.sourceDocument.id,
    sourceUpdatedAt: params.sourceDocument.updated ?? '',
    filters: {
      notebook: params.filters.notebook ?? '',
      tags: [...(params.filters.tags ?? [])].sort(),
      themeNames: [...(params.filters.themeNames ?? [])].sort(),
      keyword: (params.filters.keyword ?? '').trim(),
    },
    timeRange: params.timeRange,
    themeDocumentVersion: params.themeDocuments
      .map(item => `${item.documentId}:${item.title}:${item.themeName}`)
      .sort(),
    modelVersion: buildModelVersion(params.config),
    profileVersion: AI_PROFILE_VERSION,
  }

  return simpleHash(JSON.stringify(payload))
}

async function loadSnapshot(storage: PluginStorageLike): Promise<AiDocumentIndexSnapshot> {
  const data = await storage.loadData?.(AI_INDEX_STORAGE_NAME)
  if (!data || typeof data !== 'object') {
    return createEmptySnapshot()
  }

  return {
    schemaVersion: Number.isFinite(data.schemaVersion) ? data.schemaVersion : AI_INDEX_SCHEMA_VERSION,
    semanticProfiles: isRecord(data.semanticProfiles)
      ? Object.fromEntries(
          Object.entries(data.semanticProfiles).map(([documentId, record]) => [
            documentId,
            normalizeSemanticProfileRecord(record),
          ]),
        )
      : {},
    suggestionCache: isRecord(data.suggestionCache) ? data.suggestionCache as Record<string, DocumentLinkSuggestionCacheRecord> : {},
  }
}

async function saveSnapshot(storage: PluginStorageLike, snapshot: AiDocumentIndexSnapshot) {
  await storage.saveData?.(AI_INDEX_STORAGE_NAME, snapshot)
}

function createEmptySnapshot(): AiDocumentIndexSnapshot {
  return {
    schemaVersion: AI_INDEX_SCHEMA_VERSION,
    semanticProfiles: {},
    suggestionCache: {},
  }
}

function buildSemanticProfileRecord(params: {
  config: AiConfig
  sourceDocument: DocumentRecord
  orphan: OrphanItem
  result: AiLinkSuggestionResult
  existing?: DocumentSemanticProfileRecord
  updatedAt: string
}): DocumentSemanticProfileRecord {
  const baseRecord = buildBaseSemanticProfileRecord({
    config: params.config,
    sourceDocument: params.sourceDocument,
    existing: params.existing,
    updatedAt: params.updatedAt,
  })
  const title = resolveDocumentTitle(params.sourceDocument)
  const tags = normalizeTags(params.sourceDocument.tags)
  const summaryShort = params.result.summary.trim() || uiText(`Generated AI link suggestions for ${title}`, `已生成 ${title} 的 AI 补链建议`)
  const summaryMedium = [
    summaryShort,
    ...params.result.suggestions.map(item => item.reason.trim()),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
  const topicCandidates = params.result.suggestions.map(item => ({
    documentId: item.targetDocumentId,
    title: item.targetTitle,
    targetType: item.targetType,
    confidence: item.confidence,
  }))
  const evidenceSnippets = params.result.suggestions.map(item => ({
    targetDocumentId: item.targetDocumentId,
    reason: item.reason,
    draftText: item.draftText ?? '',
  }))
  const keywords = deduplicateStrings([
    ...tags,
    ...params.result.suggestions.map(item => item.targetTitle),
    ...params.result.suggestions.flatMap(item => (item.tagSuggestions ?? []).map(tag => tag.tag)),
  ])
  const roleHints = deduplicateStrings([
    'orphan-document',
    params.orphan.hasSparseEvidence ? 'sparse-evidence' : '',
    params.result.suggestions.some(item => item.targetType === 'theme-document') ? 'theme-reconnect' : 'structure-reconnect',
  ])

  return {
    ...baseRecord,
    summaryShort,
    summaryMedium,
    keywordsJson: JSON.stringify(keywords),
    topicCandidatesJson: JSON.stringify(topicCandidates),
    entitiesJson: JSON.stringify([]),
    roleHintsJson: JSON.stringify(roleHints),
    embeddingJson: baseRecord.embeddingJson,
    evidenceSnippetsJson: JSON.stringify(evidenceSnippets),
  }
}

function normalizeSemanticProfileRecord(value: unknown): DocumentSemanticProfileRecord {
  const record = (isRecord(value) ? value : {}) as Partial<DocumentSemanticProfileRecord>

  return {
    documentId: typeof record.documentId === 'string' ? record.documentId : '',
    sourceUpdatedAt: typeof record.sourceUpdatedAt === 'string' ? record.sourceUpdatedAt : '',
    sourceHash: typeof record.sourceHash === 'string' ? record.sourceHash : '',
    profileVersion: Number.isFinite(record.profileVersion) ? Number(record.profileVersion) : AI_PROFILE_VERSION,
    modelVersion: typeof record.modelVersion === 'string' ? record.modelVersion : 'unknown',
    title: typeof record.title === 'string' ? record.title : '',
    path: typeof record.path === 'string' ? record.path : '',
    hpath: typeof record.hpath === 'string' ? record.hpath : '',
    tagsJson: typeof record.tagsJson === 'string' ? record.tagsJson : EMPTY_JSON_ARRAY,
    summaryShort: typeof record.summaryShort === 'string' ? record.summaryShort : '',
    summaryMedium: typeof record.summaryMedium === 'string' ? record.summaryMedium : '',
    keywordsJson: typeof record.keywordsJson === 'string' ? record.keywordsJson : EMPTY_JSON_ARRAY,
    topicCandidatesJson: typeof record.topicCandidatesJson === 'string' ? record.topicCandidatesJson : EMPTY_JSON_ARRAY,
    entitiesJson: typeof record.entitiesJson === 'string' ? record.entitiesJson : EMPTY_JSON_ARRAY,
    roleHintsJson: typeof record.roleHintsJson === 'string' ? record.roleHintsJson : EMPTY_JSON_ARRAY,
    embeddingJson: typeof record.embeddingJson === 'string' ? record.embeddingJson : EMPTY_JSON_ARRAY,
    evidenceSnippetsJson: typeof record.evidenceSnippetsJson === 'string' ? record.evidenceSnippetsJson : EMPTY_JSON_ARRAY,
    documentSummaryShort: typeof record.documentSummaryShort === 'string' ? record.documentSummaryShort : undefined,
    documentSummaryMedium: typeof record.documentSummaryMedium === 'string' ? record.documentSummaryMedium : undefined,
    documentKeywordsJson: typeof record.documentKeywordsJson === 'string' ? record.documentKeywordsJson : undefined,
    documentEvidenceSnippetsJson: typeof record.documentEvidenceSnippetsJson === 'string' ? record.documentEvidenceSnippetsJson : undefined,
    documentSummaryUpdatedAt: typeof record.documentSummaryUpdatedAt === 'string' ? record.documentSummaryUpdatedAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
  }
}

function buildDocumentSummaryProfileRecord(params: {
  config: AiConfig
  sourceDocument: DocumentRecord
  existing?: DocumentSemanticProfileRecord
  summaryShort: string
  summaryMedium?: string
  keywords?: string[]
  evidenceSnippets?: string[]
  updatedAt: string
}): DocumentSemanticProfileRecord {
  const baseRecord = buildBaseSemanticProfileRecord({
    config: params.config,
    sourceDocument: params.sourceDocument,
    existing: params.existing,
    updatedAt: params.updatedAt,
  })
  const summaryShort = params.summaryShort.trim()
  const summaryMedium = (params.summaryMedium ?? summaryShort).trim() || summaryShort

  return {
    ...baseRecord,
    documentSummaryShort: summaryShort || undefined,
    documentSummaryMedium: summaryMedium || undefined,
    documentKeywordsJson: JSON.stringify(deduplicateStrings(params.keywords ?? [])),
    documentEvidenceSnippetsJson: JSON.stringify(deduplicateStrings(params.evidenceSnippets ?? [])),
    documentSummaryUpdatedAt: params.updatedAt,
  }
}

function buildBaseSemanticProfileRecord(params: {
  config: AiConfig
  sourceDocument: DocumentRecord
  existing?: DocumentSemanticProfileRecord
  updatedAt: string
}): DocumentSemanticProfileRecord {
  const title = resolveDocumentTitle(params.sourceDocument)
  const tags = normalizeTags(params.sourceDocument.tags)

  return {
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
    profileVersion: AI_PROFILE_VERSION,
    modelVersion: buildModelVersion(params.config),
    title,
    path: params.sourceDocument.path ?? '',
    hpath: params.sourceDocument.hpath ?? '',
    tagsJson: JSON.stringify(tags),
    summaryShort: params.existing?.summaryShort ?? '',
    summaryMedium: params.existing?.summaryMedium ?? '',
    keywordsJson: params.existing?.keywordsJson ?? EMPTY_JSON_ARRAY,
    topicCandidatesJson: params.existing?.topicCandidatesJson ?? EMPTY_JSON_ARRAY,
    entitiesJson: params.existing?.entitiesJson ?? EMPTY_JSON_ARRAY,
    roleHintsJson: params.existing?.roleHintsJson ?? EMPTY_JSON_ARRAY,
    embeddingJson: params.existing?.embeddingJson ?? EMPTY_JSON_ARRAY,
    evidenceSnippetsJson: params.existing?.evidenceSnippetsJson ?? EMPTY_JSON_ARRAY,
    documentSummaryShort: params.existing?.documentSummaryShort,
    documentSummaryMedium: params.existing?.documentSummaryMedium,
    documentKeywordsJson: params.existing?.documentKeywordsJson,
    documentEvidenceSnippetsJson: params.existing?.documentEvidenceSnippetsJson,
    documentSummaryUpdatedAt: params.existing?.documentSummaryUpdatedAt,
    updatedAt: params.updatedAt,
  }
}

function buildModelVersion(config: AiConfig): string {
  return [config.aiModel?.trim(), config.aiEmbeddingModel?.trim()].filter(Boolean).join(' | ') || 'unknown'
}

function buildSuggestionCacheStorageKey(documentId: string, cacheKey: string): string {
  return `${documentId}:${cacheKey}`
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
