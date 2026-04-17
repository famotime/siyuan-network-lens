import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('component helper i18n cleanup', () => {
  it('removes uiText usage from the current helper wave', async () => {
    const targets = [
      './setting-panel-ai.ts',
      './ai-provider-presets.ts',
      './setting-panel-ai-transfer.ts',
      './ai-inbox-detail.ts',
      './setting-panel-ai-state.ts',
      './setting-panel-secret-field.ts',
    ] as const

    for (const target of targets) {
      const source = await readFile(new URL(target, import.meta.url), 'utf8')
      expect(source, target).not.toContain('uiText(')
      expect(source, target).not.toContain('pickUiText(')
      expect(source, target).toContain("from '@/i18n/ui'")
    }
  })
})
