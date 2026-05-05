import { ref, type ComputedRef } from 'vue'

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
}) {
  const wikiPanelPlacement = ref<'documents' | 'ranking' | ''>('')
  const wikiPanelCoreDocumentId = ref('')
  const activeWikiPreviewRequest = ref<WikiPreviewRequest | null>(null)

  function isCoreDocumentWikiPanelVisible(documentId: string) {
    return wikiPanelPlacement.value === 'ranking' && wikiPanelCoreDocumentId.value === documentId
  }

  async function prepareCurrentWikiPreview() {
    await params.prepareWikiPreview(activeWikiPreviewRequest.value ?? undefined)
  }

  async function toggleDocumentWikiPanel() {
    if (wikiPanelPlacement.value === 'documents') {
      wikiPanelPlacement.value = ''
      wikiPanelCoreDocumentId.value = ''
      return
    }

    activeWikiPreviewRequest.value = {
      sourceDocumentIds: params.filteredDocuments.value.map(document => document.id),
      scopeDescriptionLine: '- Scope source: current doc sample',
    }
    wikiPanelPlacement.value = 'documents'
    wikiPanelCoreDocumentId.value = ''
    await prepareCurrentWikiPreview()
  }

  async function toggleCoreDocumentWikiPanel(documentId: string) {
    if (isCoreDocumentWikiPanelVisible(documentId)) {
      wikiPanelPlacement.value = ''
      wikiPanelCoreDocumentId.value = ''
      return
    }

    const associations = params.resolveLinkAssociations(documentId)
    const sourceDocumentIds = [
      documentId,
      ...associations.outbound.map(item => item.documentId),
      ...associations.inbound.map(item => item.documentId),
      ...associations.childDocuments.map(item => item.documentId),
    ]

    activeWikiPreviewRequest.value = {
      sourceDocumentIds: [...new Set(sourceDocumentIds)],
      scopeDescriptionLine: `- Scope source: related range for core doc "${params.resolveTitle(documentId)}" (outbound / inbound / child docs)`,
      themeDocumentId: documentId,
    }
    wikiPanelPlacement.value = 'ranking'
    wikiPanelCoreDocumentId.value = documentId
    await prepareCurrentWikiPreview()
  }

  return {
    wikiPanelPlacement,
    wikiPanelCoreDocumentId,
    activeWikiPreviewRequest,
    isCoreDocumentWikiPanelVisible,
    prepareCurrentWikiPreview,
    toggleDocumentWikiPanel,
    toggleCoreDocumentWikiPanel,
  }
}
