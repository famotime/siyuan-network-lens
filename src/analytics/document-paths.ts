import type { DocumentRecord } from './analysis'

export interface NotebookPathOption {
  id: string
  name: string
}

export function splitDelimitedInput(value?: string): string[] {
  if (!value) {
    return []
  }

  return value
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
}

export function normalizeDocumentPath(value?: string): string {
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

export function normalizeScopedPaths(value?: string): string[] {
  return splitDelimitedInput(value)
    .map(item => normalizeDocumentPath(item))
    .filter(Boolean)
}

export function matchesAnyScopedPath(params: {
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>
  configuredPaths: string[]
  notebookName?: string
}): boolean {
  return params.configuredPaths.some(path => matchesScopedPath({
    document: params.document,
    configuredPath: path,
    notebookName: params.notebookName,
  }))
}

export function matchesScopedPath(params: {
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>
  configuredPath: string
  notebookName?: string
}): boolean {
  const configuredPath = normalizeDocumentPath(params.configuredPath)
  if (!configuredPath) {
    return false
  }

  return buildDocumentPathCandidates(params.document, params.notebookName)
    .some(candidate => matchesPathPrefix(candidate, configuredPath))
}

export function buildDocumentPathCandidates(
  document: Pick<DocumentRecord, 'box' | 'path' | 'hpath'>,
  notebookName?: string,
): string[] {
  const candidates = new Set<string>()
  const normalizedPath = normalizeDocumentPath(document.path)
  const normalizedHPath = normalizeDocumentPath(document.hpath)

  if (normalizedPath) {
    candidates.add(normalizedPath)
  }
  if (normalizedHPath) {
    candidates.add(normalizedHPath)
  }

  for (const prefix of buildNotebookPrefixes(document.box, notebookName)) {
    if (normalizedPath) {
      candidates.add(joinNotebookPath(prefix, normalizedPath))
    }
    if (normalizedHPath) {
      candidates.add(joinNotebookPath(prefix, normalizedHPath))
    }
  }

  return [...candidates]
}

export function resolveScopedPathTarget(
  value: string,
  notebooks?: NotebookPathOption[],
): { notebook: string, path: string } | null {
  const firstPath = splitDelimitedInput(value)[0] ?? ''
  const normalized = normalizeDocumentPath(firstPath)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length < 2) {
    return null
  }

  const notebookKey = segments[0]
  const path = `/${segments.slice(1).join('/')}`
  const matchedNotebook = notebooks?.find(notebook => notebook.id === notebookKey || notebook.name === notebookKey)

  return {
    notebook: matchedNotebook?.id ?? notebookKey,
    path,
  }
}

function buildNotebookPrefixes(documentBox?: string, notebookName?: string): string[] {
  const prefixes = new Set<string>()
  const normalizedName = normalizeNotebookPrefix(notebookName)
  const normalizedId = normalizeNotebookPrefix(documentBox)

  if (normalizedName) {
    prefixes.add(normalizedName)
  }
  if (normalizedId) {
    prefixes.add(normalizedId)
  }

  return [...prefixes]
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

function matchesPathPrefix(value: string, configuredPath: string): boolean {
  if (!value || !configuredPath) {
    return false
  }

  return value === configuredPath || value.startsWith(`${configuredPath}/`)
}
