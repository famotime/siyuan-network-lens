import type { DocumentRecord } from '@/analytics/analysis'
import { buildLinkAssociations } from '@/analytics/link-associations'
import type { SummaryDetailSection, SummaryDetailItem } from '@/analytics/summary-details'
import { countThemeMatchesForDocument, type ThemeDocument, type ThemeDocumentMatch } from '@/analytics/theme-documents'
import type { TimeRange } from '@/analytics/analysis'
import { normalizeTags } from '@/analytics/document-utils'

export type PathScope = 'focused' | 'all' | 'community'

export function buildTagOptions(documents: DocumentRecord[]): string[] {
  const tagSet = new Set<string>()
  for (const document of documents) {
    for (const tag of normalizeTags(document.tags)) {
      tagSet.add(tag)
    }
  }
  return [...tagSet].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

export function buildOrphanThemeSuggestionMap(params: {
  orphans: Array<{ documentId: string }>
  documentMap: Map<string, DocumentRecord>
  themeDocuments: ThemeDocument[]
}): Map<string, ThemeDocumentMatch[]> {
  const suggestions = new Map<string, ThemeDocumentMatch[]>()

  for (const orphan of params.orphans) {
    const document = params.documentMap.get(orphan.documentId)
    if (!document) {
      continue
    }
    const matches = countThemeMatchesForDocument({
      document,
      themeDocuments: params.themeDocuments,
    })
    if (matches.length) {
      suggestions.set(orphan.documentId, matches)
    }
  }

  return suggestions
}

export function buildOrphanDetailItems(params: {
  selectedSummaryDetail: SummaryDetailSection | null
  orphanThemeSuggestions: Map<string, ThemeDocumentMatch[]>
}): Array<SummaryDetailItem & { themeSuggestions: ThemeDocumentMatch[] }> {
  if (params.selectedSummaryDetail?.key !== 'orphans' || params.selectedSummaryDetail.kind !== 'list') {
    return []
  }

  return params.selectedSummaryDetail.items.map(item => ({
    ...item,
    themeSuggestions: params.orphanThemeSuggestions.get(item.documentId) ?? [],
  }))
}

export function countSelectedSummaryItems(detail: SummaryDetailSection | null): number {
  if (!detail) {
    return 0
  }
  if (detail.kind === 'aiInbox') {
    return detail.result?.items.length ?? 0
  }
  if (detail.kind === 'list') {
    return detail.items.length
  }
  if (detail.kind === 'ranking') {
    return detail.ranking.length
  }
  if (detail.kind === 'propagation') {
    return detail.items.length
  }
  if (detail.kind === 'wikiCards') {
    return detail.pages.length
  }
  return detail.trends.risingDocuments.length + detail.trends.fallingDocuments.length
}

export function buildPathOptions(params: {
  pathScope: PathScope
  filteredDocuments: DocumentRecord[]
  selectedCommunity: { documentIds: string[] } | null
  ranking: Array<{ documentId: string }>
  bridgeDocuments: Array<{ documentId: string }>
  propagationNodes: Array<{ documentId: string }>
  documentMap: Map<string, DocumentRecord>
  resolveTitle: (documentId: string) => string
}): Array<{ id: string, title: string }> {
  const ids = new Set<string>()

  if (params.pathScope === 'all') {
    for (const document of params.filteredDocuments) {
      ids.add(document.id)
    }
  } else if (params.pathScope === 'community') {
    for (const documentId of params.selectedCommunity?.documentIds ?? []) {
      ids.add(documentId)
    }
  } else {
    for (const item of params.ranking) {
      ids.add(item.documentId)
    }
    for (const item of params.bridgeDocuments) {
      ids.add(item.documentId)
    }
    for (const item of params.propagationNodes) {
      ids.add(item.documentId)
    }
  }

  return [...ids]
    .map((id) => {
      const document = params.documentMap.get(id)
      return document
        ? {
            id,
            title: params.resolveTitle(id),
          }
        : null
    })
    .filter((item): item is { id: string, title: string } => item !== null)
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

export function buildLinkAssociationMap(params: {
  references: Array<{
    sourceDocumentId: string
    targetDocumentId: string
    sourceUpdated?: string
  }>
  ranking: Array<{ documentId: string }>
  sampleDocumentMap: Map<string, DocumentRecord>
  associationDocumentMap: Map<string, DocumentRecord>
  now: Date
  timeRange: TimeRange
}): Map<string, ReturnType<typeof buildLinkAssociations>> {
  const map = new Map<string, ReturnType<typeof buildLinkAssociations>>()

  for (const item of params.ranking) {
    map.set(item.documentId, buildLinkAssociations({
      documentId: item.documentId,
      references: params.references,
      documentMap: params.sampleDocumentMap,
      childDocumentMap: params.associationDocumentMap,
      now: params.now,
      timeRange: params.timeRange,
    }))
  }

  return map
}
