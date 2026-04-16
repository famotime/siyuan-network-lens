import type { SummaryCardKey } from './summary-details'
import { pickUiText } from '@/i18n/ui'

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

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export const SUMMARY_CARD_DEFINITIONS: SummaryCardDefinition[] = [
  {
    key: 'read',
    visibilityConfigKey: 'showRead',
    defaultVisible: true,
    settingLabel: uiText('Read / unread card', '已读 / 未读卡片'),
    settingDescription: uiText('Show read status counts and switch between read and unread views', '显示已读状态统计，并支持在已读和未读视图间切换'),
  },
  {
    key: 'todaySuggestions',
    visibilityConfigKey: 'showTodaySuggestions',
    defaultVisible: true,
    settingLabel: uiText('Today suggestions card', '今日建议卡片'),
    settingDescription: uiText('Show AI-ranked cleanup suggestions and open the linked detail panel', '显示 AI 排序后的整理建议，并打开联动详情面板'),
    showInSettings: false,
  },
  {
    key: 'orphans',
    visibilityConfigKey: 'showOrphans',
    defaultVisible: true,
    settingLabel: uiText('Orphan docs card', '孤立文档卡片'),
    settingDescription: uiText('Show docs without valid doc-level links in the current window', '显示当前窗口内没有有效文档级连接的文档'),
    legacyVisibilityConfigKey: 'showOrphanBridge',
  },
  {
    key: 'ranking',
    visibilityConfigKey: 'showRanking',
    defaultVisible: true,
    settingLabel: uiText('Core docs card', '核心文档卡片'),
    settingDescription: uiText('Show core doc counts and open linked details', '显示核心文档数量并打开联动详情'),
  },
  {
    key: 'documents',
    visibilityConfigKey: 'showDocuments',
    defaultVisible: false,
    settingLabel: uiText('Doc sample card', '文档样本卡片'),
    settingDescription: uiText('Show the number of docs matched by the current filters', '显示当前筛选命中的文档数量'),
  },
  {
    key: 'largeDocuments',
    visibilityConfigKey: 'showLargeDocuments',
    defaultVisible: true,
    settingLabel: uiText('Large docs card', '大文档卡片'),
    settingDescription: uiText('Show large docs by text or asset thresholds', '按文本或资源体积阈值显示大文档'),
  },
  {
    key: 'trends',
    visibilityConfigKey: 'showTrends',
    defaultVisible: false,
    settingLabel: uiText('Trend watch card', '趋势观察卡片'),
    settingDescription: uiText('Show trend changes and open linked details', '显示趋势变化并打开联动详情'),
  },
  {
    key: 'references',
    visibilityConfigKey: 'showReferences',
    defaultVisible: false,
    settingLabel: uiText('Active links card', '活跃连接卡片'),
    settingDescription: uiText('Show doc-level reference counts in the current window', '显示当前窗口内的文档级引用数量'),
  },
  {
    key: 'communities',
    visibilityConfigKey: 'showCommunities',
    defaultVisible: false,
    settingLabel: uiText('Topic clusters card', '主题社区卡片'),
    settingDescription: uiText('Show cluster scale and open linked details', '显示社区规模并打开联动详情'),
  },
  {
    key: 'propagation',
    visibilityConfigKey: 'showPropagation',
    defaultVisible: false,
    settingLabel: uiText('Propagation nodes card', '传播节点卡片'),
    settingDescription: uiText('Show high-propagation-value node summaries', '显示高传播价值节点摘要'),
  },
  {
    key: 'bridges',
    visibilityConfigKey: 'showBridges',
    defaultVisible: false,
    settingLabel: uiText('Bridge docs card', '桥接文档卡片'),
    settingDescription: uiText('Show bridge docs whose removal weakens cluster connectivity', '显示移除后会削弱社区连通性的桥接文档'),
    legacyVisibilityConfigKey: 'showOrphanBridge',
  },
  {
    key: 'dormant',
    visibilityConfigKey: 'showDormant',
    defaultVisible: false,
    settingLabel: uiText('Dormant docs card', '沉没文档卡片'),
    settingDescription: uiText('Show docs past the inactivity threshold without valid links', '显示超过不活跃阈值且没有有效连接的文档'),
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
