import { Plugin, Dialog } from 'siyuan'
import { reactive, watch } from 'vue'

import pluginInfo from '@/../plugin.json'
import { destroyApp, destroySetting, mountApp, mountSetting } from '@/main'
import { openPluginDock } from './plugin-dock'
import { PLUGIN_ICON, PLUGIN_ICON_SYMBOL } from './plugin-icon'
import { DEFAULT_CONFIG, ensureConfigDefaults, type PluginConfig } from './types/config'

const DOCK_TYPE = 'reference-analytics-dock'
const STORAGE_NAME = 'settings.json'

export default class ReferenceAnalyticsPlugin extends Plugin {
  private dockInstance?: ReturnType<Plugin['addDock']>
  private config = reactive<PluginConfig>({ ...DEFAULT_CONFIG })

  get version() {
    return pluginInfo.version
  }

  async onload() {
    this.addIcons(PLUGIN_ICON_SYMBOL)

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
  }

  onunload() {
    destroyApp()
  }

  async uninstall() {
    await this.removeData(STORAGE_NAME)
  }

  openDock() {
    openPluginDock(DOCK_TYPE, this.dockInstance)
  }

  openSetting() {
    const dialog = new Dialog({
      title: this.i18n?.settingsTitle ?? `${this.displayName} Settings`,
      width: '680px',
      height: '720px',
      content: '<div id="reference-analytics-setting-root" style="height: 100%;"></div>',
      destroyCallback: () => {
        destroySetting()
      },
    })

    const root = dialog.element.querySelector('#reference-analytics-setting-root') as HTMLElement
    if (root) {
      mountSetting(root, this.config)
    }
  }
}
