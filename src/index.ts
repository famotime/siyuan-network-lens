import '@/index.scss'

import { Plugin } from 'siyuan'

import pluginInfo from '@/../plugin.json'
import { destroyApp, mountApp } from '@/main'

const DOCK_TYPE = 'reference-analytics-dock'
const PLUGIN_TITLE = '引用网络分析器'
const PLUGIN_ICON = 'iconGraph'

export default class ReferenceAnalyticsPlugin extends Plugin {
  private dockInstance?: ReturnType<Plugin['addDock']>

  get version() {
    return pluginInfo.version
  }

  async onload() {
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
        mountApp(root, this)
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
}
