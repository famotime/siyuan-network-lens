import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('WikiChatDialog', () => {
  it('renders assistant replies through the shared markdown renderer', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain("import { renderSimpleMarkdown } from '@/utils/markdown'")
    expect(source).toContain('v-html="renderSimpleMarkdown(msg.content)"')
  })

  it('uses stronger dark-surface contrast tokens for assistant replies and metadata', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain('color-mix(in srgb, var(--b3-theme-on-background) 94%, white 6%)')
    expect(source).toContain('color-mix(in srgb, var(--b3-theme-on-background) 72%, transparent)')
    expect(source).toContain('color-mix(in srgb, var(--b3-theme-surface-light) 88%, var(--b3-theme-background))')
  })
})
