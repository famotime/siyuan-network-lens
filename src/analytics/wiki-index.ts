const SIYUAN_BLOCK_URL_PATTERN = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
const BLOCK_REFERENCE_PATTERN = /\(\(\s*([^)\s"']+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)\)/g

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

  const extractTargets = (text: string): Array<{ id: string, label: string }> => {
    const targets: Array<{ id: string, label: string }> = []
    for (const match of text.matchAll(SIYUAN_BLOCK_URL_PATTERN)) {
      targets.push({ id: match[1], label: match[0] })
    }
    for (const match of text.matchAll(BLOCK_REFERENCE_PATTERN)) {
      targets.push({ id: match[1], label: match[0] })
    }
    return targets
  }

  for (const target of extractTargets(params.kramdown)) {
    if (seen.has(target.id)) {
      continue
    }
    seen.add(target.id)
    pages.push({
      documentId: target.id,
      title: target.label,
      themeDocumentTitle: resolveThemeDocumentIdFromTitle(target.label, params.wikiPageSuffix),
    })
  }

  return pages
}
