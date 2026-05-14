import { watch, type ComputedRef, type Ref } from 'vue'

import type { ReferenceGraphReport } from '@/analytics/analysis'
import { isSameSummaryCardOrder, normalizeSummaryCardOrder } from '@/analytics/summary-card-order'
import type { SummaryCardItem, SummaryCardKey } from '@/analytics/summary-details'
import type { PathScope } from './use-analytics-derived'

type PathOption = { id: string }
type ThemeOption = { value: string }
type LightweightReport = Pick<ReferenceGraphReport, 'ranking' | 'orphans' | 'bridgeDocuments' | 'communities'>

export function resolveSynchronizedPathEndpoints(params: {
  options: readonly PathOption[]
  currentFromDocumentId: string
  currentToDocumentId: string
}): { fromDocumentId: string, toDocumentId: string } {
  if (params.options.length === 0) {
    return {
      fromDocumentId: '',
      toDocumentId: '',
    }
  }

  const hasFrom = params.options.some(option => option.id === params.currentFromDocumentId)
  const fromDocumentId = hasFrom ? params.currentFromDocumentId : (params.options[0]?.id ?? '')
  const hasTo = params.options.some(option => option.id === params.currentToDocumentId)
  const toDocumentId = (!hasTo || params.currentToDocumentId === fromDocumentId)
    ? (params.options.find(option => option.id !== fromDocumentId)?.id ?? '')
    : params.currentToDocumentId

  return {
    fromDocumentId,
    toDocumentId,
  }
}

export function resolvePreferredEvidenceDocument(params: {
  report: LightweightReport | null | undefined
  sampleDocumentIds: ReadonlySet<string>
  currentSelectedEvidenceDocument: string
}): string {
  if (!params.report) {
    return ''
  }

  const preferredDocumentId = params.report.ranking[0]?.documentId
    ?? params.report.orphans[0]?.documentId
    ?? params.report.bridgeDocuments[0]?.documentId
    ?? ''

  if (!preferredDocumentId) {
    return ''
  }

  if (!params.sampleDocumentIds.has(params.currentSelectedEvidenceDocument)) {
    return preferredDocumentId
  }

  return params.currentSelectedEvidenceDocument
}

export function resolveSelectedCommunityId(
  report: LightweightReport | null | undefined,
  currentSelectedCommunityId: string,
): string {
  if (!report) {
    return ''
  }

  return report.communities.some(item => item.id === currentSelectedCommunityId)
    ? currentSelectedCommunityId
    : (report.communities[0]?.id ?? '')
}

export function filterSelectedValues(selectedValues: readonly string[], allowedValues: Iterable<string>): string[] {
  const allowed = new Set(allowedValues)
  return selectedValues.filter(value => allowed.has(value))
}

export function resolveEvidenceDocumentFromActiveDocument(params: {
  activeDocumentId: string
  sampleDocumentIds: ReadonlySet<string>
  currentSelectedEvidenceDocument: string
}): string {
  if (params.activeDocumentId && params.sampleDocumentIds.has(params.activeDocumentId)) {
    return params.activeDocumentId
  }

  if (params.currentSelectedEvidenceDocument && !params.sampleDocumentIds.has(params.currentSelectedEvidenceDocument)) {
    return ''
  }

  return params.currentSelectedEvidenceDocument
}

export function resolveCommunitySelectionFromEvidence(params: {
  report: Pick<ReferenceGraphReport, 'communities'> | null | undefined
  selectedEvidenceDocument: string
  currentSelectedCommunityId: string
}): string {
  if (!params.report || !params.selectedEvidenceDocument) {
    return params.currentSelectedCommunityId
  }

  const community = params.report.communities.find(item => item.documentIds.includes(params.selectedEvidenceDocument))
  return community?.id ?? params.currentSelectedCommunityId
}

export function normalizePathScopeForCommunity(scope: PathScope, hasSelectedCommunity: boolean): PathScope {
  if (scope === 'community' && !hasSelectedCommunity) {
    return 'focused'
  }
  return scope
}

export function resolveSelectedSummaryCardKey(params: {
  cards: readonly SummaryCardItem[]
  currentSelectedSummaryCardKey: SummaryCardKey
}): SummaryCardKey {
  if (params.cards.length === 0) {
    return params.currentSelectedSummaryCardKey
  }

  return params.cards.some(card => card.key === params.currentSelectedSummaryCardKey)
    ? params.currentSelectedSummaryCardKey
    : params.cards[0].key
}

export function resolveSummaryCardOrderSync(params: {
  savedOrder?: readonly string[]
  currentOrder: readonly string[]
}): SummaryCardKey[] | null {
  if (isSameSummaryCardOrder(params.savedOrder, params.currentOrder)) {
    return null
  }

  return normalizeSummaryCardOrder(params.savedOrder)
}

export function setupAnalyticsSelectionSync(params: {
  pathOptions: ComputedRef<PathOption[]>
  fromDocumentId: Ref<string>
  toDocumentId: Ref<string>
  report: ComputedRef<ReferenceGraphReport | null>
  sampleDocumentIds: ComputedRef<Set<string>>
  selectedEvidenceDocument: Ref<string>
  selectedCommunityId: Ref<string>
  summaryCardOrderSource: ComputedRef<readonly string[] | undefined>
  summaryCardOrder: Ref<SummaryCardKey[]>
  summaryCards: ComputedRef<SummaryCardItem[]>
  selectedSummaryCardKey: Ref<SummaryCardKey>
  themeOptions: ComputedRef<ThemeOption[]>
  selectedThemes: Ref<string[]>
  tagOptions: ComputedRef<string[]>
  selectedTags: Ref<string[]>
  activeDocumentId: Ref<string>
  pathScope: Ref<PathScope>
  selectedCommunity: ComputedRef<{ id: string } | null>
}) {
  watch(params.pathOptions, (options) => {
    const next = resolveSynchronizedPathEndpoints({
      options,
      currentFromDocumentId: params.fromDocumentId.value,
      currentToDocumentId: params.toDocumentId.value,
    })
    params.fromDocumentId.value = next.fromDocumentId
    params.toDocumentId.value = next.toDocumentId
  }, { immediate: true })

  watch(params.report, (nextReport) => {
    if (!nextReport) {
      params.selectedEvidenceDocument.value = ''
      params.selectedCommunityId.value = ''
      return
    }

    params.selectedEvidenceDocument.value = resolvePreferredEvidenceDocument({
      report: nextReport,
      sampleDocumentIds: params.sampleDocumentIds.value,
      currentSelectedEvidenceDocument: params.selectedEvidenceDocument.value,
    })
    params.selectedCommunityId.value = resolveSelectedCommunityId(nextReport, params.selectedCommunityId.value)
  }, { immediate: true })

  watch(params.summaryCardOrderSource, (savedOrder) => {
    const nextOrder = resolveSummaryCardOrderSync({
      savedOrder,
      currentOrder: params.summaryCardOrder.value,
    })
    if (nextOrder) {
      params.summaryCardOrder.value = nextOrder
    }
  }, { immediate: true })

  watch(params.summaryCards, (cards) => {
    params.selectedSummaryCardKey.value = resolveSelectedSummaryCardKey({
      cards,
      currentSelectedSummaryCardKey: params.selectedSummaryCardKey.value,
    })
  }, { immediate: true })

  watch(params.themeOptions, (options) => {
    params.selectedThemes.value = filterSelectedValues(
      params.selectedThemes.value,
      options.map(option => option.value),
    )
  }, { immediate: true })

  watch(params.tagOptions, (options) => {
    params.selectedTags.value = filterSelectedValues(params.selectedTags.value, options)
  }, { immediate: true })

  watch([params.activeDocumentId, params.sampleDocumentIds], ([documentId, documentIds]) => {
    params.selectedEvidenceDocument.value = resolveEvidenceDocumentFromActiveDocument({
      activeDocumentId: documentId,
      sampleDocumentIds: documentIds,
      currentSelectedEvidenceDocument: params.selectedEvidenceDocument.value,
    })
  })

  watch([params.report, params.selectedEvidenceDocument], ([nextReport, documentId]) => {
    params.selectedCommunityId.value = resolveCommunitySelectionFromEvidence({
      report: nextReport,
      selectedEvidenceDocument: documentId,
      currentSelectedCommunityId: params.selectedCommunityId.value,
    })
  }, { immediate: true })

  watch(params.pathScope, (scope) => {
    params.pathScope.value = normalizePathScopeForCommunity(scope, Boolean(params.selectedCommunity.value))
  })
}
