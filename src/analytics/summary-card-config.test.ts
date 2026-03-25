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
    expect(SUMMARY_CARD_DEFINITIONS.map(item => item.key)).toEqual(DEFAULT_SUMMARY_CARD_ORDER)
    expect(getSummaryCardDefinition('documents')).toEqual(expect.objectContaining({
      key: 'documents',
      visibilityConfigKey: 'showDocuments',
      defaultVisible: true,
      settingLabel: '文档样本卡片',
    }))
    expect(getSummaryCardDefinition('bridges')).toEqual(expect.objectContaining({
      key: 'bridges',
      visibilityConfigKey: 'showBridges',
      defaultVisible: true,
      settingLabel: '桥接节点卡片',
    }))
  })

  it('derives per-card visibility defaults and visibility lookups from the shared definitions', () => {
    expect(buildSummaryCardVisibilityDefaults()).toEqual({
      showDocuments: true,
      showRead: true,
      showReferences: true,
      showRanking: true,
      showTrends: true,
      showCommunities: true,
      showOrphans: true,
      showDormant: true,
      showBridges: true,
      showPropagation: true,
    })

    expect(getSummaryCardVisibilityConfigKey('ranking')).toBe('showRanking')
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
