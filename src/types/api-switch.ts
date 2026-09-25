export interface SharedConfig {
  profileId: string
  profileName: string
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  models?: string[]
  requestTimeoutSeconds?: number
  temperature?: number
  maxTokens?: number
  memo?: string
  providerUrl?: string
  protocol?: string
  headers?: Record<string, string>
  isDecisionModel?: boolean
}

export interface SiyuanApiSwitch {
  version: string
  register(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null) => void,
    localConfig?: Omit<SharedConfig, 'profileId' | 'profileName'>,
  ): void
  unregister(pluginId: string): void
  getBoundConfig(pluginId: string): SharedConfig | null
}
