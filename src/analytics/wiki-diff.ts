import type { WikiPreviewStatus } from './wiki-page-model'
import type { WikiRenderedSectionMeta } from './wiki-renderer'
import type { WikiPageSnapshotRecord } from './wiki-store'
import { resolveWikiSectionKeyFromHeading } from './wiki-page-model'
import { t } from '@/i18n/ui'

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
  const affectedSections = params.nextDraft.sectionMetadata
    .filter(section => oldSectionMap.get(section.key) !== section.markdown.trim())
    .map(section => section.key)

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

function parseManagedSectionMap(markdown: string): Map<string, string> {
  const sectionMap = new Map<string, string>()
  const sectionPattern = /^###\s+(.+)$/gm
  const matches = [...markdown.matchAll(sectionPattern)]

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const next = matches[index + 1]
    const heading = current[1].trim()
    const start = (current.index ?? 0) + current[0].length
    const end = next?.index ?? markdown.length
    const body = markdown.slice(start, end).trim()
    sectionMap.set(resolveSectionKey(heading), body)
  }

  return sectionMap
}

function resolveSectionKey(heading: string): string {
  return resolveWikiSectionKeyFromHeading(heading)
}
