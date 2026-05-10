export const WIKI_SOURCE_DOC_LINK_TYPE_PRIORITY = ['inbound', 'outbound', 'child'] as const

export type WikiSourceDocLinkType = typeof WIKI_SOURCE_DOC_LINK_TYPE_PRIORITY[number]

export interface WikiSourceDocumentEntry {
  documentId: string
  title: string
  linkTypes: WikiSourceDocLinkType[]
}

export function normalizeWikiSourceDocLinkTypes(
  values: Iterable<WikiSourceDocLinkType> | null | undefined,
): WikiSourceDocLinkType[] {
  const seen = new Set<string>()

  for (const value of values ?? []) {
    if (typeof value === 'string') {
      seen.add(value)
    }
  }

  return WIKI_SOURCE_DOC_LINK_TYPE_PRIORITY.filter(value => seen.has(value))
}

export function resolvePrimaryWikiSourceDocLinkType(
  values: Iterable<WikiSourceDocLinkType> | null | undefined,
): WikiSourceDocLinkType {
  return normalizeWikiSourceDocLinkTypes(values)[0] ?? 'outbound'
}

export function normalizeWikiSourceDocumentEntries(value: unknown): WikiSourceDocumentEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null
      }

      const documentId = typeof item.documentId === 'string' ? item.documentId.trim() : ''
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const linkTypes = normalizeWikiSourceDocLinkTypes(
        Array.isArray(item.linkTypes)
          ? item.linkTypes as WikiSourceDocLinkType[]
          : (typeof item.linkType === 'string' ? [item.linkType as WikiSourceDocLinkType] : []),
      )

      if (!documentId) {
        return null
      }

      return {
        documentId,
        title: title || documentId,
        linkTypes,
      } satisfies WikiSourceDocumentEntry
    })
    .filter((item): item is WikiSourceDocumentEntry => item !== null)
}
