import type { AnalyticsFilters, TimeRange } from './analysis'
import type { AiInboxItem, AiInboxResult } from './ai-inbox'

export const TODAY_SUGGESTION_HISTORY_STORAGE_NAME = 'today-suggestion-history.json'
export const TODAY_SUGGESTION_HISTORY_SCHEMA_VERSION = 1
const MAX_HISTORY_ENTRIES = 3

type PluginStorageLike = {
  loadData?: (storageName: string) => Promise<any>
  saveData?: (storageName: string, value: any) => Promise<void> | void
}

export interface TodaySuggestionHistoryEntry {
  id: string
  generatedAt: string
  timeRange: TimeRange
  filters: AnalyticsFilters
  summaryCount: number
  result: AiInboxResult
}

export interface TodaySuggestionHistorySnapshot {
  schemaVersion: number
  entries: TodaySuggestionHistoryEntry[]
}

export interface TodaySuggestionHistoryStore {
  loadSnapshot: () => Promise<TodaySuggestionHistorySnapshot>
  saveEntry: (entry: TodaySuggestionHistoryEntry) => Promise<TodaySuggestionHistorySnapshot>
}

export function createTodaySuggestionHistoryStoreFromPlugin(plugin: PluginStorageLike | null | undefined): TodaySuggestionHistoryStore | null {
  if (!plugin?.loadData || !plugin?.saveData) {
    return null
  }

  return createTodaySuggestionHistoryStore(plugin)
}

export function createTodaySuggestionHistoryStore(storage: PluginStorageLike): TodaySuggestionHistoryStore {
  return {
    async loadSnapshot() {
      return loadSnapshot(storage)
    },
    async saveEntry(entry) {
      const snapshot = await loadSnapshot(storage)
      snapshot.entries = normalizeEntries([entry, ...snapshot.entries])
      await saveSnapshot(storage, snapshot)
      return snapshot
    },
  }
}

async function loadSnapshot(storage: PluginStorageLike): Promise<TodaySuggestionHistorySnapshot> {
  const data = await storage.loadData?.(TODAY_SUGGESTION_HISTORY_STORAGE_NAME)
  return normalizeSnapshot(data)
}

async function saveSnapshot(storage: PluginStorageLike, snapshot: TodaySuggestionHistorySnapshot) {
  await storage.saveData?.(TODAY_SUGGESTION_HISTORY_STORAGE_NAME, {
    schemaVersion: TODAY_SUGGESTION_HISTORY_SCHEMA_VERSION,
    entries: snapshot.entries,
  })
}

function normalizeSnapshot(value: unknown): TodaySuggestionHistorySnapshot {
  const record = isRecord(value) ? value : {}

  return {
    schemaVersion: TODAY_SUGGESTION_HISTORY_SCHEMA_VERSION,
    entries: normalizeEntries(Array.isArray(record.entries) ? record.entries : []),
  }
}

function normalizeEntries(value: unknown[]): TodaySuggestionHistoryEntry[] {
  return value
    .map(item => normalizeEntry(item))
    .filter((item): item is TodaySuggestionHistoryEntry => item !== null)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    .slice(0, MAX_HISTORY_ENTRIES)
}

function normalizeEntry(value: unknown): TodaySuggestionHistoryEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const result = normalizeAiInboxResult(value.result)
  const id = normalizeOptionalString(value.id)
  const generatedAt = normalizeOptionalString(value.generatedAt) || result?.generatedAt || ''

  if (!id || !generatedAt || !result) {
    return null
  }

  return {
    id,
    generatedAt,
    timeRange: normalizeTimeRange(value.timeRange),
    filters: normalizeFilters(value.filters),
    summaryCount: normalizeSummaryCount(value.summaryCount, result.items.length),
    result,
  }
}

function normalizeAiInboxResult(value: unknown): AiInboxResult | null {
  if (!isRecord(value)) {
    return null
  }

  const generatedAt = normalizeOptionalString(value.generatedAt)
  const summary = normalizeOptionalString(value.summary)
  const items = Array.isArray(value.items)
    ? value.items
        .map(item => normalizeAiInboxItem(item))
        .filter((item): item is AiInboxItem => item !== null)
    : []

  if (!generatedAt || !summary || items.length === 0) {
    return null
  }

  return {
    generatedAt,
    summary,
    items,
  }
}

function normalizeAiInboxItem(value: unknown): AiInboxItem | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeOptionalString(value.id)
  const title = normalizeOptionalString(value.title)
  const action = normalizeOptionalString(value.action)
  const reason = normalizeOptionalString(value.reason)

  if (!id || !title || !action || !reason) {
    return null
  }

  return {
    id,
    type: value.type === 'document' || value.type === 'connection' || value.type === 'topic-page' || value.type === 'bridge-risk'
      ? value.type
      : 'document',
    title,
    priority: value.priority === 'P1' || value.priority === 'P2' || value.priority === 'P3'
      ? value.priority
      : 'P2',
    action,
    reason,
    documentIds: normalizeStringArray(value.documentIds) || undefined,
    confidence: value.confidence === 'high' || value.confidence === 'medium' || value.confidence === 'low'
      ? value.confidence
      : undefined,
    recommendedTargets: normalizeRecommendedTargets(value.recommendedTargets),
    evidence: normalizeStringArray(value.evidence) || undefined,
    expectedChanges: normalizeStringArray(value.expectedChanges) || undefined,
  }
}

function normalizeRecommendedTargets(value: unknown): AiInboxItem['recommendedTargets'] {
  if (!Array.isArray(value)) {
    return undefined
  }

  const targets = value
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      const title = normalizeOptionalString(item.title)
      const reason = normalizeOptionalString(item.reason)
      if (!title || !reason) {
        return null
      }

      return {
        documentId: normalizeOptionalString(item.documentId) || undefined,
        title,
        reason,
        kind: item.kind === 'theme-document' || item.kind === 'core-document' || item.kind === 'community-hub' || item.kind === 'related-document'
          ? item.kind
          : 'related-document',
      }
    })
    .filter((item): item is NonNullable<AiInboxItem['recommendedTargets']>[number] => item !== null)

  return targets.length ? targets : undefined
}

function normalizeFilters(value: unknown): AnalyticsFilters {
  if (!isRecord(value)) {
    return {}
  }

  const notebook = normalizeOptionalString(value.notebook)
  const tags = normalizeStringArray(value.tags)
  const themeNames = normalizeStringArray(value.themeNames)
  const keyword = normalizeOptionalString(value.keyword)

  return {
    notebook: notebook || undefined,
    tags: tags?.length ? tags : undefined,
    themeNames: themeNames?.length ? themeNames : undefined,
    keyword: keyword || undefined,
  }
}

function normalizeTimeRange(value: unknown): TimeRange {
  if (value === '3d' || value === '7d' || value === '30d' || value === '60d' || value === '90d' || value === 'all') {
    return value
  }
  return '7d'
}

function normalizeSummaryCount(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number'
    ? Math.floor(value)
    : typeof value === 'string' && value.trim()
      ? Number.parseInt(value, 10)
      : Number.NaN

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
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
