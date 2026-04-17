import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import SummaryDetailSection from './SummaryDetailSection.vue'

const wikiPanelProps = {
  wikiEnabled: true,
  aiEnabled: true,
  aiConfigReady: true,
  previewLoading: false,
  applyLoading: false,
  error: '',
  preview: null,
  prepareWikiPreview: vi.fn(),
  applyWikiChanges: vi.fn(),
  openWikiDocument: vi.fn(),
}

const baseProps = {
  selectedSummaryCount: 1,
  isExpanded: true,
  onTogglePanel: vi.fn(),
  aiSuggestionEnabled: true,
  aiSuggestionConfigured: true,
  aiSuggestionLoading: false,
  aiSuggestionError: '',
  generateAiInbox: vi.fn(),
  orphanDetailItems: [],
  orphanThemeSuggestions: new Map<string, Array<{ themeDocumentId: string, themeDocumentTitle: string, themeName: string, matchCount: number }>>(),
  orphanSort: 'updated-desc' as const,
  onUpdateOrphanSort: vi.fn(),
  dormantDays: 30,
  onUpdateDormantDays: vi.fn(),
  openDocument: vi.fn(),
  toggleOrphanThemeSuggestion: vi.fn(),
  isThemeSuggestionActive: vi.fn(() => false),
  toggleOrphanAiLinkSuggestion: vi.fn(),
  isAiLinkSuggestionActive: vi.fn(() => false),
  toggleOrphanAiTagSuggestion: vi.fn(),
  isAiTagSuggestionActive: vi.fn(() => false),
  aiEnabled: true,
  aiLinkSuggestionConfigReady: true,
  orphanAiSuggestionStates: new Map(),
  generateOrphanAiSuggestion: vi.fn(),
  readCardMode: 'unread' as const,
  pathScope: 'focused' as const,
  onUpdatePathScope: vi.fn(),
  maxPathDepth: 4,
  onUpdateMaxPathDepth: vi.fn(),
  fromDocumentId: 'doc-a',
  onUpdateFromDocumentId: vi.fn(),
  toDocumentId: 'doc-b',
  onUpdateToDocumentId: vi.fn(),
  pathOptions: [
    { id: 'doc-a', title: 'Alpha' },
    { id: 'doc-b', title: 'Beta' },
  ],
  pathChain: ['doc-a', 'doc-b'],
  resolveTitle: (documentId: string) => ({ 'doc-a': 'Alpha', 'doc-b': 'Beta' }[documentId] ?? documentId),
  snapshotLabel: '03-14 11:00',
  formatTimestamp: (timestamp?: string) => timestamp ?? 'Unknown time',
  toggleLinkPanel: vi.fn(),
  isLinkPanelExpanded: vi.fn(() => false),
  resolveLinkAssociations: vi.fn(() => ({ outbound: [], inbound: [], childDocuments: [] })),
  toggleLinkGroup: vi.fn(),
  isLinkGroupExpanded: vi.fn(() => false),
  isSyncing: vi.fn(() => false),
  syncAssociation: vi.fn(),
  formatDelta: (delta: number) => delta > 0 ? `+${delta}` : String(delta),
  themeDocumentIds: new Set<string>(['doc-a']),
  themeDocuments: [],
  selectCommunity: vi.fn(),
  wikiPanelProps,
  isCoreDocumentWikiPanelVisible: vi.fn(() => false),
  toggleCoreDocumentWikiPanel: vi.fn(),
  aiInboxHistory: [],
  selectedAiInboxHistoryId: '',
  selectAiInboxHistory: vi.fn(),
}

describe('SummaryDetailSection', () => {
  it('does not warn when showWikiPanelActions is omitted and the default is used', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const { showWikiPanelActions: _showWikiPanelActions, ...propsWithoutWikiToggle } = baseProps
      const app = createSSRApp({
        render: () => h(SummaryDetailSection, {
          ...propsWithoutWikiToggle,
          detail: {
            key: 'documents',
            title: 'Doc sample',
            description: 'Docs matched by the current filters.',
            kind: 'list',
            items: [],
          },
        }),
      })

      await renderToString(app)

      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('renders generic list details inside a collapsible panel', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        detail: {
          key: 'documents',
          title: 'Doc sample',
          description: 'Docs matched by the current filters.',
          kind: 'list',
          items: [
            {
              documentId: 'doc-a',
              title: 'Alpha',
              meta: '/Alpha · Updated 2026-03-14',
              badge: 'Topic doc',
              isThemeDocument: true,
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)
    const toggleMarkup = html.match(/<button class="panel-toggle"[\s\S]*?<\/button>/)?.[0] ?? ''

    expect(html).toContain('Doc sample')
    expect(html).toContain('summary-detail-item')
    expect(html).toContain('Alpha')
    expect(html).toContain('Topic doc')
    expect(toggleMarkup).toContain('aria-label="Collapse details"')
    expect(toggleMarkup).toContain('panel-toggle__caret')
    expect(toggleMarkup).not.toMatch(/>\s*折叠\s*<span/)
    expect(toggleMarkup).not.toMatch(/>\s*展开\s*<span/)
  })

  it('starts moving summary detail chrome and ai empty states to keyed i18n entries', async () => {
    const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./SummaryDetailSection.vue', import.meta.url), 'utf8'))

    expect(source).toContain("import { pickUiText, t } from '@/i18n/ui'")
    expect(source).toContain(":aria-label=\"isExpanded ? t('summaryDetail.collapseDetails') : t('summaryDetail.expandDetails')\"")
    expect(source).toContain("{{ t('summaryDetail.historyLabel') }}")
    expect(source).toContain("{{ aiSuggestionLoading ? t('summaryDetail.analyzing') : detail.result ? t('summaryDetail.reanalyze') : t('summaryDetail.todaySuggestions') }}")
    expect(source).toContain("{{ t('summaryDetail.aiEmpty.enableAi') }}")
    expect(source).toContain("{{ t('summaryDetail.aiEmpty.incompleteConfig') }}")
    expect(source).toContain("{{ t('summaryDetail.aiEmpty.openTodaySuggestions') }}")
    expect(source).toContain("{{ t('summaryDetail.aiSection.suggestedTargets') }}")
    expect(source).toContain("{{ t('summaryDetail.aiSection.recommendedAction') }}")
    expect(source).toContain("{{ t('summaryDetail.aiSection.whyFirst') }}")
    expect(source).toContain("{{ t('summaryDetail.empty.noDocs') }}")
    expect(source).toContain("{{ t('summaryDetail.empty.noPropagationNodes') }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.title') }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.scopeLabel') }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.scopeFocused') }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.scopeAll') }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.scopeCommunity') }}")
    expect(source).toContain("{{ t('summaryDetail.empty.noExplainablePath') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.currentWindow') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.previousWindow') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.newLinks') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.brokenLinks') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.documentHeat') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.risingDocs') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.noClearlyRisingDocs') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.documentCooling') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.coolingDocs') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.noClearlyCoolingDocs') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.communityLift') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.communityIdle') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.brokenPaths') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.risingTopics') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.noClearlyRisingTopics') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.lowActivityTopics') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.lowActivity') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.noClearlyLowActivityTopics') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.brokenPathDescription') }}")
    expect(source).toContain("{{ t('summaryDetail.trends.noClearlyBrokenLinks') }}")
    expect(source).toContain("{{ t('summaryDetail.counts.suggestions', { count: detail.result.items.length }) }}")
    expect(source).toContain("{{ t('summaryDetail.trends.currentPrevious', { current: item.currentReferences, previous: item.previousReferences }) }}")
    expect(source).toContain("{{ t('summaryDetail.trends.currentPrevious', { current: community.currentReferences, previous: community.previousReferences }) }}")
    expect(source).toContain("{{ t('summaryDetail.trends.referenceCount', { count: edge.referenceCount }) }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.maxDepth') }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.fromLabel') }}")
    expect(source).toContain("{{ t('summaryDetail.propagation.toLabel') }}")
    expect(source).toContain(":title=\"t('summaryDetail.themeSuggestionTooltip', { title: suggestion.themeDocumentTitle, count: suggestion.matchCount })\"")
    expect(source).toContain("? t('summaryDetail.counts.suggestions', { count: props.selectedSummaryCount })")
    expect(source).toContain(": t('summaryDetail.counts.docs', { count: props.selectedSummaryCount })")
    expect(source).toContain("if (suggestion.label !== t('summaryDetail.labels.repairLinks'))")
    expect(source).toContain("text: t('summaryDetail.labels.repairLinksWithTopics', { text })")
    expect(source).toContain("return t('summaryDetail.labels.repairLinks')")
    expect(source).toContain("return t('summaryDetail.labels.buildTopicPage')")
    expect(source).toContain("return t('summaryDetail.labels.bridgeRisk')")
    expect(source).toContain("return t('summaryDetail.labels.documentCleanup')")
    expect(source).toContain("t('summaryDetail.historyTooltip.generated', { value: entry.generatedAt || t('summaryDetail.historyTooltip.unknownTime') })")
    expect(source).toContain("t('summaryDetail.historyTooltip.window', { value: entry.timeRange })")
    expect(source).toContain("t('summaryDetail.historyTooltip.count', { value: entry.summaryCount })")
    expect(source).toContain("t('summaryDetail.historyTooltip.notebook', { value: entry.filters.notebook || t('summaryDetail.historyTooltip.all') })")
    expect(source).not.toContain(":aria-label=\"isExpanded ? uiText('Collapse details', '收起详情') : uiText('Expand details', '展开详情')\"")
  })

  it('does not render the wiki maintenance entry inside the document sample detail card', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        detail: {
          key: 'documents',
          title: 'Doc sample',
          description: 'Docs matched by the current filters.',
          kind: 'list',
          items: [
            {
              documentId: 'doc-a',
              title: 'Alpha',
              meta: '/Alpha · Updated 2026-03-14',
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('summary-detail-list')
    expect(html).not.toContain('summary-detail-wiki-action')
    expect(html).not.toContain('Maintain LLM Wiki')
    expect(html).not.toContain('wiki-panel panel')
  })

  it('renders propagation detail items and path controls', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        detail: {
          key: 'propagation',
          title: 'Propagation nodes',
          description: 'Docs that frequently appear on key shortest paths.',
          kind: 'propagation',
          items: [
            {
              documentId: 'doc-a',
              title: 'Alpha',
              meta: 'Covers 2 focus docs · Community span 1',
              badge: '3 pts',
              isThemeDocument: true,
              suggestions: [{ label: 'Propagation optimization', text: 'Add path notes.' }],
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Propagation nodes')
    expect(html).toContain('Propagation paths')
    expect(html).toContain('Core + bridge')
    expect(html).toContain('Alpha')
    expect(html).toContain('3 pts')
    expect(html).toContain('path-node')
  })

  it('renders orphan-style theme suggestions inside unread detail items', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        orphanThemeSuggestions: new Map([
          ['doc-orphan', [
            { themeDocumentId: 'doc-theme-ai', themeDocumentTitle: '主题-AI-索引', themeName: 'AI', matchCount: 2 },
          ]],
        ]),
        detail: {
          key: 'read',
          title: 'Unread docs',
          description: 'Docs not matched by read rules.',
          kind: 'list',
          items: [
            {
              documentId: 'doc-orphan',
              title: 'Alpha',
              meta: 'Created 2026-03-14',
              badge: 'Needs review',
              suggestions: [{ label: 'Repair links', text: 'No doc-level links in the current window.' }],
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Unread docs')
    expect(html).toContain('Created 2026-03-14')
    expect(html).toContain('Repair links')
    expect(html).toContain('No doc-level links in the current window, suggested topic docs below (click to add):')
    expect(html).toContain('AI')
  })

  it('renders today suggestions with a separate toolbar row below the title area', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        isAiLinkSuggestionActive: vi.fn(() => true),
        selectedSummaryCount: 2,
        detail: {
          key: 'todaySuggestions',
          title: 'Today suggestions',
          description: 'Suggestions ranked by priority.',
          kind: 'aiInbox',
          result: {
            generatedAt: '2026-04-03T08:00:00.000Z',
            summary: 'Repair AI topic links first today.',
            items: [
              {
                id: 'task-doc-1',
                type: 'document',
                title: 'Repair orphan doc: AI and machine learning notes',
                priority: 'P1',
                action: 'Link this doc to Topic-AI-Index and AI Overview.\nCan fit the AI topic: ((doc-theme-ai "Topic-AI-Index"))',
                reason: 'It is isolated in the current window, but strongly matches the AI and Machine Learning topic pages. This can remove one orphan doc and grow the topic cluster from 8 to 9.',
                documentIds: ['doc-orphan'],
                recommendedTargets: [
                  {
                    documentId: 'doc-theme-ai',
                    title: 'Topic-AI-Index',
                    reason: 'Acts as a stable topic entry',
                    kind: 'theme-document',
                  },
                  {
                    documentId: 'doc-core-ai',
                    title: 'AI Overview',
                    reason: 'Can be used as a related core doc',
                    kind: 'core-document',
                  },
                ],
                evidence: ['Isolated in the current window', 'Topic match hit 4 times'],
                expectedChanges: ['Expected orphan count -1'],
              },
            ],
          },
        },
        aiSuggestionEnabled: true,
        aiSuggestionConfigured: true,
        aiSuggestionLoading: false,
        aiSuggestionError: '',
        generateAiInbox: vi.fn(),
      }),
    })

    const html = await renderToString(app)
    const headerMainStart = html.indexOf('panel-header__main')
    const toolbarStart = html.indexOf('panel-header__ai-toolbar')
    const detailBodyStart = html.indexOf('summary-detail-body')
    const headerMainMarkup = headerMainStart >= 0 && toolbarStart > headerMainStart
      ? html.slice(headerMainStart, toolbarStart)
      : ''
    const toolbarMarkup = toolbarStart >= 0 && detailBodyStart > toolbarStart
      ? html.slice(toolbarStart, detailBodyStart)
      : ''

    expect(html).toContain('2 suggestions')
    expect(html).toContain('Reanalyze')
    expect(headerMainMarkup).toContain('Suggestions ranked by priority.')
    expect(headerMainMarkup).toContain('2 suggestions')
    expect(headerMainMarkup).toContain('panel-toggle')
    expect(headerMainMarkup).not.toContain('action-button')
    expect(headerMainMarkup).not.toContain('Reanalyze')
    expect(headerMainMarkup).not.toContain('History:')
    expect(toolbarMarkup).toContain('panel-header__ai-toolbar')
    expect(toolbarMarkup).toContain('action-button')
    expect(toolbarMarkup).toContain('Reanalyze')
    expect(toolbarMarkup).not.toContain('panel-toggle')
    expect(html).toContain('Repair AI topic links first today.')
    expect(html).toContain('Repair orphan doc:')
    expect(html).toContain('AI and machine learning notes')
    expect(html).toContain('document-title__button--default')
    expect(html).not.toContain('Open document')
    expect(html).toContain('Suggested targets')
    expect(html).toContain('Recommended action')
    expect(html).toContain('Why this first')
    expect(html).toContain('Link this doc to Topic-AI-Index and AI Overview.')
    expect(html).toContain('Can fit the AI topic: Topic-AI-Index')
    expect(html).toContain('It is isolated in the current window, but strongly matches the AI and Machine Learning topic pages.')
    expect(html).toContain('This can remove one orphan doc and grow the topic cluster from 8 to 9.')
    expect(html).toContain('Isolated in the current window')
    expect(html).toContain('Expected orphan count -1')
    expect(html.indexOf('Suggested targets')).toBeLessThan(html.indexOf('Recommended action'))
    expect(html.indexOf('Recommended action')).toBeLessThan(html.indexOf('Why this first'))
    expect(html).toContain('ai-suggestion-panel__action-pills')
    expect(html).toContain('ai-suggestion-panel__action-pill')
    expect(html).not.toContain('为什么先做')
    expect(html).not.toContain('预估收益')
    expect(html).not.toContain('建议草稿')
    expect(html).toContain('Topic-AI-Index')
    expect(html).toContain('AI Overview')
    expect((html.match(/ai-suggestion-panel__action-pill--active/g) ?? [])).toHaveLength(1)
    expect(html).not.toContain('doc-theme-ai')
    expect(html).not.toContain('doc-core-ai')
    expect(html).not.toContain('>证据<')
    expect(html).not.toContain('>处理后变化<')
    expect(html).not.toContain('Test connection')
  })

  it('renders today suggestion history buttons in a dedicated toolbar row before the reanalyze action and exposes tooltip metadata', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        detail: {
          key: 'todaySuggestions',
          title: 'Today suggestions',
          description: 'Suggestions ranked by priority.',
          kind: 'aiInbox',
          result: {
            generatedAt: '2026-04-03T08:00:00.000Z',
            summary: 'Current suggestions',
            items: [
              {
                id: 'task-doc-current',
                type: 'document',
                title: 'Current suggestion',
                priority: 'P1',
                action: 'Add link to Topic-AI-Index',
                reason: 'Isolated in the current window.',
              },
            ],
          },
        },
        aiInboxHistory: [
          {
            id: 'history-1',
            generatedAt: '2026-04-03T07:30:00.000Z',
            timeRange: '7d',
            filters: {
              notebook: 'box-1',
              tags: ['AI'],
              themeNames: ['AI'],
              keyword: 'machine learning',
            },
            summaryCount: 2,
            result: {
              generatedAt: '2026-04-03T07:30:00.000Z',
              summary: 'History suggestion 1',
              items: [
                {
                  id: 'task-doc-history-1',
                  type: 'document',
                  title: 'History suggestion 1',
                  priority: 'P1',
                  action: 'Add link to Topic-AI-Index',
                  reason: 'Isolated in the current window.',
                },
              ],
            },
          },
          {
            id: 'history-2',
            generatedAt: '2026-04-03T07:00:00.000Z',
            timeRange: '30d',
            filters: {
              notebook: '',
              tags: ['AI', 'ML'],
              themeNames: ['AI', 'Machine Learning'],
              keyword: '',
            },
            summaryCount: 1,
            result: {
              generatedAt: '2026-04-03T07:00:00.000Z',
              summary: 'History suggestion 2',
              items: [
                {
                  id: 'task-doc-history-2',
                  type: 'document',
                  title: 'History suggestion 2',
                  priority: 'P2',
                  action: 'Add link to Topic-Machine-Learning-Index',
                  reason: 'Isolated in the current window.',
                },
              ],
            },
          },
          {
            id: 'history-3',
            generatedAt: '2026-04-03T06:30:00.000Z',
            timeRange: 'all',
            filters: {
              notebook: 'box-2',
              tags: [],
              themeNames: [],
              keyword: 'bridge',
            },
            summaryCount: 3,
            result: {
              generatedAt: '2026-04-03T06:30:00.000Z',
              summary: 'History suggestion 3',
              items: [
                {
                  id: 'task-doc-history-3',
                  type: 'document',
                  title: 'History suggestion 3',
                  priority: 'P3',
                  action: 'Add link to bridge doc',
                  reason: 'Isolated in the current window.',
                },
              ],
            },
          },
        ],
        selectedAiInboxHistoryId: 'history-2',
      } as any),
    })

    const html = await renderToString(app)
    const historyButtonsStart = html.indexOf('ai-history-button')
    const historyLabelStart = html.indexOf('History:')
    const actionButtonStart = html.indexOf('action-button')
    const toolbarStart = html.indexOf('panel-header__ai-toolbar')
    const detailBodyStart = html.indexOf('summary-detail-body')
    const toolbarMarkup = toolbarStart >= 0 && detailBodyStart > toolbarStart
      ? html.slice(toolbarStart, detailBodyStart)
      : ''
    const historyButtonMatches = html.match(/<button class="ai-history-button(?: history-button--active)?"/g) ?? []

    expect(html).toContain('ai-history-button')
    expect(historyButtonMatches).toHaveLength(3)
    expect(html).toContain('panel-header__ai-toolbar')
    expect(html).toContain('History:')
    expect(toolbarMarkup).toContain('panel-header__ai-history-group')
    expect(toolbarMarkup).toContain('panel-header__ai-history-buttons')
    expect(historyButtonsStart).toBeGreaterThanOrEqual(0)
    expect(historyLabelStart).toBeGreaterThanOrEqual(0)
    expect(historyButtonsStart).toBeGreaterThan(historyLabelStart)
    expect(actionButtonStart).toBeGreaterThan(historyButtonsStart)
    expect(toolbarMarkup).toContain('ai-history-button')
    expect(toolbarMarkup).toContain('action-button')
    expect(toolbarMarkup).not.toContain('panel-toggle')
    expect(html).toContain('>1<')
    expect(html).toContain('>2<')
    expect(html).toContain('>3<')
    expect(html).toContain('Generated')
    expect(html).toContain('Window')
    expect(html).toContain('Count')
    expect(html).toContain('Keyword')
    expect(html).toContain('history-button--active')
  })

  it('hides the ai toolbar row when the detail panel is collapsed', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        isExpanded: false,
        detail: {
          key: 'todaySuggestions',
          title: 'Today suggestions',
          description: 'Suggestions ranked by priority.',
          kind: 'aiInbox',
          result: null,
        },
        aiInboxHistory: [
          {
            id: 'history-1',
            generatedAt: '2026-04-03T07:30:00.000Z',
            timeRange: '7d',
            filters: {
              notebook: '',
              tags: [],
              themeNames: [],
              keyword: '',
            },
            summaryCount: 2,
            result: {
              generatedAt: '2026-04-03T07:30:00.000Z',
              summary: 'History suggestion 1',
              items: [],
            },
          },
        ],
      } as any),
    })

    const html = await renderToString(app)

    expect(html).toContain('Today suggestions')
    expect(html).toContain('1 suggestions')
    expect(html).toContain('panel-toggle')
    expect(html).not.toContain('panel-header__ai-toolbar')
    expect(html).not.toContain('History:')
    expect(html).not.toContain('action-button')
  })

  it('renders theme action pills from action text when recommended targets are missing', async () => {
    const app = createSSRApp({
      render: () => h(SummaryDetailSection, {
        ...baseProps,
        isAiLinkSuggestionActive: vi.fn((sourceDocumentId: string, targetDocumentId: string) => {
          return sourceDocumentId === 'doc-orphan' && targetDocumentId === 'doc-openclaw'
        }),
        themeDocuments: [
          {
            documentId: 'doc-openclaw',
            title: '~OpenClaw',
            themeName: 'OpenClaw',
            matchTerms: ['OpenClaw'],
            box: 'box-1',
            path: '/topics/openclaw.sy',
            hpath: '/主题笔记/~OpenClaw',
          },
          {
            documentId: 'doc-skills',
            title: '~Skills',
            themeName: 'Skills',
            matchTerms: ['Skills'],
            box: 'box-1',
            path: '/topics/skills.sy',
            hpath: '/主题笔记/~Skills',
          },
        ],
        detail: {
          key: 'todaySuggestions',
          title: 'Today suggestions',
          description: 'Suggestions ranked by priority.',
          kind: 'aiInbox',
          result: {
            generatedAt: '2026-04-03T08:00:00.000Z',
            summary: 'Repair orphan docs first today.',
            items: [
              {
                id: 'task-doc-2',
                type: 'document',
                title: 'Repair orphan doc: Alan first-week note excerpts',
                priority: 'P2',
                action: 'Add links to ~OpenClaw and ~Skills, then note which topic it belongs to.',
                reason: 'No doc-level links currently, with matches to both OpenClaw and Skills topics.',
                documentIds: ['doc-orphan'],
              },
            ],
          },
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('~OpenClaw')
    expect(html).toContain('~Skills')
    expect(html).toContain('ai-suggestion-panel__action-pills')
    expect((html.match(/ai-suggestion-panel__action-pill/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((html.match(/ai-suggestion-panel__action-pill--active/g) ?? [])).toHaveLength(1)
  })
})
