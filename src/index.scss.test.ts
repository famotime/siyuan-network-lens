import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('root stylesheet', () => {
  it('loads shared component styles via the Sass module system instead of deprecated @import', async () => {
    const source = await readFile(new URL('./index.scss', import.meta.url), 'utf8')

    expect(source).toContain("@use './styles/components.scss';")
    expect(source).not.toContain('@import')
  })
})
