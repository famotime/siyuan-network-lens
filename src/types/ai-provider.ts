export type AiProviderPresetKey = 'siliconflow' | 'openai' | 'gemini' | 'custom'

export interface AiProviderConfigSnapshot {
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string

  aiRequestTimeoutSeconds: number
  aiMaxTokens: number
  aiTemperature: number
  aiMaxContextMessages: number
}

export type AiProviderConfigMap = Partial<Record<AiProviderPresetKey, Partial<AiProviderConfigSnapshot>>>
