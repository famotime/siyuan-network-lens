import type { App as VueApp } from 'vue'
import { createApp } from 'vue'
import type { Plugin } from 'siyuan'

import App from './App.vue'

let app: VueApp<Element> | null = null
let rootElement: HTMLElement | null = null

export function mountApp(element: HTMLElement, plugin: Plugin) {
  destroyApp()
  rootElement = element
  app = createApp(App, {
    plugin,
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
