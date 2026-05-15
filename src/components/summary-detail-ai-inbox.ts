import type { AiInboxItemType } from '@/analytics/ai-inbox'
import type { DetailSuggestion } from '@/analytics/summary-details'
import type { TodaySuggestionHistoryEntry } from '@/analytics/today-suggestion-history-store'
import type { ThemeDocument, ThemeDocumentMatch } from '@/analytics/theme-documents'
import { t } from '@/i18n/ui'
import { resolveAiInboxActionTargets as resolveAiInboxActionTargetsFromData } from '@/components/ai-inbox-detail'

export type DetailItemWithThemeSuggestions = {
  documentId: string
  title: string
  meta: string
  badge?: string
  isThemeDocument?: boolean
  suggestions?: Array<{ label: string, text: string }>
  readTagSuggestions?: string[]
  readTagSuggestionDescription?: string
  themeSuggestions: ThemeDocumentMatch[]
}

export function hasSuggestionCallout(item: DetailItemWithThemeSuggestions): boolean {
  return Boolean(item.suggestions?.length || item.themeSuggestions.length)
}

export function buildSuggestionCalloutItems(item: DetailItemWithThemeSuggestions): DetailSuggestion[] {
  const suggestions = item.suggestions ?? []
  if (!item.themeSuggestions.length) {
    return suggestions
  }

  return suggestions.map((suggestion) => {
    if (suggestion.label !== t('summaryDetail.labels.repairLinks')) {
      return suggestion
    }

    const text = suggestion.text.replace(/[.。；，,\s]*$/, '')
    return {
      ...suggestion,
      text: t('summaryDetail.labels.repairLinksWithTopics', { text }),
    }
  })
}

export function resolveAiInboxTypeLabel(type: AiInboxItemType) {
  if (type === 'connection') {
    return t('summaryDetail.labels.repairLinks')
  }
  if (type === 'topic-page') {
    return t('summaryDetail.labels.buildTopicPage')
  }
  if (type === 'bridge-risk') {
    return t('summaryDetail.labels.bridgeRisk')
  }
  return t('summaryDetail.labels.documentCleanup')
}

export function resolveAiInboxActionTargets(params: {
  item: { action: string, recommendedTargets?: any[] }
  themeDocuments: ThemeDocument[]
}) {
  return resolveAiInboxActionTargetsFromData({
    item: params.item,
    themeDocuments: params.themeDocuments,
  }).filter(target => Boolean(target.documentId?.trim()))
}

export function buildAiInboxHistoryTooltip(entry: TodaySuggestionHistoryEntry) {
  return [
    t('summaryDetail.historyTooltip.generated', { value: entry.generatedAt || t('summaryDetail.historyTooltip.unknownTime') }),
    t('summaryDetail.historyTooltip.window', { value: entry.timeRange }),
    t('summaryDetail.historyTooltip.count', { value: entry.summaryCount }),
    t('summaryDetail.historyTooltip.notebook', { value: entry.filters.notebook || t('summaryDetail.historyTooltip.all') }),
    t('summaryDetail.historyTooltip.tags', { value: entry.filters.tags?.join(' / ') || t('summaryDetail.historyTooltip.all') }),
    t('summaryDetail.historyTooltip.topics', { value: entry.filters.themeNames?.join(' / ') || t('summaryDetail.historyTooltip.all') }),
    t('summaryDetail.historyTooltip.keyword', { value: entry.filters.keyword || t('summaryDetail.historyTooltip.none') }),
  ].join('\n')
}
