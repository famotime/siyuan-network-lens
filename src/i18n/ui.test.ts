import { describe, expect, it } from 'vitest'

import { normalizeUiLocale, pickUiText, t } from './ui'

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

  it('resolves keyed UI text', () => {
    expect(t('app.refreshAnalysis', 'en_US')).toBe('Refresh analysis')
    expect(t('app.refreshAnalysis', 'zh_CN')).toBe('刷新分析')
    expect(t('app.loading.contextTitle', 'en_US')).toBe('Preparing topic, tag, and reference overview')
    expect(t('app.loading.contextTitle', 'zh_CN')).toBe('正在准备主题、标签与引用概览')
  })

  it('supports simple placeholder interpolation', () => {
    expect(t('summaryDetail.counts.suggestions', { count: 2 }, 'en_US')).toBe('2 suggestions')
    expect(t('summaryDetail.counts.suggestions', { count: 2 }, 'zh_CN')).toBe('2 条建议')
    expect(t('summaryDetail.trends.currentPrevious', { current: 5, previous: 3 }, 'en_US')).toBe('Current 5 · Previous 3')
    expect(t('summaryDetail.trends.currentPrevious', { current: 5, previous: 3 }, 'zh_CN')).toBe('当前 5 · 上一窗口 3')
  })

  it('includes shared component copy used by migrated controls', () => {
    expect(t('shared.clear', 'en_US')).toBe('Clear')
    expect(t('shared.clear', 'zh_CN')).toBe('清空')
    expect(t('shared.topicDoc', 'en_US')).toBe('Topic doc')
    expect(t('shared.topicDoc', 'zh_CN')).toBe('主题文档')
    expect(t('shared.selectedThemesCount', { count: 2, unit: 'themes' }, 'en_US')).toBe('2 themes selected')
    expect(t('shared.selectedThemesCount', { count: 2, unit: '个主题' }, 'zh_CN')).toBe('已选 2 个主题')
    expect(t('shared.switchToUnreadDocs', 'en_US')).toBe('Switch to unread docs')
    expect(t('shared.switchToUnreadDocs', 'zh_CN')).toBe('切换为未读文档')
  })
})
