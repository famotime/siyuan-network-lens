import { describe, expect, it } from 'vitest'

import {
  buildInitialSelectedSuggestionIndices,
  getSelectedSuggestions,
  resolveDiffDialogLoading,
  selectAllSuggestionIndices,
  toggleSelectedSuggestionIndex,
} from './wiki-maintain-diff-state'

const suggestions = [
  { type: 'broken-link', description: '坏链 1' },
  { type: 'outdated-section', description: '段落过时' },
  { type: 'missing-reference', description: '缺少引用' },
] as const

describe('wiki-maintain-diff-state', () => {
  it('selects all suggestions by default', () => {
    expect([...buildInitialSelectedSuggestionIndices(suggestions)]).toEqual([0, 1, 2])
    expect([...selectAllSuggestionIndices(suggestions)]).toEqual([0, 1, 2])
  })

  it('toggles a suggestion index on and off without mutating the original set', () => {
    const current = new Set([0, 1, 2])

    const removed = toggleSelectedSuggestionIndex(current, 1)
    const restored = toggleSelectedSuggestionIndex(removed, 1)

    expect([...current]).toEqual([0, 1, 2])
    expect([...removed]).toEqual([0, 2])
    expect([...restored]).toEqual([0, 1, 2])
  })

  it('returns selected suggestions in source order when applying', () => {
    const selected = new Set([2, 0])

    expect(getSelectedSuggestions(suggestions, selected)).toEqual([
      { type: 'broken-link', description: '坏链 1' },
      { type: 'missing-reference', description: '缺少引用' },
    ])
  })

  it('stops showing loading once suggestions or revised markdown are available', () => {
    expect(resolveDiffDialogLoading({
      loading: true,
      suggestions: [],
      revisedMarkdown: '',
    })).toBe(true)

    expect(resolveDiffDialogLoading({
      loading: true,
      suggestions,
      revisedMarkdown: '',
    })).toBe(false)

    expect(resolveDiffDialogLoading({
      loading: true,
      suggestions: [],
      revisedMarkdown: '# revised',
    })).toBe(false)

    expect(resolveDiffDialogLoading({
      loading: false,
      suggestions: [],
      revisedMarkdown: '',
    })).toBe(false)
  })
})
