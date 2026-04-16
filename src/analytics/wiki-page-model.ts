export const WIKI_PAGE_TYPES = ['theme', 'index', 'log'] as const
export type WikiPageType = typeof WIKI_PAGE_TYPES[number]

export const WIKI_SECTION_KEYS = [
  'meta',
  'overview',
  'keyDocuments',
  'structureObservations',
  'evidence',
  'actions',
  'manualNotes',
] as const
export type WikiSectionKey = typeof WIKI_SECTION_KEYS[number]

export const WIKI_PREVIEW_STATUSES = ['create', 'update', 'unchanged', 'conflict'] as const
export type WikiPreviewStatus = typeof WIKI_PREVIEW_STATUSES[number]

export const WIKI_APPLY_RESULTS = ['created', 'updated', 'skipped', 'conflict'] as const
export type WikiApplyResult = typeof WIKI_APPLY_RESULTS[number]

import { pickUiText } from '@/i18n/ui'

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export const WIKI_PAGE_HEADING_VARIANTS = {
  managedRoot: ['AI managed area', 'AI 管理区'],
  manualNotes: ['Manual notes', '人工备注'],
  meta: ['Page meta', '页面头信息'],
  overview: ['Topic overview', '主题概览'],
  keyDocuments: ['Key documents', '关键文档'],
  structureObservations: ['Structure observations', '结构观察'],
  evidence: ['Relationship evidence', '关系证据'],
  actions: ['Cleanup actions', '整理动作'],
} as const satisfies Record<WikiSectionKey | 'managedRoot', readonly [string, string]>

export const WIKI_PAGE_HEADINGS: Record<WikiSectionKey | 'managedRoot', string> = Object.fromEntries(
  Object.entries(WIKI_PAGE_HEADING_VARIANTS).map(([key, [en_US, zh_CN]]) => [
    key,
    uiText(en_US, zh_CN),
  ]),
) as Record<WikiSectionKey | 'managedRoot', string>

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
  key: WikiSectionKey | 'managedRoot',
  level?: '##' | '###',
): string[] {
  const prefix = level ? `${level} ` : ''
  return WIKI_PAGE_HEADING_VARIANTS[key].map(heading => `${prefix}${heading}`)
}

export function matchesWikiHeading(
  value: string,
  key: WikiSectionKey | 'managedRoot',
  level?: '##' | '###',
): boolean {
  return getWikiHeadingCandidates(key, level).some(heading => value.startsWith(heading))
}

export function resolveWikiSectionKeyFromHeading(heading: string): WikiSectionKey | string {
  for (const key of WIKI_SECTION_KEYS) {
    if (WIKI_PAGE_HEADING_VARIANTS[key].includes(heading as any)) {
      return key
    }
  }

  return heading
}

function normalizeWikiSuffix(value: string): string {
  return value.trim()
}
