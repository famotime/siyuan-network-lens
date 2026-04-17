import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('wiki and ai composable i18n cleanup', () => {
  it('removes uiText usage from the current wiki/composable wave', async () => {
    const targets = [
      '../analytics/wiki-ai.ts',
      './use-analytics-wiki.ts',
      './use-analytics-ai.ts',
      './use-analytics.ts',
    ] as const

    for (const target of targets) {
      const source = await readFile(new URL(target, import.meta.url), 'utf8')
      expect(source, target).not.toContain('uiText(')
      expect(source, target).toContain("from '@/i18n/ui'")
    }
  })
})
