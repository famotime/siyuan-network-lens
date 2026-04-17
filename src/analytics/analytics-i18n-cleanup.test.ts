import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('analytics i18n cleanup', () => {
  it('removes uiText usage from summary metadata sources', async () => {
    const targets = [
      './summary-detail-sections.ts',
      './summary-cards.ts',
      './summary-card-config.ts',
    ] as const

    for (const target of targets) {
      const source = await readFile(new URL(target, import.meta.url), 'utf8')
      expect(source, target).not.toContain('uiText(')
      expect(source, target).toContain("from '@/i18n/ui'")
    }
  })
})
