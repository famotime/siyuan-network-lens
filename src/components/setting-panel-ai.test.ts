import { afterEach, describe, expect, it } from 'vitest'

import {
  buildSiliconFlowModelSelectPlaceholder,
  shouldAutoLoadSiliconFlowModelCatalog,
} from './setting-panel-ai'
import {
  buildSiliconFlowModelSelectTitle,
  shouldResetSiliconFlowModelCatalog,
  syncAiProviderConfigSnapshot,
} from './setting-panel-ai-state'

describe('setting panel ai helpers', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('requests siliconflow model autoload only when api key is available and the catalog is not already ready', () => {
    expect(shouldAutoLoadSiliconFlowModelCatalog({
      apiKey: '',
      loading: false,
      loaded: false,
      error: '',
    })).toBe(false)

    expect(shouldAutoLoadSiliconFlowModelCatalog({
      apiKey: 'sk-test',
      loading: false,
      loaded: false,
      error: '',
    })).toBe(true)

    expect(shouldAutoLoadSiliconFlowModelCatalog({
      apiKey: 'sk-test',
      loading: true,
      loaded: false,
      error: '',
    })).toBe(false)

    expect(shouldAutoLoadSiliconFlowModelCatalog({
      apiKey: 'sk-test',
      loading: false,
      loaded: true,
      error: '',
    })).toBe(false)

    expect(shouldAutoLoadSiliconFlowModelCatalog({
      apiKey: 'sk-test',
      loading: false,
      loaded: true,
      error: '加载失败',
    })).toBe(true)
  })

  it('builds compact siliconflow select placeholder copy for loading states', () => {
    expect(buildSiliconFlowModelSelectPlaceholder({
      kind: 'chat',
      apiKey: '',
      loading: false,
      loaded: false,
      error: '',
      optionCount: 0,
    })).toBe('Enter API Key first')

    expect(buildSiliconFlowModelSelectPlaceholder({
      kind: 'chat',
      apiKey: 'sk-test',
      loading: false,
      loaded: false,
      error: '',
      optionCount: 0,
    })).toBe('Click to load chat models')

    expect(buildSiliconFlowModelSelectPlaceholder({
      kind: 'embedding',
      apiKey: 'sk-test',
      loading: true,
      loaded: false,
      error: '',
      optionCount: 0,
    })).toBe('Loading embedding models...')

    expect(buildSiliconFlowModelSelectPlaceholder({
      kind: 'chat',
      apiKey: 'sk-test',
      loading: false,
      loaded: false,
      error: '模型列表请求失败',
      optionCount: 0,
    })).toBe('Load failed, click to retry')

    expect(buildSiliconFlowModelSelectPlaceholder({
      kind: 'chat',
      apiKey: 'sk-test',
      loading: false,
      loaded: true,
      error: '',
      optionCount: 3,
    })).toBe('Select chat model')
  })

  it('mirrors the current provider fields into aiProviderConfigs for the selected provider', () => {
    const config: any = {
      aiBaseUrl: 'https://api.example.com/v1',
      aiApiKey: 'sk-test',
      aiModel: 'gpt-4.1-mini',
      aiEmbeddingModel: 'text-embedding-3-small',
      aiRequestTimeoutSeconds: 45,
      aiMaxTokens: 4096,
      aiTemperature: 0.2,
      aiMaxContextMessages: 9,
    }

    syncAiProviderConfigSnapshot(config, 'openai')

    expect(config.aiProviderPreset).toBe('openai')
    expect(config.aiProviderConfigs.openai).toEqual({
      aiBaseUrl: 'https://api.example.com/v1',
      aiApiKey: 'sk-test',
      aiModel: 'gpt-4.1-mini',
      aiEmbeddingModel: 'text-embedding-3-small',
      aiRequestTimeoutSeconds: 45,
      aiMaxTokens: 4096,
      aiTemperature: 0.2,
      aiMaxContextMessages: 9,
    })
  })

  it('resets the siliconflow catalog only when provider or api key invalidates the current cache', () => {
    expect(shouldResetSiliconFlowModelCatalog({
      provider: 'custom',
      apiKey: 'sk-test',
      previousProvider: 'siliconflow',
      previousApiKey: 'sk-old',
    })).toBe(true)

    expect(shouldResetSiliconFlowModelCatalog({
      provider: 'siliconflow',
      apiKey: '',
      previousProvider: 'siliconflow',
      previousApiKey: 'sk-old',
    })).toBe(true)

    expect(shouldResetSiliconFlowModelCatalog({
      provider: 'siliconflow',
      apiKey: 'sk-new',
      previousProvider: 'siliconflow',
      previousApiKey: 'sk-old',
    })).toBe(true)

    expect(shouldResetSiliconFlowModelCatalog({
      provider: 'siliconflow',
      apiKey: 'sk-test',
      previousProvider: 'siliconflow',
      previousApiKey: 'sk-test',
    })).toBe(false)
  })

  it('builds select titles with the last known error appended', () => {
    expect(buildSiliconFlowModelSelectTitle({
      baseTitle: 'Automatically load SiliconFlow chat models when the select opens',
      placeholder: 'Load failed, click to retry',
      error: 'Model request timed out',
    })).toContain('Last load failed: Model request timed out')
  })

  it('switches siliconflow placeholders to Chinese when the workspace locale is zh_CN', () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    expect(buildSiliconFlowModelSelectPlaceholder({
      kind: 'chat',
      apiKey: '',
      loading: false,
      loaded: false,
      error: '',
      optionCount: 0,
    })).toBe('请先填写 API Key')
  })
})
