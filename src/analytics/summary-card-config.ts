import type { SummaryCardKey } from './summary-details'

export type SummaryCardVisibilityConfigKey =
  | 'showDocuments'
  | 'showLargeDocuments'
  | 'showRead'
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
  legacyVisibilityConfigKey?: LegacySummaryCardVisibilityConfigKey
}

export const SUMMARY_CARD_DEFINITIONS: SummaryCardDefinition[] = [
  {
    key: 'read',
    visibilityConfigKey: 'showRead',
    defaultVisible: true,
    settingLabel: '已读/未读文档卡片',
    settingDescription: '展示已读状态统计，并支持在已读与未读之间切换',
  },
  {
    key: 'orphans',
    visibilityConfigKey: 'showOrphans',
    defaultVisible: true,
    settingLabel: '孤立文档卡片',
    settingDescription: '展示当前窗口内没有有效文档级连接的文档数',
    legacyVisibilityConfigKey: 'showOrphanBridge',
  },
  {
    key: 'ranking',
    visibilityConfigKey: 'showRanking',
    defaultVisible: true,
    settingLabel: '核心文档卡片',
    settingDescription: '展示核心文档数量并联动详情',
  },
  {
    key: 'documents',
    visibilityConfigKey: 'showDocuments',
    defaultVisible: false,
    settingLabel: '文档样本卡片',
    settingDescription: '展示当前筛选命中的文档数量',
  },
  {
    key: 'largeDocuments',
    visibilityConfigKey: 'showLargeDocuments',
    defaultVisible: true,
    settingLabel: '大文档卡片',
    settingDescription: '展示按文字或资源阈值切换的大文档统计入口',
  },
  {
    key: 'trends',
    visibilityConfigKey: 'showTrends',
    defaultVisible: false,
    settingLabel: '趋势观察卡片',
    settingDescription: '展示趋势变化并联动详情',
  },
  {
    key: 'references',
    visibilityConfigKey: 'showReferences',
    defaultVisible: false,
    settingLabel: '活跃关系卡片',
    settingDescription: '展示当前窗口内的文档级引用次数',
  },
  {
    key: 'communities',
    visibilityConfigKey: 'showCommunities',
    defaultVisible: false,
    settingLabel: '主题社区卡片',
    settingDescription: '展示社区规模并联动详情',
  },
  {
    key: 'propagation',
    visibilityConfigKey: 'showPropagation',
    defaultVisible: false,
    settingLabel: '传播节点卡片',
    settingDescription: '展示高传播价值节点汇总',
  },
  {
    key: 'bridges',
    visibilityConfigKey: 'showBridges',
    defaultVisible: false,
    settingLabel: '桥接节点卡片',
    settingDescription: '展示断开后会削弱社区连接的桥接文档数',
    legacyVisibilityConfigKey: 'showOrphanBridge',
  },
  {
    key: 'dormant',
    visibilityConfigKey: 'showDormant',
    defaultVisible: false,
    settingLabel: '沉没文档卡片',
    settingDescription: '展示超过阈值未产生有效连接的文档数',
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
  config: Partial<Record<SummaryCardVisibilityConfigKey, boolean>>,
  key: SummaryCardKey,
): boolean {
  const definition = getSummaryCardDefinition(key)
  return config[definition.visibilityConfigKey] ?? definition.defaultVisible
}
