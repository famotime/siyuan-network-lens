import type {
  DocumentRecord,
  ReferenceGraphReport,
  TrendReport,
} from './analysis'
import type {
  DocumentIndexProfile,
  PropositionItem,
  SourceBlockItem,
} from './ai-index-store'
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
  propositions: PropositionItem[]
  keywords: string[]
  primarySourceBlocks: SourceBlockItem[]
  secondarySourceBlocks: SourceBlockItem[]
  sourceUpdatedAt: string
  generatedAt: string
}

export interface WikiThemeAnalysisSignals {
  coreDocumentIds: string[]
  bridgeDocumentIds: string[]
  propagationDocumentIds: string[]
  orphanDocumentIds: string[]
  risingDocumentIds: string[]
  fallingDocumentIds: string[]
  relationshipEvidence: string[]
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
  analysisSignals: WikiThemeAnalysisSignals
}

export interface WikiGenerationPayloadBundle {
  themes: WikiThemeBundle[]
  unclassifiedDocuments: WikiBundleDocumentItem[]
  missingProfileDocumentIds: string[]
}

export function buildWikiGenerationPayloads(params: {
  config: Pick<PluginConfig, 'wikiPageSuffix'>
  scope: WikiScopeResult
  report: ReferenceGraphReport
  trends: TrendReport
  documentMap: ReadonlyMap<string, DocumentRecord>
  getDocumentProfile: (document: DocumentRecord) => DocumentIndexProfile | null
}): WikiGenerationPayloadBundle {
  const missingProfileDocumentIds: string[] = []

  return {
    themes: params.scope.themeGroups.map((group) => {
      const sourceDocuments = group.sourceDocumentIds.map((documentId) => {
        const item = buildBundleItem(documentId, params.documentMap, params.getDocumentProfile)
        if (!item) {
          throw new Error(`Missing document index profile for wiki source document: ${documentId}`)
        }
        return item
      })

      return {
        themeName: group.themeName,
        pageTitle: buildThemeWikiPageTitle(group.themeDocumentTitle, params.config.wikiPageSuffix ?? ''),
        themeDocumentId: group.themeDocumentId,
        themeDocumentTitle: group.themeDocumentTitle,
        sourceDocuments,
        templateSignals: buildTemplateSignals(sourceDocuments),
        analysisSignals: buildAnalysisSignals({
          sourceDocumentIds: group.sourceDocumentIds,
          report: params.report,
          trends: params.trends,
          documentMap: params.documentMap,
        }),
      }
    }),
    unclassifiedDocuments: params.scope.unclassifiedDocuments.flatMap((document) => {
      const item = buildBundleItem(document.id, params.documentMap, params.getDocumentProfile)
      if (!item) {
        missingProfileDocumentIds.push(document.id)
        return []
      }
      return [item]
    }),
    missingProfileDocumentIds,
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
    propositions: normalizePropositions(parseJsonArray<PropositionItem>(profile.propositionsJson)),
    keywords: parseStringArray(profile.keywordsJson),
    primarySourceBlocks: normalizeSourceBlocks(parseJsonArray<SourceBlockItem>(profile.primarySourceBlocksJson)),
    secondarySourceBlocks: normalizeSourceBlocks(parseJsonArray<SourceBlockItem>(profile.secondarySourceBlocksJson)),
    sourceUpdatedAt: profile.sourceUpdatedAt,
    generatedAt: profile.generatedAt,
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

function buildAnalysisSignals(params: {
  sourceDocumentIds: string[]
  report: ReferenceGraphReport
  trends: TrendReport
  documentMap: ReadonlyMap<string, DocumentRecord>
}): WikiThemeAnalysisSignals {
  const sourceDocumentIdSet = new Set(params.sourceDocumentIds)

  return {
    coreDocumentIds: params.report.ranking
      .map(item => item.documentId)
      .filter(documentId => sourceDocumentIdSet.has(documentId)),
    bridgeDocumentIds: params.report.bridgeDocuments
      .map(item => item.documentId)
      .filter(documentId => sourceDocumentIdSet.has(documentId)),
    propagationDocumentIds: params.report.propagationNodes
      .map(item => item.documentId)
      .filter(documentId => sourceDocumentIdSet.has(documentId)),
    orphanDocumentIds: params.report.orphans
      .map(item => item.documentId)
      .filter(documentId => sourceDocumentIdSet.has(documentId)),
    risingDocumentIds: params.trends.risingDocuments
      .map(item => item.documentId)
      .filter(documentId => sourceDocumentIdSet.has(documentId)),
    fallingDocumentIds: params.trends.fallingDocuments
      .map(item => item.documentId)
      .filter(documentId => sourceDocumentIdSet.has(documentId)),
    relationshipEvidence: buildRelationshipEvidence({
      sourceDocumentIds: params.sourceDocumentIds,
      report: params.report,
      documentMap: params.documentMap,
    }),
  }
}

function buildRelationshipEvidence(params: {
  sourceDocumentIds: string[]
  report: ReferenceGraphReport
  documentMap: ReadonlyMap<string, DocumentRecord>
}): string[] {
  const sourceDocumentIdSet = new Set(params.sourceDocumentIds)
  const evidence: string[] = []

  for (const targetDocumentId of params.sourceDocumentIds) {
    const refs = params.report.evidenceByDocument[targetDocumentId] ?? []
    for (const ref of refs) {
      if (!sourceDocumentIdSet.has(ref.sourceDocumentId)) {
        continue
      }
      const sourceTitle = resolveTitle(params.documentMap.get(ref.sourceDocumentId), ref.sourceDocumentId)
      const targetTitle = resolveTitle(params.documentMap.get(targetDocumentId), targetDocumentId)
      evidence.push(`${sourceTitle} -> ${targetTitle}：${ref.content}`)
    }
  }

  return evidence
}

function normalizePropositions(items: PropositionItem[]): PropositionItem[] {
  return items
    .filter((item): item is PropositionItem => Boolean(item) && typeof item.text === 'string')
    .map(item => ({
      text: item.text.trim(),
      sourceBlockIds: Array.isArray(item.sourceBlockIds)
        ? item.sourceBlockIds.filter((blockId): blockId is string => typeof blockId === 'string' && blockId.trim().length > 0)
        : [],
    }))
    .filter(item => item.text.length > 0)
}

function normalizeSourceBlocks(items: SourceBlockItem[]): SourceBlockItem[] {
  return items
    .filter((item): item is SourceBlockItem => Boolean(item) && typeof item.blockId === 'string' && typeof item.text === 'string')
    .map(item => ({
      blockId: item.blockId.trim(),
      text: item.text.trim(),
    }))
    .filter(item => item.blockId.length > 0 && item.text.length > 0)
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

function resolveTitle(document: DocumentRecord | undefined, fallbackId: string): string {
  return document?.title || document?.hpath || document?.path || fallbackId
}
