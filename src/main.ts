import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import type { Plugin } from 'siyuan'

import App from './App.vue'
import SettingPanel from './components/SettingPanel.vue'
import type { PluginConfig } from './types/config'

let app: VueApp<Element> | null = null
let rootElement: HTMLElement | null = null

export function mountApp(element: HTMLElement, plugin: Plugin, config: PluginConfig) {
  destroyApp()
  rootElement = element
  app = createApp(App, {
    plugin,
    config,
  })
  app.mount(element)
}

export function destroyApp() {
  app?.unmount()
  if (rootElement) {
    rootElement.innerHTML = ''
  }
  app = null
  rootElement = null
}

let settingApp: VueApp<Element> | null = null
let settingRootElement: HTMLElement | null = null

export function mountSetting(element: HTMLElement, config: PluginConfig) {
  destroySetting()
  settingRootElement = element
  settingApp = createApp(SettingPanel, {
    config,
  })
  settingApp.mount(element)
}

export function destroySetting() {
  settingApp?.unmount()
  if (settingRootElement) {
    settingRootElement.innerHTML = ''
  }
  settingApp = null
  settingRootElement = null
}

