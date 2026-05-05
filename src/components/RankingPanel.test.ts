import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'

import RankingPanel from './RankingPanel.vue'

const wikiPanelProps = {
  wikiEnabled: true,
  aiEnabled: true,
  aiConfigReady: true,
  previewLoading: false,
  applyLoading: false,
  error: '',
  preview: {
    generatedAt: '2026-04-10T08:00:00.000Z',
    scope: {
      summary: {
        themeDocumentCount: 2,
        sourceDocumentCount: 2,
        themeGroupCount: 1,
        excludedWikiDocumentCount: 0,
        unclassifiedDocumentCount: 0,
      },
      descriptionLines: ['- 范围来源：核心文档《Alpha》关联范围（正链 / 反链 / 子文档）'],
    },
    themePages: [],
    unclassifiedDocuments: [],
    excludedWikiDocuments: [],
  },
  prepareWikiPreview: vi.fn(),
  applyWikiChanges: vi.fn(),
  openWikiDocument: vi.fn(),
}

describe('RankingPanel', () => {
  it('uses keyed i18n entries instead of inline uiText pairs', async () => {
    const source = await readFile(new URL('./RankingPanel.vue', import.meta.url), 'utf8')

    expect(source).toContain("import { t } from '@/i18n/ui'")
    expect(source).toContain("{{ t('rankingPanel.title') }}")
    expect(source).toContain("{{ t('rankingPanel.description') }}")
    expect(source).toContain("{{ t('rankingPanel.empty') }}")
    expect(source).not.toContain('uiText(')
  })

  it('renders a wiki maintenance button inside theme document cards only', async () => {
    const app = createSSRApp({
      render: () => h(RankingPanel, {
        variant: 'detail',
        ranking: [
          {
            documentId: 'doc-a',
            title: 'Alpha',
            inboundReferences: 3,
            distinctSourceDocuments: 2,
            outboundReferences: 1,
            tagCount: 1,
            childDocumentCount: 0,
            createdAt: '20260301090000',
            updatedAt: '20260311120000',
            isThemeDocument: true,
            suggestions: [],
          },
          {
            documentId: 'doc-b',
            title: 'Beta',
            inboundReferences: 2,
            distinctSourceDocuments: 1,
            outboundReferences: 0,
            tagCount: 0,
            childDocumentCount: 0,
            createdAt: '20260302090000',
            updatedAt: '20260312120000',
            isThemeDocument: false,
            suggestions: [],
          },
        ],
        panelCount: 2,
        snapshotLabel: '04-10 16:00',
        isExpanded: true,
        onTogglePanel: vi.fn(),
        resolveTitle: (documentId: string) => ({ 'doc-a': 'Alpha', 'doc-b': 'Beta' }[documentId] ?? documentId),
        formatTimestamp: (timestamp?: string) => timestamp ?? '未知时间',
        openDocument: vi.fn(),
        toggleLinkPanel: vi.fn(),
        isLinkPanelExpanded: vi.fn(() => false),
        resolveLinkAssociations: vi.fn(() => ({ outbound: [], inbound: [], childDocuments: [] })),
        toggleLinkGroup: vi.fn(),
        isLinkGroupExpanded: vi.fn(() => false),
        isSyncing: vi.fn(() => false),
        syncAssociation: vi.fn(),
        wikiPanelProps,
        isWikiPanelVisibleForCoreDocument: (documentId: string) => documentId === 'doc-a',
        toggleCoreDocumentWikiPanel: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect((html.match(/Maintain LLM Wiki|Hide LLM Wiki/g) ?? [])).toHaveLength(1)
    expect(html).toContain('Hide LLM Wiki')
    expect(html).not.toContain('Maintain LLM Wiki')
    expect((html.match(/ghost-button ghost-button--filled/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('范围来源：核心文档《Alpha》关联范围')
    expect((html.match(/wiki-panel panel/g) ?? [])).toHaveLength(1)
  })

  it('hides core document wiki actions when the alpha gate disables wiki entry points', async () => {
    const app = createSSRApp({
      render: () => h(RankingPanel, {
        variant: 'detail',
        ranking: [
          {
            documentId: 'doc-a',
            title: 'Alpha',
            inboundReferences: 3,
            distinctSourceDocuments: 2,
            outboundReferences: 1,
            tagCount: 1,
            childDocumentCount: 0,
            createdAt: '20260301090000',
            updatedAt: '20260311120000',
            isThemeDocument: false,
            suggestions: [],
          },
        ],
        panelCount: 1,
        snapshotLabel: '04-10 16:00',
        isExpanded: true,
        onTogglePanel: vi.fn(),
        resolveTitle: (documentId: string) => ({ 'doc-a': 'Alpha' }[documentId] ?? documentId),
        formatTimestamp: (timestamp?: string) => timestamp ?? '未知时间',
        openDocument: vi.fn(),
        toggleLinkPanel: vi.fn(),
        isLinkPanelExpanded: vi.fn(() => false),
        resolveLinkAssociations: vi.fn(() => ({ outbound: [], inbound: [], childDocuments: [] })),
        toggleLinkGroup: vi.fn(),
        isLinkGroupExpanded: vi.fn(() => false),
        isSyncing: vi.fn(() => false),
        syncAssociation: vi.fn(),
        wikiPanelProps,
        isWikiPanelVisibleForCoreDocument: vi.fn(() => false),
        toggleCoreDocumentWikiPanel: vi.fn(),
        showWikiPanelActions: false,
      }),
    })

    const html = await renderToString(app)

    expect(html).not.toContain('Maintain LLM Wiki')
    expect(html).not.toContain('Hide LLM Wiki')
    expect(html).not.toContain('wiki-panel panel')
  })
})
