import { ensureDocumentIndex } from '@/analytics/ai-document-summary'
import type {
  AnalyticsFilters,
  DocumentRecord,
  TimeRange,
} from '@/analytics/analysis'
import type { AiDocumentIndexStore } from '@/analytics/ai-index-store'
import type { WikiPagePreviewResult } from '@/analytics/wiki-diff'
import type { WikiApplyBatchResult } from '@/analytics/wiki-documents'
import { WIKI_SECTION_MARKER_PREFIX } from '@/analytics/wiki-renderer'
import { getWikiHeadingCandidates } from '@/analytics/wiki-page-model'
import type { RenderedWikiDraft } from '@/analytics/wiki-renderer'
import type { WikiScopeSummary } from '@/analytics/wiki-scope'
import type { WikiPageSnapshotRecord } from '@/analytics/wiki-store'
import type { WikiPagePlan, WikiTemplateDiagnosis } from '@/analytics/wiki-template-model'
import { t } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'

type GetIDsByHPathFn = (notebook: string, path: string) => Promise<string[]>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string, subtype?: string }>>

export interface WikiPreviewThemePageItem {
  pageTitle: string
  themeName: string
  themeDocumentId: string
  themeDocumentTitle: string
  themeDocumentBox: string
  themeDocumentHPath: string
  sourceDocumentIds: string[]
  preview: WikiPagePreviewResult
  diagnosis: WikiTemplateDiagnosis
  pagePlan: WikiPagePlan
  draft: RenderedWikiDraft
  affectedSectionHeadings: string[]
  hasManualNotes: boolean
}

export interface WikiPreviewState {
  generatedAt: string
  scope: {
    summary: WikiScopeSummary
    descriptionLines: string[]
  }
  themePages: WikiPreviewThemePageItem[]
  unclassifiedDocuments: Array<{ documentId: string, title: string }>
  excludedWikiDocuments: Array<{ documentId: string, title: string }>
  applyResult?: WikiApplyBatchResult
}

export interface WikiPreviewRequest {
  sourceDocumentIds?: string[]
  scopeDescriptionLine?: string
}

export function deduplicateStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

export async function buildWikiSourceProfileMap(params: {
  sourceDocuments: DocumentRecord[]
  config: PluginConfig
  aiIndexStore: AiDocumentIndexStore | null
  forwardProxy?: (url: string, method?: string, payload?: any, headers?: any[], timeout?: number, contentType?: string) => Promise<IResForwardProxy>
  getChildBlocks?: GetChildBlocksFn
  getBlockKramdown?: GetBlockKramdownFn
  generatedAt: string
}) {
  if (!params.aiIndexStore || !params.forwardProxy || !params.getChildBlocks || !params.getBlockKramdown) {
    throw new Error('Wiki topic bundle requires AI document index dependencies')
  }

  const entries = await Promise.all(params.sourceDocuments.map(async (document) => {
    await ensureDocumentIndex({
      config: params.config,
      sourceDocument: document,
      indexStore: params.aiIndexStore,
      forwardProxy: params.forwardProxy,
      getChildBlocks: params.getChildBlocks,
      getBlockKramdown: params.getBlockKramdown,
      updatedAt: params.generatedAt,
    })

    const profile = document.updated
      ? await params.aiIndexStore.getFreshDocumentProfile(document.id, document.updated)
      : await params.aiIndexStore.getDocumentProfile(document.id)

    if (!profile) {
      throw new Error(`Missing fresh document index profile after ensuring wiki source document: ${document.id}`)
    }

    return [document.id, profile] as const
  }))

  return new Map(entries)
}

export async function resolveExistingWikiPage(params: {
  notebook: string
  pageHPath: string
  storedRecord: WikiPageSnapshotRecord | null
  getIDsByHPath?: GetIDsByHPathFn
  getBlockKramdown: GetBlockKramdownFn
}): Promise<{
  pageId: string
  fullMarkdown: string
  managedMarkdown: string
  hasManualNotes: boolean
} | null> {
  const storedPageId = params.storedRecord?.pageId
  let pageId = storedPageId

  if (!pageId && params.getIDsByHPath) {
    const ids = await params.getIDsByHPath(params.notebook, params.pageHPath)
    pageId = ids[0] ?? ''
  }

  if (!pageId) {
    return null
  }

  try {
    const block = await params.getBlockKramdown(pageId)
    const fullMarkdown = block?.kramdown ?? ''
    return {
      pageId,
      fullMarkdown,
      managedMarkdown: extractManagedMarkdown(fullMarkdown),
      hasManualNotes: getWikiHeadingCandidates('manualNotes', '##')
        .some(heading => fullMarkdown.includes(`\n${heading}`)),
    }
  } catch {
    return null
  }
}

export function buildWikiScopeDescriptionLines(params: {
  timeRange: TimeRange
  filters: AnalyticsFilters
  resolveNotebookName: (notebookId: string) => string
  scopeDescriptionLine?: string
}) {
  return [
    params.scopeDescriptionLine ?? t('analytics.wiki.scopeSourceCurrentDocSample'),
    t('analytics.wiki.timeWindowLine', { value: params.timeRange }),
    t('analytics.wiki.notebookLine', { value: params.filters.notebook ? params.resolveNotebookName(params.filters.notebook) : t('analytics.wiki.allNotebooks') }),
    t('analytics.wiki.tagsLine', { value: params.filters.tags?.length ? params.filters.tags.join(', ') : t('analytics.wiki.allTags') }),
    t('analytics.wiki.topicsLine', { value: params.filters.themeNames?.length ? params.filters.themeNames.join(', ') : t('analytics.wiki.allTopics') }),
    t('analytics.wiki.keywordLine', { value: params.filters.keyword?.trim() || t('analytics.wiki.none') }),
  ]
}

export function resolveWikiScopeDocuments(params: {
  sourceDocumentIds?: string[]
  fallbackDocuments: DocumentRecord[]
  associationDocumentMap: Map<string, DocumentRecord>
  documentMap: Map<string, DocumentRecord>
}): DocumentRecord[] {
  if (!params.sourceDocumentIds?.length) {
    return params.fallbackDocuments
  }

  const documents: DocumentRecord[] = []
  const visited = new Set<string>()

  for (const documentId of params.sourceDocumentIds) {
    const document = params.associationDocumentMap.get(documentId) ?? params.documentMap.get(documentId)
    if (!document || visited.has(document.id)) {
      continue
    }
    documents.push(document)
    visited.add(document.id)
  }

  return documents
}

export function resolveAffectedSectionHeadings(params: {
  preview: WikiPagePreviewResult
  draft: RenderedWikiDraft
  existingManagedMarkdown?: string
}): string[] {
  const sectionHeadingMap = new Map<string, string>()

  for (const [sectionKey, heading] of parseManagedSectionHeadingMap(params.existingManagedMarkdown ?? '')) {
    sectionHeadingMap.set(sectionKey, heading)
  }

  for (const section of params.draft.sectionMetadata) {
    sectionHeadingMap.set(section.key, section.heading)
  }

  return params.preview.affectedSections.map(sectionId => sectionHeadingMap.get(sectionId) ?? resolveWikiSectionDisplayLabel(sectionId))
}

export function resolveWikiSectionOrderLabels(params: {
  pagePlan: WikiPagePlan
  draft: RenderedWikiDraft
}): string[] {
  const sectionHeadingMap = new Map(
    params.draft.sectionMetadata.map(section => [section.key, section.heading] as const),
  )

  return params.pagePlan.sectionOrder.map(sectionId => sectionHeadingMap.get(sectionId) ?? resolveWikiSectionDisplayLabel(sectionId))
}

function extractManagedMarkdown(fullMarkdown: string): string {
  const manualHeadingIndex = getWikiHeadingCandidates('manualNotes', '##')
    .map(heading => fullMarkdown.indexOf(`\n${heading}`))
    .filter(index => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1
  if (manualHeadingIndex < 0) {
    return fullMarkdown.trim()
  }
  return fullMarkdown.slice(0, manualHeadingIndex).trim()
}

function humanizeSectionId(sectionId: string): string {
  return sectionId
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function resolveWikiSectionDisplayLabel(sectionId: string): string {
  switch (sectionId) {
    case 'intro':
      return t('analytics.wikiPage.overviewHeading')
    case 'highlights':
      return t('analytics.wikiPage.keyDocumentsHeading')
    case 'sources':
      return t('analytics.wikiPage.evidenceHeading')
    default:
      return humanizeSectionId(sectionId)
  }
}

function parseManagedSectionHeadingMap(markdown: string): Map<string, string> {
  const headingMap = new Map<string, string>()
  const lines = markdown.split(/\r?\n/)
  let currentKey = ''

  for (const line of lines) {
    const markerKey = parseSectionMarker(line)
    if (markerKey) {
      currentKey = markerKey
      continue
    }

    const headingMatch = line.match(/^###\s+(.+)$/)
    if (headingMatch && currentKey) {
      headingMap.set(currentKey, headingMatch[1].trim())
    }
  }

  return headingMap
}

function parseSectionMarker(line: string): string {
  const trimmed = line.trim()
  if (!trimmed.startsWith(WIKI_SECTION_MARKER_PREFIX) || !trimmed.endsWith('-->')) {
    return ''
  }

  return trimmed
    .slice(WIKI_SECTION_MARKER_PREFIX.length, -3)
    .trim()
}
