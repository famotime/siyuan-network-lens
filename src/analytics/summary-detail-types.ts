import type { RankingItem, TrendReport } from './analysis'
import type { AiInboxResult } from './ai-inbox'
import type { WikiIndexPage } from './wiki-index'

export type SummaryCardKey =
  | 'documents'
  | 'largeDocuments'
  | 'read'
  | 'todaySuggestions'
  | 'references'
  | 'ranking'
  | 'trends'
  | 'communities'
  | 'orphans'
  | 'dormant'
  | 'bridges'
  | 'propagation'
  | 'llmWiki'

export interface SummaryCardItem {
  key: SummaryCardKey
  label: string
  value: string
  hint: string
}

export interface SummaryDetailItem {
  documentId: string
  title: string
  meta: string
  badge?: string
  isThemeDocument?: boolean
  suggestions?: DetailSuggestion[]
}

export interface DetailSuggestion {
  label: string
  text: string
}

export interface RankingDetailItem extends RankingItem {
  tagCount: number
  createdAt: string
  updatedAt: string
  isThemeDocument?: boolean
  suggestions?: DetailSuggestion[]
}

export type ListDetailSectionKey = Exclude<SummaryCardKey, 'ranking' | 'trends' | 'propagation' | 'todaySuggestions' | 'llmWiki'>

export type SummaryDetailSection =
  | {
    key: ListDetailSectionKey
    title: string
    description: string
    kind: 'list'
    items: SummaryDetailItem[]
  }
  | {
    key: 'ranking'
    title: string
    description: string
    kind: 'ranking'
    ranking: RankingDetailItem[]
  }
  | {
    key: 'trends'
    title: string
    description: string
    kind: 'trends'
    trends: TrendReport
  }
  | {
    key: 'propagation'
    title: string
    description: string
    kind: 'propagation'
    items: SummaryDetailItem[]
  }
  | {
    key: 'todaySuggestions'
    title: string
    description: string
    kind: 'aiInbox'
    result: AiInboxResult | null
  }
  | {
    key: 'llmWiki'
    title: string
    description: string
    kind: 'wikiCards'
    pages: WikiIndexPage[]
  }
