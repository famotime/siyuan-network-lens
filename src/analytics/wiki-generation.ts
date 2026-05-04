import type { DocumentRecord } from './analysis'
import type { DocumentIndexProfile, PropositionItem, SourceBlockItem } from './ai-index-store'
import { buildThemeWikiPageTitle } from './wiki-page-model'
import type { WikiScopeResult } from './wiki-scope'
import type { PluginConfig } from '@/types/config'

export const WIKI_LLM_OUTPUT_KEYS = [
  'overview',
  'keyDocuments',
  'structureObservations',
  'evidence',
  'actions',
] as const

export interface WikiBundleDocumentItem {
  documentId: string
  title: string
  positioning: string
  propositions: string[]
  keywords: string[]
  primarySourceBlocks: string[]
  secondarySourceBlocks: string[]
  updatedAt: string
}

export interface WikiThemeBundle {
  themeName: string
  pageTitle: string
  themeDocumentId: string
  themeDocumentTitle: string
  sourceDocuments: WikiBundleDocumentItem[]
  templateSignals: {
    sourceDocumentCount: number
    propositionCount: number
    primarySourceBlockCount: number
    secondarySourceBlockCount: number
  }
}

export interface WikiGenerationPayloadBundle {
  themes: WikiThemeBundle[]
  unclassifiedDocuments: WikiBundleDocumentItem[]
}

export function buildWikiGenerationPayloads(params: {
  config: Pick<PluginConfig, 'wikiPageSuffix'>
  scope: WikiScopeResult
  documentMap: ReadonlyMap<string, DocumentRecord>
  getDocumentProfile: (document: DocumentRecord) => DocumentIndexProfile | null
}): WikiGenerationPayloadBundle {
  return {
    themes: params.scope.themeGroups.map((group) => {
      const sourceDocuments = group.sourceDocumentIds
        .map(documentId => buildBundleItem(documentId, params.documentMap, params.getDocumentProfile))
        .filter((item): item is WikiBundleDocumentItem => item !== null)

      return {
        themeName: group.themeName,
        pageTitle: buildThemeWikiPageTitle(group.themeDocumentTitle, params.config.wikiPageSuffix ?? ''),
        themeDocumentId: group.themeDocumentId,
        themeDocumentTitle: group.themeDocumentTitle,
        sourceDocuments,
        templateSignals: buildTemplateSignals(sourceDocuments),
      }
    }),
    unclassifiedDocuments: params.scope.unclassifiedDocuments
      .map(document => buildBundleItem(document.id, params.documentMap, params.getDocumentProfile))
      .filter((item): item is WikiBundleDocumentItem => item !== null),
  }
}

function buildBundleItem(
  documentId: string,
  documentMap: ReadonlyMap<string, DocumentRecord>,
  getDocumentProfile: (document: DocumentRecord) => DocumentIndexProfile | null,
): WikiBundleDocumentItem | null {
  const document = documentMap.get(documentId)
  if (!document) {
    return null
  }

  const profile = getDocumentProfile(document)
  if (!profile) {
    return null
  }

  return {
    documentId,
    title: profile.title || document.title || document.hpath || document.path || document.id,
    positioning: profile.positioning || '',
    propositions: parseJsonArray<PropositionItem>(profile.propositionsJson)
      .map(item => item?.text?.trim() || '')
      .filter(Boolean),
    keywords: parseStringArray(profile.keywordsJson),
    primarySourceBlocks: parseJsonArray<SourceBlockItem>(profile.primarySourceBlocksJson)
      .map(item => item?.text?.trim() || '')
      .filter(Boolean),
    secondarySourceBlocks: parseJsonArray<SourceBlockItem>(profile.secondarySourceBlocksJson)
      .map(item => item?.text?.trim() || '')
      .filter(Boolean),
    updatedAt: profile.generatedAt,
  }
}

function buildTemplateSignals(sourceDocuments: WikiBundleDocumentItem[]): WikiThemeBundle['templateSignals'] {
  return {
    sourceDocumentCount: sourceDocuments.length,
    propositionCount: sourceDocuments.reduce((sum, item) => sum + item.propositions.length, 0),
    primarySourceBlockCount: sourceDocuments.reduce((sum, item) => sum + item.primarySourceBlocks.length, 0),
    secondarySourceBlockCount: sourceDocuments.reduce((sum, item) => sum + item.secondarySourceBlocks.length, 0),
  }
}

function parseStringArray(value?: string): string[] {
  return parseJsonArray<unknown>(value)
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
