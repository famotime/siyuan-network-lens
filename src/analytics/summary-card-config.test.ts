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
      settingLabel: '已读/未读文档卡片',
    }))
    expect(getSummaryCardDefinition('bridges')).toEqual(expect.objectContaining({
      key: 'bridges',
      visibilityConfigKey: 'showBridges',
      defaultVisible: false,
      settingLabel: '桥接节点卡片',
    }))
    expect(getSummaryCardDefinition('largeDocuments')).toEqual(expect.objectContaining({
      key: 'largeDocuments',
      visibilityConfigKey: 'showLargeDocuments',
      settingLabel: '大文档卡片',
    }))
  })

  it('derives per-card visibility defaults and visibility lookups from the shared definitions', () => {
    expect(buildSummaryCardVisibilityDefaults()).toEqual({
      showRead: true,
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
      showSummaryCards: true,
      showRanking: false,
      themeNotebookId: '',
      themeDocumentPath: '',
      themeNamePrefix: '',
      themeNameSuffix: '',
    } as any, 'ranking')).toBe(false)
  })
})
