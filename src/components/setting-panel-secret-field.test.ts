import { afterEach, describe, expect, it } from 'vitest'

import { resolveSecretFieldMeta } from './setting-panel-secret-field'

describe('setting panel secret field', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('uses password mode and show action when secret is hidden', () => {
    expect(resolveSecretFieldMeta(false, 'API Key')).toEqual({
      inputType: 'password',
      actionLabel: 'Show API Key',
      icon: 'eye',
    })
  })

  it('uses text mode and hide action when secret is visible', () => {
    expect(resolveSecretFieldMeta(true, 'API Key')).toEqual({
      inputType: 'text',
      actionLabel: 'Hide API Key',
      icon: 'eye-off',
    })
  })

  it('switches show and hide labels to Chinese when the workspace locale is zh_CN', () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    expect(resolveSecretFieldMeta(false, 'API Key').actionLabel).toBe('显示 API Key')
    expect(resolveSecretFieldMeta(true, 'API Key').actionLabel).toBe('隐藏 API Key')
  })
})
