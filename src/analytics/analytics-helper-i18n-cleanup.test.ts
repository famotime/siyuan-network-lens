import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('analytics helper i18n cleanup', () => {
  it('removes uiText usage from the current helper wave', async () => {
    const targets = [
      './wiki-renderer.ts',
      './time-range.ts',
      './document-utils.ts',
      './orphan-theme-links.ts',
      './orphan-document-tags.ts',
      './orphan-document-links.ts',
      './ai-document-summary.ts',
    ] as const

    for (const target of targets) {
      const source = await readFile(new URL(target, import.meta.url), 'utf8')
      expect(source, target).not.toContain('uiText(')
      expect(source, target).toContain("from '@/i18n/ui'")
    }
  })
})
