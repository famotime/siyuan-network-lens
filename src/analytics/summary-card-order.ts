import type { SummaryCardItem, SummaryCardKey } from './summary-details'
import { DEFAULT_SUMMARY_CARD_ORDER as DEFAULT_SUMMARY_CARD_ORDER_CONFIG } from './summary-card-config'

export const DEFAULT_SUMMARY_CARD_ORDER = DEFAULT_SUMMARY_CARD_ORDER_CONFIG

export function normalizeSummaryCardOrder(order?: readonly string[]): SummaryCardKey[] {
  const normalized: SummaryCardKey[] = []

  for (const key of order ?? []) {
    if (isSummaryCardKey(key) && !normalized.includes(key)) {
      normalized.push(key)
    }
  }

  for (const key of DEFAULT_SUMMARY_CARD_ORDER) {
    if (!normalized.includes(key)) {
      normalized.push(key)
    }
  }

  return normalized
}

export function sortSummaryCards(cards: SummaryCardItem[], order?: readonly string[]): SummaryCardItem[] {
  const orderIndex = new Map(normalizeSummaryCardOrder(order).map((key, index) => [key, index]))

  return [...cards].sort((left, right) => {
    return (orderIndex.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(right.key) ?? Number.MAX_SAFE_INTEGER)
  })
}

export function moveSummaryCardOrder(params: {
  order?: readonly string[]
  draggedKey: SummaryCardKey
  targetKey: SummaryCardKey
}): SummaryCardKey[] {
  const order = normalizeSummaryCardOrder(params.order)
  if (params.draggedKey === params.targetKey) {
    return order
  }

  const fromIndex = order.indexOf(params.draggedKey)
  const targetIndex = order.indexOf(params.targetKey)
  if (fromIndex === -1 || targetIndex === -1) {
    return order
  }

  const nextOrder = [...order]
  nextOrder.splice(fromIndex, 1)
  const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
  nextOrder.splice(insertIndex, 0, params.draggedKey)

  return nextOrder
}

export function isSameSummaryCardOrder(left?: readonly string[], right?: readonly string[]): boolean {
  const normalizedLeft = normalizeSummaryCardOrder(left)
  const normalizedRight = normalizeSummaryCardOrder(right)

  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((key, index) => key === normalizedRight[index])
}

function isSummaryCardKey(value: string): value is SummaryCardKey {
  return DEFAULT_SUMMARY_CARD_ORDER.includes(value as SummaryCardKey)
}
