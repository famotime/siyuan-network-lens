export type TimeRange = '3d' | '7d' | '30d' | '60d' | '90d' | 'all'

export const TIME_RANGE_OPTIONS: TimeRange[] = ['all', '3d', '7d', '30d', '60d', '90d']

export function filterReferencesByTimeRange(params: {
  references: ReferenceRecord[]
  now: Date
  timeRange: TimeRange
}): ReferenceRecord[] {
  return params.references.filter(reference => isReferenceInTimeRange(reference.sourceUpdated ?? '', params.now, params.timeRange))
}

export interface DocumentRecord {
  id: string
  box: string
  path: string
  hpath: string
  title?: string
  name?: string
  content?: string
  tags?: readonly string[] | string
  created?: string
  updated?: string
}

export interface ReferenceRecord {
  id: string
  sourceDocumentId: string
  sourceBlockId: string
  targetDocumentId: string
  targetBlockId: string
  content: string
  sourceUpdated?: string
}

export interface AnalyticsFilters {
  notebook?: string
  tag?: string
  keyword?: string
  themeNames?: string[]
}

export type OrphanSort = 'updated-desc' | 'created-desc' | 'title-asc'

interface NormalizedDocument {
  id: string
  box: string
  path: string
  hpath: string
  title: string
  tags: string[]
  created?: string
  updated?: string
}

interface NormalizedReference extends ReferenceRecord {
  sourceUpdated: string
}

export interface RankingItem {
  documentId: string
  title: string
  inboundReferences: number
  distinctSourceDocuments: number
  outboundReferences: number
  lastActiveAt: string
}

export interface CommunityItem {
  id: string
  documentIds: string[]
  size: number
  hubDocumentIds: string[]
  topTags: string[]
  notebookIds: string[]
  missingTopicPage: boolean
}

export interface BridgeItem {
  documentId: string
  title: string
  degree: number
}

export interface OrphanItem extends BridgeItem {
  createdAt: string
  updatedAt: string
  historicalReferenceCount: number
  lastHistoricalAt: string
  hasSparseEvidence: boolean
}

export interface DormantItem extends OrphanItem {
  inactivityDays: number
  lastConnectedAt: string
}

export interface PropagationNodeItem extends BridgeItem {
  score: number
  pathPairCount: number
  focusDocumentCount: number
  communitySpan: number
  bridgeRole: boolean
}

export interface SuggestionItem {
  type: 'promote-hub' | 'repair-orphan' | 'maintain-bridge' | 'archive-dormant'
  documentId: string
  title: string
  reason: string
}

export interface TrendDocumentItem {
  documentId: string
  title: string
  currentReferences: number
  previousReferences: number
  delta: number
}

export interface ConnectionChangeItem {
  documentIds: string[]
  referenceCount: number
}

export interface CommunityTrendItem {
  communityId: string
  documentIds: string[]
  hubDocumentIds: string[]
  topTags: string[]
  currentReferences: number
  previousReferences: number
  delta: number
}

export interface ReferenceGraphReport {
  summary: {
    totalDocuments: number
    analyzedDocuments: number
    totalReferences: number
    orphanCount: number
    communityCount: number
    dormantCount: number
    sparseEvidenceCount: number
    propagationCount: number
  }
  ranking: RankingItem[]
  communities: CommunityItem[]
  bridgeDocuments: BridgeItem[]
  orphans: OrphanItem[]
  dormantDocuments: DormantItem[]
  propagationNodes: PropagationNodeItem[]
  suggestions: SuggestionItem[]
  evidenceByDocument: Record<string, NormalizedReference[]>
}

export interface TrendReport {
  current: {
    referenceCount: number
  }
  previous: {
    referenceCount: number
  }
  risingDocuments: TrendDocumentItem[]
  fallingDocuments: TrendDocumentItem[]
  connectionChanges: {
    newCount: number
    brokenCount: number
    newEdges: ConnectionChangeItem[]
    brokenEdges: ConnectionChangeItem[]
  }
  communityTrends: CommunityTrendItem[]
  risingCommunities: CommunityTrendItem[]
  dormantCommunities: CommunityTrendItem[]
}

export function filterDocumentsByTimeRange(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  timeRange: TimeRange
  filters?: AnalyticsFilters
}): DocumentRecord[] {
  const normalizedDocuments = normalizeDocuments(params.documents)
  const filteredDocuments = normalizedDocuments.filter(document => matchesFilters(document, params.filters))
  const documentById = new Map(params.documents.map(document => [document.id, document]))

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

  return params.documents.filter(document => windowDocumentIds.has(document.id))
}

export function analyzeReferenceGraph(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  timeRange: TimeRange
  filters?: AnalyticsFilters
  orphanSort?: OrphanSort
  dormantDays?: number
}): ReferenceGraphReport {
  const documentRecords = filterDocumentsByTimeRange({
    documents: params.documents,
    references: params.references,
    now: params.now,
    timeRange: params.timeRange,
    filters: params.filters,
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
  const references = allReferences.filter((reference) => {
    return isReferenceInTimeRange(reference.sourceUpdated, params.now, params.timeRange)
  })

  const adjacency = buildAdjacencyFromReferences(documents.map(document => document.id), references)
  const evidenceByDocument: Record<string, NormalizedReference[]> = {}
  const inboundByDocument = new Map<string, NormalizedReference[]>()
  const inboundSourcesByDocument = new Map<string, Set<string>>()
  const outboundTargetsByDocument = new Map<string, Set<string>>()
  const allTouchesByDocument = buildTouchIndex(documents.map(document => document.id), allReferences)
  const historicalConnectionsByDocument = buildHistoricalConnectionsIndex(documents.map(document => document.id), allReferences)
  const dormantDays = params.dormantDays ?? 30

  for (const reference of references) {
    const inbound = inboundByDocument.get(reference.targetDocumentId) ?? []
    inbound.push(reference)
    inboundByDocument.set(reference.targetDocumentId, inbound)

    const inboundSources = inboundSourcesByDocument.get(reference.targetDocumentId) ?? new Set<string>()
    inboundSources.add(reference.sourceDocumentId)
    inboundSourcesByDocument.set(reference.targetDocumentId, inboundSources)

    const outboundTargets = outboundTargetsByDocument.get(reference.sourceDocumentId) ?? new Set<string>()
    outboundTargets.add(reference.targetDocumentId)
    outboundTargetsByDocument.set(reference.sourceDocumentId, outboundTargets)

    adjacency.get(reference.sourceDocumentId)?.add(reference.targetDocumentId)
    adjacency.get(reference.targetDocumentId)?.add(reference.sourceDocumentId)
  }

  for (const [documentId, items] of inboundByDocument) {
    evidenceByDocument[documentId] = [...items].sort((left, right) => compareTimestamp(right.sourceUpdated, left.sourceUpdated))
  }

  const ranking = documents
    .map((document) => {
      const inbound = inboundByDocument.get(document.id) ?? []
      const distinctSourceDocuments = inboundSourcesByDocument.get(document.id) ?? new Set<string>()
      const outboundTargets = outboundTargetsByDocument.get(document.id) ?? new Set<string>()
      return {
        documentId: document.id,
        title: document.title,
        inboundReferences: distinctSourceDocuments.size,
        distinctSourceDocuments: distinctSourceDocuments.size,
        outboundReferences: outboundTargets.size,
        lastActiveAt: inbound.reduce((latest, reference) => {
          return compareTimestamp(reference.sourceUpdated, latest) > 0 ? reference.sourceUpdated : latest
        }, ''),
      }
    })
    .filter(item => item.inboundReferences > 0)
    .sort((left, right) => {
      if (right.inboundReferences !== left.inboundReferences) {
        return right.inboundReferences - left.inboundReferences
      }
      if (right.distinctSourceDocuments !== left.distinctSourceDocuments) {
        return right.distinctSourceDocuments - left.distinctSourceDocuments
      }
      return compareTimestamp(right.lastActiveAt, left.lastActiveAt)
    })

  const degrees = new Map<string, number>()
  for (const [documentId, neighbors] of adjacency) {
    degrees.set(documentId, neighbors.size)
  }

  const bridgeIds = findMeaningfulBridgeDocuments(adjacency)
  const communities = buildCommunities(documents, adjacency, bridgeIds)
  const bridgeDocuments = [...bridgeIds]
    .map((documentId) => {
      const document = documentMap.get(documentId)!
      return {
        documentId,
        title: document.title,
        degree: degrees.get(documentId) ?? 0,
      }
    })
    .sort((left, right) => {
      if (right.degree !== left.degree) {
        return right.degree - left.degree
      }
      return left.documentId.localeCompare(right.documentId)
    })
  const propagationNodes = buildPropagationNodes({
    documents,
    adjacency,
    ranking,
    bridgeIds,
    communities,
  })

  const disconnectedDocuments = documents
    .filter(document => (degrees.get(document.id) ?? 0) === 0)
    .map((document) => {
      const historicalReferences = [...(allTouchesByDocument.get(document.id) ?? [])]
        .sort((left, right) => compareTimestamp(right.sourceUpdated, left.sourceUpdated))
      const historicalReferenceCount = historicalConnectionsByDocument.get(document.id)?.size ?? 0
      const lastHistoricalAt = historicalReferences[0]?.sourceUpdated ?? ''

      return {
        documentId: document.id,
        title: document.title,
        degree: 0,
        createdAt: document.created ?? '',
        updatedAt: document.updated ?? '',
        historicalReferenceCount,
        lastHistoricalAt,
        hasSparseEvidence: historicalReferenceCount > 0 && historicalReferenceCount <= 2,
      }
    })

  const orphans = sortOrphans(disconnectedDocuments, params.orphanSort)

  const dormantDocuments = disconnectedDocuments
    .map((item) => {
      const updatedAt = item.updatedAt || item.createdAt
      const lastRelevantAt = latestTimestamp(updatedAt, item.lastHistoricalAt)
      const inactivityDays = diffDays(params.now, lastRelevantAt)

      return {
        ...item,
        inactivityDays,
        lastConnectedAt: item.lastHistoricalAt,
      }
    })
    .filter(item => item.inactivityDays >= dormantDays)
    .sort((left, right) => {
      if (right.inactivityDays !== left.inactivityDays) {
        return right.inactivityDays - left.inactivityDays
      }
      return left.documentId.localeCompare(right.documentId)
    })

  return {
    summary: {
      totalDocuments: documents.length,
      analyzedDocuments: documents.length,
      totalReferences: countUniqueDirectedEdges(references),
      orphanCount: orphans.length,
      communityCount: communities.length,
      dormantCount: dormantDocuments.length,
      sparseEvidenceCount: disconnectedDocuments.filter(item => item.hasSparseEvidence).length,
      propagationCount: propagationNodes.length,
    },
    ranking,
    communities,
    bridgeDocuments,
    orphans,
    dormantDocuments,
    propagationNodes,
    suggestions: buildSuggestions(ranking, orphans, dormantDocuments, bridgeDocuments),
    evidenceByDocument,
  }
}

export function analyzeTrends(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  days: number
  timeRange: TimeRange
  filters?: AnalyticsFilters
}): TrendReport {
  const documentRecords = filterDocumentsByTimeRange({
    documents: params.documents,
    references: params.references,
    now: params.now,
    timeRange: params.timeRange,
    filters: params.filters,
  })
  const documents = normalizeDocuments(documentRecords)
  const documentMap = new Map(documents.map(document => [document.id, document]))
  const references = normalizeReferences(params.references).filter((reference) => {
    if (!documentMap.has(reference.sourceDocumentId) || !documentMap.has(reference.targetDocumentId)) {
      return false
    }
    return reference.sourceDocumentId !== reference.targetDocumentId
  })

  const currentReferences = references.filter(reference => isInTrailingWindow(reference.sourceUpdated, params.now, params.days))
  const previousReferences = references.filter(reference => isInPreviousWindow(reference.sourceUpdated, params.now, params.days))

  const currentCounts = countByTarget(currentReferences)
  const previousCounts = countByTarget(previousReferences)
  const documentIds = new Set([...currentCounts.keys(), ...previousCounts.keys()])

  const deltas = [...documentIds]
    .map((documentId) => {
      const document = documentMap.get(documentId)
      if (!document) {
        return null
      }
      const currentReferences = currentCounts.get(documentId) ?? 0
      const previousReferences = previousCounts.get(documentId) ?? 0
      return {
        documentId,
        title: document.title,
        currentReferences,
        previousReferences,
        delta: currentReferences - previousReferences,
      }
    })
    .filter((item): item is TrendDocumentItem => item !== null)

  const allAdjacency = buildAdjacencyFromReferences(documents.map(document => document.id), references)
  const allBridgeIds = findMeaningfulBridgeDocuments(allAdjacency)
  const communities = buildCommunities(documents, allAdjacency, allBridgeIds)
  const communityTrends = communities
    .map((community) => {
      const communityIds = new Set(community.documentIds)
      const currentCommunityReferences = currentReferences.filter((reference) => {
        return communityIds.has(reference.sourceDocumentId) && communityIds.has(reference.targetDocumentId)
      })
      const previousCommunityReferences = previousReferences.filter((reference) => {
        return communityIds.has(reference.sourceDocumentId) && communityIds.has(reference.targetDocumentId)
      })

      const currentUniqueCount = countUniqueDirectedEdges(currentCommunityReferences)
      const previousUniqueCount = countUniqueDirectedEdges(previousCommunityReferences)

      return {
        communityId: community.id,
        documentIds: community.documentIds,
        hubDocumentIds: community.hubDocumentIds,
        topTags: community.topTags,
        currentReferences: currentUniqueCount,
        previousReferences: previousUniqueCount,
        delta: currentUniqueCount - previousUniqueCount,
      }
    })
    .sort((left, right) => {
      if (right.delta !== left.delta) {
        return right.delta - left.delta
      }
      if (right.currentReferences !== left.currentReferences) {
        return right.currentReferences - left.currentReferences
      }
      return left.documentIds[0].localeCompare(right.documentIds[0])
    })

  const currentEdges = buildConnectionEdgeMap(currentReferences)
  const previousEdges = buildConnectionEdgeMap(previousReferences)
  const newEdges = buildConnectionDifference(currentEdges, previousEdges)
  const brokenEdges = buildConnectionDifference(previousEdges, currentEdges)

  return {
    current: {
      referenceCount: countUniqueDirectedEdges(currentReferences),
    },
    previous: {
      referenceCount: countUniqueDirectedEdges(previousReferences),
    },
    risingDocuments: deltas
      .filter(item => item.delta > 0)
      .sort((left, right) => {
        if (right.delta !== left.delta) {
          return right.delta - left.delta
        }
        if (right.currentReferences !== left.currentReferences) {
          return right.currentReferences - left.currentReferences
        }
        return left.documentId.localeCompare(right.documentId)
      }),
    fallingDocuments: deltas
      .filter(item => item.delta < 0)
      .sort((left, right) => {
        if (left.delta !== right.delta) {
          return left.delta - right.delta
        }
        if (left.currentReferences !== right.currentReferences) {
          return left.currentReferences - right.currentReferences
        }
        return left.documentId.localeCompare(right.documentId)
      }),
    connectionChanges: {
      newCount: newEdges.length,
      brokenCount: brokenEdges.length,
      newEdges,
      brokenEdges,
    },
    communityTrends,
    risingCommunities: communityTrends.filter(item => item.delta > 0),
    dormantCommunities: communityTrends.filter(item => item.currentReferences === 0 || (item.delta < 0 && item.currentReferences <= 1)),
  }
}

export function findReferencePath(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  fromDocumentId: string
  toDocumentId: string
  maxDepth?: number
  filters?: AnalyticsFilters
  now?: Date
  timeRange?: TimeRange
}): string[] {
  const documentRecords = params.now && params.timeRange
    ? filterDocumentsByTimeRange({
        documents: params.documents,
        references: params.references,
        now: params.now,
        timeRange: params.timeRange,
        filters: params.filters,
      })
    : params.documents.filter((document) => {
        const normalized = normalizeDocuments([document])[0]
        return matchesFilters(normalized, params.filters)
      })
  const documents = normalizeDocuments(documentRecords)
  const documentIds = new Set(documents.map(document => document.id))
  if (!documentIds.has(params.fromDocumentId) || !documentIds.has(params.toDocumentId)) {
    return []
  }

  const adjacency = createAdjacency([...documentIds])
  for (const reference of normalizeReferences(params.references)) {
    if (reference.sourceDocumentId === reference.targetDocumentId) {
      continue
    }
    if (!documentIds.has(reference.sourceDocumentId) || !documentIds.has(reference.targetDocumentId)) {
      continue
    }
    if (params.now && params.timeRange && !isReferenceInTimeRange(reference.sourceUpdated, params.now, params.timeRange)) {
      continue
    }
    adjacency.get(reference.sourceDocumentId)?.add(reference.targetDocumentId)
    adjacency.get(reference.targetDocumentId)?.add(reference.sourceDocumentId)
  }

  const maxDepth = params.maxDepth ?? 6
  const queue: Array<{ id: string, path: string[] }> = [{ id: params.fromDocumentId, path: [params.fromDocumentId] }]
  const visited = new Set<string>([params.fromDocumentId])

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.id === params.toDocumentId) {
      return current.path
    }
    if (current.path.length - 1 >= maxDepth) {
      continue
    }

    const neighbors = [...(adjacency.get(current.id) ?? [])].sort()
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue
      }
      visited.add(neighbor)
      queue.push({
        id: neighbor,
        path: [...current.path, neighbor],
      })
    }
  }

  return []
}

function normalizeDocuments(documents: DocumentRecord[]): NormalizedDocument[] {
  return documents.map(document => ({
    id: document.id,
    box: document.box,
    path: document.path,
    hpath: document.hpath,
    title: document.title || document.name || document.content || document.hpath || document.id,
    tags: normalizeTags(document.tags),
    created: document.created,
    updated: document.updated,
  }))
}

function normalizeReferences(references: ReferenceRecord[]): NormalizedReference[] {
  return references.map(reference => ({
    ...reference,
    sourceUpdated: reference.sourceUpdated ?? '',
  }))
}

function normalizeTags(tags?: readonly string[] | string): string[] {
  if (!tags) {
    return []
  }
  if (Array.isArray(tags)) {
    return tags.map(tag => tag.trim()).filter(Boolean)
  }
  if (typeof tags === 'string') {
    return tags
      .split(/[,\s#]+/)
      .map(tag => tag.trim())
      .filter(Boolean)
  }
  return []
}

function matchesFilters(document: NormalizedDocument, filters?: AnalyticsFilters): boolean {
  if (!filters) {
    return true
  }
  if (filters.notebook && document.box !== filters.notebook) {
    return false
  }
  if (filters.tag && !document.tags.includes(filters.tag)) {
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

function resolveDocumentTimestamp(document: NormalizedDocument): string {
  const updated = document.updated ?? ''
  const created = document.created ?? ''
  if (updated && created) {
    return latestTimestamp(updated, created)
  }
  return updated || created || ''
}

function isReferenceInTimeRange(timestamp: string, now: Date, timeRange: TimeRange): boolean {
  if (timeRange === 'all') {
    return true
  }
  return isInTrailingWindow(timestamp, now, Number.parseInt(timeRange, 10))
}

function isInTrailingWindow(timestamp: string, now: Date, days: number): boolean {
  const value = parseTimestamp(timestamp)
  if (!value) {
    return false
  }
  const end = now.getTime()
  const start = end - days * 24 * 60 * 60 * 1000
  return value > start && value <= end
}

function isInPreviousWindow(timestamp: string, now: Date, days: number): boolean {
  const value = parseTimestamp(timestamp)
  if (!value) {
    return false
  }
  const end = now.getTime() - days * 24 * 60 * 60 * 1000
  const start = end - days * 24 * 60 * 60 * 1000
  return value > start && value <= end
}

function parseTimestamp(timestamp: string): number | null {
  if (!timestamp || timestamp.length < 8) {
    return null
  }
  const year = Number.parseInt(timestamp.slice(0, 4), 10)
  const month = Number.parseInt(timestamp.slice(4, 6), 10) - 1
  const day = Number.parseInt(timestamp.slice(6, 8), 10)
  const hour = Number.parseInt(timestamp.slice(8, 10) || '0', 10)
  const minute = Number.parseInt(timestamp.slice(10, 12) || '0', 10)
  const second = Number.parseInt(timestamp.slice(12, 14) || '0', 10)
  return Date.UTC(year, month, day, hour, minute, second)
}

function compareTimestamp(left: string, right: string): number {
  const leftValue = parseTimestamp(left) ?? 0
  const rightValue = parseTimestamp(right) ?? 0
  return leftValue - rightValue
}

function createAdjacency(documentIds: string[]): Map<string, Set<string>> {
  return new Map(documentIds.map(documentId => [documentId, new Set<string>()]))
}

function buildAdjacencyFromReferences(
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

function buildTouchIndex(
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

function buildHistoricalConnectionsIndex(
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

function buildConnectionEdgeMap(references: NormalizedReference[]): Map<string, ConnectionChangeItem> {
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

function buildConnectionDifference(
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

function latestTimestamp(left: string, right: string): string {
  return compareTimestamp(left, right) >= 0 ? left : right
}

function diffDays(now: Date, timestamp: string): number {
  const value = parseTimestamp(timestamp)
  if (!value) {
    return Number.POSITIVE_INFINITY
  }
  return Math.floor((now.getTime() - value) / (24 * 60 * 60 * 1000))
}

function sortOrphans(orphans: OrphanItem[], sort: OrphanSort = 'updated-desc'): OrphanItem[] {
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

function collectTopTags(documents: NormalizedDocument[]): string[] {
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

function isTopicPageCandidate(document: NormalizedDocument): boolean {
  const keywords = ['index', 'hub', 'map', 'overview', 'guide', '索引', '导航', '地图', '总览']
  const title = document.title.toLowerCase()
  const tags = document.tags.map(tag => tag.toLowerCase())

  return keywords.some(keyword => title.includes(keyword.toLowerCase()) || tags.includes(keyword.toLowerCase()))
}

function buildPropagationNodes(params: {
  documents: NormalizedDocument[]
  adjacency: Map<string, Set<string>>
  ranking: RankingItem[]
  bridgeIds: Set<string>
  communities: CommunityItem[]
}): PropagationNodeItem[] {
  const documentMap = new Map(params.documents.map(document => [document.id, document]))
  const focusIds = buildPropagationFocusIds(params.ranking, params.bridgeIds, params.communities)
  if (focusIds.length < 2) {
    return []
  }

  const communityIdByDocument = new Map<string, string>()
  for (const community of params.communities) {
    for (const documentId of community.documentIds) {
      communityIdByDocument.set(documentId, community.id)
    }
  }

  const distances = new Map<string, Map<string, number>>()
  for (const focusId of focusIds) {
    distances.set(focusId, computeDistancesFromNode(params.adjacency, focusId))
  }

  const pathPairCounts = new Map<string, number>()
  const focusCoverage = new Map<string, Set<string>>()
  const communityCoverage = new Map<string, Set<string>>()

  for (let leftIndex = 0; leftIndex < focusIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < focusIds.length; rightIndex += 1) {
      const leftId = focusIds[leftIndex]
      const rightId = focusIds[rightIndex]
      const leftDistances = distances.get(leftId)!
      const rightDistances = distances.get(rightId)!
      const shortestDistance = leftDistances.get(rightId)

      if (shortestDistance === undefined || shortestDistance < 2) {
        continue
      }

      for (const candidate of params.documents) {
        if (candidate.id === leftId || candidate.id === rightId) {
          continue
        }
        const leftToCandidate = leftDistances.get(candidate.id)
        const rightToCandidate = rightDistances.get(candidate.id)
        if (leftToCandidate === undefined || rightToCandidate === undefined) {
          continue
        }
        if (leftToCandidate + rightToCandidate !== shortestDistance) {
          continue
        }

        pathPairCounts.set(candidate.id, (pathPairCounts.get(candidate.id) ?? 0) + 1)

        const coveredFocusIds = focusCoverage.get(candidate.id) ?? new Set<string>()
        coveredFocusIds.add(leftId)
        coveredFocusIds.add(rightId)
        focusCoverage.set(candidate.id, coveredFocusIds)

        const coveredCommunities = communityCoverage.get(candidate.id) ?? new Set<string>()
        const leftCommunityId = communityIdByDocument.get(leftId)
        const rightCommunityId = communityIdByDocument.get(rightId)
        if (leftCommunityId) {
          coveredCommunities.add(leftCommunityId)
        }
        if (rightCommunityId) {
          coveredCommunities.add(rightCommunityId)
        }
        communityCoverage.set(candidate.id, coveredCommunities)
      }
    }
  }

  return [...pathPairCounts.entries()]
    .filter(([, pathPairCount]) => pathPairCount > 0)
    .map(([documentId, pathPairCount]) => {
      const document = documentMap.get(documentId)!
      const focusDocumentCount = focusCoverage.get(documentId)?.size ?? 0
      const communitySpan = communityCoverage.get(documentId)?.size ?? 0
      const degree = params.adjacency.get(documentId)?.size ?? 0
      return {
        documentId,
        title: document.title,
        degree,
        score: pathPairCount,
        pathPairCount,
        focusDocumentCount,
        communitySpan,
        bridgeRole: params.bridgeIds.has(documentId),
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      if (right.communitySpan !== left.communitySpan) {
        return right.communitySpan - left.communitySpan
      }
      if (right.degree !== left.degree) {
        return right.degree - left.degree
      }
      return left.documentId.localeCompare(right.documentId)
    })
}

function buildPropagationFocusIds(
  ranking: RankingItem[],
  bridgeIds: Set<string>,
  communities: CommunityItem[],
): string[] {
  const ids = new Set<string>()
  for (const item of ranking.slice(0, 12)) {
    ids.add(item.documentId)
  }
  for (const bridgeId of bridgeIds) {
    ids.add(bridgeId)
  }
  for (const community of communities) {
    for (const hubDocumentId of community.hubDocumentIds) {
      ids.add(hubDocumentId)
    }
  }
  return [...ids].sort()
}

function computeDistancesFromNode(
  adjacency: Map<string, Set<string>>,
  sourceId: string,
): Map<string, number> {
  const distances = new Map<string, number>([[sourceId, 0]])
  const queue = [sourceId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const distance = distances.get(currentId) ?? 0
    for (const neighbor of adjacency.get(currentId) ?? []) {
      if (distances.has(neighbor)) {
        continue
      }
      distances.set(neighbor, distance + 1)
      queue.push(neighbor)
    }
  }

  return distances
}

function findArticulationPoints(adjacency: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>()
  const discovery = new Map<string, number>()
  const low = new Map<string, number>()
  const articulationPoints = new Set<string>()
  let time = 0

  const visit = (currentId: string, parentId: string | null) => {
    visited.add(currentId)
    time += 1
    discovery.set(currentId, time)
    low.set(currentId, time)

    let children = 0
    for (const neighbor of adjacency.get(currentId) ?? []) {
      if (!visited.has(neighbor)) {
        children += 1
        visit(neighbor, currentId)
        low.set(currentId, Math.min(low.get(currentId)!, low.get(neighbor)!))

        if (parentId !== null && low.get(neighbor)! >= discovery.get(currentId)!) {
          articulationPoints.add(currentId)
        }
      } else if (neighbor !== parentId) {
        low.set(currentId, Math.min(low.get(currentId)!, discovery.get(neighbor)!))
      }
    }

    if (parentId === null && children > 1) {
      articulationPoints.add(currentId)
    }
  }

  for (const [documentId, neighbors] of adjacency) {
    if (neighbors.size === 0 || visited.has(documentId)) {
      continue
    }
    visit(documentId, null)
  }

  return articulationPoints
}

function findMeaningfulBridgeDocuments(adjacency: Map<string, Set<string>>): Set<string> {
  const candidates = findArticulationPoints(adjacency)
  const bridgeIds = new Set<string>()

  for (const candidate of candidates) {
    if ((adjacency.get(candidate)?.size ?? 0) < 3) {
      continue
    }
    const componentSizes = getComponentSizesWithoutNode(adjacency, candidate)
    const denseComponents = componentSizes.filter(size => size >= 2)
    if (denseComponents.length >= 2) {
      bridgeIds.add(candidate)
    }
  }

  return bridgeIds
}

function getComponentSizesWithoutNode(adjacency: Map<string, Set<string>>, excludedId: string): number[] {
  const visited = new Set<string>([excludedId])
  const sizes: number[] = []

  for (const [documentId] of adjacency) {
    if (visited.has(documentId)) {
      continue
    }

    const queue = [documentId]
    visited.add(documentId)
    let size = 0

    while (queue.length > 0) {
      const currentId = queue.shift()!
      size += 1
      for (const neighbor of adjacency.get(currentId) ?? []) {
        if (neighbor === excludedId || visited.has(neighbor)) {
          continue
        }
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }

    sizes.push(size)
  }

  return sizes
}

function buildCommunities(
  documents: NormalizedDocument[],
  adjacency: Map<string, Set<string>>,
  bridgeIds: Set<string>,
): CommunityItem[] {
  const documentMap = new Map(documents.map(document => [document.id, document]))
  const visited = new Set<string>()
  const communities: CommunityItem[] = []

  for (const document of documents) {
    if (bridgeIds.has(document.id) || visited.has(document.id) || (adjacency.get(document.id)?.size ?? 0) === 0) {
      continue
    }

    const queue = [document.id]
    const component: string[] = []
    visited.add(document.id)

    while (queue.length > 0) {
      const currentId = queue.shift()!
      component.push(currentId)
      const neighbors = adjacency.get(currentId) ?? new Set<string>()
      for (const neighbor of neighbors) {
        if (bridgeIds.has(neighbor) || visited.has(neighbor)) {
          continue
        }
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }

    if (component.length <= 1) {
      continue
    }

    const sortedDocumentIds = [...component].sort()
    const communityDocuments = sortedDocumentIds.map(documentId => documentMap.get(documentId)!)
    const hubDocumentIds = [...component]
      .sort((left, right) => {
        const degreeDiff = (adjacency.get(right)?.size ?? 0) - (adjacency.get(left)?.size ?? 0)
        if (degreeDiff !== 0) {
          return degreeDiff
        }
        return left.localeCompare(right)
      })
      .slice(0, 3)
      .sort()

    const leadDocument = documentMap.get(sortedDocumentIds[0])!
    communities.push({
      id: `community-${leadDocument.id}`,
      documentIds: sortedDocumentIds,
      size: sortedDocumentIds.length,
      hubDocumentIds,
      topTags: collectTopTags(communityDocuments),
      notebookIds: [...new Set(communityDocuments.map(document => document.box))].sort(),
      missingTopicPage: !communityDocuments.some(document => isTopicPageCandidate(document)),
    })
  }

  return communities.sort((left, right) => {
    if (right.size !== left.size) {
      return right.size - left.size
    }
    return left.documentIds[0].localeCompare(right.documentIds[0])
  })
}

function buildSuggestions(
  ranking: RankingItem[],
  orphans: OrphanItem[],
  dormantDocuments: DormantItem[],
  bridgeDocuments: BridgeItem[],
): SuggestionItem[] {
  const suggestions: SuggestionItem[] = []

  for (const item of ranking.filter(item => item.inboundReferences >= 2 || item.distinctSourceDocuments >= 2).slice(0, 5)) {
    suggestions.push({
      type: 'promote-hub',
      documentId: item.documentId,
      title: item.title,
      reason: `被 ${item.distinctSourceDocuments} 个文档引用，共 ${item.inboundReferences} 次`,
    })
  }

  for (const item of orphans) {
    suggestions.push({
      type: 'repair-orphan',
      documentId: item.documentId,
      title: item.title,
      reason: item.hasSparseEvidence
        ? `当前窗口内没有文档级连接，但历史上还有 ${item.historicalReferenceCount} 条零散引用证据`
        : '当前分析窗口内没有文档级连接',
    })
  }

  for (const item of dormantDocuments) {
    suggestions.push({
      type: 'archive-dormant',
      documentId: item.documentId,
      title: item.title,
      reason: `${item.inactivityDays} 天未产生有效连接，适合归档或补齐索引`,
    })
  }

  for (const item of bridgeDocuments) {
    suggestions.push({
      type: 'maintain-bridge',
      documentId: item.documentId,
      title: item.title,
      reason: `连接 ${item.degree} 条关系，移除后会打断社区连通性`,
    })
  }

  return suggestions
}

function countByTarget(references: NormalizedReference[]): Map<string, number> {
  const sourcesByTarget = new Map<string, Set<string>>()
  for (const reference of references) {
    const sources = sourcesByTarget.get(reference.targetDocumentId) ?? new Set<string>()
    sources.add(reference.sourceDocumentId)
    sourcesByTarget.set(reference.targetDocumentId, sources)
  }
  return new Map([...sourcesByTarget.entries()].map(([targetId, sources]) => [targetId, sources.size]))
}

function countUniqueDirectedEdges(references: NormalizedReference[]): number {
  const edges = new Set<string>()
  for (const reference of references) {
    edges.add(`${reference.sourceDocumentId}|${reference.targetDocumentId}`)
  }
  return edges.size
}
