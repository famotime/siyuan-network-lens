import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createAppWikiPanelController } from './use-app-wiki-panel'

describe('createAppWikiPanelController', () => {
  it('opens and closes the document-scope wiki panel with the current filtered documents', async () => {
    const prepareWikiPreview = vi.fn(async () => undefined)
    const controller = createAppWikiPanelController({
      filteredDocuments: computed(() => [
        { id: 'doc-a' },
        { id: 'doc-b' },
      ]),
      resolveLinkAssociations: () => ({
        outbound: [],
        inbound: [],
        childDocuments: [],
      }),
      resolveTitle: documentId => documentId,
      prepareWikiPreview,
    })

    await controller.toggleDocumentWikiPanel()

    expect(controller.wikiPanelPlacement.value).toBe('documents')
    expect(controller.wikiPanelCoreDocumentId.value).toBe('')
    expect(controller.activeWikiPreviewRequest.value).toEqual({
      sourceDocumentIds: ['doc-a', 'doc-b'],
      scopeDescriptionLine: '- Scope source: current doc sample',
    })
    expect(prepareWikiPreview).toHaveBeenCalledWith({
      sourceDocumentIds: ['doc-a', 'doc-b'],
      scopeDescriptionLine: '- Scope source: current doc sample',
    })

    await controller.toggleDocumentWikiPanel()

    expect(controller.wikiPanelPlacement.value).toBe('')
    expect(controller.wikiPanelCoreDocumentId.value).toBe('')
    expect(prepareWikiPreview).toHaveBeenCalledTimes(1)
  })

  it('opens the ranking-scope wiki panel with a deduplicated association request', async () => {
    const prepareWikiPreview = vi.fn(async () => undefined)
    const controller = createAppWikiPanelController({
      filteredDocuments: computed(() => []),
      resolveLinkAssociations: () => ({
        outbound: [{ documentId: 'doc-b' }, { documentId: 'doc-c' }],
        inbound: [{ documentId: 'doc-c' }, { documentId: 'doc-d' }],
        childDocuments: [{ documentId: 'doc-e' }, { documentId: 'doc-b' }],
      }),
      resolveTitle: () => 'Beta',
      prepareWikiPreview,
    })

    await controller.toggleCoreDocumentWikiPanel('doc-a')

    expect(controller.wikiPanelPlacement.value).toBe('ranking')
    expect(controller.wikiPanelCoreDocumentId.value).toBe('doc-a')
    expect(controller.activeWikiPreviewRequest.value).toEqual({
      sourceDocumentIds: ['doc-a', 'doc-b', 'doc-c', 'doc-d', 'doc-e'],
      scopeDescriptionLine: '- Scope source: related range for core doc "Beta" (outbound / inbound / child docs)',
      themeDocumentId: 'doc-a',
    })
    expect(controller.isCoreDocumentWikiPanelVisible('doc-a')).toBe(true)
    expect(prepareWikiPreview).toHaveBeenCalledWith({
      sourceDocumentIds: ['doc-a', 'doc-b', 'doc-c', 'doc-d', 'doc-e'],
      scopeDescriptionLine: '- Scope source: related range for core doc "Beta" (outbound / inbound / child docs)',
      themeDocumentId: 'doc-a',
    })
  })
})
