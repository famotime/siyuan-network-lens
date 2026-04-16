import { describe, expect, it } from 'vitest'

import { normalizeUiLocale, pickUiText } from './ui'

describe('ui i18n helper', () => {
  it('normalizes zh variants to zh_CN', () => {
    expect(normalizeUiLocale('zh_CN')).toBe('zh_CN')
    expect(normalizeUiLocale('zh-Hans')).toBe('zh_CN')
    expect(normalizeUiLocale('zh')).toBe('zh_CN')
  })

  it('falls back to en_US for non-zh locales', () => {
    expect(normalizeUiLocale('en_US')).toBe('en_US')
    expect(normalizeUiLocale('ja_JP')).toBe('en_US')
    expect(normalizeUiLocale(undefined)).toBe('en_US')
  })

  it('picks locale-specific text', () => {
    expect(pickUiText({ en_US: 'Refresh analysis', zh_CN: '刷新分析' }, 'en_US')).toBe('Refresh analysis')
    expect(pickUiText({ en_US: 'Refresh analysis', zh_CN: '刷新分析' }, 'zh_CN')).toBe('刷新分析')
  })
})
