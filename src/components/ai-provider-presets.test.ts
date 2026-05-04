import { afterEach, describe, expect, it } from 'vitest'

import {
  AI_PROVIDER_PRESET_OPTIONS,
  applyAiProviderPreset,
  buildAiProviderPresetOptions,
  buildAiModelOptionItems,
  detectAiProviderPreset,
} from './ai-provider-presets'

describe('ai provider presets', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('detects known provider presets from base urls', () => {
    expect(detectAiProviderPreset('https://api.siliconflow.cn')).toBe('siliconflow')
    expect(detectAiProviderPreset('https://api.openai.com/v1')).toBe('openai')
    expect(detectAiProviderPreset('https://generativelanguage.googleapis.com/v1beta/openai/')).toBe('gemini')
    expect(detectAiProviderPreset('https://api.example.com/v1')).toBe('custom')
  })

  it('applies provider preset base urls and default models', () => {
    const openAiConfig = {
      aiBaseUrl: '',
      aiModel: '',
    } as any
    applyAiProviderPreset(openAiConfig, 'openai')
    expect(openAiConfig).toEqual(expect.objectContaining({
      aiBaseUrl: 'https://api.openai.com/v1',
      aiModel: 'gpt-5',
    }))

    const geminiConfig = {
      aiBaseUrl: '',
      aiModel: '',
    } as any
    applyAiProviderPreset(geminiConfig, 'gemini')
    expect(geminiConfig).toEqual(expect.objectContaining({
      aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      aiModel: 'gemini-2.5-flash',
    }))

    const siliconFlowConfig = {
      aiBaseUrl: '',
      aiModel: 'old-model',
    } as any
    applyAiProviderPreset(siliconFlowConfig, 'siliconflow')
    expect(siliconFlowConfig).toEqual(expect.objectContaining({
      aiBaseUrl: 'https://api.siliconflow.cn/v1',
      aiModel: '',
    }))
  })

  it('saves the current provider config and restores the selected provider config', () => {
    const config = {
      aiProviderPreset: 'openai',
      aiProviderConfigs: {
        openai: {
          aiBaseUrl: 'https://api.openai.com/v1',
          aiApiKey: 'sk-openai',
          aiModel: 'gpt-5-custom',
          aiRequestTimeoutSeconds: 45,
          aiMaxTokens: 4096,
          aiTemperature: 0.4,
          aiMaxContextMessages: 5,
        },
      },
      aiBaseUrl: 'https://api.openai.com/v1',
      aiApiKey: 'sk-openai',
      aiModel: 'gpt-5-custom',
      aiRequestTimeoutSeconds: 45,
      aiMaxTokens: 4096,
      aiTemperature: 0.4,
      aiMaxContextMessages: 5,
      aiContextCapacity: 'full',
    } as any

    applyAiProviderPreset(config, 'gemini')

    expect(config.aiProviderPreset).toBe('gemini')
    expect(config.aiProviderConfigs.openai).toEqual({
      aiBaseUrl: 'https://api.openai.com/v1',
      aiApiKey: 'sk-openai',
      aiModel: 'gpt-5-custom',
      aiRequestTimeoutSeconds: 45,
      aiMaxTokens: 4096,
      aiTemperature: 0.4,
      aiMaxContextMessages: 5,
    })
    expect(config.aiBaseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai')
    expect(config.aiApiKey).toBe('')
    expect(config.aiModel).toBe('gemini-2.5-flash')
    expect(config.aiRequestTimeoutSeconds).toBe(60)
    expect(config.aiMaxTokens).toBe(4096)
    expect(config.aiTemperature).toBe(0.7)
    expect(config.aiMaxContextMessages).toBe(1)
    expect(config.aiContextCapacity).toBe('full')

    config.aiApiKey = 'gemini-key'
    config.aiModel = 'gemini-2.5-pro-exp'
    config.aiRequestTimeoutSeconds = 120
    config.aiMaxTokens = 102400
    config.aiTemperature = 0.2
    config.aiMaxContextMessages = 1

    applyAiProviderPreset(config, 'openai')

    expect(config.aiProviderPreset).toBe('openai')
    expect(config.aiProviderConfigs.gemini).toEqual({
      aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      aiApiKey: 'gemini-key',
      aiModel: 'gemini-2.5-pro-exp',
      aiRequestTimeoutSeconds: 120,
      aiMaxTokens: 102400,
      aiTemperature: 0.2,
      aiMaxContextMessages: 1,
    })
    expect(config.aiBaseUrl).toBe('https://api.openai.com/v1')
    expect(config.aiApiKey).toBe('sk-openai')
    expect(config.aiModel).toBe('gpt-5-custom')
    expect(config.aiRequestTimeoutSeconds).toBe(45)
    expect(config.aiMaxTokens).toBe(4096)
    expect(config.aiTemperature).toBe(0.4)
    expect(config.aiMaxContextMessages).toBe(5)
    expect(config.aiContextCapacity).toBe('full')
  })

  it('builds unique sorted model option items and preserves the current value', () => {
    expect(buildAiModelOptionItems(['z-model', 'a-model', 'a-model'], 'custom-model')).toEqual([
      { value: 'a-model', label: 'a-model', key: 'a-model' },
      { value: 'custom-model', label: 'custom-model', key: 'custom-model' },
      { value: 'z-model', label: 'z-model', key: 'z-model' },
    ])
  })

  it('exposes preset options for siliconflow, openai, gemini and custom mode', () => {
    expect(AI_PROVIDER_PRESET_OPTIONS).toEqual([
      { value: 'siliconflow', label: 'SiliconFlow' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'gemini', label: 'Gemini' },
      { value: 'custom', label: 'Custom' },
    ])
  })

  it('switches preset option labels to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const presets = await import('./ai-provider-presets')
    expect(presets.buildAiProviderPresetOptions()).toEqual([
      { value: 'siliconflow', label: '硅基流动' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'gemini', label: 'Gemini' },
      { value: 'custom', label: '自定义' },
    ])
  })
})
