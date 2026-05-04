import type { DocumentRecord, OrphanItem, TimeRange } from './analysis'
import type { AiLinkSuggestionResult } from './ai-link-suggestions'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import type { ThemeDocument } from './theme-documents'
import type { PluginConfig } from '@/types/config'

const AI_LINK_REPAIR_STORAGE_NAME = 'ai-link-repair-store.json'
const AI_LINK_REPAIR_SCHEMA_VERSION = 1
const EMPTY_JSON_ARRAY = JSON.stringify([])

type AiConfig = Pick<PluginConfig, 'aiModel'>

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

export interface LinkRepairProfile {
  documentId: string
  sourceUpdatedAt: string
  sourceHash: string
  modelVersion: string
  summary: string
  candidateTargetsJson: string
  roleHintsJson: string
  tagSuggestionsJson: string
  evidenceJson: string
  updatedAt: string
}

export interface LinkRepairSuggestionCache {
  sourceDocumentId: string
  cacheKey: string
  modelVersion: string
  suggestionsJson: string
  createdAt: string
}

export interface AiLinkRepairStoreSnapshot {
  schemaVersion: number
  repairProfiles: Record<string, LinkRepairProfile>
  suggestionCache: Record<string, LinkRepairSuggestionCache>
}

export interface AiLinkRepairStore {
  saveSuggestionIndex: (params: {
    config: AiConfig
    sourceDocument: DocumentRecord
    orphan: OrphanItem
    themeDocuments: ThemeDocument[]
    filters: AnalyticsFiltersLike
    timeRange: TimeRange
    result: AiLinkSuggestionResult
  }) => Promise<void>
  getRepairProfile: (documentId: string) => Promise<LinkRepairProfile | null>
  invalidateSuggestionCache: (documentId: string) => Promise<void>
}

export function createAiLinkRepairStore(storage: PluginStorageLike): AiLinkRepairStore {
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

      const title = resolveDocumentTitle(params.sourceDocument)
      const tags = normalizeTags(params.sourceDocument.tags)

      const candidateTargets = params.result.suggestions.map(item => ({
        targetDocumentId: item.targetDocumentId,
        targetTitle: item.targetTitle,
        targetType: item.targetType,
        confidence: item.confidence,
      }))
      const tagSuggestions = params.result.suggestions.flatMap(item => item.tagSuggestions ?? [])
      const evidence = params.result.suggestions.map(item => ({
        targetDocumentId: item.targetDocumentId,
        reason: item.reason,
        draftText: item.draftText ?? '',
      }))
      const roleHints = deduplicateStrings([
        'orphan-document',
        params.orphan.hasSparseEvidence ? 'sparse-evidence' : '',
        params.result.suggestions.some(item => item.targetType === 'theme-document') ? 'theme-reconnect' : 'structure-reconnect',
      ])

      const existing = snapshot.repairProfiles[params.sourceDocument.id]

      snapshot.repairProfiles[params.sourceDocument.id] = {
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
        modelVersion,
        summary: params.result.summary.trim(),
        candidateTargetsJson: JSON.stringify(candidateTargets),
        roleHintsJson: JSON.stringify(roleHints),
        tagSuggestionsJson: JSON.stringify(tagSuggestions),
        evidenceJson: JSON.stringify(evidence),
        updatedAt,
        ...pickExistingProfileMeta(existing),
      }

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
    async getRepairProfile(documentId) {
      const snapshot = await loadSnapshot(storage)
      return snapshot.repairProfiles[documentId] ?? null
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

function pickExistingProfileMeta(existing: LinkRepairProfile | undefined): Partial<LinkRepairProfile> {
  if (!existing) {
    return {}
  }
  return {
    // preserve nothing from existing — profile is always rebuilt
  }
}

export function createAiLinkRepairStoreFromPlugin(plugin: PluginStorageLike | null | undefined): AiLinkRepairStore | null {
  if (!plugin?.loadData || !plugin?.saveData) {
    return null
  }

  return createAiLinkRepairStore(plugin)
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
  }

  return simpleHash(JSON.stringify(payload))
}

async function loadSnapshot(storage: PluginStorageLike): Promise<AiLinkRepairStoreSnapshot> {
  const data = await storage.loadData?.(AI_LINK_REPAIR_STORAGE_NAME)
  if (!data || typeof data !== 'object') {
    return createEmptySnapshot()
  }

  return {
    schemaVersion: Number.isFinite(data.schemaVersion) ? data.schemaVersion : AI_LINK_REPAIR_SCHEMA_VERSION,
    repairProfiles: isRecord(data.repairProfiles)
      ? data.repairProfiles as Record<string, LinkRepairProfile>
      : {},
    suggestionCache: isRecord(data.suggestionCache)
      ? data.suggestionCache as Record<string, LinkRepairSuggestionCache>
      : {},
  }
}

async function saveSnapshot(storage: PluginStorageLike, snapshot: AiLinkRepairStoreSnapshot) {
  await storage.saveData?.(AI_LINK_REPAIR_STORAGE_NAME, snapshot)
}

function createEmptySnapshot(): AiLinkRepairStoreSnapshot {
  return {
    schemaVersion: AI_LINK_REPAIR_SCHEMA_VERSION,
    repairProfiles: {},
    suggestionCache: {},
  }
}

function buildModelVersion(config: AiConfig): string {
  return config.aiModel?.trim() || 'unknown'
}

function buildSuggestionCacheStorageKey(documentId: string, cacheKey: string): string {
  return `${documentId}:${cacheKey}`
}

function deduplicateStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
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
