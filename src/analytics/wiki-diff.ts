import type { WikiPreviewStatus } from './wiki-page-model'
import type { WikiRenderedSectionMeta } from './wiki-renderer'
import type { WikiPageSnapshotRecord } from './wiki-store'
import { resolveWikiSectionKeyFromHeading } from './wiki-page-model'
import { WIKI_SECTION_MARKER_PREFIX } from './wiki-renderer'
import { t } from '@/i18n/ui'

interface ParsedManagedSection {
  key: string
  heading: string
  markdown: string
}

export interface WikiPagePreviewResult {
  pageType: WikiPageSnapshotRecord['pageType']
  pageTitle: string
  status: WikiPreviewStatus
  affectedSections: string[]
  sourceDocumentCount: number
  lastGeneratedAt: string
  pageFingerprint: string
  managedFingerprint: string
  oldSummary: string
  newSummary: string
  conflictReason?: string
}

export function buildWikiPreview(params: {
  pageType: WikiPageSnapshotRecord['pageType']
  pageTitle: string
  sourceDocumentIds: string[]
  generatedAt: string
  nextDraft: {
    managedMarkdown: string
    fullMarkdown: string
    sectionMetadata: WikiRenderedSectionMeta[]
  }
  existingPage?: {
    managedMarkdown: string
  }
  storedRecord?: WikiPageSnapshotRecord
}): WikiPagePreviewResult {
  const nextManagedFingerprint = fingerprintWikiContent(params.nextDraft.managedMarkdown)
  const nextPageFingerprint = fingerprintWikiContent(params.nextDraft.fullMarkdown || params.nextDraft.managedMarkdown)
  const oldManagedMarkdown = params.existingPage?.managedMarkdown ?? ''
  const oldManagedFingerprint = oldManagedMarkdown
    ? fingerprintWikiContent(oldManagedMarkdown)
    : ''
  const oldSectionMap = parseManagedSectionMap(oldManagedMarkdown)
  const nextSectionKeys = new Set(params.nextDraft.sectionMetadata.map(section => section.key))
  const nextAffectedSections = params.nextDraft.sectionMetadata
    .filter((section) => {
      const previous = oldSectionMap.get(section.key)
      if (!previous) {
        return true
      }
      return previous.heading !== section.heading || previous.markdown !== section.markdown.trim()
    })
    .map(section => section.key)
  const removedSections = [...oldSectionMap.keys()]
    .filter(sectionKey => !nextSectionKeys.has(sectionKey))
  const affectedSections = [...new Set([
    ...nextAffectedSections,
    ...removedSections,
  ])]

  const lastAppliedManagedFingerprint = params.storedRecord?.lastApply?.managedFingerprint ?? ''
  const hasConflict = Boolean(
    params.existingPage
    && lastAppliedManagedFingerprint
    && oldManagedFingerprint
    && oldManagedFingerprint !== lastAppliedManagedFingerprint,
  )

  const status = hasConflict
    ? 'conflict'
    : !params.existingPage
        ? 'create'
        : oldManagedFingerprint === nextManagedFingerprint
            ? 'unchanged'
            : 'update'

  return {
    pageType: params.pageType,
    pageTitle: params.pageTitle,
    status,
    affectedSections: status === 'unchanged' ? [] : affectedSections,
    sourceDocumentCount: params.sourceDocumentIds.length,
    lastGeneratedAt: params.generatedAt,
    pageFingerprint: nextPageFingerprint,
    managedFingerprint: nextManagedFingerprint,
    oldSummary: summarizeMarkdown(oldManagedMarkdown),
    newSummary: summarizeMarkdown(params.nextDraft.managedMarkdown),
    conflictReason: hasConflict
      ? t('analytics.wiki.conflictReasonManagedAreaMismatch')
      : undefined,
  }
}

export function fingerprintWikiContent(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `w${(hash >>> 0).toString(16)}`
}

function summarizeMarkdown(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

function parseManagedSectionMap(markdown: string): Map<string, ParsedManagedSection> {
  const sectionMap = new Map<string, ParsedManagedSection>()
  const sections = parseManagedSections(markdown)

  for (const section of sections) {
    sectionMap.set(section.key, section)
  }

  return sectionMap
}

function parseManagedSections(markdown: string): ParsedManagedSection[] {
  const sections: ParsedManagedSection[] = []
  const lines = markdown.split(/\r?\n/)
  let currentKey = ''
  let currentHeading = ''
  let bodyLines: string[] = []

  const flush = () => {
    if (!currentHeading) {
      return
    }
    sections.push({
      key: normalizeDynamicSectionKey(currentKey || resolveSectionKey(currentHeading)),
      heading: currentHeading,
      markdown: bodyLines.join('\n').trim(),
    })
  }

  for (const line of lines) {
    const markerKey = parseSectionMarker(line)
    if (markerKey) {
      flush()
      currentKey = markerKey
      currentHeading = ''
      bodyLines = []
      continue
    }

    const headingMatch = line.match(/^###\s+(.+)$/)
    if (headingMatch) {
      flush()
      currentHeading = headingMatch[1].trim()
      bodyLines = []
      continue
    }

    if (currentHeading) {
      bodyLines.push(line)
    }
  }

  flush()
  return sections
}

function resolveSectionKey(heading: string): string {
  return resolveWikiSectionKeyFromHeading(heading)
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

function normalizeDynamicSectionKey(key: string): string {
  switch (key) {
    case 'overview':
      return 'intro'
    case 'keyDocuments':
      return 'highlights'
    case 'evidence':
      return 'sources'
    default:
      return key
  }
}
