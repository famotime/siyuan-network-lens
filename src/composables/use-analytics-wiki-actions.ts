import type { ComputedRef, Ref } from 'vue'

import type {
  AnalyticsFilters,
  DocumentRecord,
  ReferenceGraphReport,
  TimeRange,
  TrendReport,
} from '@/analytics/analysis'
import type { AiDocumentIndexStore, DocumentIndexProfile } from '@/analytics/ai-index-store'
import type { AiWikiService } from '@/analytics/wiki-ai'
import { buildWikiPreview } from '@/analytics/wiki-diff'
import { applyWikiDocuments } from '@/analytics/wiki-documents'
import { resolveScopedPathTarget } from '@/analytics/document-paths'
import type { WikiThemeBundle } from '@/analytics/wiki-generation'
import { buildThemeWikiPageTitle } from '@/analytics/wiki-page-model'
import { renderThemeWikiDraft } from '@/analytics/wiki-renderer'
import { buildWikiPageStorageKey, type AiWikiStore, type WikiPageSnapshotRecord } from '@/analytics/wiki-store'
import type { WikiPreviewCacheStore } from '@/analytics/wiki-preview-store'
import type { AnalyticsSnapshot } from '@/analytics/siyuan-data'
import {
  normalizeWikiSourceDocLinkTypes,
  resolvePrimaryWikiSourceDocLinkType,
  type WikiSourceDocumentEntry,
} from '@/analytics/wiki-source-docs'
import type { ThemeDocument } from '@/analytics/theme-documents'
import { countThemeMatchesForDocument } from '@/analytics/theme-documents'
import {
  buildWikiPreviewSummary,
  buildWikiScopeDescriptionLines,
  buildWikiSourceProfileMap,
  resolveAffectedSectionHeadings,
  resolveExistingWikiPage,
  resolveWikiScopeDocuments,
  type WikiPreviewRequest,
  type WikiPreviewState,
  type WikiPreviewThemePageItem,
} from './use-analytics-wiki'
import { t } from '@/i18n/ui'
import { DEFAULT_WIKI_CONTAINER_PATH, type PluginConfig } from '@/types/config'

type ShowMessageFn = (text: string, timeout?: number, type?: 'info' | 'error') => void
type BlockWriteFn = (dataType: 'markdown' | 'dom', data: string, parentID: string) => Promise<any>
type BlockDeleteFn = (id: string) => Promise<any>
type BlockUpdateFn = (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
type CreateDocWithMdFn = (notebook: string, path: string, markdown: string) => Promise<string>
type GetIDsByHPathFn = (notebook: string, path: string) => Promise<string[]>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string, subtype?: string }>>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>
type GetBlockAttrsFn = (id: string) => Promise<{ [key: string]: string }>
type SetBlockAttrsFn = (id: string, attrs: { [key: string]: string }) => Promise<any>
type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

export function createAnalyticsWikiActionsController(params: {
  config: PluginConfig
  appliedConfig: ComputedRef<PluginConfig>
  snapshot: Ref<AnalyticsSnapshot | null>
  report: ComputedRef<ReferenceGraphReport | null>
  trends: ComputedRef<TrendReport | null>
  filters: ComputedRef<AnalyticsFilters>
  timeRange: Ref<TimeRange>
  filteredDocuments: ComputedRef<DocumentRecord[]>
  associationDocumentMap: ComputedRef<Map<string, DocumentRecord>>
  themeDocuments: ComputedRef<ThemeDocument[]>
  aiConfigReady: ComputedRef<boolean>
  wikiPreviewLoading: Ref<boolean>
  wikiApplyLoading: Ref<boolean>
  wikiError: Ref<string>
  wikiPreview: Ref<WikiPreviewState | null>
  wikiPreviewCache: Ref<Map<string, WikiPreviewState>>
  wikiPreviewCacheStore?: WikiPreviewCacheStore | null
  aiIndexStore: AiDocumentIndexStore | null
  aiWikiStore: AiWikiStore | null
  aiWikiService: AiWikiService | null
  forwardProxy?: ForwardProxyFn
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
  createDocWithMd?: CreateDocWithMdFn
  getIDsByHPath?: GetIDsByHPathFn
  prependBlock: BlockWriteFn
  appendBlock: BlockWriteFn
  updateBlock: BlockUpdateFn
  deleteBlock: BlockDeleteFn
  getBlockAttrs?: GetBlockAttrsFn
  setBlockAttrs?: SetBlockAttrsFn
  resolveNotebookName: (notebookId: string) => string
  notify: ShowMessageFn
}) {
  async function restoreCachedWikiPreview(themeDocumentId: string) {
    params.wikiError.value = ''
    const cached = params.wikiPreviewCache.value.get(themeDocumentId)
    if (cached) {
      params.wikiPreview.value = cached
      return
    }

    if (params.wikiPreviewCacheStore) {
      const persisted = await params.wikiPreviewCacheStore.getPreview(themeDocumentId)
      if (persisted) {
        persisted.isCachedPreview = true
        params.wikiPreviewCache.value.set(themeDocumentId, persisted)
        params.wikiPreview.value = persisted
        return
      }
    }

    params.wikiPreview.value = null
  }

  async function prepareWikiPreview(request?: WikiPreviewRequest) {
    params.wikiPreviewLoading.value = true
    params.wikiError.value = ''

    try {
      if (!params.config.wikiEnabled) {
        throw new Error(t('analytics.controller.enableWikiFirst'))
      }
      if (!params.config.aiEnabled || !params.aiConfigReady.value) {
        throw new Error(t('analytics.controller.enableSuggestionsAndAi'))
      }
      if (!params.snapshot.value || !params.report.value || !params.trends.value) {
        throw new Error(t('analytics.controller.analysisNotReady'))
      }
      if (!params.aiWikiService) {
        throw new Error(t('analytics.controller.aiProxyNotInitialized'))
      }
      if (!params.aiWikiStore) {
        throw new Error(t('analytics.controller.wikiStorageNotInitialized'))
      }
      if (!request?.themeDocumentId) {
        throw new Error(t('analytics.controller.wikiThemeDocumentRequired'))
      }

      const generatedAt = new Date().toISOString()
      const themeDocument = params.themeDocuments.value.find(document => document.documentId === request.themeDocumentId)
      if (!themeDocument) {
        throw new Error(t('analytics.controller.wikiThemeDocumentNotFound'))
      }

      const scopedDocuments = resolveWikiScopeDocuments({
        sourceDocumentIds: request.sourceDocumentIds,
        fallbackDocuments: params.filteredDocuments.value,
        associationDocumentMap: params.associationDocumentMap.value,
      })
      const sourceDocuments = scopedDocuments.filter(document => document.id !== themeDocument.documentId)
      const scopeDescriptionLines = buildWikiScopeDescriptionLines({
        timeRange: params.timeRange.value,
        filters: params.filters.value,
        resolveNotebookName: params.resolveNotebookName,
        scopeDescriptionLine: request.scopeDescriptionLine,
      })
      const sourceProfileResult = await buildWikiSourceProfileMap({
        sourceDocuments,
        config: params.appliedConfig.value,
        aiIndexStore: params.aiIndexStore,
        forwardProxy: params.forwardProxy,
        getChildBlocks: params.getChildBlocks,
        getBlockKramdown: params.getBlockKramdown,
        generatedAt,
      })
      const sourceProfileMap = sourceProfileResult.profileMap
      const effectiveSourceDocuments = sourceProfileResult.effectiveDocuments
      const skippedSourceDocuments = sourceProfileResult.skippedDocuments

      if (!effectiveSourceDocuments.length) {
        throw new Error(t('analytics.controller.wikiPreviewNoUsableSourceDocuments', {
          titles: skippedSourceDocuments.map(item => item.title).join('、') || t('shared.noOptionsAvailable'),
        }))
      }

      if (skippedSourceDocuments.length) {
        const skippedTitles = skippedSourceDocuments.map(item => item.title).join('、')
        scopeDescriptionLines.push(`- ${t('analytics.controller.wikiPreviewIncompleteDueToSkippedDocuments')}`)
        scopeDescriptionLines.push(`  - ${t('analytics.controller.wikiPreviewSkippedDocuments', {
          count: skippedSourceDocuments.length,
          titles: skippedTitles,
        })}`)
      }

      const wikiTarget = resolveScopedPathTarget(params.appliedConfig.value.wikiContainerPath ?? '', params.snapshot.value?.notebooks)
      const wikiContainerPath = wikiTarget?.path ?? ''

      // --- Incremental diff logic ---
      const pageTitle = buildThemeWikiPageTitle(themeDocument.title, params.appliedConfig.value.wikiPageSuffix ?? '')
      const pageKey = buildWikiPageStorageKey({
        pageType: 'theme',
        pageTitle,
        themeDocumentId: themeDocument.documentId,
      })
      const storedRecord = await params.aiWikiStore.getPageRecord(pageKey)

      const isIncremental = params.config.wikiIncrementalEnabled !== false
      const deltaMap = isIncremental
        ? computeSourceDocumentDeltas(
          effectiveSourceDocuments.map(d => ({ id: d.id, updated: d.updated })),
          storedRecord?.sourceDocumentTimestamps,
        )
        : new Map(effectiveSourceDocuments.map(d => [d.id, 'new' as const]))

      const hasChanges = [...deltaMap.values()].some(s => s !== 'unchanged')
      if (isIncremental && storedRecord?.sourceDocumentTimestamps && !hasChanges) {
        const cached = params.wikiPreviewCache.value.get(request.themeDocumentId)
        if (cached) {
          params.wikiPreview.value = cached
          params.notify(t('analytics.wiki.noSourceChangesUseCache'), 3000, 'info')
          return
        }
      }

      const sourceDocumentTimestamps: Record<string, string> = {}
      for (const doc of effectiveSourceDocuments) {
        sourceDocumentTimestamps[doc.id] = doc.updated
      }

      let existingWikiContent: string | undefined
      if (isIncremental && storedRecord) {
        const pageHPath = wikiContainerPath ? `${wikiContainerPath}/${pageTitle}` : `${themeDocument.hpath}/${pageTitle}`
        const existingPage = await resolveExistingWikiPage({
          notebook: wikiTarget?.notebook ?? themeDocument.box,
          pageHPath,
          storedRecord,
          getIDsByHPath: params.getIDsByHPath,
          getBlockKramdown: params.getBlockKramdown,
        })
        existingWikiContent = existingPage?.managedMarkdown
      }
      // --- End incremental diff logic ---

      const scopedDocumentMap = new Map(scopedDocuments.map(document => [document.id, document]))
      const payload = buildSingleThemeWikiPayload({
        config: params.appliedConfig.value,
        themeDocument,
        sourceDocuments: effectiveSourceDocuments,
        report: params.report.value,
        trends: params.trends.value,
        documentMap: scopedDocumentMap,
        getDocumentProfile: document => sourceProfileMap.get(document.id) ?? null,
        deltaMap,
      })

      const diagnosis = await params.aiWikiService.diagnoseThemeTemplate({
        config: params.appliedConfig.value,
        payload,
        existingWikiContent,
      })
      const pagePlan = await params.aiWikiService.planThemePage({
        config: params.appliedConfig.value,
        payload,
        diagnosis,
        existingWikiContent,
      })
      const sections = await Promise.all(pagePlan.sectionOrder.map(sectionType => params.aiWikiService!.generateThemeSection({
        config: params.appliedConfig.value,
        payload,
        diagnosis,
        pagePlan,
        sectionType,
        existingWikiContent,
      })))
      const sourceDocumentTitleMap = Object.fromEntries(payload.sourceDocuments.map(doc => [doc.documentId, doc.title]))
      const draft = renderThemeWikiDraft({
        pageTitle: payload.pageTitle,
        pairedThemeDocumentId: payload.themeDocumentId,
        pairedThemeTitle: payload.themeDocumentTitle,
        generatedAt,
        model: params.appliedConfig.value.aiModel?.trim() || 'unknown',
        sourceDocumentCount: payload.sourceDocuments.length,
        diagnosis,
        pagePlan,
        sections,
        sourceDocumentTitleMap,
      })

      const existingPage = await resolveExistingWikiPage({
        notebook: wikiTarget?.notebook ?? themeDocument.box,
        pageHPath: wikiContainerPath ? `${wikiContainerPath}/${pageTitle}` : `${themeDocument.hpath}/${pageTitle}`,
        storedRecord,
        getIDsByHPath: params.getIDsByHPath,
        getBlockKramdown: params.getBlockKramdown,
      })
      const preview = buildWikiPreview({
        pageType: 'theme',
        pageTitle: payload.pageTitle,
        sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
        generatedAt,
        nextDraft: draft,
        existingPage: existingPage?.managedMarkdown
          ? { managedMarkdown: existingPage.managedMarkdown }
          : undefined,
        storedRecord: storedRecord ?? undefined,
      })

      const nextRecord: WikiPageSnapshotRecord = {
        pageType: 'theme',
        pageTitle: payload.pageTitle,
        pageId: existingPage?.pageId ?? storedRecord?.pageId,
        themeDocumentId: payload.themeDocumentId,
        themeDocumentTitle: payload.themeDocumentTitle,
        sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
        sourceDocumentEntries: [],
        sourceDocumentTimestamps,
        pageFingerprint: preview.pageFingerprint,
        managedFingerprint: preview.managedFingerprint,
        lastGeneratedAt: generatedAt,
        lastPreview: {
          generatedAt,
          status: preview.status,
          sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
          pageFingerprint: preview.pageFingerprint,
          managedFingerprint: preview.managedFingerprint,
        },
        lastApply: storedRecord?.lastApply,
      }
      await params.aiWikiStore.savePageRecord(nextRecord)

      const deltaStats = {
        isIncremental: isIncremental && Boolean(storedRecord?.sourceDocumentTimestamps),
        newCount: [...deltaMap.values()].filter(s => s === 'new').length,
        changedCount: [...deltaMap.values()].filter(s => s === 'changed').length,
        unchangedCount: [...deltaMap.values()].filter(s => s === 'unchanged').length,
        deletedCount: [...deltaMap.values()].filter(s => s === 'deleted').length,
        processingTimeMs: Date.now() - new Date(generatedAt).getTime(),
      }

      const sourceDocMetas = effectiveSourceDocuments.map(doc => {
        const themeMatches = countThemeMatchesForDocument({
          document: doc,
          themeDocuments: params.themeDocuments.value,
        })

        const linkTypes = normalizeWikiSourceDocLinkTypes(request?.sourceDocumentLinkTypes?.get(doc.id) ?? ['outbound'])

        return {
          documentId: doc.id,
          title: doc.title || doc.hpath || doc.id,
          deltaStatus: deltaMap.get(doc.id) ?? 'new',
          linkType: resolvePrimaryWikiSourceDocLinkType(linkTypes),
          linkTypes,
          updatedAt: doc.updated,
          hasThemeLink: false,
          isWeakAssociation: themeMatches.length === 0,
          themeSuggestions: themeMatches,
        }
      })

      const sourceDocumentEntries: WikiSourceDocumentEntry[] = sourceDocMetas.map(meta => ({
        documentId: meta.documentId,
        title: meta.title,
        linkTypes: normalizeWikiSourceDocLinkTypes(meta.linkTypes ?? [meta.linkType]),
      }))

      nextRecord.sourceDocumentEntries = sourceDocumentEntries

      const themePage: WikiPreviewThemePageItem = {
        pageId: existingPage?.pageId ?? storedRecord?.pageId,
        pageTitle: payload.pageTitle,
        themeName: payload.themeName,
        themeDocumentId: payload.themeDocumentId,
        themeDocumentTitle: payload.themeDocumentTitle,
        themeDocumentBox: themeDocument.box,
        themeDocumentHPath: themeDocument.hpath,
        sourceDocumentIds: payload.sourceDocuments.map(document => document.documentId),
        preview,
        diagnosis,
        pagePlan,
        draft,
        affectedSectionHeadings: resolveAffectedSectionHeadings({
          preview,
          draft,
          existingManagedMarkdown: existingPage?.managedMarkdown,
        }),
        hasManualNotes: existingPage?.hasManualNotes ?? false,
      }

      params.wikiPreview.value = {
        generatedAt,
        scope: {
          summary: buildWikiPreviewSummary({
            sourceDocumentCount: effectiveSourceDocuments.length,
            draft,
            existingFullMarkdown: existingPage?.fullMarkdown,
          }),
          descriptionLines: scopeDescriptionLines,
        },
        themePages: [themePage],
        unclassifiedDocuments: [],
        excludedWikiDocuments: [],
        skippedSourceDocuments,
        deltaStats,
        sourceDocMetas,
        isCachedPreview: false,
      }
      params.wikiPreviewCache.value.set(request.themeDocumentId, params.wikiPreview.value)

      if (params.wikiPreviewCacheStore) {
        await params.wikiPreviewCacheStore.savePreview(request.themeDocumentId, params.wikiPreview.value)
      }

      if (skippedSourceDocuments.length) {
        params.notify(t('analytics.controller.wikiPreviewSkippedDocuments', {
          count: skippedSourceDocuments.length,
          titles: skippedSourceDocuments.map(item => item.title).join('、'),
        }), 5000, 'info')
      }

      const hasNewPages = themePage.preview.status === 'create'
      if (hasNewPages) {
        try {
          await applyWikiChanges()
        } catch {
          // Auto-apply errors are already handled inside applyWikiChanges.
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToGenerateWikiPreview')
      params.wikiError.value = message
      params.wikiPreview.value = null
      params.notify(message, 5000, 'error')
    } finally {
      params.wikiPreviewLoading.value = false
    }
  }

  async function applyWikiChanges(overwriteConflicts = false) {
    params.wikiApplyLoading.value = true
    params.wikiError.value = ''

    try {
      if (!params.wikiPreview.value) {
        throw new Error(t('analytics.controller.noWikiPreviewAvailable'))
      }
      if (!params.aiWikiStore) {
        throw new Error(t('analytics.controller.wikiStorageNotInitialized'))
      }
      if (!params.createDocWithMd || !params.getIDsByHPath || !params.getBlockAttrs || !params.setBlockAttrs) {
        throw new Error(t('analytics.controller.wikiWriteCapabilityNotInitialized'))
      }

      const result = await applyWikiDocuments({
        config: {
          themeNotebookId: params.appliedConfig.value.themeNotebookId,
          themeDocumentPath: params.appliedConfig.value.themeDocumentPath,
          wikiIndexTitle: params.appliedConfig.value.wikiIndexTitle ?? 'LLM-Wiki-Index',
          wikiLogTitle: params.appliedConfig.value.wikiLogTitle ?? 'LLM-Wiki-Maintenance-Log',
          wikiPageSuffix: params.appliedConfig.value.wikiPageSuffix ?? '-llm-wiki',
          wikiContainerPath: params.appliedConfig.value.wikiContainerPath ?? DEFAULT_WIKI_CONTAINER_PATH,
        },
        notebooks: params.snapshot.value?.notebooks,
        generatedAt: new Date().toISOString(),
        scopeSummary: {
          sourceDocumentCount: params.wikiPreview.value.scope.summary.sourceDocumentCount,
          themeGroupCount: 1,
          unclassifiedDocumentCount: 0,
          excludedWikiDocumentCount: 0,
        },
        scopeDescriptionLines: params.wikiPreview.value.scope.descriptionLines,
        themePages: params.wikiPreview.value.themePages.map(page => ({
          pageTitle: page.pageTitle,
          themeName: page.themeName,
          themeDocumentId: page.themeDocumentId,
          themeDocumentTitle: page.themeDocumentTitle,
          themeDocumentBox: page.themeDocumentBox,
          themeDocumentHPath: page.themeDocumentHPath,
          sourceDocumentIds: page.sourceDocumentIds,
          sourceDocumentEntries: (params.wikiPreview.value?.sourceDocMetas ?? [])
            .filter(meta => page.sourceDocumentIds.includes(meta.documentId))
            .map(meta => ({
              documentId: meta.documentId,
              title: meta.title,
              linkTypes: normalizeWikiSourceDocLinkTypes(meta.linkTypes ?? [meta.linkType]),
            })),
          preview: page.preview,
          draft: page.draft,
        })),
        unclassifiedDocuments: params.wikiPreview.value.unclassifiedDocuments,
        overwriteConflicts,
        store: params.aiWikiStore,
        api: {
          createDocWithMd: params.createDocWithMd,
          getIDsByHPath: params.getIDsByHPath,
          prependBlock: params.prependBlock,
          appendBlock: params.appendBlock,
          updateBlock: params.updateBlock,
          deleteBlock: params.deleteBlock,
          getChildBlocks: params.getChildBlocks,
          getBlockKramdown: params.getBlockKramdown,
          getBlockAttrs: params.getBlockAttrs,
          setBlockAttrs: params.setBlockAttrs,
        },
      })

      params.wikiPreview.value = {
        ...params.wikiPreview.value,
        applyResult: result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToWriteWiki')
      params.wikiError.value = message
      params.notify(message, 5000, 'error')
    } finally {
      params.wikiApplyLoading.value = false
    }
  }

  return {
    wikiPreviewLoading: params.wikiPreviewLoading,
    wikiApplyLoading: params.wikiApplyLoading,
    wikiError: params.wikiError,
    wikiPreview: params.wikiPreview,
    restoreCachedWikiPreview,
    prepareWikiPreview,
    applyWikiChanges,
  }
}

function buildSingleThemeWikiPayload(params: {
  config: Pick<PluginConfig, 'wikiPageSuffix'>
  themeDocument: { documentId: string, title: string, themeName: string }
  sourceDocuments: DocumentRecord[]
  report: ReferenceGraphReport
  trends: TrendReport
  documentMap: ReadonlyMap<string, DocumentRecord>
  getDocumentProfile: (document: DocumentRecord) => DocumentIndexProfile | null
  deltaMap?: Map<string, 'new' | 'changed' | 'unchanged' | 'deleted'>
}): WikiThemeBundle {
  const bundleDocuments = params.sourceDocuments.map((document) => {
    const profile = params.getDocumentProfile(document)
    if (!profile) {
      throw new Error(`Missing document index profile for wiki source document: ${document.id}`)
    }

    return {
      documentId: document.id,
      title: profile.title || document.title || document.hpath || document.path || document.id,
      positioning: profile.positioning || '',
      propositions: parseJsonArray<any>(profile.propositionsJson)
        .filter((item): item is { text: string, sourceBlockIds?: string[] } => Boolean(item) && typeof item.text === 'string')
        .map(item => ({
          text: item.text.trim(),
          sourceBlockIds: Array.isArray(item.sourceBlockIds)
            ? item.sourceBlockIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            : [],
        }))
        .filter(item => item.text.length > 0),
      keywords: parseJsonArray<unknown>(profile.keywordsJson)
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean),
      primarySourceBlocks: parseJsonArray<any>(profile.primarySourceBlocksJson)
        .filter((item): item is { blockId: string, text: string } => Boolean(item) && typeof item.blockId === 'string' && typeof item.text === 'string')
        .map(item => ({ blockId: item.blockId.trim(), text: item.text.trim() }))
        .filter(item => item.blockId.length > 0 && item.text.length > 0),
      secondarySourceBlocks: parseJsonArray<any>(profile.secondarySourceBlocksJson)
        .filter((item): item is { blockId: string, text: string } => Boolean(item) && typeof item.blockId === 'string' && typeof item.text === 'string')
        .map(item => ({ blockId: item.blockId.trim(), text: item.text.trim() }))
        .filter(item => item.blockId.length > 0 && item.text.length > 0),
      sourceUpdatedAt: profile.sourceUpdatedAt,
      generatedAt: profile.generatedAt,
      deltaStatus: params.deltaMap?.get(document.id) ?? 'new',
    }
  })

  const sourceDocumentIds = bundleDocuments.map(item => item.documentId)
  const sourceDocumentIdSet = new Set(sourceDocumentIds)
  const relationshipEvidence: string[] = []

  for (const targetDocumentId of sourceDocumentIds) {
    const refs = params.report.evidenceByDocument[targetDocumentId] ?? []
    for (const ref of refs) {
      if (!sourceDocumentIdSet.has(ref.sourceDocumentId)) {
        continue
      }
      const sourceTitle = resolveTitle(params.documentMap.get(ref.sourceDocumentId), ref.sourceDocumentId)
      const targetTitle = resolveTitle(params.documentMap.get(targetDocumentId), targetDocumentId)
      relationshipEvidence.push(`${sourceTitle} -> ${targetTitle}：${ref.content}`)
    }
  }

  return {
    themeName: params.themeDocument.themeName,
    pageTitle: buildThemeWikiPageTitle(params.themeDocument.title, params.config.wikiPageSuffix ?? ''),
    themeDocumentId: params.themeDocument.documentId,
    themeDocumentTitle: params.themeDocument.title,
    sourceDocuments: bundleDocuments,
    templateSignals: {
      sourceDocumentCount: bundleDocuments.length,
      propositionCount: bundleDocuments.reduce((sum, item) => sum + item.propositions.length, 0),
      primarySourceBlockCount: bundleDocuments.reduce((sum, item) => sum + item.primarySourceBlocks.length, 0),
      secondarySourceBlockCount: bundleDocuments.reduce((sum, item) => sum + item.secondarySourceBlocks.length, 0),
    },
    analysisSignals: {
      coreDocumentIds: params.report.ranking.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      bridgeDocumentIds: params.report.bridgeDocuments.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      propagationDocumentIds: params.report.propagationNodes.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      orphanDocumentIds: params.report.orphans.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      risingDocumentIds: params.trends.risingDocuments.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      fallingDocumentIds: params.trends.fallingDocuments.map(item => item.documentId).filter(documentId => sourceDocumentIdSet.has(documentId)),
      relationshipEvidence,
    },
  }
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

function computeSourceDocumentDeltas(
  currentDocuments: Array<{ id: string, updated: string }>,
  previousTimestamps: Record<string, string> | undefined,
): Map<string, 'new' | 'changed' | 'unchanged' | 'deleted'> {
  const deltas = new Map<string, 'new' | 'changed' | 'unchanged' | 'deleted'>()

  if (!previousTimestamps) {
    for (const doc of currentDocuments) {
      deltas.set(doc.id, 'new')
    }
    return deltas
  }

  const currentIds = new Set(currentDocuments.map(d => d.id))
  const previousIds = new Set(Object.keys(previousTimestamps))

  for (const doc of currentDocuments) {
    if (!previousIds.has(doc.id)) {
      deltas.set(doc.id, 'new')
    } else if (previousTimestamps[doc.id] !== doc.updated) {
      deltas.set(doc.id, 'changed')
    } else {
      deltas.set(doc.id, 'unchanged')
    }
  }

  for (const previousId of previousIds) {
    if (!currentIds.has(previousId)) {
      deltas.set(previousId, 'deleted')
    }
  }

  return deltas
}
