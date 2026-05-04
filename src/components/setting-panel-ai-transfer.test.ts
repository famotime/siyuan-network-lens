import { describe, expect, it } from 'vitest'

import {
  applyImportedAiSettings,
  parseAiSettingsTransferPayload,
  stringifyAiSettingsTransferPayload,
} from './setting-panel-ai-transfer'

describe('setting panel ai transfer', () => {
  it('serializes ai settings into a versioned export payload', () => {
    const json = stringifyAiSettingsTransferPayload({
      showSummaryCards: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '主题-',
      themeNameSuffix: '-索引',
      aiEnabled: true,
      aiProviderPreset: 'gemini',
      aiProviderConfigs: {
        openai: {
          aiBaseUrl: 'https://api.openai.com/v1',
          aiApiKey: 'sk-openai',
          aiModel: 'gpt-5',
          aiRequestTimeoutSeconds: 60,
          aiMaxTokens: 8192,
          aiTemperature: 0.2,
          aiMaxContextMessages: 5,
        },
        gemini: {
          aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          aiApiKey: 'sk-gemini',
          aiModel: 'gemini-2.5-flash',
          aiRequestTimeoutSeconds: 45,
          aiMaxTokens: 4096,
          aiTemperature: 0.3,
          aiMaxContextMessages: 11,
        },
      },
      aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      aiApiKey: 'sk-gemini',
      aiModel: 'gemini-2.5-flash',
      aiRequestTimeoutSeconds: 45,
      aiMaxTokens: 4096,
      aiTemperature: 0.3,
      aiMaxContextMessages: 11,
      aiContextCapacity: 'full',
    }, new Date('2026-04-04T09:08:07.000Z'))

    expect(JSON.parse(json)).toEqual({
      kind: 'network-lens-ai-settings',
      schemaVersion: 2,
      exportedAt: '2026-04-04T09:08:07.000Z',
      config: {
        aiEnabled: true,
        aiProviderPreset: 'gemini',
        aiProviderConfigs: {
          openai: {
            aiBaseUrl: 'https://api.openai.com/v1',
            aiApiKey: 'sk-openai',
            aiModel: 'gpt-5',
            aiRequestTimeoutSeconds: 60,
            aiMaxTokens: 8192,
            aiTemperature: 0.2,
            aiMaxContextMessages: 5,
          },
          gemini: {
            aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
            aiApiKey: 'sk-gemini',
            aiModel: 'gemini-2.5-flash',
            aiRequestTimeoutSeconds: 45,
            aiMaxTokens: 4096,
            aiTemperature: 0.3,
            aiMaxContextMessages: 11,
          },
        },
        aiContextCapacity: 'full',
      },
    })
  })

  it('parses exported payloads and applies only ai settings to the current config', () => {
    const config = {
      showSummaryCards: true,
      themeNotebookId: 'box-1',
      themeDocumentPath: '/专题',
      themeNamePrefix: '主题-',
      themeNameSuffix: '-索引',
      readPaths: '/已读',
      aiEnabled: false,
      aiProviderPreset: 'custom',
        aiProviderConfigs: {
          custom: {
            aiBaseUrl: 'https://custom.example.com/v1',
            aiApiKey: 'sk-custom',
            aiModel: 'custom-model',
            aiRequestTimeoutSeconds: 30,
            aiMaxTokens: 10240,
            aiTemperature: 0.7,
            aiMaxContextMessages: 7,
          },
        },
      aiBaseUrl: 'https://custom.example.com/v1',
      aiApiKey: 'sk-custom',
      aiModel: 'custom-model',
      aiRequestTimeoutSeconds: 30,
      aiMaxTokens: 10240,
      aiTemperature: 0.7,
      aiMaxContextMessages: 7,
      aiContextCapacity: 'balanced',
    } as any

    const imported = parseAiSettingsTransferPayload(JSON.stringify({
      kind: 'network-lens-ai-settings',
      schemaVersion: 2,
      config: {
        aiEnabled: true,
        aiProviderPreset: 'openai',
        aiProviderConfigs: {
          openai: {
            aiBaseUrl: 'https://api.openai.com/v1',
            aiApiKey: 'sk-openai',
            aiModel: 'gpt-5',
            aiRequestTimeoutSeconds: '60',
            aiMaxTokens: '8192',
            aiTemperature: '0.4',
            aiMaxContextMessages: '9',
          },
        },
        aiContextCapacity: 'compact',
      },
    }))

    applyImportedAiSettings(config, imported)

    expect(config.themeNotebookId).toBe('box-1')
    expect(config.readPaths).toBe('/已读')
    expect(config.aiEnabled).toBe(true)
    expect(config.aiProviderPreset).toBe('openai')
    expect(config.aiBaseUrl).toBe('https://api.openai.com/v1')
    expect(config.aiApiKey).toBe('sk-openai')
    expect(config.aiModel).toBe('gpt-5')
    expect(config.aiRequestTimeoutSeconds).toBe(60)
    expect(config.aiMaxTokens).toBe(8192)
    expect(config.aiTemperature).toBe(0.4)
    expect(config.aiMaxContextMessages).toBe(9)
    expect(config.aiContextCapacity).toBe('compact')
    expect(config.aiProviderConfigs).toEqual({
      openai: {
        aiBaseUrl: 'https://api.openai.com/v1',
        aiApiKey: 'sk-openai',
        aiModel: 'gpt-5',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 8192,
        aiTemperature: 0.4,
        aiMaxContextMessages: 9,
      },
    })
  })

  it('rejects invalid ai settings payloads', () => {
    expect(() => parseAiSettingsTransferPayload('{"kind":"other"}')).toThrow('Invalid AI settings file format')
    expect(() => parseAiSettingsTransferPayload(JSON.stringify({
      aiEnabled: true,
      aiBaseUrl: 'https://api.openai.com/v1',
      aiApiKey: 'sk-openai',
      aiModel: 'gpt-5',
    }))).toThrow('Invalid AI settings file format')
    expect(() => parseAiSettingsTransferPayload('not-json')).toThrow('AI settings file is not valid JSON')
  })
})
