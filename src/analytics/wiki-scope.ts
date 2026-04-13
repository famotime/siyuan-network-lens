import type { DocumentRecord } from './analysis'
import type { NotebookPathOption } from './document-paths'
import { countThemeMatchesForDocument, collectThemeDocuments, type ThemeDocument } from './theme-documents'
import { isWikiDocumentTitle } from './wiki-page-model'
import type { PluginConfig } from '@/types/config'

export const DEFAULT_WIKI_SECONDARY_THEME_SCORE_RATIO = 0.8

export interface WikiThemeGroup {
  themeName: string
  themeDocumentId: string
  themeDocumentTitle: string
  sourceDocumentIds: string[]
}

export interface WikiScopeSummary {
  themeDocumentCount: number
  sourceDocumentCount: number
  themeGroupCount: number
  excludedWikiDocumentCount: number
  unclassifiedDocumentCount: number
}

export interface WikiScopeResult {
  themeDocuments: ThemeDocument[]
  sourceDocuments: DocumentRecord[]
  themeGroups: WikiThemeGroup[]
  unclassifiedDocuments: DocumentRecord[]
  excludedWikiDocuments: DocumentRecord[]
  summary: WikiScopeSummary
}

export function buildWikiScope(params: {
  documents: DocumentRecord[]
  config: PluginConfig
  notebooks?: NotebookPathOption[]
  themeDocuments?: ThemeDocument[]
  secondaryThemeScoreRatio?: number
}): WikiScopeResult {
  const themeDocuments = params.themeDocuments ?? collectThemeDocuments({
    documents: params.documents,
    config: params.config,
    notebooks: params.notebooks,
  })
  const wikiPageSuffix = params.config.wikiPageSuffix?.trim() ?? ''
  const themeDocumentIdSet = new Set(themeDocuments.map(item => item.documentId))
  const excludedWikiDocuments = params.documents.filter(document => isWikiDocumentTitle(document.title || document.hpath || document.path || document.id, wikiPageSuffix))
  const sourceDocuments = params.documents.filter((document) => {
    if (themeDocumentIdSet.has(document.id)) {
      return false
    }
    return !isWikiDocumentTitle(document.title || document.hpath || document.path || document.id, wikiPageSuffix)
  })
  const secondaryThemeScoreRatio = params.secondaryThemeScoreRatio ?? DEFAULT_WIKI_SECONDARY_THEME_SCORE_RATIO
  const groups = new Map<string, WikiThemeGroup>()
  const unclassifiedDocuments: DocumentRecord[] = []

  for (const document of sourceDocuments) {
    const matches = countThemeMatchesForDocument({
      document,
      themeDocuments,
    })
    const selectedMatches = selectScopeThemeMatches(matches, secondaryThemeScoreRatio)
    if (!selectedMatches.length) {
      unclassifiedDocuments.push(document)
      continue
    }

    for (const match of selectedMatches) {
      const group = groups.get(match.themeDocumentId) ?? {
        themeName: match.themeName,
        themeDocumentId: match.themeDocumentId,
        themeDocumentTitle: match.themeDocumentTitle,
        sourceDocumentIds: [],
      }
      group.sourceDocumentIds.push(document.id)
      groups.set(match.themeDocumentId, group)
    }
  }

  const themeGroups = [...groups.values()]
    .map(group => ({
      ...group,
      sourceDocumentIds: [...group.sourceDocumentIds],
    }))
    .sort((left, right) => left.themeName.localeCompare(right.themeName, 'zh-CN'))

  return {
    themeDocuments,
    sourceDocuments,
    themeGroups,
    unclassifiedDocuments,
    excludedWikiDocuments,
    summary: {
      themeDocumentCount: themeDocuments.length,
      sourceDocumentCount: sourceDocuments.length,
      themeGroupCount: themeGroups.length,
      excludedWikiDocumentCount: excludedWikiDocuments.length,
      unclassifiedDocumentCount: unclassifiedDocuments.length,
    },
  }
}

function selectScopeThemeMatches(
  matches: Array<{
    themeDocumentId: string
    themeDocumentTitle: string
    themeName: string
    matchCount: number
  }>,
  secondaryThemeScoreRatio: number,
) {
  if (!matches.length) {
    return []
  }

  const primaryMatch = matches[0]
  const result = [primaryMatch]
  const secondaryMatch = matches[1]

  if (!secondaryMatch || primaryMatch.matchCount <= 0) {
    return result
  }

  if (secondaryMatch.matchCount / primaryMatch.matchCount >= secondaryThemeScoreRatio) {
    result.push(secondaryMatch)
  }

  return result
}
