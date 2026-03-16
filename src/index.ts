import { Plugin, Dialog } from 'siyuan'
import { reactive, watch } from 'vue'

import pluginInfo from '@/../plugin.json'
import { destroyApp, mountApp, mountSetting, destroySetting } from '@/main'
import { DEFAULT_CONFIG, ensureConfigDefaults, type PluginConfig } from './types/config'

const DOCK_TYPE = 'reference-analytics-dock'
const PLUGIN_TITLE = '脉络镜'
const PLUGIN_ICON = 'iconGraph'

export default class ReferenceAnalyticsPlugin extends Plugin {
  private dockInstance?: ReturnType<Plugin['addDock']>
  private config = reactive<PluginConfig>({ ...DEFAULT_CONFIG })

  get version() {
    return pluginInfo.version
  }

  async onload() {
    const loadedConfig = await this.loadData('settings.json')
    if (loadedConfig) {
      ensureConfigDefaults(loadedConfig as PluginConfig)
      Object.assign(this.config, loadedConfig)
    }
    ensureConfigDefaults(this.config)

    watch(() => { return { ...this.config } }, (newConfig) => {
      this.saveData('settings.json', newConfig)
    }, { deep: true })

    this.addTopBar({
      icon: PLUGIN_ICON,
      title: PLUGIN_TITLE,
      callback: () => {
        this.openDock()
      },
    })

    this.addCommand({
      langKey: 'openReferenceAnalytics',
      langText: PLUGIN_TITLE,
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
        title: PLUGIN_TITLE,
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

  openDock() {
    this.dockInstance?.model.toggleModel(DOCK_TYPE, true)
  }

  openSetting() {
    const dialog = new Dialog({
      title: '脉络镜 设置',
      width: '600px',
      height: '500px',
      content: '<div id="reference-analytics-setting-root" style="height: 100%;"></div>',
      destroyCallback: () => {
        destroySetting()
      }
    })

    const root = dialog.element.querySelector('#reference-analytics-setting-root') as HTMLElement
    if (root) {
        mountSetting(root, this.config)
    }
  }
}
