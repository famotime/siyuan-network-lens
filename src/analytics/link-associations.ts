import type { DocumentRecord, ReferenceRecord, TimeRange } from './analysis'
import { filterReferencesByTimeRange } from './analysis'

export interface LinkAssociationItem {
  documentId: string
  title: string
  direction: 'outbound' | 'inbound' | 'child'
  isOverlap: boolean
}

export interface LinkAssociations {
  outbound: LinkAssociationItem[]
  inbound: LinkAssociationItem[]
  childDocuments: LinkAssociationItem[]
}

export function buildLinkAssociations(params: {
  documentId: string
  references: ReferenceRecord[]
  documentMap: Map<string, DocumentRecord>
  childDocumentMap?: Map<string, DocumentRecord>
  now: Date
  timeRange: TimeRange
}): LinkAssociations {
  const outboundTargets = new Set<string>()
  const inboundSources = new Set<string>()
  const filteredReferences = filterReferencesByTimeRange({
    references: params.references,
    now: params.now,
    timeRange: params.timeRange,
  })

  for (const reference of filteredReferences) {
    if (reference.sourceDocumentId === reference.targetDocumentId) {
      continue
    }
    if (!params.documentMap.has(reference.sourceDocumentId) || !params.documentMap.has(reference.targetDocumentId)) {
      continue
    }
    if (reference.sourceDocumentId === params.documentId) {
      outboundTargets.add(reference.targetDocumentId)
    }
    if (reference.targetDocumentId === params.documentId) {
      inboundSources.add(reference.sourceDocumentId)
    }
  }

  const overlap = new Set<string>([...outboundTargets].filter(documentId => inboundSources.has(documentId)))

  const outbound = buildAssociationList({
    documentIds: outboundTargets,
    documentMap: params.documentMap,
    overlap,
    direction: 'outbound',
  })
  const inbound = buildAssociationList({
    documentIds: inboundSources,
    documentMap: params.documentMap,
    overlap,
    direction: 'inbound',
  })
  const childDocuments = buildChildAssociationList({
    coreDocumentId: params.documentId,
    documentMap: params.childDocumentMap ?? params.documentMap,
    excluded: new Set([...outboundTargets, ...inboundSources]),
  })

  return { outbound, inbound, childDocuments }
}

function buildAssociationList(params: {
  documentIds: Set<string>
  documentMap: Map<string, DocumentRecord>
  overlap: Set<string>
  direction: LinkAssociationItem['direction']
}): LinkAssociationItem[] {
  return [...params.documentIds]
    .map((documentId) => {
      const document = params.documentMap.get(documentId)
      if (!document) {
        return null
      }
      return {
        documentId,
        title: resolveTitle(document),
        direction: params.direction,
        isOverlap: params.overlap.has(documentId),
      }
    })
    .filter((item): item is LinkAssociationItem => item !== null)
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

function resolveTitle(document: DocumentRecord): string {
  return document.title || document.name || document.content || document.hpath || document.id
}

function buildChildAssociationList(params: {
  coreDocumentId: string
  documentMap: Map<string, DocumentRecord>
  excluded: Set<string>
}): LinkAssociationItem[] {
  const coreDocument = params.documentMap.get(params.coreDocumentId)
  if (!coreDocument) {
    return []
  }

  return [...params.documentMap.values()]
    .filter((candidate) => {
      if (candidate.id === params.coreDocumentId) {
        return false
      }
      if (params.excluded.has(candidate.id)) {
        return false
      }
      return isChildDocument(coreDocument, candidate)
    })
    .map(candidate => ({
      documentId: candidate.id,
      title: resolveTitle(candidate),
      direction: 'child' as const,
      isOverlap: false,
    }))
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

function isChildDocument(parent: Partial<DocumentRecord>, candidate: Partial<DocumentRecord>): boolean {
  if (parent.box && candidate.box && parent.box !== candidate.box) {
    return false
  }

  const pathPrefix = toChildPathPrefix(parent.path)
  if (pathPrefix && normalizePath(candidate.path).startsWith(pathPrefix)) {
    return true
  }

  const hierarchyPrefix = toHierarchyPrefix(parent.hpath)
  if (hierarchyPrefix && normalizePath(candidate.hpath).startsWith(hierarchyPrefix)) {
    return true
  }

  return false
}

function toChildPathPrefix(path?: string): string {
  const normalized = normalizePath(path)
  if (!normalized) {
    return ''
  }
  if (normalized.endsWith('.sy')) {
    return `${normalized.slice(0, -3)}/`
  }
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function toHierarchyPrefix(hpath?: string): string {
  const normalized = normalizePath(hpath)
  if (!normalized) {
    return ''
  }
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function normalizePath(value?: string): string {
  return (value ?? '').replace(/\\/g, '/').trim()
}
