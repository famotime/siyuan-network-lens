import {
  compareSiyuanTimestamps as compareTimestamp,
} from './document-utils'
import {
  buildAdjacencyFromReferences,
  buildConnectionDifference,
  buildConnectionEdgeMap,
  buildGraphAnalysisContext,
  buildTrendAnalysisContext,
  collectTopTags,
  countByTarget,
  countUniqueDirectedEdges,
  createAdjacency,
  diffDays,
  excludeWikiDocuments,
  filterDocumentsByTimeRange,
  isReferenceInTimeRange,
  isTopicPageCandidate,
  latestTimestamp,
  matchesFilters,
  normalizeDocuments,
  normalizeReferences,
  resolveDocumentTimestamp,
  sortOrphans,
  type NormalizedDocument,
  type NormalizedReference,
} from './analysis-context'

export type TimeRange = '3d' | '7d' | '30d' | '60d' | '90d' | 'all'

export const TIME_RANGE_OPTIONS: TimeRange[] = ['all', '3d', '7d', '30d', '60d', '90d']
export { filterDocumentsByTimeRange } from './analysis-context'

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
  alias?: string
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
  tags?: string[]
  keyword?: string
  themeNames?: string[]
}

export type OrphanSort = 'updated-desc' | 'created-desc' | 'title-asc'

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

export function analyzeReferenceGraph(params: {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  now: Date
  timeRange: TimeRange
  filters?: AnalyticsFilters
  orphanSort?: OrphanSort
  dormantDays?: number
  wikiPageSuffix?: string
  excludedPaths?: string
  excludedNamePrefixes?: string
  excludedNameSuffixes?: string
  notebooks?: Array<{ id: string, name: string }>
}): ReferenceGraphReport {
  const {
    documents,
    documentMap,
    allReferences,
    references,
    adjacency,
    allTouchesByDocument,
    historicalConnectionsByDocument,
  } = buildGraphAnalysisContext({
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
  const evidenceByDocument: Record<string, NormalizedReference[]> = {}
  const inboundByDocument = new Map<string, NormalizedReference[]>()
  const inboundSourcesByDocument = new Map<string, Set<string>>()
  const outboundTargetsByDocument = new Map<string, Set<string>>()
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
        inboundReferences: inbound.length,
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
  wikiPageSuffix?: string
  excludedPaths?: string
  excludedNamePrefixes?: string
  excludedNameSuffixes?: string
  notebooks?: Array<{ id: string, name: string }>
}): TrendReport {
  const {
    documents,
    documentMap,
    references,
    currentReferences,
    previousReferences,
  } = buildTrendAnalysisContext({
    documents: params.documents,
    references: params.references,
    now: params.now,
    days: params.days,
    timeRange: params.timeRange,
    filters: params.filters,
    wikiPageSuffix: params.wikiPageSuffix,
    excludedPaths: params.excludedPaths,
    excludedNamePrefixes: params.excludedNamePrefixes,
    excludedNameSuffixes: params.excludedNameSuffixes,
    notebooks: params.notebooks,
  })

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
  wikiPageSuffix?: string
}): string[] {
  const documentRecords = params.now && params.timeRange
    ? filterDocumentsByTimeRange({
        documents: params.documents,
        references: params.references,
        now: params.now,
        timeRange: params.timeRange,
        filters: params.filters,
        wikiPageSuffix: params.wikiPageSuffix,
      })
    : excludeWikiDocuments(params.documents, params.wikiPageSuffix).filter((document) => {
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
        : '当前没有文档级连接',
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
