import type { DocumentRecord } from './analysis'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import type { PluginConfig } from '@/types/config'

export type ReadMarkerConfig = Pick<PluginConfig, 'readTagNames' | 'readTitlePrefixes' | 'readTitleSuffixes' | 'readPaths'>
export type ReadCardMode = 'read' | 'unread'
export interface ReadNotebookOption {
  id: string
  name: string
}

export interface ReadMatchItem {
  documentId: string
  title: string
  matchedTags: string[]
  matchedPrefixes: string[]
  matchedSuffixes: string[]
  matchedPaths: string[]
}

export function collectReadMatches(params: {
  documents: DocumentRecord[]
  notebooks?: ReadNotebookOption[]
  config?: ReadMarkerConfig | null
}): ReadMatchItem[] {
  const config = params.config
  const tagNames = normalizeSelectedTags(config?.readTagNames)
  const prefixes = normalizeTitleRules(config?.readTitlePrefixes)
  const suffixes = normalizeTitleRules(config?.readTitleSuffixes)
  const paths = normalizeReadPaths(config?.readPaths)
  const notebookNameById = new Map((params.notebooks ?? []).map(notebook => [notebook.id, notebook.name]))

  if (tagNames.length === 0 && prefixes.length === 0 && suffixes.length === 0 && paths.length === 0) {
    return []
  }

  const selectedTags = new Set(tagNames)

  return params.documents
    .map((document) => {
      const title = resolveDocumentTitle(document)
      const matchedTags = normalizeTags(document.tags).filter(tag => selectedTags.has(tag))
      const matchedPrefixes = prefixes.filter(prefix => title.startsWith(prefix))
      const matchedSuffixes = suffixes.filter(suffix => title.endsWith(suffix))
      const matchedPaths = paths.filter(path => matchesReadPath(document, path, notebookNameById.get(document.box)))

      if (matchedTags.length === 0 && matchedPrefixes.length === 0 && matchedSuffixes.length === 0 && matchedPaths.length === 0) {
        return null
      }

      return {
        documentId: document.id,
        title,
        matchedTags,
        matchedPrefixes,
        matchedSuffixes,
        matchedPaths,
      }
    })
    .filter((item): item is ReadMatchItem => item !== null)
    .sort((left, right) => left.documentId.localeCompare(right.documentId))
}

export function normalizeTitleRules(value?: string): string[] {
  if (!value) {
    return []
  }

  return value
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeSelectedTags(tags?: readonly string[]): string[] {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .map(tag => tag.trim())
    .filter(Boolean)
}

function normalizeReadPaths(value?: string): string[] {
  return normalizeTitleRules(value).map((item) => {
    return normalizePath(item)
  }).filter(Boolean)
}

function matchesReadPath(
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>,
  readPath: string,
  notebookName?: string,
): boolean {
  const candidates = buildReadPathCandidates(document, notebookName)
  return candidates.some(candidate => matchesPathPrefix(candidate, readPath))
}

function buildReadPathCandidates(
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>,
  notebookName?: string,
): string[] {
  const candidates = new Set<string>()
  const normalizedPath = normalizePath(document.path)
  const normalizedHpath = normalizePath(document.hpath)

  if (normalizedPath) {
    candidates.add(normalizedPath)
  }
  if (normalizedHpath) {
    candidates.add(normalizedHpath)
  }

  const notebookPrefix = normalizeNotebookPrefix(notebookName ?? document.box)
  if (notebookPrefix) {
    if (normalizedPath) {
      candidates.add(joinNotebookPath(notebookPrefix, normalizedPath))
    }
    if (normalizedHpath) {
      candidates.add(joinNotebookPath(notebookPrefix, normalizedHpath))
    }
  }

  return [...candidates]
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

function normalizeNotebookPrefix(value?: string): string {
  if (!value) {
    return ''
  }

  const normalized = value
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

  return normalized ? `/${normalized}` : ''
}

function joinNotebookPath(notebookPrefix: string, path: string): string {
  if (!path || path === '/') {
    return notebookPrefix
  }
  return `${notebookPrefix}${path}`
}

function matchesPathPrefix(value: string, readPath: string): boolean {
  if (!value || !readPath) {
    return false
  }

  return value === readPath || value.startsWith(`${readPath}/`)
}
