import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('plugin lifecycle release hygiene', () => {
  it('cleans persisted settings via STORAGE_NAME during uninstall', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')

    expect(source).toContain("const STORAGE_NAME = 'settings.json'")
    expect(source).toContain('this.removeData(STORAGE_NAME)')
  })

  it('does not register a top bar icon entry point', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('this.addTopBar(')
  })

  it('opens the setting dialog with a taller default viewport', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')

    expect(source).toContain("width: '680px'")
    expect(source).toContain("height: '720px'")
    expect(source).toContain("title: this.i18n?.settingsTitle ?? `${this.displayName} Settings`")
  })
})
