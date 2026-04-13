import type { DocumentRecord } from './analysis'
import { matchesAnyScopedPath, normalizeDocumentPath, normalizeScopedPaths, splitDelimitedInput, type NotebookPathOption } from './document-paths'
import { normalizeTags, resolveDocumentTitle as resolveTitle } from './document-utils'
import { isWikiDocumentTitle } from './wiki-page-model'
import type { PluginConfig } from '@/types/config'

export interface ThemeDocument {
  documentId: string
  title: string
  themeName: string
  matchTerms: string[]
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
  notebooks?: NotebookPathOption[]
}): ThemeDocument[] {
  const configuredPaths = normalizeThemePaths(params.config)
  const prefix = params.config.themeNamePrefix.trim()
  const suffix = params.config.themeNameSuffix.trim()
  const wikiPageSuffix = params.config.wikiPageSuffix?.trim() ?? ''
  const notebookNameById = new Map((params.notebooks ?? []).map(notebook => [notebook.id, notebook.name]))

  if (configuredPaths.length === 0) {
    return []
  }

  const themeDocuments = params.documents
    .map((document) => {
      const matchedPathIndex = findMatchedPathIndex(document, configuredPaths, notebookNameById.get(document.box))
      if (matchedPathIndex < 0) {
        return null
      }
      return {
        document,
        matchedPathIndex,
      }
    })
    .filter((item): item is { document: DocumentRecord, matchedPathIndex: number } => item !== null)
    .map((document) => {
      const title = resolveTitle(document.document)
      if (isWikiDocumentTitle(title, wikiPageSuffix)) {
        return null
      }
      if (!matchesAffix(title, prefix, suffix)) {
        return null
      }
      const themeName = stripAffixes(title, prefix, suffix)
      if (!themeName) {
        return null
      }
      const matchTerms = buildThemeMatchTerms(themeName, document.document.name, document.document.alias)
      return {
        documentId: document.document.id,
        title,
        themeName,
        matchTerms,
        box: document.document.box,
        path: document.document.path,
        hpath: document.document.hpath,
        matchedPathIndex: document.matchedPathIndex,
      }
    })
    .filter((document): document is ThemeDocument & { matchedPathIndex: number } => document !== null)
    .sort((left, right) => {
      return left.themeName.localeCompare(right.themeName, 'zh-CN')
        || left.matchedPathIndex - right.matchedPathIndex
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
  document: Pick<DocumentRecord, 'id' | 'path' | 'hpath' | 'title' | 'name' | 'alias' | 'content' | 'tags'>
  themeDocuments: ThemeDocument[]
}): ThemeDocumentMatch[] {
  const fields = buildMatchFields(params.document, { includeContent: true })

  return params.themeDocuments
    .filter(themeDocument => themeDocument.documentId !== params.document.id)
    .map((themeDocument) => {
      const matchCount = themeDocument.matchTerms.reduce((total, term) => {
        const normalizedTerm = term.trim().toLocaleLowerCase()
        if (!normalizedTerm) {
          return total
        }
        return total + fields.reduce((fieldTotal, field) => fieldTotal + countOccurrences(field, normalizedTerm), 0)
      }, 0)
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
  document: Pick<DocumentRecord, 'id' | 'path' | 'hpath' | 'title' | 'name' | 'alias' | 'content' | 'tags'>
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

function deduplicateThemeDocuments(themeDocuments: Array<ThemeDocument & { matchedPathIndex: number }>): ThemeDocument[] {
  const byThemeName = new Map<string, ThemeDocument>()

  for (const themeDocument of themeDocuments) {
    const existing = byThemeName.get(themeDocument.themeName)
    if (!existing) {
      byThemeName.set(themeDocument.themeName, stripMatchedPathIndex(themeDocument))
      continue
    }

    if (themeDocument.hpath.length < existing.hpath.length
      || (themeDocument.hpath.length === existing.hpath.length && themeDocument.hpath.localeCompare(existing.hpath, 'zh-CN') < 0)) {
      byThemeName.set(themeDocument.themeName, stripMatchedPathIndex(themeDocument))
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

function isDocumentInConfiguredPaths(
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>,
  configuredPaths: string[],
  notebookName?: string,
): boolean {
  return matchesAnyScopedPath({
    document,
    configuredPaths,
    notebookName,
  })
}

function findMatchedPathIndex(
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>,
  configuredPaths: string[],
  notebookName?: string,
): number {
  return configuredPaths.findIndex(configuredPath => matchesAnyScopedPath({
    document,
    configuredPaths: [configuredPath],
    notebookName,
  }))
}

function normalizeThemePaths(config: PluginConfig): string[] {
  const rawPaths = splitDelimitedInput(config.themeDocumentPath)
  const legacyNotebookId = config.themeNotebookId?.trim() ?? ''
  if (rawPaths.length === 1 && legacyNotebookId && rawPaths[0].split('/').filter(Boolean).length < 2) {
    const legacyPath = normalizeDocumentPath(rawPaths[0])
    return legacyPath ? [`/${legacyNotebookId}${legacyPath}`] : []
  }

  const configuredPaths = normalizeScopedPaths(config.themeDocumentPath)
  if (configuredPaths.length > 0) {
    return configuredPaths
  }
  return []
}

function stripMatchedPathIndex(document: ThemeDocument & { matchedPathIndex: number }): ThemeDocument {
  const { matchedPathIndex: _matchedPathIndex, ...themeDocument } = document
  return themeDocument
}

function buildMatchFields(
  document: Pick<DocumentRecord, 'path' | 'hpath' | 'title' | 'name' | 'alias' | 'content' | 'tags'>,
  options?: { includeContent?: boolean },
): string[] {
  const tags = normalizeTags(document.tags)

  const fields = [
    resolveTitle(document),
    document.hpath ?? '',
    document.path ?? '',
    tags.join(' '),
  ]

  if (options?.includeContent) {
    fields.push(document.content ?? '')
  }

  return fields.map(value => value.toLocaleLowerCase())
}

function buildThemeMatchTerms(themeName: string, name?: string, alias?: string): string[] {
  return [...new Set([
    themeName.trim(),
    (name ?? '').trim(),
    ...parseAliases(alias),
  ].filter(Boolean))]
}

function parseAliases(alias?: string): string[] {
  if (!alias) {
    return []
  }

  return alias
    .split(/[\r\n,，;；、|]+/)
    .map(item => item.trim())
    .filter(Boolean)
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
