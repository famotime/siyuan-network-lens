import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createAppWikiPanelController } from './use-app-wiki-panel'

describe('createAppWikiPanelController', () => {
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
    expect(prepareWikiPreview).not.toHaveBeenCalled()
  })
})
