import { describe, expect, it, vi } from 'vitest'

import {
  formatCurrentSiyuanTimestamp,
  loadInternalLinkTargets,
} from './siyuan-data-queries'

describe('formatCurrentSiyuanTimestamp', () => {
  it('formats a local Date into SiYuan timestamp shape', () => {
    const value = formatCurrentSiyuanTimestamp(new Date(2026, 4, 5, 9, 7, 3))

    expect(value).toBe('20260505090703')
  })
})

describe('loadInternalLinkTargets', () => {
  it('chunks target ids into 200-item queries and escapes single quotes safely', async () => {
    const sqlRunner = vi.fn(async (query: string) => {
      if (query.includes("id = 'id-with-''quote'")) {
        return []
      }
      return []
    })
    const targetIds = [
      ...Array.from({ length: 201 }, (_, index) => `id-${index}`),
      "id-with-'quote",
    ]

    await loadInternalLinkTargets(sqlRunner, targetIds)

    expect(sqlRunner).toHaveBeenCalledTimes(2)
    expect(sqlRunner.mock.calls[0][0]).toContain('LIMIT 200')
    expect(sqlRunner.mock.calls[1][0]).toContain("'id-with-''quote'")
    expect(sqlRunner.mock.calls[1][0]).toContain('LIMIT 2')
  })
})
