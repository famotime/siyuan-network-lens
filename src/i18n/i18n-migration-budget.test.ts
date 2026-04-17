import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('i18n migration budget', () => {
  it('keeps uiText usage in key files within the current migration budget', async () => {
    const checks = [
      {
        path: '../components/SummaryDetailSection.vue',
        expectedCount: 0,
      },
      {
        path: '../App.vue',
        expectedCount: 0,
      },
      {
        path: '../components/SettingPanel.vue',
        expectedCount: 0,
      },
    ] as const

    for (const check of checks) {
      const source = await readFile(new URL(check.path, import.meta.url), 'utf8')
      const count = (source.match(/uiText\(/g) ?? []).length
      expect(count, `${check.path} uiText count`).toBeLessThanOrEqual(check.expectedCount)
    }
  })
})
