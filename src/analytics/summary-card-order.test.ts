import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SUMMARY_CARD_ORDER,
  moveSummaryCardOrder,
  normalizeSummaryCardOrder,
} from './summary-card-order'

describe('summary card order', () => {
  it('falls back to the default order when saved order is empty', () => {
    expect(normalizeSummaryCardOrder()).toEqual(DEFAULT_SUMMARY_CARD_ORDER)
    expect(normalizeSummaryCardOrder([])).toEqual(DEFAULT_SUMMARY_CARD_ORDER)
  })

  it('drops invalid keys, removes duplicates, and appends missing cards', () => {
    expect(normalizeSummaryCardOrder([
      'orphans',
      'documents',
      'read',
      'orphans',
      'unknown-card',
      'ranking',
    ])).toEqual([
      'orphans',
      'documents',
      'read',
      'ranking',
      'largeDocuments',
      'trends',
      'references',
      'communities',
      'propagation',
      'bridges',
      'dormant',
    ])
  })

  it('moves a dragged card before the drop target', () => {
    expect(moveSummaryCardOrder({
      order: DEFAULT_SUMMARY_CARD_ORDER,
      draggedKey: 'orphans',
      targetKey: 'documents',
    })).toEqual([
      'read',
      'ranking',
      'orphans',
      'documents',
      'largeDocuments',
      'trends',
      'references',
      'communities',
      'propagation',
      'bridges',
      'dormant',
    ])
  })
})
