import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'

export function buildInitialSelectedSuggestionIndices(suggestions: readonly WikiMaintenanceSuggestion[]): Set<number> {
  return new Set(suggestions.map((_, index) => index))
}

export function selectAllSuggestionIndices(suggestions: readonly WikiMaintenanceSuggestion[]): Set<number> {
  return buildInitialSelectedSuggestionIndices(suggestions)
}

export function toggleSelectedSuggestionIndex(current: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(current)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  return new Set([...next].sort((left, right) => left - right))
}

export function getSelectedSuggestions(
  suggestions: readonly WikiMaintenanceSuggestion[],
  selectedIndices: ReadonlySet<number>,
): WikiMaintenanceSuggestion[] {
  return [...selectedIndices]
    .sort((left, right) => left - right)
    .map(index => suggestions[index])
    .filter((suggestion): suggestion is WikiMaintenanceSuggestion => Boolean(suggestion))
}

export function resolveDiffDialogLoading(params: {
  loading?: boolean
  suggestions: readonly WikiMaintenanceSuggestion[]
  revisedMarkdown: string
}): boolean {
  if (!params.loading) {
    return false
  }

  return params.suggestions.length === 0 && !params.revisedMarkdown
}
