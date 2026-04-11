import type { SummaryCardKey } from '@/analytics/summary-details'

export type HiddenPluginSettingKey = 'ai-service' | 'llm-wiki'

export type AlphaFeatureHideConfig = {
  hiddenSummaryCardKeys: SummaryCardKey[]
  hiddenSettingKeys: HiddenPluginSettingKey[]
}

export const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  hiddenSummaryCardKeys: ['communities', 'bridges', 'dormant'],
  hiddenSettingKeys: ['llm-wiki'],
}

export function getHiddenSummaryCardKeys(
  config: AlphaFeatureHideConfig = ALPHA_FEATURE_HIDE_CONFIG,
): Set<SummaryCardKey> {
  return new Set(config.hiddenSummaryCardKeys)
}

export function getHiddenPluginSettingKeys(
  config: AlphaFeatureHideConfig = ALPHA_FEATURE_HIDE_CONFIG,
): Set<HiddenPluginSettingKey> {
  return new Set(config.hiddenSettingKeys)
}

export function isAlphaSummaryCardVisible(
  key: SummaryCardKey,
  config: AlphaFeatureHideConfig = ALPHA_FEATURE_HIDE_CONFIG,
): boolean {
  return !getHiddenSummaryCardKeys(config).has(key)
}

export function isAlphaSettingVisible(
  key: HiddenPluginSettingKey,
  config: AlphaFeatureHideConfig = ALPHA_FEATURE_HIDE_CONFIG,
): boolean {
  return !getHiddenPluginSettingKeys(config).has(key)
}
