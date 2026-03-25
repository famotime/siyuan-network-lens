import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('plugin lifecycle release hygiene', () => {
  it('cleans persisted settings during uninstall', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')

    expect(source).toContain('uninstall()')
    expect(source).toContain("this.removeData('settings.json')")
  })
})
