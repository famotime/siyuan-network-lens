import { Plugin, Dialog } from 'siyuan'
import { reactive, watch } from 'vue'

import pluginInfo from '@/../plugin.json'
import { pickPluginText } from '@/i18n/plugin'
import { destroyApp, destroySetting, mountApp, mountSetting } from '@/main'
import './index.scss'
import { openPluginDock } from './plugin-dock'
import { PLUGIN_ICON, PLUGIN_ICON_SYMBOL } from './plugin-icon'
import { createWikiCommandProvider } from './plugin/wiki-command-provider'
import type { WikiCommandProvider } from './plugin/wiki-command-provider-types'
import type { SharedConfig } from './types/api-switch'
import { DEFAULT_CONFIG, ensureConfigDefaults, type PluginConfig } from './types/config'

const DOCK_TYPE = 'reference-analytics-dock'
const STORAGE_NAME = 'settings.json'

function serializeConfig(config: PluginConfig): string {
  const sorted: Record<string, any> = {}
  for (const key of Object.keys(config).sort()) {
    sorted[key] = (config as any)[key]
  }
  return JSON.stringify(sorted)
}

export default class ReferenceAnalyticsPlugin extends Plugin {
  private dockInstance?: ReturnType<Plugin['addDock']>
  private config = reactive<PluginConfig>({ ...DEFAULT_CONFIG })
  private wikiCommandProvider: WikiCommandProvider | null = null
  private localAiConfigBackup: any = null
  private isManaged = false
  private lastSavedConfigJson = ''

  get version() {
    return pluginInfo.version
  }

  async onload() {
    this.addIcons(PLUGIN_ICON_SYMBOL)

    this.wikiCommandProvider = createWikiCommandProvider({
      pluginVersion: this.version,
      plugin: this,
    })

    const loadedConfig = await this.loadData(STORAGE_NAME)
    if (loadedConfig) {
      ensureConfigDefaults(loadedConfig as PluginConfig)
      Object.assign(this.config, loadedConfig)
    }
    ensureConfigDefaults(this.config)
    this.lastSavedConfigJson = serializeConfig(this.getPersistedConfig())

    watch(() => { return { ...this.config } }, () => {
      const configToSave = this.getPersistedConfig()
      const newJson = serializeConfig(configToSave)
      if (newJson === this.lastSavedConfigJson) {
        return
      }
      this.lastSavedConfigJson = newJson
      this.saveData(STORAGE_NAME, configToSave)
    }, { deep: true })

    this.addCommand({
      langKey: 'openReferenceAnalytics',
      langText: pickPluginText('pluginTitle'),
      hotkey: '',
      callback: () => {
        this.openDock()
      },
    })

    this.dockInstance = this.addDock({
      type: DOCK_TYPE,
      data: {},
      config: {
        position: 'RightTop',
        size: {
          width: 420,
          height: null,
        },
        icon: PLUGIN_ICON,
        title: this.displayName,
        show: false,
      },
      init: (dock) => {
        const root = document.createElement('div')
        root.className = 'reference-analytics-root'
        dock.element.append(root)
        mountApp(root, this, this.config)
      },
      destroy: () => {
        destroyApp()
      },
    })

    this.initApiSwitchSync()
  }

  onunload() {
    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.unregister(this.name)
    }
    destroyApp()
  }

  async uninstall() {
    await this.removeData(STORAGE_NAME)
  }

  /**
   * 覆盖基类 onDataChanged 方法。
   * 显式处理思源广播的插件私有存储变更，防止思源因缺少该钩子将数据变更事件降级为全量卸载重载（导致图标闪烁与多端互推风暴）。
   */
  async onDataChanged() {
    const loadedConfig = await this.loadData(STORAGE_NAME)
    if (!loadedConfig) {
      return
    }
    ensureConfigDefaults(loadedConfig as PluginConfig)
    const newJson = serializeConfig(loadedConfig as PluginConfig)
    if (newJson === this.lastSavedConfigJson) {
      return
    }

    if (this.isManaged) {
      this.localAiConfigBackup = {
        aiProviderPreset: loadedConfig.aiProviderPreset || 'custom',
        aiBaseUrl: loadedConfig.aiBaseUrl,
        aiApiKey: loadedConfig.aiApiKey,
        aiModel: loadedConfig.aiModel,
        aiRequestTimeoutSeconds: loadedConfig.aiRequestTimeoutSeconds,
        aiMaxTokens: loadedConfig.aiMaxTokens,
        aiTemperature: loadedConfig.aiTemperature,
        aiHeaders: loadedConfig.aiHeaders,
        aiProtocol: loadedConfig.aiProtocol,
      }
      const runtimeAiOverrides = {
        aiProviderPreset: this.config.aiProviderPreset,
        aiBaseUrl: this.config.aiBaseUrl,
        aiApiKey: this.config.aiApiKey,
        aiModel: this.config.aiModel,
        aiRequestTimeoutSeconds: this.config.aiRequestTimeoutSeconds,
        aiMaxTokens: this.config.aiMaxTokens,
        aiTemperature: this.config.aiTemperature,
        aiHeaders: this.config.aiHeaders,
        aiProtocol: this.config.aiProtocol,
        isAiManaged: true,
        aiManagedProfileName: this.config.aiManagedProfileName,
      }
      Object.assign(this.config, loadedConfig, runtimeAiOverrides)
    } else {
      Object.assign(this.config, loadedConfig)
    }
    this.lastSavedConfigJson = serializeConfig(this.getPersistedConfig())
  }

  private getPersistedConfig(): PluginConfig {
    const configToSave = { ...this.config }
    if (this.isManaged && this.localAiConfigBackup) {
      configToSave.aiProviderPreset = this.localAiConfigBackup.aiProviderPreset
      configToSave.aiBaseUrl = this.localAiConfigBackup.aiBaseUrl
      configToSave.aiApiKey = this.localAiConfigBackup.aiApiKey
      configToSave.aiModel = this.localAiConfigBackup.aiModel
      configToSave.aiRequestTimeoutSeconds = this.localAiConfigBackup.aiRequestTimeoutSeconds
      configToSave.aiMaxTokens = this.localAiConfigBackup.aiMaxTokens
      configToSave.aiTemperature = this.localAiConfigBackup.aiTemperature
      configToSave.isAiManaged = false
      configToSave.aiManagedProfileName = undefined
    } else if (!this.isManaged) {
      configToSave.isAiManaged = false
      configToSave.aiManagedProfileName = undefined
    }
    return configToSave
  }

  openDock() {
    openPluginDock(DOCK_TYPE, this.dockInstance)
  }

  /** 公开 API — 供外部插件（如文档助手）调用 Wiki 生成 */
  getWikiCommandIntegration(): WikiCommandProvider | null {
    return this.wikiCommandProvider
  }

  openSetting() {
    const dialog = new Dialog({
      title: this.i18n?.settingsTitle ?? pickPluginText('settingsTitle'),
      width: '680px',
      height: '720px',
      content: '<div id="reference-analytics-setting-root" class="reference-analytics-root" style="height: 100%;"></div>',
      destroyCallback: () => {
        destroySetting()
      },
    })

    const root = dialog.element.querySelector('#reference-analytics-setting-root') as HTMLElement
    if (root) {
      mountSetting(root, this.config)
    }
  }

  private initApiSwitchSync() {
    const sync = (shared: SharedConfig | null) => {
      if (shared) {
        if (!this.isManaged) {
          this.localAiConfigBackup = {
            aiProviderPreset: this.config.aiProviderPreset || 'custom',
            aiBaseUrl: this.config.aiBaseUrl,
            aiApiKey: this.config.aiApiKey,
            aiModel: this.config.aiModel,
            aiRequestTimeoutSeconds: this.config.aiRequestTimeoutSeconds,
            aiMaxTokens: this.config.aiMaxTokens,
            aiTemperature: this.config.aiTemperature,
            aiHeaders: this.config.aiHeaders,
            aiProtocol: this.config.aiProtocol,
          }
          this.isManaged = true
        }

        const normalizedPreset = (['siliconflow', 'openai', 'gemini'].includes(shared.provider) ? shared.provider : 'custom') as any
        this.config.aiProviderPreset = normalizedPreset
        this.config.aiBaseUrl = shared.baseUrl
        this.config.aiApiKey = shared.apiKey
        this.config.aiModel = shared.model
        this.config.aiRequestTimeoutSeconds = shared.requestTimeoutSeconds ?? this.config.aiRequestTimeoutSeconds
        this.config.aiMaxTokens = shared.maxTokens ?? this.config.aiMaxTokens
        this.config.aiTemperature = shared.temperature ?? this.config.aiTemperature
        this.config.aiHeaders = shared.headers
        this.config.aiProtocol = shared.protocol
        this.config.isAiManaged = true
        this.config.aiManagedProfileName = shared.profileName
      } else {
        if (this.isManaged && this.localAiConfigBackup) {
          this.config.aiProviderPreset = this.localAiConfigBackup.aiProviderPreset || 'custom'
          this.config.aiBaseUrl = this.localAiConfigBackup.aiBaseUrl
          this.config.aiApiKey = this.localAiConfigBackup.aiApiKey
          this.config.aiModel = this.localAiConfigBackup.aiModel
          this.config.aiRequestTimeoutSeconds = this.localAiConfigBackup.aiRequestTimeoutSeconds
          this.config.aiMaxTokens = this.localAiConfigBackup.aiMaxTokens
          this.config.aiTemperature = this.localAiConfigBackup.aiTemperature
          this.config.aiHeaders = this.localAiConfigBackup.aiHeaders
          this.config.aiProtocol = this.localAiConfigBackup.aiProtocol
          this.localAiConfigBackup = null
          this.isManaged = false
        }
        this.config.isAiManaged = false
        this.config.aiManagedProfileName = undefined
      }
    }

    const activeLocal = this.isManaged && this.localAiConfigBackup ? this.localAiConfigBackup : this.config
    const local = {
      provider: activeLocal?.aiProviderPreset || 'custom',
      baseUrl: activeLocal?.aiBaseUrl || '',
      apiKey: activeLocal?.aiApiKey || '',
      model: activeLocal?.aiModel || '',
      requestTimeoutSeconds: activeLocal?.aiRequestTimeoutSeconds,
      temperature: activeLocal?.aiTemperature,
      maxTokens: activeLocal?.aiMaxTokens,
      headers: activeLocal?.aiHeaders,
      protocol: activeLocal?.aiProtocol,
    }

    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.register(this.name, this.displayName, sync, local)
    } else {
      window.addEventListener('siyuan-api-switch:ready', () => {
        if (window.siyuanApiSwitch) {
          window.siyuanApiSwitch.register(this.name, this.displayName, sync, local)
        }
      }, { once: true })
    }
  }
}
