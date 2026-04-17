import { access, readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('plugin manifest bilingual metadata', () => {
  it('maps README files to the correct locales', async () => {
    const source = await readFile(new URL('../plugin.json', import.meta.url), 'utf8')

    expect(source).toContain('"default": "README_zh_CN.md"')
    expect(source).toContain('"en_US": "README.md"')
    expect(source).toContain('"zh_CN": "README_zh_CN.md"')
  })

  it('references README files that exist in the repository', async () => {
    await expect(access(new URL('../README.md', import.meta.url))).resolves.toBeUndefined()
    await expect(access(new URL('../README_zh_CN.md', import.meta.url))).resolves.toBeUndefined()
  })
})
