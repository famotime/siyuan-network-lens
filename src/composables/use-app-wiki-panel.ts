import { ref, type ComputedRef } from 'vue'

import { buildSiyuanBlockLinkMarkdown } from '@/analytics/link-sync'
import { t } from '@/i18n/ui'
import type { WikiPreviewRequest } from './use-analytics-wiki'

type DocumentIdItem = { documentId: string }

type LinkAssociations = {
  outbound: DocumentIdItem[]
  inbound: DocumentIdItem[]
  childDocuments: DocumentIdItem[]
}

export function createAppWikiPanelController(params: {
  filteredDocuments: ComputedRef<Array<{ id: string }>>
  resolveLinkAssociations: (documentId: string) => LinkAssociations
  resolveTitle: (documentId: string) => string
  prepareWikiPreview: (request?: WikiPreviewRequest) => Promise<void>
  onSwitchDocument: (themeDocumentId: string) => void | Promise<void>
}) {
  const wikiPanelPlacement = ref<'ranking' | ''>('')
  const wikiPanelCoreDocumentId = ref('')
  const activeWikiPreviewRequest = ref<WikiPreviewRequest | null>(null)

  function isCoreDocumentWikiPanelVisible(documentId: string) {
    return wikiPanelPlacement.value === 'ranking' && wikiPanelCoreDocumentId.value === documentId
  }

  async function prepareCurrentWikiPreview() {
    await params.prepareWikiPreview(activeWikiPreviewRequest.value ?? undefined)
  }

  async function toggleCoreDocumentWikiPanel(documentId: string) {
    if (isCoreDocumentWikiPanelVisible(documentId)) {
      wikiPanelPlacement.value = ''
      wikiPanelCoreDocumentId.value = ''
      return
    }

    await params.onSwitchDocument(documentId)

    const associations = params.resolveLinkAssociations(documentId)
    const sourceDocumentIds = [
      documentId,
      ...associations.outbound.map(item => item.documentId),
      ...associations.inbound.map(item => item.documentId),
      ...associations.childDocuments.map(item => item.documentId),
    ]

    const sourceDocumentLinkTypes = new Map<string, 'outbound' | 'inbound' | 'child'>()
    for (const item of associations.outbound) {
      sourceDocumentLinkTypes.set(item.documentId, 'outbound')
    }
    for (const item of associations.inbound) {
      sourceDocumentLinkTypes.set(item.documentId, 'inbound')
    }
    for (const item of associations.childDocuments) {
      sourceDocumentLinkTypes.set(item.documentId, 'child')
    }

    activeWikiPreviewRequest.value = {
      sourceDocumentIds: [...new Set(sourceDocumentIds)],
      sourceDocumentLinkTypes,
      scopeDescriptionLine: t('analytics.wiki.scopeSourceRelatedRange', { title: buildSiyuanBlockLinkMarkdown(documentId, params.resolveTitle(documentId)) }),
      themeDocumentId: documentId,
    }
    wikiPanelPlacement.value = 'ranking'
    wikiPanelCoreDocumentId.value = documentId
  }

  return {
    wikiPanelPlacement,
    wikiPanelCoreDocumentId,
    activeWikiPreviewRequest,
    isCoreDocumentWikiPanelVisible,
    prepareCurrentWikiPreview,
    toggleCoreDocumentWikiPanel,
  }
}
