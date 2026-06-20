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
import { DEFAULT_CONFIG, ensureConfigDefaults, type PluginConfig } from './types/config'

const DOCK_TYPE = 'reference-analytics-dock'
const STORAGE_NAME = 'settings.json'

export default class ReferenceAnalyticsPlugin extends Plugin {
  private dockInstance?: ReturnType<Plugin['addDock']>
  private config = reactive<PluginConfig>({ ...DEFAULT_CONFIG })
  private wikiCommandProvider: WikiCommandProvider | null = null
  private localAiConfigBackup: any = null
  private isManaged = false

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

    watch(() => { return { ...this.config } }, (newConfig) => {
      this.saveData(STORAGE_NAME, newConfig)
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
    const sync = (shared: any | null) => {
      if (shared) {
        if (!this.isManaged) {
          this.localAiConfigBackup = {
            aiBaseUrl: this.config.aiBaseUrl,
            aiApiKey: this.config.aiApiKey,
            aiModel: this.config.aiModel,
            aiRequestTimeoutSeconds: this.config.aiRequestTimeoutSeconds,
            aiMaxTokens: this.config.aiMaxTokens,
            aiTemperature: this.config.aiTemperature,
          }
          this.isManaged = true
        }

        this.config.aiBaseUrl = shared.baseUrl
        this.config.aiApiKey = shared.apiKey
        this.config.aiModel = shared.model
        this.config.aiRequestTimeoutSeconds = shared.requestTimeoutSeconds ?? this.config.aiRequestTimeoutSeconds
        this.config.aiMaxTokens = shared.maxTokens ?? this.config.aiMaxTokens
        this.config.aiTemperature = shared.temperature ?? this.config.aiTemperature
        this.config.isAiManaged = true
        this.config.aiManagedProfileName = shared.profileName
      } else {
        if (this.isManaged && this.localAiConfigBackup) {
          this.config.aiBaseUrl = this.localAiConfigBackup.aiBaseUrl
          this.config.aiApiKey = this.localAiConfigBackup.aiApiKey
          this.config.aiModel = this.localAiConfigBackup.aiModel
          this.config.aiRequestTimeoutSeconds = this.localAiConfigBackup.aiRequestTimeoutSeconds
          this.config.aiMaxTokens = this.localAiConfigBackup.aiMaxTokens
          this.config.aiTemperature = this.localAiConfigBackup.aiTemperature
          this.localAiConfigBackup = null
          this.isManaged = false
        }
        this.config.isAiManaged = false
        this.config.aiManagedProfileName = undefined
      }
    }

    const activeLocal = this.isManaged ? this.localAiConfigBackup : this.config;
    const local = {
      provider: this.config.aiProviderPreset || "custom",
      baseUrl: activeLocal?.aiBaseUrl || "",
      apiKey: activeLocal?.aiApiKey || "",
      model: activeLocal?.aiModel || "",
      requestTimeoutSeconds: activeLocal?.aiRequestTimeoutSeconds,
      temperature: activeLocal?.aiTemperature,
      maxTokens: activeLocal?.aiMaxTokens,
    };

    if (window.siyuanApiSwitch) {
      window.siyuanApiSwitch.register(this.name, this.displayName, sync, local)
    } else {
      window.addEventListener("siyuan-api-switch:ready", () => {
        if (window.siyuanApiSwitch) {
          window.siyuanApiSwitch.register(this.name, this.displayName, sync, local)
        }
      }, { once: true })
    }
  }
}
