import { afterEach, describe, expect, it } from 'vitest'

import { buildTimeRangeOptions } from './time-range'

describe('buildTimeRangeOptions', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('builds labels from the shared time range options', () => {
    expect(buildTimeRangeOptions()).toEqual([
      { value: 'all', label: 'All time' },
      { value: '3d', label: 'Last 3 days' },
      { value: '7d', label: 'Last 7 days' },
      { value: '30d', label: 'Last 30 days' },
      { value: '60d', label: 'Last 60 days' },
      { value: '90d', label: 'Last 90 days' },
    ])
  })

  it('switches labels to Chinese when the workspace locale is zh_CN', () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    expect(buildTimeRangeOptions()).toEqual([
      { value: 'all', label: '全部时间' },
      { value: '3d', label: '最近 3 天' },
      { value: '7d', label: '最近 7 天' },
      { value: '30d', label: '最近 30 天' },
      { value: '60d', label: '最近 60 天' },
      { value: '90d', label: '最近 90 天' },
    ])
  })
})
