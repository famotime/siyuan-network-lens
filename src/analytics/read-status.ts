import type { DocumentRecord } from './analysis'
import { matchesScopedPath, normalizeScopedPaths } from './document-paths'
import { normalizeTags, normalizeTitleRules, resolveDocumentTitle } from './document-utils'
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

function normalizeSelectedTags(tags?: readonly string[]): string[] {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .map(tag => tag.trim())
    .filter(Boolean)
}

function normalizeReadPaths(value?: string): string[] {
  return normalizeScopedPaths(value)
}

function matchesReadPath(
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>,
  readPath: string,
  notebookName?: string,
): boolean {
  return matchesScopedPath({
    document,
    configuredPath: readPath,
    notebookName,
  })
}
