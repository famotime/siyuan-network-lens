import { TIME_RANGE_OPTIONS, type TimeRange } from './analysis'
import { t } from '@/i18n/ui'

export function buildTimeRangeOptions() {
  return TIME_RANGE_OPTIONS.map(value => ({
    value,
    label: ({
      all: t('analytics.summaryDetailSource.allTime'),
      '3d': t('analytics.summaryDetailSource.last3Days'),
      '7d': t('analytics.summaryDetailSource.last7Days'),
      '30d': t('analytics.summaryDetailSource.last30Days'),
      '60d': t('analytics.summaryDetailSource.last60Days'),
      '90d': t('analytics.summaryDetailSource.last90Days'),
    } satisfies Record<TimeRange, string>)[value],
  }))
}
