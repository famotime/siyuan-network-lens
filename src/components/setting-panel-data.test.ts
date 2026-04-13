import { describe, expect, it } from 'vitest'

import {
  collectTagOptions,
  ensureReadMarkerDefaults,
  loadSettingPanelData,
  migrateLegacyThemeDocumentPath,
} from './setting-panel-data'

describe('setting-panel-data', () => {
  it('fills read marker defaults when config fields are missing', () => {
    const config = {
      showSummaryCards: true,
      showRanking: true,
      showCommunities: true,
      showOrphanBridge: true,
      showTrends: true,
      showPropagation: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '主题-',
      themeNameSuffix: '-索引',
    } as any

    ensureReadMarkerDefaults(config)

    expect(config.readTagNames).toEqual([])
    expect(config.readTitlePrefixes).toBe('')
    expect(config.readTitleSuffixes).toBe('')
    expect(config.readPaths).toBe('')
  })

  it('collects unique sorted tag options from block tag rows', () => {
    expect(collectTagOptions([
      { tag: 'AI,知识 #整理' },
      { tag: '整理,回顾' },
      { tag: null },
    ])).toEqual([
      { value: '回顾', label: '回顾', key: '回顾' },
      { value: '整理', label: '整理', key: '整理' },
      { value: '知识', label: '知识', key: '知识' },
      { value: 'AI', label: 'AI', key: 'AI' },
    ])
  })

  it('loads notebooks and tag options with graceful fallback on rejected requests', async () => {
    const result = await loadSettingPanelData({
      lsNotebooks: async () => ({
        notebooks: [
          { id: 'box-1', name: 'Notebook A' },
        ],
      }),
      sql: async () => [
        { tag: 'AI,知识' },
      ],
    })

    expect(result.notebooks).toEqual([
      { id: 'box-1', name: 'Notebook A' },
    ])
    expect(result.readTagOptions).toEqual([
      { value: '知识', label: '知识', key: '知识' },
      { value: 'AI', label: 'AI', key: 'AI' },
    ])
  })

  it('migrates legacy theme notebook config to a notebook-scoped full path when notebook data is available', () => {
    const config = {
      showSummaryCards: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '',
      themeNameSuffix: '',
    } as any

    migrateLegacyThemeDocumentPath(config, [
      { id: 'box-1', name: '知识库' },
    ])

    expect(config.themeDocumentPath).toBe('/知识库/专题')
  })
})
