import { TIME_RANGE_OPTIONS, type TimeRange } from './analysis'
import { pickUiText } from '@/i18n/ui'

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export function buildTimeRangeOptions() {
  return TIME_RANGE_OPTIONS.map(value => ({
    value,
    label: ({
      all: uiText('All time', '全部时间'),
      '3d': uiText('Last 3 days', '最近 3 天'),
      '7d': uiText('Last 7 days', '最近 7 天'),
      '30d': uiText('Last 30 days', '最近 30 天'),
      '60d': uiText('Last 60 days', '最近 60 天'),
      '90d': uiText('Last 90 days', '最近 90 天'),
    } satisfies Record<TimeRange, string>)[value],
  }))
}
