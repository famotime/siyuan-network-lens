import {
  compareSiyuanTimestamps as compareTimestamp,
  isTimestampInPreviousWindow as isInPreviousWindow,
  isTimestampInTrailingWindow as isInTrailingWindow,
  normalizeTags,
  parseSiyuanTimestamp as parseTimestamp,
  resolveDocumentTitle,
} from './document-utils'
import { matchesAnyScopedPath, normalizeScopedPaths, splitDelimitedInput, type NotebookPathOption } from './document-paths'
import { isWikiDocumentTitle } from './wiki-page-model'
import type {
  AnalyticsFilters,
  ConnectionChangeItem,
  DocumentRecord,
  OrphanItem,
  OrphanSort,
  ReferenceRecord,
  TimeRange,
  TrendDocumentItem,
} from './analysis'

export interface NormalizedDocument {
  id: string
  box: string
  path: string
  hpath: string
  title: string
  tags: string[]
  created?: string
  updated?: string
}

export interface NormalizedReference extends ReferenceRecord {
  sourceUpdated: string
}

export interface GraphAnalysisContext {
  documents: NormalizedDocument[]
  documentMap: Map<string, NormalizedDocument>
  allReferences: NormalizedReference[]
  references: NormalizedReference[]
  adjacency: Map<string, Set<string>>
  allTouchesByDocument: Map<string, NormalizedReference[]>
  historicalConnectionsByDocument: Map<string, Set<string>>
}

export interface TrendAnalysisContext {
  documents: NormalizedDocument[]
  documentMap: Map<string, NormalizedDocument>
  references: NormalizedReference[]
  currentReferences: NormalizedReference[]
  previousReferences: NormalizedReference[]
}

export function filterDocumentsByTimeRange(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  timeRange: TimeRange
  filters?: AnalyticsFilters
  wikiPageSuffix?: string
  excludedPaths?: string
  excludedNamePrefixes?: string
  excludedNameSuffixes?: string
  notebooks?: NotebookPathOption[]
}): DocumentRecord[] {
  const visibleDocuments = excludeWikiDocuments(params.documents, params.wikiPageSuffix)
  const filteredVisibleDocuments = excludeConfiguredDocuments({
    documents: visibleDocuments,
    excludedPaths: params.excludedPaths,
    excludedNamePrefixes: params.excludedNamePrefixes,
    excludedNameSuffixes: params.excludedNameSuffixes,
    notebooks: params.notebooks,
  })
  const normalizedDocuments = normalizeDocuments(filteredVisibleDocuments)
  const filteredDocuments = normalizedDocuments.filter(document => matchesFilters(document, params.filters))
  const documentById = new Map(filteredVisibleDocuments.map(document => [document.id, document]))

  if (params.timeRange === 'all') {
    return filteredDocuments
      .map(document => documentById.get(document.id))
      .filter((document): document is DocumentRecord => Boolean(document))
  }

  const allowedIds = new Set(filteredDocuments.map(document => document.id))
  const filteredReferences = normalizeReferences(params.references).filter((reference) => {
    if (reference.sourceDocumentId === reference.targetDocumentId) {
      return false
    }
    return allowedIds.has(reference.sourceDocumentId) && allowedIds.has(reference.targetDocumentId)
  })
  const activeReferences = filteredReferences.filter(reference => isReferenceInTimeRange(reference.sourceUpdated, params.now, params.timeRange))
  const activeDocumentIds = new Set<string>()
  for (const reference of activeReferences) {
    activeDocumentIds.add(reference.sourceDocumentId)
    activeDocumentIds.add(reference.targetDocumentId)
  }

  const windowDocumentIds = new Set(
    filteredDocuments
      .filter((document) => {
        if (activeDocumentIds.has(document.id)) {
          return true
        }
        const timestamp = resolveDocumentTimestamp(document)
        if (!timestamp) {
          return false
        }
        return isInTrailingWindow(timestamp, params.now, Number.parseInt(params.timeRange, 10))
      })
      .map(document => document.id),
  )

  return filteredVisibleDocuments.filter(document => windowDocumentIds.has(document.id))
}

export function buildGraphAnalysisContext(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  timeRange: TimeRange
  filters?: AnalyticsFilters
  wikiPageSuffix?: string
  excludedPaths?: string
  excludedNamePrefixes?: string
  excludedNameSuffixes?: string
  notebooks?: NotebookPathOption[]
}): GraphAnalysisContext {
  const documentRecords = filterDocumentsByTimeRange({
    documents: params.documents,
    references: params.references,
    now: params.now,
    timeRange: params.timeRange,
    filters: params.filters,
    wikiPageSuffix: params.wikiPageSuffix,
    excludedPaths: params.excludedPaths,
    excludedNamePrefixes: params.excludedNamePrefixes,
    excludedNameSuffixes: params.excludedNameSuffixes,
    notebooks: params.notebooks,
  })
  const documents = normalizeDocuments(documentRecords)
  const documentMap = new Map(documents.map(document => [document.id, document]))
  const allReferences = normalizeReferences(params.references).filter((reference) => {
    if (reference.sourceDocumentId === reference.targetDocumentId) {
      return false
    }
    if (!documentMap.has(reference.sourceDocumentId) || !documentMap.has(reference.targetDocumentId)) {
      return false
    }
    return true
  })
  const references = allReferences.filter(reference => isReferenceInTimeRange(reference.sourceUpdated, params.now, params.timeRange))

  return {
    documents,
    documentMap,
    allReferences,
    references,
    adjacency: buildAdjacencyFromReferences(documents.map(document => document.id), references),
    allTouchesByDocument: buildTouchIndex(documents.map(document => document.id), allReferences),
    historicalConnectionsByDocument: buildHistoricalConnectionsIndex(documents.map(document => document.id), allReferences),
  }
}

export function buildTrendAnalysisContext(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  days: number
  timeRange: TimeRange
  filters?: AnalyticsFilters
  wikiPageSuffix?: string
  excludedPaths?: string
  excludedNamePrefixes?: string
  excludedNameSuffixes?: string
  notebooks?: NotebookPathOption[]
}): TrendAnalysisContext {
  const documentRecords = filterDocumentsByTimeRange({
    documents: params.documents,
    references: params.references,
    now: params.now,
    timeRange: params.timeRange,
    filters: params.filters,
    wikiPageSuffix: params.wikiPageSuffix,
    excludedPaths: params.excludedPaths,
    excludedNamePrefixes: params.excludedNamePrefixes,
    excludedNameSuffixes: params.excludedNameSuffixes,
    notebooks: params.notebooks,
  })
  const documents = normalizeDocuments(documentRecords)
  const documentMap = new Map(documents.map(document => [document.id, document]))
  const references = normalizeReferences(params.references).filter((reference) => {
    if (!documentMap.has(reference.sourceDocumentId) || !documentMap.has(reference.targetDocumentId)) {
      return false
    }
    return reference.sourceDocumentId !== reference.targetDocumentId
  })

  return {
    documents,
    documentMap,
    references,
    currentReferences: references.filter(reference => isInTrailingWindow(reference.sourceUpdated, params.now, params.days)),
    previousReferences: references.filter(reference => isInPreviousWindow(reference.sourceUpdated, params.now, params.days)),
  }
}

export function normalizeDocuments(documents: DocumentRecord[]): NormalizedDocument[] {
  return documents.map(document => ({
    id: document.id,
    box: document.box,
    path: document.path,
    hpath: document.hpath,
    title: resolveDocumentTitle(document),
    tags: normalizeTags(document.tags),
    created: document.created,
    updated: document.updated,
  }))
}

export function normalizeReferences(references: ReferenceRecord[]): NormalizedReference[] {
  return references.map(reference => ({
    ...reference,
    sourceUpdated: reference.sourceUpdated ?? '',
  }))
}

export function excludeWikiDocuments(documents: DocumentRecord[], wikiPageSuffix?: string): DocumentRecord[] {
  if (!wikiPageSuffix?.trim()) {
    return documents
  }

  return documents.filter(document => !isWikiDocumentTitle(resolveDocumentTitle(document), wikiPageSuffix))
}

export function excludeConfiguredDocuments(params: {
  documents: DocumentRecord[]
  excludedPaths?: string
  excludedNamePrefixes?: string
  excludedNameSuffixes?: string
  notebooks?: NotebookPathOption[]
}): DocumentRecord[] {
  const configuredPaths = normalizeScopedPaths(params.excludedPaths)
  if (configuredPaths.length === 0) {
    return params.documents
  }

  const notebookNameById = new Map((params.notebooks ?? []).map(notebook => [notebook.id, notebook.name]))
  const prefixes = splitDelimitedInput(params.excludedNamePrefixes)
  const suffixes = splitDelimitedInput(params.excludedNameSuffixes)

  return params.documents.filter((document) => {
    const isInExcludedPath = matchesAnyScopedPath({
      document,
      configuredPaths,
      notebookName: notebookNameById.get(document.box),
    })

    if (!isInExcludedPath) {
      return true
    }

    return !matchesExcludedTitle(resolveDocumentTitle(document), prefixes, suffixes)
  })
}

export function matchesFilters(document: NormalizedDocument, filters?: AnalyticsFilters): boolean {
  if (!filters) {
    return true
  }
  if (filters.notebook && document.box !== filters.notebook) {
    return false
  }
  if (filters.tag && !document.tags.includes(filters.tag)) {
    return false
  }
  if (filters.tags?.length && !filters.tags.some(tag => document.tags.includes(tag))) {
    return false
  }
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase()
    const haystack = `${document.title} ${document.hpath} ${document.path} ${document.tags.join(' ')}`.toLowerCase()
    if (!haystack.includes(keyword)) {
      return false
    }
  }
  if (filters.themeNames?.length) {
    const haystack = `${document.title} ${document.hpath} ${document.path} ${document.tags.join(' ')}`.toLowerCase()
    const hasMatchedTheme = filters.themeNames.some(themeName => haystack.includes(themeName.toLowerCase()))
    if (!hasMatchedTheme) {
      return false
    }
  }
  return true
}

function matchesExcludedTitle(title: string, prefixes: string[], suffixes: string[]): boolean {
  if (prefixes.length === 0 && suffixes.length === 0) {
    return true
  }

  return prefixes.some(prefix => title.startsWith(prefix))
    || suffixes.some(suffix => title.endsWith(suffix))
}

export function resolveDocumentTimestamp(document: NormalizedDocument): string {
  const updated = document.updated ?? ''
  const created = document.created ?? ''
  if (updated && created) {
    return latestTimestamp(updated, created)
  }
  return updated || created || ''
}

export function isReferenceInTimeRange(timestamp: string, now: Date, timeRange: TimeRange): boolean {
  if (timeRange === 'all') {
    return true
  }
  return isInTrailingWindow(timestamp, now, Number.parseInt(timeRange, 10))
}

export function createAdjacency(documentIds: string[]): Map<string, Set<string>> {
  return new Map(documentIds.map(documentId => [documentId, new Set<string>()]))
}

export function buildAdjacencyFromReferences(
  documentIds: string[],
  references: NormalizedReference[],
): Map<string, Set<string>> {
  const adjacency = createAdjacency(documentIds)
  for (const reference of references) {
    adjacency.get(reference.sourceDocumentId)?.add(reference.targetDocumentId)
    adjacency.get(reference.targetDocumentId)?.add(reference.sourceDocumentId)
  }
  return adjacency
}

export function buildTouchIndex(
  documentIds: string[],
  references: NormalizedReference[],
): Map<string, NormalizedReference[]> {
  const touches = new Map<string, NormalizedReference[]>(documentIds.map(documentId => [documentId, []]))
  for (const reference of references) {
    touches.get(reference.sourceDocumentId)?.push(reference)
    touches.get(reference.targetDocumentId)?.push(reference)
  }
  return touches
}

export function buildHistoricalConnectionsIndex(
  documentIds: string[],
  references: NormalizedReference[],
): Map<string, Set<string>> {
  const connections = new Map<string, Set<string>>(documentIds.map(documentId => [documentId, new Set<string>()]))
  for (const reference of references) {
    connections.get(reference.sourceDocumentId)?.add(reference.targetDocumentId)
    connections.get(reference.targetDocumentId)?.add(reference.sourceDocumentId)
  }
  return connections
}

export function buildConnectionEdgeMap(references: NormalizedReference[]): Map<string, ConnectionChangeItem> {
  const edges = new Map<string, ConnectionChangeItem>()
  for (const reference of references) {
    const documentIds = [reference.sourceDocumentId, reference.targetDocumentId].sort()
    const key = documentIds.join('|')
    const existing = edges.get(key)
    if (existing) {
      existing.referenceCount += 1
      continue
    }
    edges.set(key, {
      documentIds,
      referenceCount: 1,
    })
  }
  return edges
}

export function buildConnectionDifference(
  source: Map<string, ConnectionChangeItem>,
  excluded: Map<string, ConnectionChangeItem>,
): ConnectionChangeItem[] {
  return [...source.entries()]
    .filter(([key]) => !excluded.has(key))
    .map(([, item]) => item)
    .sort((left, right) => {
      if (right.referenceCount !== left.referenceCount) {
        return right.referenceCount - left.referenceCount
      }
      return left.documentIds[0].localeCompare(right.documentIds[0]) || left.documentIds[1].localeCompare(right.documentIds[1])
    })
}

export function latestTimestamp(left: string, right: string): string {
  return compareTimestamp(left, right) >= 0 ? left : right
}

export function diffDays(now: Date, timestamp: string): number {
  const value = parseTimestamp(timestamp)
  if (!value) {
    return Number.POSITIVE_INFINITY
  }
  return Math.floor((now.getTime() - value) / (24 * 60 * 60 * 1000))
}

export function sortOrphans(orphans: OrphanItem[], sort: OrphanSort = 'updated-desc'): OrphanItem[] {
  return [...orphans].sort((left, right) => {
    if (sort === 'created-desc') {
      return compareTimestamp(right.createdAt, left.createdAt) || left.documentId.localeCompare(right.documentId)
    }
    if (sort === 'title-asc') {
      return left.title.localeCompare(right.title, 'zh-CN') || left.documentId.localeCompare(right.documentId)
    }
    return compareTimestamp(right.updatedAt, left.updatedAt) || left.documentId.localeCompare(right.documentId)
  })
}

export function collectTopTags(documents: NormalizedDocument[]): string[] {
  const counts = new Map<string, number>()
  for (const document of documents) {
    for (const tag of document.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }
      return left[0].localeCompare(right[0], 'zh-CN')
    })
    .slice(0, 3)
    .map(([tag]) => tag)
}

export function isTopicPageCandidate(document: NormalizedDocument): boolean {
  const keywords = ['index', 'hub', 'map', 'overview', 'guide', '索引', '导航', '地图', '总览']
  const title = document.title.toLowerCase()
  const tags = document.tags.map(tag => tag.toLowerCase())

  return keywords.some(keyword => title.includes(keyword.toLowerCase()) || tags.includes(keyword.toLowerCase()))
}

export function countByTarget(references: NormalizedReference[]): Map<string, number> {
  const sourcesByTarget = new Map<string, Set<string>>()
  for (const reference of references) {
    const sources = sourcesByTarget.get(reference.targetDocumentId) ?? new Set<string>()
    sources.add(reference.sourceDocumentId)
    sourcesByTarget.set(reference.targetDocumentId, sources)
  }
  return new Map([...sourcesByTarget.entries()].map(([targetId, sources]) => [targetId, sources.size]))
}

export function countUniqueDirectedEdges(references: NormalizedReference[]): number {
  const edges = new Set<string>()
  for (const reference of references) {
    edges.add(`${reference.sourceDocumentId}|${reference.targetDocumentId}`)
  }
  return edges.size
}
