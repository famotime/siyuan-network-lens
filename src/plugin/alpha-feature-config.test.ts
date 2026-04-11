import { describe, expect, it } from 'vitest'

import {
  getHiddenPluginSettingKeys,
  getHiddenSummaryCardKeys,
  isAlphaSettingVisible,
  isAlphaSummaryCardVisible,
} from './alpha-feature-config'

describe('alpha feature config', () => {
  it('reports hidden summary cards and setting groups from a supplied config', () => {
    expect(getHiddenSummaryCardKeys({
      hiddenSummaryCardKeys: ['todaySuggestions', 'trends'],
      hiddenSettingKeys: ['ai-service'],
    })).toEqual(new Set(['todaySuggestions', 'trends']))

    expect(getHiddenPluginSettingKeys({
      hiddenSummaryCardKeys: [],
      hiddenSettingKeys: ['ai-service', 'llm-wiki'],
    })).toEqual(new Set(['ai-service', 'llm-wiki']))
  })

  it('returns false for hidden cards and settings', () => {
    expect(isAlphaSummaryCardVisible('todaySuggestions', {
      hiddenSummaryCardKeys: ['todaySuggestions'],
      hiddenSettingKeys: [],
    })).toBe(false)

    expect(isAlphaSummaryCardVisible('ranking', {
      hiddenSummaryCardKeys: ['todaySuggestions'],
      hiddenSettingKeys: [],
    })).toBe(true)

    expect(isAlphaSettingVisible('llm-wiki', {
      hiddenSummaryCardKeys: [],
      hiddenSettingKeys: ['llm-wiki'],
    })).toBe(false)

    expect(isAlphaSettingVisible('ai-service', {
      hiddenSummaryCardKeys: [],
      hiddenSettingKeys: ['llm-wiki'],
    })).toBe(true)
  })
})
