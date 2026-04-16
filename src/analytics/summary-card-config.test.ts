import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SUMMARY_CARD_ORDER,
  SUMMARY_CARD_DEFINITIONS,
  buildSummaryCardVisibilityDefaults,
  getSummaryCardDefinition,
  getSummaryCardVisibilityConfigKey,
  isSummaryCardVisible,
} from './summary-card-config'

describe('summary card config', () => {
  it('uses a single definition list as the source of default order and card settings', () => {
    expect(SUMMARY_CARD_DEFINITIONS.map(item => item.key)).toEqual([
      'read',
      'todaySuggestions',
      'orphans',
      'ranking',
      'documents',
      'largeDocuments',
      'trends',
      'references',
      'communities',
      'propagation',
      'bridges',
      'dormant',
    ])
    expect(SUMMARY_CARD_DEFINITIONS.map(item => item.key)).toEqual(DEFAULT_SUMMARY_CARD_ORDER)
    expect(getSummaryCardDefinition('read')).toEqual(expect.objectContaining({
      key: 'read',
      visibilityConfigKey: 'showRead',
      defaultVisible: true,
      settingLabel: 'Read / unread card',
    }))
    expect(getSummaryCardDefinition('todaySuggestions')).toEqual(expect.objectContaining({
      key: 'todaySuggestions',
      visibilityConfigKey: 'showTodaySuggestions',
      defaultVisible: true,
      settingLabel: 'Today suggestions card',
    }))
    expect(getSummaryCardDefinition('bridges')).toEqual(expect.objectContaining({
      key: 'bridges',
      visibilityConfigKey: 'showBridges',
      defaultVisible: false,
      settingLabel: 'Bridge docs card',
    }))
    expect(getSummaryCardDefinition('largeDocuments')).toEqual(expect.objectContaining({
      key: 'largeDocuments',
      visibilityConfigKey: 'showLargeDocuments',
      settingLabel: 'Large docs card',
    }))
  })

  it('derives per-card visibility defaults and visibility lookups from the shared definitions', () => {
    expect(buildSummaryCardVisibilityDefaults()).toEqual({
      showRead: true,
      showTodaySuggestions: true,
      showOrphans: true,
      showRanking: true,
      showDocuments: false,
      showLargeDocuments: true,
      showTrends: false,
      showReferences: false,
      showCommunities: false,
      showPropagation: false,
      showBridges: false,
      showDormant: false,
    })

    expect(getSummaryCardVisibilityConfigKey('ranking')).toBe('showRanking')
    expect(getSummaryCardVisibilityConfigKey('largeDocuments')).toBe('showLargeDocuments')
    expect(isSummaryCardVisible({
      aiEnabled: false,
      showTodaySuggestions: true,
    } as any, 'todaySuggestions')).toBe(false)
    expect(isSummaryCardVisible({
      aiEnabled: true,
      showTodaySuggestions: false,
    } as any, 'todaySuggestions')).toBe(true)
    expect(isSummaryCardVisible({
      showSummaryCards: true,
      showRanking: false,
      themeNotebookId: '',
      themeDocumentPath: '',
      themeNamePrefix: '',
      themeNameSuffix: '',
    } as any, 'ranking')).toBe(false)
  })
})
