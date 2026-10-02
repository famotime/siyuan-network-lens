export class Plugin {
  name = 'siyuan-network-lens'
  displayName = '脉络镜'
  i18n?: Record<string, string>
  addIcons() {}
  addCommand() {}
  addDock() {}
  loadData() { return Promise.resolve(null) }
  saveData() { return Promise.resolve() }
  removeData() { return Promise.resolve() }
  onDataChanged(_reason?: any): Promise<void> | void {}
}

export class Dialog {}
