const SIYUAN_BLOCK_URL_PATTERN = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
const MARKDOWN_LINK_WITH_BLOCK_PATTERN = /\[([^\]]+)\]\(\s*siyuan:\/\/blocks\/([^?\s<>"')\]#]+)(?:\s+"[^"]*")?\s*\)/gi
const BLOCK_REFERENCE_PATTERN = /\(\(\s*([^)\s"']+)(?:\s+"([^"]*)")?\s*\)\)/g

export interface WikiMaintenanceState {
  status: 'idle' | 'reviewing' | 'suggestions-ready' | 'applying'
  suggestions?: WikiMaintenanceSuggestion[]
  diffPreview?: string
}

export interface WikiMaintenanceSuggestion {
  type: 'broken-link' | 'outdated-section' | 'missing-reference'
  description: string
  sectionHeading?: string
}

export interface WikiIndexPage {
  documentId: DocumentId
  title: string
  themeDocumentTitle?: string
  summary?: string
  maintenanceState?: WikiMaintenanceState
}

export interface WikiChatScope {
  mode: 'topic' | 'document'
  targetPage?: WikiIndexPage
}

export function resolveThemeDocumentIdFromTitle(
  wikiPageTitle: string,
  wikiPageSuffix: string,
): string {
  if (!wikiPageTitle) {
    return ''
  }
  if (wikiPageSuffix && wikiPageTitle.endsWith(wikiPageSuffix)) {
    return wikiPageTitle.slice(0, -wikiPageSuffix.length)
  }
  return wikiPageTitle
}

export function parseWikiIndexPages(params: {
  kramdown: string
  wikiPageSuffix: string
}): WikiIndexPage[] {
  if (!params.kramdown) {
    return []
  }

  const seen = new Set<string>()
  const pages: WikiIndexPage[] = []

  for (const match of params.kramdown.matchAll(MARKDOWN_LINK_WITH_BLOCK_PATTERN)) {
    const id = match[2]
    const title = match[1].trim()
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    pages.push({
      documentId: id,
      title,
      themeDocumentTitle: resolveThemeDocumentIdFromTitle(title, params.wikiPageSuffix),
    })
  }

  for (const match of params.kramdown.matchAll(BLOCK_REFERENCE_PATTERN)) {
    const id = match[1]
    const title = match[2]?.trim() || id
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    pages.push({
      documentId: id,
      title,
      themeDocumentTitle: resolveThemeDocumentIdFromTitle(title, params.wikiPageSuffix),
    })
  }

  for (const match of params.kramdown.matchAll(SIYUAN_BLOCK_URL_PATTERN)) {
    const id = match[1]
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    pages.push({
      documentId: id,
      title: id,
      themeDocumentTitle: resolveThemeDocumentIdFromTitle(id, params.wikiPageSuffix),
    })
  }

  return pages
}
