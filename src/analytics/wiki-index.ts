const SIYUAN_BLOCK_URL_PATTERN = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
const MARKDOWN_LINK_WITH_BLOCK_PATTERN = /\[([^\]]+)\]\(\s*siyuan:\/\/blocks\/([^?\s<>"')\]#]+)(?:\s+"[^"]*")?\s*\)/gi
const BLOCK_REFERENCE_PATTERN = /\(\(\s*([^)\s"']+)(?:\s+"([^"]*)")?\s*\)\)/g
const SUMMARY_LINE_PATTERN = /^\s*-\s*(?:摘要|Summary)\s*[：:]\s*(.+)\s*$/i

export interface WikiMaintenanceState {
  status: 'idle' | 'reviewing' | 'suggestions-ready' | 'applying'
  suggestions?: WikiMaintenanceSuggestion[]
  currentMarkdown?: string
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
  inboundReferences?: number
  outboundReferences?: number
  childDocumentCount?: number
  createdAt?: string
  updatedAt?: string
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
    if (params.wikiPageSuffix && !title.endsWith(params.wikiPageSuffix)) {
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
    if (params.wikiPageSuffix && !title.endsWith(params.wikiPageSuffix)) {
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
    if (params.wikiPageSuffix && !id.endsWith(params.wikiPageSuffix)) {
      continue
    }
    seen.add(id)
    pages.push({
      documentId: id,
      title: id,
      themeDocumentTitle: resolveThemeDocumentIdFromTitle(id, params.wikiPageSuffix),
    })
  }

  attachPageSummariesFromIndexMarkdown(params.kramdown, pages)

  return pages
}

function attachPageSummariesFromIndexMarkdown(kramdown: string, pages: WikiIndexPage[]) {
  if (!pages.length) {
    return
  }

  const pageById = new Map(pages.map(page => [page.documentId, page]))
  const lines = kramdown.split(/\r?\n/)
  let currentPage: WikiIndexPage | undefined

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const pageMatch = line.match(/^\s*-\s*\[(.+?)\]\(\s*siyuan:\/\/blocks\/([^?\s<>"')\]#]+)(?:\s+"[^"]*")?\s*\)/)
    if (pageMatch) {
      currentPage = pageById.get(pageMatch[2])
      continue
    }

    if (!currentPage) {
      continue
    }

    const summaryMatch = line.match(SUMMARY_LINE_PATTERN)
    if (summaryMatch) {
      const summary = summaryMatch[1]?.trim()
      if (summary) {
        currentPage.summary = summary
      }
      continue
    }

    if (/^\s*-\s+/.test(line) && !/^\s{2,}-\s+/.test(rawLine)) {
      currentPage = undefined
    }
  }
}
