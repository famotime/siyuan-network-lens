import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('component i18n cleanup', () => {
  it('removes uiText usage from the next wave of shared components', async () => {
    const targets = [
      './DocumentTitle.vue',
      './FilterSelect.vue',
      './ThemeMultiSelect.vue',
      './DormantDetailPanel.vue',
      './SuggestionCallout.vue',
      './SummaryCardsGrid.vue',
    ] as const

    for (const target of targets) {
      const source = await readFile(new URL(target, import.meta.url), 'utf8')
      expect(source, target).not.toContain('uiText(')
      expect(source, target).toContain("import { t } from '@/i18n/ui'")
    }
  })
})
