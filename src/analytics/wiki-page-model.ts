export const WIKI_PAGE_TYPES = ['theme', 'index', 'log'] as const
export type WikiPageType = typeof WIKI_PAGE_TYPES[number]

export const WIKI_PREVIEW_STATUSES = ['create', 'update', 'unchanged', 'conflict'] as const
export type WikiPreviewStatus = typeof WIKI_PREVIEW_STATUSES[number]

export const WIKI_APPLY_RESULTS = ['created', 'updated', 'skipped', 'conflict'] as const
export type WikiApplyResult = typeof WIKI_APPLY_RESULTS[number]

import { t } from '@/i18n/ui'

export const WIKI_PAGE_HEADING_KEYS = ['managedRoot', 'manualNotes'] as const
export type WikiPageHeadingKey = typeof WIKI_PAGE_HEADING_KEYS[number]

type WikiHistoricalHeadingKey =
  | WikiPageHeadingKey
  | 'meta'
  | 'overview'
  | 'keyDocuments'
  | 'structureObservations'
  | 'evidence'
  | 'actions'

const WIKI_PAGE_HEADING_VARIANTS = {
  managedRoot: ['AI managed area', 'AI 管理区'],
  manualNotes: ['Manual notes', '人工备注'],
  meta: ['Page meta', '页面头信息'],
  overview: ['Topic overview', '主题概览'],
  keyDocuments: ['Key documents', '关键文档'],
  structureObservations: ['Structure observations', '结构观察'],
  evidence: ['Relationship evidence', '关系证据'],
  actions: ['Cleanup actions', '整理动作'],
} as const satisfies Record<WikiHistoricalHeadingKey, readonly [string, string]>

export const WIKI_PAGE_HEADINGS: Record<WikiPageHeadingKey, string> = {
  managedRoot: t('analytics.wikiPage.managedRootHeading'),
  manualNotes: t('wikiMaintain.manualNotes'),
}

export const WIKI_BLOCK_ATTR_KEYS = {
  pageType: 'custom-network-lens-wiki-page-type',
  region: 'custom-network-lens-wiki-region',
  section: 'custom-network-lens-wiki-section',
  themeDocumentId: 'custom-network-lens-wiki-theme-document-id',
} as const

export interface WikiPreviewRecord {
  generatedAt: string
  status: WikiPreviewStatus
  sourceDocumentIds: string[]
  pageFingerprint?: string
  managedFingerprint?: string
}

export interface WikiApplyRecord {
  appliedAt: string
  result: WikiApplyResult
  sourceDocumentIds: string[]
  pageFingerprint?: string
  managedFingerprint?: string
}

export function buildThemeWikiPageTitle(themeTitle: string, suffix: string): string {
  const normalizedTitle = themeTitle.trim()
  const normalizedSuffix = normalizeWikiSuffix(suffix)

  if (!normalizedTitle || !normalizedSuffix) {
    return normalizedTitle
  }
  if (normalizedTitle.endsWith(normalizedSuffix)) {
    return normalizedTitle
  }
  return `${normalizedTitle}${normalizedSuffix}`
}

export function isWikiDocumentTitle(title: string, suffix: string): boolean {
  const normalizedTitle = title.trim()
  const normalizedSuffix = normalizeWikiSuffix(suffix)

  return Boolean(normalizedTitle && normalizedSuffix && normalizedTitle.endsWith(normalizedSuffix))
}

export function getWikiHeadingCandidates(
  key: WikiHistoricalHeadingKey,
  level?: '##' | '###',
): string[] {
  const prefix = level ? `${level} ` : ''
  return WIKI_PAGE_HEADING_VARIANTS[key].map(heading => `${prefix}${heading}`)
}

export function matchesWikiHeading(
  value: string,
  key: WikiHistoricalHeadingKey,
  level?: '##' | '###',
): boolean {
  return getWikiHeadingCandidates(key, level).some(heading => value.startsWith(heading))
}

export function findHeadingIndex(
  fullMarkdown: string,
  key: WikiHistoricalHeadingKey,
  level?: '##' | '###',
): number {
  const candidates = getWikiHeadingCandidates(key, level)

  // Exact match (fast path).
  const exactIndex = candidates
    .map(heading => fullMarkdown.indexOf(`\n${heading}`))
    .filter(index => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1
  if (exactIndex >= 0) {
    return exactIndex
  }

  // IAL-aware fallback: heading with optional trailing {: ... } attributes.
  for (const heading of candidates) {
    const pattern = new RegExp(`\n${escapeRegExp(heading)}\\s*(\\{:[^}]*\\})?`)
    const match = pattern.exec(fullMarkdown)
    if (match) {
      return match.index
    }
  }

  return -1
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function resolveWikiSectionKeyFromHeading(heading: string): string {
  for (const key of [
    ...WIKI_PAGE_HEADING_KEYS,
    'meta',
    'overview',
    'keyDocuments',
    'structureObservations',
    'evidence',
    'actions',
  ] as WikiHistoricalHeadingKey[]) {
    if (WIKI_PAGE_HEADING_VARIANTS[key].includes(heading as any)) {
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
  }

  return heading
}

function normalizeWikiSuffix(value: string): string {
  return value.trim()
}
