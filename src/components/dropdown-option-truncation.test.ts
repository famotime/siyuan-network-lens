import { describe, expect, it } from 'vitest'

import { buildDropdownLayout, buildDropdownMaxWidth, buildTruncationMap, resolveTruncatedTitle } from './dropdown-option-truncation'

describe('dropdown option truncation helpers', () => {
  it('marks only labels whose scroll width exceeds client width as truncated', () => {
    expect(buildTruncationMap([
      { key: 'long', clientWidth: 80, scrollWidth: 160 },
      { key: 'short', clientWidth: 80, scrollWidth: 60 },
    ])).toEqual({
      long: true,
      short: false,
    })
  })

  it('treats labels clipped by dropdown viewport as truncated', () => {
    expect(buildTruncationMap([
      { key: 'left', clientWidth: 120, scrollWidth: 120, clippedLeft: true },
      { key: 'right', clientWidth: 120, scrollWidth: 120, clippedRight: true },
      { key: 'full', clientWidth: 120, scrollWidth: 120 },
    ])).toEqual({
      left: true,
      right: true,
      full: false,
    })
  })

  it('returns title text only when the label is truncated', () => {
    expect(resolveTruncatedTitle('一个很长很长的标签名', true)).toBe('一个很长很长的标签名')
    expect(resolveTruncatedTitle('短标签', false)).toBeUndefined()
    expect(resolveTruncatedTitle('短标签', undefined)).toBeUndefined()
  })

  it('limits dropdown width by the visible container width', () => {
    expect(buildDropdownMaxWidth({
      triggerLeft: 220,
      triggerWidth: 90,
      contentWidth: 320,
      containerLeft: 0,
      containerWidth: 300,
      viewportWidth: 1280,
      viewportPadding: 16,
      designMaxWidth: 448,
    })).toBe('284px')
  })

  it('keeps the design max width when container space is sufficient', () => {
    expect(buildDropdownMaxWidth({
      triggerLeft: 24,
      triggerWidth: 120,
      contentWidth: 396,
      containerLeft: 0,
      containerWidth: 420,
      viewportWidth: 1280,
      viewportPadding: 16,
      designMaxWidth: 448,
    })).toBe('404px')
  })

  it('shifts the dropdown left to stay inside the right boundary before clipping content', () => {
    expect(buildDropdownLayout({
      triggerLeft: 220,
      triggerWidth: 90,
      contentWidth: 260,
      containerLeft: 0,
      containerWidth: 300,
      viewportWidth: 1280,
      viewportPadding: 16,
      designMaxWidth: 448,
    })).toEqual({
      maxWidth: '284px',
      offsetX: '-180px',
    })
  })
})
