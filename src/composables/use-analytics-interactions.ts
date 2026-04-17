import { ref } from 'vue'

import {
  addThemeLinkToDocumentChange,
  applyThemeLinkToOrphanDocument,
  removeThemeLinkFromDocumentChange,
  type AppliedThemeLinkChange,
} from '@/analytics/orphan-theme-links'
import {
  addDocumentLinkToChange,
  applyDocumentLinkToOrphanDocument,
  removeDocumentLinkFromChange,
  type AppliedDocumentLinkChange,
} from '@/analytics/orphan-document-links'
import {
  addTagToDocumentChange,
  applyTagToOrphanDocument,
  removeTagFromDocumentChange,
  type AppliedTagSuggestionChange,
} from '@/analytics/orphan-document-tags'
import { syncAssociation as syncAssociationCore, type LinkDirection } from '@/analytics/link-sync'
import type { DocumentRecord } from '@/analytics/analysis'
import type { ThemeDocument } from '@/analytics/theme-documents'
import { t } from '@/i18n/ui'

type ShowMessageFn = (text: string, timeout?: number, type?: 'info' | 'error') => void
type BlockWriteFn = (dataType: 'markdown' | 'dom', data: string, parentID: string) => Promise<any>
type BlockDeleteFn = (id: string) => Promise<any>
type BlockUpdateFn = (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string }>>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>
type GetBlockAttrsFn = (id: string) => Promise<{ [key: string]: string }>
type SetBlockAttrsFn = (id: string, attrs: { [key: string]: string }) => Promise<any>

export function createLinkAssociationInteractions(params: {
  resolveTitle: (documentId: string) => string
  appendBlock: BlockWriteFn
  prependBlock: BlockWriteFn
  notify: ShowMessageFn
  refresh: () => Promise<void>
  onSelectEvidence: (documentId: string) => void
}) {
  const expandedLinkPanels = ref(new Set<string>())
  const expandedLinkGroups = ref(new Set<string>())
  const syncInProgress = ref(new Set<string>())

  function toggleLinkPanel(documentId: string) {
    if (expandedLinkPanels.value.has(documentId)) {
      expandedLinkPanels.value.delete(documentId)
      return
    }
    expandedLinkPanels.value.add(documentId)
    params.onSelectEvidence(documentId)
  }

  function isLinkPanelExpanded(documentId: string) {
    return expandedLinkPanels.value.has(documentId)
  }

  function buildLinkGroupKey(documentId: string, direction: LinkDirection) {
    return `${documentId}:${direction}`
  }

  function toggleLinkGroup(documentId: string, direction: LinkDirection) {
    const key = buildLinkGroupKey(documentId, direction)
    if (expandedLinkGroups.value.has(key)) {
      expandedLinkGroups.value.delete(key)
      return
    }
    expandedLinkGroups.value.add(key)
  }

  function isLinkGroupExpanded(documentId: string, direction: LinkDirection) {
    return expandedLinkGroups.value.has(buildLinkGroupKey(documentId, direction))
  }

  function buildSyncKey(coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) {
    return `${coreDocumentId}:${targetDocumentId}:${direction}`
  }

  function isSyncing(coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) {
    return syncInProgress.value.has(buildSyncKey(coreDocumentId, targetDocumentId, direction))
  }

  async function syncAssociation(coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) {
    const key = buildSyncKey(coreDocumentId, targetDocumentId, direction)
    if (syncInProgress.value.has(key)) {
      return
    }
    syncInProgress.value.add(key)
    try {
      await syncAssociationCore({
        coreDocumentId,
        targetDocumentId,
        direction,
        resolveTitle: params.resolveTitle,
        appendBlock: params.appendBlock,
        prependBlock: params.prependBlock,
      })
      params.notify(t('analytics.controller.relatedLinkSynced'), 3000, 'info')
      await params.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.syncFailed')
      params.notify(message, 5000, 'error')
    } finally {
      syncInProgress.value.delete(key)
    }
  }

  return {
    expandedLinkPanels,
    expandedLinkGroups,
    syncInProgress,
    toggleLinkPanel,
    isLinkPanelExpanded,
    toggleLinkGroup,
    isLinkGroupExpanded,
    isSyncing,
    syncAssociation,
  }
}

export function createThemeSuggestionController(params: {
  getThemeDocuments: () => ThemeDocument[]
  notify: ShowMessageFn
  deleteBlock: BlockDeleteFn
  updateBlock: BlockUpdateFn
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
  prependBlock: BlockWriteFn
}) {
  const pendingThemeSuggestionBlocks = ref(new Map<string, AppliedThemeLinkChange>())

  function clearPendingThemeSuggestionBlocks() {
    pendingThemeSuggestionBlocks.value.clear()
  }

  function isThemeSuggestionActive(orphanDocumentId: string, themeDocumentId: string) {
    return pendingThemeSuggestionBlocks.value.get(orphanDocumentId)?.links.some(item => item.themeDocumentId === themeDocumentId) ?? false
  }

  async function toggleOrphanThemeSuggestion(orphanDocumentId: string, themeDocumentId: string) {
    const existingChange = pendingThemeSuggestionBlocks.value.get(orphanDocumentId)

    if (existingChange?.links.some(item => item.themeDocumentId === themeDocumentId)) {
      try {
        const nextChange = await removeThemeLinkFromDocumentChange({
          change: existingChange,
          themeDocumentId,
          deleteBlock: params.deleteBlock,
          updateBlock: params.updateBlock,
        })
        if (nextChange) {
          pendingThemeSuggestionBlocks.value.set(orphanDocumentId, nextChange)
        } else {
          pendingThemeSuggestionBlocks.value.delete(orphanDocumentId)
        }
        params.notify(t('analytics.controller.topicLinkSuggestionRemoved'), 3000, 'info')
      } catch (error) {
        const message = error instanceof Error ? error.message : t('analytics.controller.failedToRemoveTopicLink')
        params.notify(message, 5000, 'error')
      }
      return
    }

    const themeDocument = params.getThemeDocuments().find(item => item.documentId === themeDocumentId)
    if (!themeDocument) {
      params.notify(t('analytics.controller.matchingTopicDocNotFound'), 5000, 'error')
      return
    }

    try {
      const change = existingChange
        ? await addThemeLinkToDocumentChange({
            change: existingChange,
            themeDocumentId: themeDocument.documentId,
            themeDocumentTitle: themeDocument.title,
            updateBlock: params.updateBlock,
          })
        : await applyThemeLinkToOrphanDocument({
            orphanDocumentId,
            themeDocumentId: themeDocument.documentId,
            themeDocumentTitle: themeDocument.title,
            getChildBlocks: params.getChildBlocks,
            getBlockKramdown: params.getBlockKramdown,
            updateBlock: params.updateBlock,
            prependBlock: params.prependBlock,
          })
      pendingThemeSuggestionBlocks.value.set(orphanDocumentId, change)
      params.notify(t('analytics.controller.topicLinkInsertedRefreshAnalysis'), 3000, 'info')
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToInsertTopicLink')
      params.notify(message, 5000, 'error')
    }
  }

  return {
    pendingThemeSuggestionBlocks,
    clearPendingThemeSuggestionBlocks,
    isThemeSuggestionActive,
    toggleOrphanThemeSuggestion,
  }
}

export function createAiSuggestionActions(params: {
  notify: ShowMessageFn
  deleteBlock: BlockDeleteFn
  updateBlock: BlockUpdateFn
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
  prependBlock: BlockWriteFn
  getBlockAttrs?: GetBlockAttrsFn
  setBlockAttrs?: SetBlockAttrsFn
  getDocumentById: (documentId: string) => Pick<DocumentRecord, 'id' | 'title' | 'tags'> | undefined
  onDocumentTagsChanged?: (documentId: string, tags: string[]) => void
  invalidateAiSuggestionCache?: (documentId: string) => Promise<void>
}) {
  const pendingAiLinkBlocks = ref(new Map<string, AppliedDocumentLinkChange>())
  const pendingAiTagBlocks = ref(new Map<string, AppliedTagSuggestionChange>())

  function clearPendingAiSuggestionActions() {
    pendingAiLinkBlocks.value.clear()
    pendingAiTagBlocks.value.clear()
  }

  function isAiLinkSuggestionActive(orphanDocumentId: string, targetDocumentId: string) {
    return pendingAiLinkBlocks.value.get(orphanDocumentId)?.links.some(item => item.targetDocumentId === targetDocumentId) ?? false
  }

  async function toggleOrphanAiLinkSuggestion(orphanDocumentId: string, targetDocumentId: string, targetDocumentTitle: string) {
    const existingChange = pendingAiLinkBlocks.value.get(orphanDocumentId)

    if (existingChange?.links.some(item => item.targetDocumentId === targetDocumentId)) {
      try {
        const nextChange = await removeDocumentLinkFromChange({
          change: existingChange,
          targetDocumentId,
          deleteBlock: params.deleteBlock,
          updateBlock: params.updateBlock,
        })
        if (nextChange) {
          pendingAiLinkBlocks.value.set(orphanDocumentId, nextChange)
        } else {
          pendingAiLinkBlocks.value.delete(orphanDocumentId)
        }
        await invalidateSuggestionCache(params.invalidateAiSuggestionCache, orphanDocumentId)
        params.notify(t('analytics.controller.aiLinkSuggestionRemoved'), 3000, 'info')
      } catch (error) {
        const message = error instanceof Error ? error.message : t('analytics.controller.failedToRemoveAiLink')
        params.notify(message, 5000, 'error')
      }
      return
    }

    try {
      const change = existingChange
        ? await addDocumentLinkToChange({
            change: existingChange,
            targetDocumentId,
            targetDocumentTitle,
            updateBlock: params.updateBlock,
          })
        : await applyDocumentLinkToOrphanDocument({
            orphanDocumentId,
            targetDocumentId,
            targetDocumentTitle,
            getChildBlocks: params.getChildBlocks,
            getBlockKramdown: params.getBlockKramdown,
            updateBlock: params.updateBlock,
            prependBlock: params.prependBlock,
          })
      pendingAiLinkBlocks.value.set(orphanDocumentId, change)
      await invalidateSuggestionCache(params.invalidateAiSuggestionCache, orphanDocumentId)
      params.notify(t('analytics.controller.aiSuggestedLinkInsertedRefreshAnalysis'), 3000, 'info')
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToInsertAiSuggestedLink')
      params.notify(message, 5000, 'error')
    }
  }

  function isAiTagSuggestionActive(documentId: string, tag: string) {
    const normalizedTag = normalizeTag(tag)
    if (!normalizedTag) {
      return false
    }

    return pendingAiTagBlocks.value.get(documentId)?.appliedTags.some(item => normalizeTag(item) === normalizedTag) ?? false
  }

  async function toggleOrphanAiTagSuggestion(documentId: string, tag: string) {
    const normalizedTag = normalizeTag(tag)
    if (!normalizedTag) {
      params.notify(t('analytics.controller.tagEmptyCannotWrite'), 5000, 'error')
      return
    }

    const document = params.getDocumentById(documentId)
    if (!document) {
      params.notify(t('analytics.controller.matchingDocNotFoundCannotWriteTag'), 5000, 'error')
      return
    }

    const existingChange = pendingAiTagBlocks.value.get(documentId)
    const getBlockAttrs = params.getBlockAttrs
    const setBlockAttrs = params.setBlockAttrs

    if (!getBlockAttrs || !setBlockAttrs) {
      params.notify(t('analytics.controller.noDocTagApiCannotWriteTag'), 5000, 'error')
      return
    }

    try {
      if (existingChange?.appliedTags.some(item => normalizeTag(item) === normalizedTag)) {
        const nextChange = await removeTagFromDocumentChange({
          change: existingChange,
          tag: normalizedTag,
          getBlockAttrs,
          setBlockAttrs,
        })
        if (nextChange) {
          pendingAiTagBlocks.value.set(documentId, nextChange)
          params.onDocumentTagsChanged?.(documentId, [...nextChange.baseTags, ...nextChange.appliedTags])
        } else {
          pendingAiTagBlocks.value.delete(documentId)
          params.onDocumentTagsChanged?.(documentId, existingChange.baseTags)
        }
        await invalidateSuggestionCache(params.invalidateAiSuggestionCache, documentId)
        params.notify(t('analytics.controller.aiTagSuggestionRemoved'), 3000, 'info')
      } else {
        const change = existingChange
          ? await addTagToDocumentChange({
              change: existingChange,
              tag: normalizedTag,
              getBlockAttrs,
              setBlockAttrs,
            })
          : await applyTagToOrphanDocument({
              orphanDocumentId: documentId,
              tag: normalizedTag,
              getBlockAttrs,
              setBlockAttrs,
            })
        pendingAiTagBlocks.value.set(documentId, change)
        params.onDocumentTagsChanged?.(documentId, [...change.baseTags, ...change.appliedTags])
        await invalidateSuggestionCache(params.invalidateAiSuggestionCache, documentId)
        params.notify(t('analytics.controller.aiTagSuggestionWritten'), 3000, 'info')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToWriteAiTag')
      params.notify(message, 5000, 'error')
    }
  }

  return {
    clearPendingAiSuggestionActions,
    isAiLinkSuggestionActive,
    toggleOrphanAiLinkSuggestion,
    isAiTagSuggestionActive,
    toggleOrphanAiTagSuggestion,
  }
}

function normalizeTag(tag: string): string {
  return tag.trim()
}

async function invalidateSuggestionCache(
  invalidateAiSuggestionCache: ((documentId: string) => Promise<void>) | undefined,
  documentId: string,
) {
  try {
    await invalidateAiSuggestionCache?.(documentId)
  } catch {
    // Private index invalidation should not block the visible AI action.
  }
}
