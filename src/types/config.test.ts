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
    expect(config.showTodaySuggestions).toBe(true)
    expect(config.showReferences).toBe(false)
    expect(config.showRanking).toBe(false)
    expect(config.showLargeDocuments).toBe(true)
    expect(config.showCommunities).toBe(true)
    expect(config.showTrends).toBe(true)
    expect(config.showOrphans).toBe(false)
    expect(config.showDormant).toBe(false)
    expect(config.showBridges).toBe(false)
    expect(config.showPropagation).toBe(true)
    expect(config.analysisExcludedPaths).toBe('')
    expect(config.analysisExcludedNamePrefixes).toBe('')
    expect(config.analysisExcludedNameSuffixes).toBe('')
    expect(config.readPaths).toBe('')
    expect(config.aiEnabled).toBe(false)
    expect(config.aiBaseUrl).toBe('')
    expect(config.aiApiKey).toBe('')
    expect(config.aiModel).toBe('')
    expect(config.aiEmbeddingModel).toBe('')
    expect(config.aiRequestTimeoutSeconds).toBe(30)
    expect(config.aiMaxTokens).toBe(10240)
    expect(config.aiTemperature).toBe(0.7)
    expect(config.aiMaxContextMessages).toBe(7)
    expect(config.aiContextCapacity).toBe('balanced')
    expect(config.enableConsoleLogging).toBe(false)
    expect(config.wikiEnabled).toBe(false)
    expect(config.wikiPageSuffix).toBe('-llm-wiki')
    expect(config.wikiIndexTitle).toBe('LLM-Wiki-Index')
    expect(config.wikiLogTitle).toBe('LLM-Wiki-Maintenance-Log')
    expect(config.themeDocumentPath).toBe('/box-1/专题')
  })

  it('restores the active ai config from the selected provider snapshot', () => {
    const config = {
      showSummaryCards: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '',
      themeNameSuffix: '',
      aiEnabled: true,
      aiBaseUrl: 'https://api.openai.com/v1',
      aiApiKey: 'stale-openai-key',
      aiModel: 'stale-openai-model',
      aiEmbeddingModel: 'stale-openai-embedding',
      aiProviderPreset: 'gemini',
      aiProviderConfigs: {
        gemini: {
          aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          aiApiKey: 'gemini-key',
          aiModel: 'gemini-2.5-flash',
          aiEmbeddingModel: 'gemini-embedding-001',
          aiRequestTimeoutSeconds: 120,
          aiMaxTokens: 102400,
          aiTemperature: 0.2,
          aiMaxContextMessages: 1,
        },
      },
      aiRequestTimeoutSeconds: 30,
      aiMaxTokens: 10240,
      aiTemperature: 0.7,
      aiMaxContextMessages: 7,
      aiContextCapacity: 'balanced',
    } as any

    ensureConfigDefaults(config)

    expect(config.aiProviderPreset).toBe('gemini')
    expect(config.aiBaseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai')
    expect(config.aiApiKey).toBe('gemini-key')
    expect(config.aiModel).toBe('gemini-2.5-flash')
    expect(config.aiEmbeddingModel).toBe('gemini-embedding-001')
    expect(config.aiRequestTimeoutSeconds).toBe(120)
    expect(config.aiMaxTokens).toBe(102400)
    expect(config.aiTemperature).toBe(0.2)
    expect(config.aiMaxContextMessages).toBe(1)
    expect(config.aiContextCapacity).toBe('balanced')
  })

  it('normalizes invalid wiki config values back to stable defaults', () => {
    const config = {
      showSummaryCards: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '',
      themeNameSuffix: '',
      enableConsoleLogging: 'yes',
      wikiEnabled: 'yes',
      wikiPageSuffix: '   ',
      wikiIndexTitle: 123,
      wikiLogTitle: null,
    } as any

    ensureConfigDefaults(config)

    expect(config.enableConsoleLogging).toBe(false)
    expect(config.wikiEnabled).toBe(false)
    expect(config.wikiPageSuffix).toBe('-llm-wiki')
    expect(config.wikiIndexTitle).toBe('LLM-Wiki-Index')
    expect(config.wikiLogTitle).toBe('LLM-Wiki-Maintenance-Log')
  })

  it('preserves full-path theme document config and normalizes analysis exclusion fields', () => {
    const config = {
      showSummaryCards: true,
      themeDocumentPath: '/知识库/专题|/归档/主题',
      themeNamePrefix: '',
      themeNameSuffix: '',
      analysisExcludedPaths: null,
      analysisExcludedNamePrefixes: 123,
      analysisExcludedNameSuffixes: undefined,
    } as any

    ensureConfigDefaults(config)

    expect(config.themeDocumentPath).toBe('/知识库/专题|/归档/主题')
    expect(config.analysisExcludedPaths).toBe('')
    expect(config.analysisExcludedNamePrefixes).toBe('')
    expect(config.analysisExcludedNameSuffixes).toBe('')
  })
})
