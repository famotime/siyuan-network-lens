import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createAppWikiPanelController } from './use-app-wiki-panel'
import { buildSiyuanBlockLinkMarkdown } from '@/analytics/link-sync'

describe('createAppWikiPanelController', () => {
  it('opens the ranking-scope wiki panel with a deduplicated association request', async () => {
    const prepareWikiPreview = vi.fn(async () => undefined)
    const onSwitchDocument = vi.fn()
    const controller = createAppWikiPanelController({
      filteredDocuments: computed(() => []),
      resolveLinkAssociations: () => ({
        outbound: [{ documentId: 'doc-b' }, { documentId: 'doc-c' }],
        inbound: [{ documentId: 'doc-c' }, { documentId: 'doc-d' }],
        childDocuments: [{ documentId: 'doc-e' }, { documentId: 'doc-b' }],
      }),
      resolveTitle: () => 'Beta',
      prepareWikiPreview,
      onSwitchDocument,
    })

    await controller.toggleCoreDocumentWikiPanel('doc-a')

    expect(controller.wikiPanelPlacement.value).toBe('ranking')
    expect(controller.wikiPanelCoreDocumentId.value).toBe('doc-a')
    expect(controller.activeWikiPreviewRequest.value).toEqual({
      sourceDocumentIds: ['doc-a', 'doc-b', 'doc-c', 'doc-d', 'doc-e'],
      sourceDocumentLinkTypes: new Map([
        ['doc-b', 'child'],
        ['doc-c', 'inbound'],
        ['doc-d', 'inbound'],
        ['doc-e', 'child'],
      ]),
      scopeDescriptionLine: `- Scope source: related range for core doc ${buildSiyuanBlockLinkMarkdown('doc-a', 'Beta')} (outbound / inbound / child docs)`,
      themeDocumentId: 'doc-a',
    })
    expect(controller.isCoreDocumentWikiPanelVisible('doc-a')).toBe(true)
    expect(onSwitchDocument).toHaveBeenCalledWith('doc-a')
    expect(prepareWikiPreview).not.toHaveBeenCalled()
  })
})
