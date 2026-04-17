import type { SummaryCardKey } from './summary-details'
import { t } from '@/i18n/ui'

export type SummaryCardVisibilityConfigKey =
  | 'showDocuments'
  | 'showLargeDocuments'
  | 'showRead'
  | 'showTodaySuggestions'
  | 'showReferences'
  | 'showRanking'
  | 'showTrends'
  | 'showCommunities'
  | 'showOrphans'
  | 'showDormant'
  | 'showBridges'
  | 'showPropagation'

type LegacySummaryCardVisibilityConfigKey = 'showOrphanBridge'

export interface SummaryCardDefinition {
  key: SummaryCardKey
  visibilityConfigKey: SummaryCardVisibilityConfigKey
  defaultVisible: boolean
  settingLabel: string
  settingDescription: string
  showInSettings?: boolean
  legacyVisibilityConfigKey?: LegacySummaryCardVisibilityConfigKey
}

export const SUMMARY_CARD_DEFINITIONS: SummaryCardDefinition[] = [
  {
    key: 'read',
    visibilityConfigKey: 'showRead',
    defaultVisible: true,
    settingLabel: t('analytics.summaryCardConfig.readUnreadCard'),
    settingDescription: t('analytics.summaryCardConfig.readUnreadCardDescription'),
  },
  {
    key: 'todaySuggestions',
    visibilityConfigKey: 'showTodaySuggestions',
    defaultVisible: true,
    settingLabel: t('analytics.summaryCardConfig.todaySuggestionsCard'),
    settingDescription: t('analytics.summaryCardConfig.todaySuggestionsCardDescription'),
    showInSettings: false,
  },
  {
    key: 'orphans',
    visibilityConfigKey: 'showOrphans',
    defaultVisible: true,
    settingLabel: t('analytics.summaryCardConfig.orphanDocsCard'),
    settingDescription: t('analytics.summaryCardConfig.orphanDocsCardDescription'),
    legacyVisibilityConfigKey: 'showOrphanBridge',
  },
  {
    key: 'ranking',
    visibilityConfigKey: 'showRanking',
    defaultVisible: true,
    settingLabel: t('analytics.summaryCardConfig.coreDocsCard'),
    settingDescription: t('analytics.summaryCardConfig.coreDocsCardDescription'),
  },
  {
    key: 'documents',
    visibilityConfigKey: 'showDocuments',
    defaultVisible: false,
    settingLabel: t('analytics.summaryCardConfig.docSampleCard'),
    settingDescription: t('analytics.summaryCardConfig.docSampleCardDescription'),
  },
  {
    key: 'largeDocuments',
    visibilityConfigKey: 'showLargeDocuments',
    defaultVisible: true,
    settingLabel: t('analytics.summaryCardConfig.largeDocsCard'),
    settingDescription: t('analytics.summaryCardConfig.largeDocsCardDescription'),
  },
  {
    key: 'trends',
    visibilityConfigKey: 'showTrends',
    defaultVisible: false,
    settingLabel: t('analytics.summaryCardConfig.trendWatchCard'),
    settingDescription: t('analytics.summaryCardConfig.trendWatchCardDescription'),
  },
  {
    key: 'references',
    visibilityConfigKey: 'showReferences',
    defaultVisible: false,
    settingLabel: t('analytics.summaryCardConfig.activeLinksCard'),
    settingDescription: t('analytics.summaryCardConfig.activeLinksCardDescription'),
  },
  {
    key: 'communities',
    visibilityConfigKey: 'showCommunities',
    defaultVisible: false,
    settingLabel: t('analytics.summaryCardConfig.topicClustersCard'),
    settingDescription: t('analytics.summaryCardConfig.topicClustersCardDescription'),
  },
  {
    key: 'propagation',
    visibilityConfigKey: 'showPropagation',
    defaultVisible: false,
    settingLabel: t('analytics.summaryCardConfig.propagationNodesCard'),
    settingDescription: t('analytics.summaryCardConfig.propagationNodesCardDescription'),
  },
  {
    key: 'bridges',
    visibilityConfigKey: 'showBridges',
    defaultVisible: false,
    settingLabel: t('analytics.summaryCardConfig.bridgeDocsCard'),
    settingDescription: t('analytics.summaryCardConfig.bridgeDocsCardDescription'),
    legacyVisibilityConfigKey: 'showOrphanBridge',
  },
  {
    key: 'dormant',
    visibilityConfigKey: 'showDormant',
    defaultVisible: false,
    settingLabel: t('analytics.summaryCardConfig.dormantDocsCard'),
    settingDescription: t('analytics.summaryCardConfig.dormantDocsCardDescription'),
    legacyVisibilityConfigKey: 'showOrphanBridge',
  },
]

export const DEFAULT_SUMMARY_CARD_ORDER: SummaryCardKey[] = SUMMARY_CARD_DEFINITIONS.map(item => item.key)

const SUMMARY_CARD_DEFINITION_MAP = new Map(SUMMARY_CARD_DEFINITIONS.map(item => [item.key, item]))

export function getSummaryCardDefinition(key: SummaryCardKey): SummaryCardDefinition {
  return SUMMARY_CARD_DEFINITION_MAP.get(key) ?? SUMMARY_CARD_DEFINITIONS[0]
}

export function getSummaryCardVisibilityConfigKey(key: SummaryCardKey): SummaryCardVisibilityConfigKey {
  return getSummaryCardDefinition(key).visibilityConfigKey
}

export function buildSummaryCardVisibilityDefaults(): Record<SummaryCardVisibilityConfigKey, boolean> {
  return Object.fromEntries(
    SUMMARY_CARD_DEFINITIONS.map(item => [item.visibilityConfigKey, item.defaultVisible]),
  ) as Record<SummaryCardVisibilityConfigKey, boolean>
}

export function isSummaryCardVisible(
  config: Partial<Record<SummaryCardVisibilityConfigKey, boolean>> & { aiEnabled?: boolean },
  key: SummaryCardKey,
): boolean {
  if (key === 'todaySuggestions') {
    return Boolean(config.aiEnabled)
  }
  const definition = getSummaryCardDefinition(key)
  return config[definition.visibilityConfigKey] ?? definition.defaultVisible
}
