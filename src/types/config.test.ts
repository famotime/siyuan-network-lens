import { describe, expect, it } from 'vitest'

import { ensureConfigDefaults } from './config'

describe('config defaults', () => {
  it('fills per-card visibility defaults and migrates old grouped card switches', () => {
    const config = {
      showSummaryCards: true,
      showRanking: false,
      showCommunities: true,
      showOrphanBridge: false,
      showTrends: true,
      showPropagation: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '主题-',
      themeNameSuffix: '-索引',
    } as any

    ensureConfigDefaults(config)

    expect(config.showDocuments).toBe(false)
    expect(config.showRead).toBe(true)
    expect(config.showReferences).toBe(false)
    expect(config.showRanking).toBe(false)
    expect(config.showCommunities).toBe(true)
    expect(config.showTrends).toBe(true)
    expect(config.showOrphans).toBe(false)
    expect(config.showDormant).toBe(false)
    expect(config.showBridges).toBe(false)
    expect(config.showPropagation).toBe(true)
    expect(config.readPaths).toBe('')
  })
})
