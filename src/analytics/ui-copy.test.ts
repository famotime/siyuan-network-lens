import { afterEach, describe, expect, it } from 'vitest'

import { getDocumentDetailDescription, getSuggestionTypeLabels } from './ui-copy'

describe('ui copy', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('describes document detail panel as following the active document', () => {
    expect(getDocumentDetailDescription())
      .toBe('Follow the active document and summarize its community role, bridge position, and dormant risk.')
  })

  it('exposes suggestion type labels', () => {
    expect(getSuggestionTypeLabels()).toEqual({
      'promote-hub': 'Promote to topic page',
      'repair-orphan': 'Repair links',
      'maintain-bridge': 'Maintain bridge',
      'archive-dormant': 'Archive dormant',
    })
  })

  it('switches the shared copy to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const uiCopy = await import('./ui-copy')

    expect(uiCopy.getDocumentDetailDescription())
      .toBe('跟随当前文档，概览其社区角色、桥接位置与沉没风险。')
    expect(uiCopy.getSuggestionTypeLabels()).toEqual({
      'promote-hub': '提升为主题页',
      'repair-orphan': '补齐链接',
      'maintain-bridge': '维护桥接',
      'archive-dormant': '归档沉没',
    })
  })

  it('keeps copy in the keyed i18n catalog instead of inline pairs', async () => {
    const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('./ui-copy.ts', import.meta.url), 'utf8'))

    expect(source).toContain("import { t } from '@/i18n/ui'")
    expect(source).not.toContain("const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })")
  })
})
