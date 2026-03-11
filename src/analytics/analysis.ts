export type TimeRange = '7d' | '30d' | '90d' | 'all'

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
}

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
}

export interface BridgeItem {
  documentId: string
  title: string
  degree: number
}

export interface SuggestionItem {
  type: 'promote-hub' | 'repair-orphan' | 'maintain-bridge'
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

export interface ReferenceGraphReport {
  summary: {
    totalDocuments: number
    analyzedDocuments: number
    totalReferences: number
    orphanCount: number
    communityCount: number
  }
  ranking: RankingItem[]
  communities: CommunityItem[]
  bridgeDocuments: BridgeItem[]
  orphans: BridgeItem[]
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
}

export function analyzeReferenceGraph(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  timeRange: TimeRange
  filters?: AnalyticsFilters
}): ReferenceGraphReport {
  const documents = normalizeDocuments(params.documents).filter(document => matchesFilters(document, params.filters))
  const documentMap = new Map(documents.map(document => [document.id, document]))
  const references = normalizeReferences(params.references).filter((reference) => {
    if (reference.sourceDocumentId === reference.targetDocumentId) {
      return false
    }
    if (!documentMap.has(reference.sourceDocumentId) || !documentMap.has(reference.targetDocumentId)) {
      return false
    }
    return isReferenceInTimeRange(reference.sourceUpdated, params.now, params.timeRange)
  })

  const adjacency = createAdjacency(documents.map(document => document.id))
  const evidenceByDocument: Record<string, NormalizedReference[]> = {}
  const inboundByDocument = new Map<string, NormalizedReference[]>()
  const outboundByDocument = new Map<string, number>()

  for (const reference of references) {
    const inbound = inboundByDocument.get(reference.targetDocumentId) ?? []
    inbound.push(reference)
    inboundByDocument.set(reference.targetDocumentId, inbound)

    outboundByDocument.set(reference.sourceDocumentId, (outboundByDocument.get(reference.sourceDocumentId) ?? 0) + 1)
    adjacency.get(reference.sourceDocumentId)?.add(reference.targetDocumentId)
    adjacency.get(reference.targetDocumentId)?.add(reference.sourceDocumentId)
  }

  for (const [documentId, items] of inboundByDocument) {
    evidenceByDocument[documentId] = [...items].sort((left, right) => compareTimestamp(right.sourceUpdated, left.sourceUpdated))
  }

  const ranking = documents
    .map((document) => {
      const inbound = inboundByDocument.get(document.id) ?? []
      const distinctSourceDocuments = new Set(inbound.map(reference => reference.sourceDocumentId))
      return {
        documentId: document.id,
        title: document.title,
        inboundReferences: inbound.length,
        distinctSourceDocuments: distinctSourceDocuments.size,
        outboundReferences: outboundByDocument.get(document.id) ?? 0,
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

  const orphans = documents
    .filter(document => (degrees.get(document.id) ?? 0) === 0)
    .map(document => ({
      documentId: document.id,
      title: document.title,
      degree: 0,
    }))
    .sort((left, right) => left.documentId.localeCompare(right.documentId))

  return {
    summary: {
      totalDocuments: documents.length,
      analyzedDocuments: documents.length,
      totalReferences: references.length,
      orphanCount: orphans.length,
      communityCount: communities.length,
    },
    ranking,
    communities,
    bridgeDocuments,
    orphans,
    suggestions: buildSuggestions(ranking, orphans, bridgeDocuments),
    evidenceByDocument,
  }
}

export function analyzeTrends(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  days: number
  filters?: AnalyticsFilters
}): TrendReport {
  const documents = normalizeDocuments(params.documents).filter(document => matchesFilters(document, params.filters))
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

  return {
    current: {
      referenceCount: currentReferences.length,
    },
    previous: {
      referenceCount: previousReferences.length,
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
  }
}

export function findReferencePath(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  fromDocumentId: string
  toDocumentId: string
  maxDepth?: number
  filters?: AnalyticsFilters
}): string[] {
  const documents = normalizeDocuments(params.documents).filter(document => matchesFilters(document, params.filters))
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
    const haystack = `${document.title} ${document.hpath} ${document.tags.join(' ')}`.toLowerCase()
    if (!haystack.includes(keyword)) {
      return false
    }
  }
  return true
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
  orphans: BridgeItem[],
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
      reason: '当前分析窗口内没有文档级连接',
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
  const counts = new Map<string, number>()
  for (const reference of references) {
    counts.set(reference.targetDocumentId, (counts.get(reference.targetDocumentId) ?? 0) + 1)
  }
  return counts
}
