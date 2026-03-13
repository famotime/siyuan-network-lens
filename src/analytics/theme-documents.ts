import type { DocumentRecord } from './analysis'
import type { PluginConfig } from '@/types/config'

export interface ThemeDocument {
  documentId: string
  title: string
  themeName: string
  box: string
  path: string
  hpath: string
}

export interface ThemeDocumentMatch {
  themeDocumentId: string
  themeDocumentTitle: string
  themeName: string
  matchCount: number
}

export interface ThemeOption {
  value: string
  label: string
  documentId: string
}

export function collectThemeDocuments(params: {
  documents: DocumentRecord[]
  config: PluginConfig
}): ThemeDocument[] {
  const notebookId = params.config.themeNotebookId.trim()
  const configuredPath = normalizePath(params.config.themeDocumentPath)
  const prefix = params.config.themeNamePrefix.trim()
  const suffix = params.config.themeNameSuffix.trim()

  if (!notebookId || !configuredPath) {
    return []
  }

  const themeDocuments = params.documents
    .filter(document => document.box === notebookId)
    .filter(document => isDocumentInConfiguredPath(document, configuredPath))
    .map((document) => {
      const title = resolveTitle(document)
      if (!matchesAffix(title, prefix, suffix)) {
        return null
      }
      const themeName = stripAffixes(title, prefix, suffix)
      if (!themeName) {
        return null
      }
      return {
        documentId: document.id,
        title,
        themeName,
        box: document.box,
        path: document.path,
        hpath: document.hpath,
      }
    })
    .filter((document): document is ThemeDocument => document !== null)
    .sort((left, right) => {
      return left.themeName.localeCompare(right.themeName, 'zh-CN')
        || left.hpath.localeCompare(right.hpath, 'zh-CN')
        || left.documentId.localeCompare(right.documentId)
    })

  return deduplicateThemeDocuments(themeDocuments)
}

export function buildThemeOptions(themeDocuments: ThemeDocument[]): ThemeOption[] {
  return themeDocuments.map(themeDocument => ({
    value: themeDocument.themeName,
    label: themeDocument.themeName,
    documentId: themeDocument.documentId,
  }))
}

export function countThemeMatchesForDocument(params: {
  document: Pick<DocumentRecord, 'id' | 'path' | 'hpath' | 'title' | 'name' | 'content' | 'tags'>
  themeDocuments: ThemeDocument[]
}): ThemeDocumentMatch[] {
  const fields = buildMatchFields(params.document)

  return params.themeDocuments
    .filter(themeDocument => themeDocument.documentId !== params.document.id)
    .map((themeDocument) => {
      const normalizedTheme = themeDocument.themeName.trim().toLocaleLowerCase()
      const matchCount = fields.reduce((total, field) => total + countOccurrences(field, normalizedTheme), 0)
      if (matchCount <= 0) {
        return null
      }
      return {
        themeDocumentId: themeDocument.documentId,
        themeDocumentTitle: themeDocument.title,
        themeName: themeDocument.themeName,
        matchCount,
      }
    })
    .filter((item): item is ThemeDocumentMatch => item !== null)
    .sort((left, right) => right.matchCount - left.matchCount || left.themeName.localeCompare(right.themeName, 'zh-CN'))
}

export function documentMatchesSelectedThemes(params: {
  document: Pick<DocumentRecord, 'id' | 'path' | 'hpath' | 'title' | 'name' | 'content' | 'tags'>
  selectedThemes: string[]
  themeDocuments?: ThemeDocument[]
}): boolean {
  if (params.selectedThemes.length === 0) {
    return true
  }
  const fields = buildMatchFields(params.document)
  return params.selectedThemes.some((themeName) => {
    const normalizedTheme = themeName.trim().toLocaleLowerCase()
    if (!normalizedTheme) {
      return false
    }
    return fields.some(field => field.includes(normalizedTheme))
  })
}

function deduplicateThemeDocuments(themeDocuments: ThemeDocument[]): ThemeDocument[] {
  const byThemeName = new Map<string, ThemeDocument>()

  for (const themeDocument of themeDocuments) {
    const existing = byThemeName.get(themeDocument.themeName)
    if (!existing) {
      byThemeName.set(themeDocument.themeName, themeDocument)
      continue
    }

    if (themeDocument.hpath.length < existing.hpath.length
      || (themeDocument.hpath.length === existing.hpath.length && themeDocument.hpath.localeCompare(existing.hpath, 'zh-CN') < 0)) {
      byThemeName.set(themeDocument.themeName, themeDocument)
    }
  }

  return [...byThemeName.values()].sort((left, right) => left.themeName.localeCompare(right.themeName, 'zh-CN'))
}

function matchesAffix(title: string, prefix: string, suffix: string): boolean {
  if (prefix && !title.startsWith(prefix)) {
    return false
  }
  if (suffix && !title.endsWith(suffix)) {
    return false
  }
  return true
}

function stripAffixes(title: string, prefix: string, suffix: string): string {
  let value = title
  if (prefix && value.startsWith(prefix)) {
    value = value.slice(prefix.length)
  }
  if (suffix && value.endsWith(suffix)) {
    value = value.slice(0, value.length - suffix.length)
  }
  return value.trim()
}

function isDocumentInConfiguredPath(document: Pick<DocumentRecord, 'path' | 'hpath'>, configuredPath: string): boolean {
  return matchesPathPrefix(normalizePath(document.hpath), configuredPath)
    || matchesPathPrefix(normalizePath(document.path), configuredPath)
}

function matchesPathPrefix(value: string, configuredPath: string): boolean {
  if (!value || !configuredPath) {
    return false
  }
  return value === configuredPath || value.startsWith(`${configuredPath}/`)
}

function normalizePath(value?: string): string {
  if (!value) {
    return ''
  }
  const normalized = value
    .replace(/\\/g, '/')
    .replace(/\.sy$/i, '')
    .trim()
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  if (withLeadingSlash === '/') {
    return withLeadingSlash
  }
  return withLeadingSlash.replace(/\/+$/, '')
}

function buildMatchFields(document: Pick<DocumentRecord, 'path' | 'hpath' | 'title' | 'name' | 'content' | 'tags'>): string[] {
  const tags = Array.isArray(document.tags)
    ? document.tags
    : typeof document.tags === 'string'
      ? document.tags.split(/[,\s#]+/)
      : []

  return [
    resolveTitle(document),
    document.hpath ?? '',
    document.path ?? '',
    tags.join(' '),
  ].map(value => value.toLocaleLowerCase())
}

function countOccurrences(haystack: string, needle: string): number {
  if (!haystack || !needle) {
    return 0
  }

  let count = 0
  let index = haystack.indexOf(needle)

  while (index >= 0) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }

  return count
}

function resolveTitle(document: Pick<DocumentRecord, 'id' | 'title' | 'name' | 'content' | 'hpath'>): string {
  return document.title || document.name || document.content || document.hpath || document.id
}
