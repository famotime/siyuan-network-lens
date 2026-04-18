import { t } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'

export type DocumentTitleCleanupConfig = Pick<
  PluginConfig,
  'themeNamePrefix' | 'themeNameSuffix' | 'readTitlePrefixes' | 'readTitleSuffixes'
>

export function normalizeTags(tags?: readonly string[] | string | null): string[] {
  if (!tags) {
    return []
  }
  if (Array.isArray(tags)) {
    return tags
      .map(tag => tag.trim())
      .filter(Boolean)
  }

  return tags
    .split(/[,\s#]+/)
    .map(tag => tag.trim())
    .filter(Boolean)
}

export function resolveDocumentTitle(document: {
  id?: string
  title?: string
  name?: string | null
  content?: string | null
  hpath?: string
  path?: string
}): string {
  return document.title || document.name || document.content || document.hpath || document.path || document.id || ''
}

export function normalizeTitleRules(value?: string): string[] {
  if (!value) {
    return []
  }

  return value
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
}

export function stripConfiguredTitleAffixes(title: string, config?: DocumentTitleCleanupConfig | null): string {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) {
    return normalizedTitle
  }

  const prefixes = [...new Set([
    config?.themeNamePrefix?.trim() ?? '',
    ...normalizeTitleRules(config?.readTitlePrefixes),
  ])]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
  const suffixes = [...new Set([
    config?.themeNameSuffix?.trim() ?? '',
    ...normalizeTitleRules(config?.readTitleSuffixes),
  ])]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)

  let value = normalizedTitle
  let changed = true
  while (changed && value) {
    changed = false

    for (const prefix of prefixes) {
      if (!value.startsWith(prefix)) {
        continue
      }
      value = value.slice(prefix.length).trim()
      changed = true
      break
    }

    for (const suffix of suffixes) {
      if (!value.endsWith(suffix)) {
        continue
      }
      value = value.slice(0, value.length - suffix.length).trim()
      changed = true
      break
    }
  }

  return value || normalizedTitle
}

export function resolveNormalizedDocumentTitle(
  document: Parameters<typeof resolveDocumentTitle>[0],
  config?: DocumentTitleCleanupConfig | null,
): string {
  return stripConfiguredTitleAffixes(resolveDocumentTitle(document), config)
}

export function parseSiyuanTimestamp(timestamp: string): number | null {
  if (!timestamp || timestamp.length < 8) {
    return null
  }
  const year = Number.parseInt(timestamp.slice(0, 4), 10)
  const month = Number.parseInt(timestamp.slice(4, 6), 10) - 1
  const day = Number.parseInt(timestamp.slice(6, 8), 10)
  const hour = Number.parseInt(timestamp.slice(8, 10) || '0', 10)
  const minute = Number.parseInt(timestamp.slice(10, 12) || '0', 10)
  const second = Number.parseInt(timestamp.slice(12, 14) || '0', 10)
  return new Date(year, month, day, hour, minute, second).getTime()
}

export function compareSiyuanTimestamps(left: string, right: string): number {
  return (parseSiyuanTimestamp(left) ?? 0) - (parseSiyuanTimestamp(right) ?? 0)
}

export function isTimestampInTrailingWindow(timestamp: string, now: Date, days: number): boolean {
  const value = parseSiyuanTimestamp(timestamp)
  if (!value) {
    return false
  }
  const end = now.getTime()
  const start = end - days * 24 * 60 * 60 * 1000
  return value > start && value <= end
}

export function isTimestampInPreviousWindow(timestamp: string, now: Date, days: number): boolean {
  const value = parseSiyuanTimestamp(timestamp)
  if (!value) {
    return false
  }
  const end = now.getTime() - days * 24 * 60 * 60 * 1000
  const start = end - days * 24 * 60 * 60 * 1000
  return value > start && value <= end
}

export function formatCompactDate(timestamp?: string): string {
  if (!timestamp || timestamp.length < 8) {
    return t('analytics.controller.unknownTime')
  }
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`
}
