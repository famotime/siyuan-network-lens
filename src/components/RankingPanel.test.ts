import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import RankingPanel from './RankingPanel.vue'

const baseRanking = [
  {
    documentId: 'doc-a',
    title: 'Alpha',
    inboundReferences: 1,
    distinctSourceDocuments: 1,
    outboundReferences: 0,
    lastActiveAt: '20260310120000',
  },
]

describe('RankingPanel', () => {
  it('renders collapsed association button label', async () => {
    const toggleLinkPanel = vi.fn()

    const app = createSSRApp({
      render: () => h(RankingPanel, {
        ranking: baseRanking,
        panelCount: 1,
        snapshotLabel: '03-12 00:00',
        isExpanded: true,
        onTogglePanel: vi.fn(),
        resolveTitle: (id: string) => id,
        formatTimestamp: () => '2026-03-10',
        openDocument: vi.fn(),
        toggleLinkPanel,
        isLinkPanelExpanded: () => false,
        resolveLinkAssociations: () => ({ outbound: [], inbound: [] }),
        toggleLinkGroup: vi.fn(),
        isLinkGroupExpanded: () => false,
        isSyncing: () => false,
        syncAssociation: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('查看关联引用/链接')
  })

  it('renders expanded group buttons with caret state', async () => {
    const app = createSSRApp({
      render: () => h(RankingPanel, {
        ranking: baseRanking,
        panelCount: 1,
        snapshotLabel: '03-12 00:00',
        isExpanded: true,
        onTogglePanel: vi.fn(),
        resolveTitle: (id: string) => id,
        formatTimestamp: () => '2026-03-10',
        openDocument: vi.fn(),
        toggleLinkPanel: vi.fn(),
        isLinkPanelExpanded: () => true,
        resolveLinkAssociations: () => ({
          outbound: [{ documentId: 'doc-x', title: 'Doc X', direction: 'outbound', isOverlap: false }],
          inbound: [],
        }),
        toggleLinkGroup: vi.fn(),
        isLinkGroupExpanded: (_documentId: string, direction: 'outbound' | 'inbound') => direction === 'outbound',
        isSyncing: () => false,
        syncAssociation: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('link-association__toggle--expanded')
  })

  it('renders highlight links with sync action', async () => {
    const app = createSSRApp({
      render: () => h(RankingPanel, {
        ranking: baseRanking,
        panelCount: 1,
        snapshotLabel: '03-12 00:00',
        isExpanded: true,
        onTogglePanel: vi.fn(),
        resolveTitle: (id: string) => id,
        formatTimestamp: () => '2026-03-10',
        openDocument: vi.fn(),
        toggleLinkPanel: vi.fn(),
        isLinkPanelExpanded: () => true,
        resolveLinkAssociations: () => ({
          outbound: [{ documentId: 'doc-x', title: 'Doc X', direction: 'outbound', isOverlap: false }],
          inbound: [],
        }),
        toggleLinkGroup: vi.fn(),
        isLinkGroupExpanded: () => true,
        isSyncing: () => false,
        syncAssociation: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Doc X')
    expect(html).toContain('link-association__doc--highlight')
    expect(html).toContain('同步')
  })
})
