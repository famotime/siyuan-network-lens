import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useSummaryDetailDocIndex } from './use-summary-detail-doc-index'

describe('useSummaryDetailDocIndex', () => {
  it('loads existing document index status for visible documents', async () => {
    const visibleDocumentIds = ref(['doc-a', 'doc-b'])
    const hasDocIndex = vi.fn(async (documentId: string) => documentId === 'doc-a')

    const state = useSummaryDetailDocIndex({
      showDocumentIndex: ref(true),
      visibleDocumentIds,
      hasDocIndex,
    })

    await nextTick()
    await Promise.resolve()

    expect(state.docIndexExists.value).toEqual({
      'doc-a': true,
      'doc-b': false,
    })
  })

  it('generates and opens a document index while updating local loading state', async () => {
    const hasDocIndex = vi.fn(async () => true)
    const generateDocIndex = vi.fn(async () => true)
    const openDocIndex = vi.fn(async () => undefined)
    const visibleDocumentIds = ref(['doc-a'])

    const state = useSummaryDetailDocIndex({
      showDocumentIndex: ref(true),
      visibleDocumentIds,
      hasDocIndex,
      generateDocIndex,
      openDocIndex,
    })

    await state.handleGenerateDocIndex('doc-a')
    await state.handleOpenDocIndex('doc-a')

    expect(generateDocIndex).toHaveBeenCalledWith('doc-a')
    expect(openDocIndex).toHaveBeenCalledWith('doc-a')
    expect(state.docIndexGenerating.value).toEqual({})
    expect(state.docIndexExists.value['doc-a']).toBe(true)
  })

  it('batch generates and batch deletes visible document indexes', async () => {
    const visibleDocumentIds = ref(['doc-a', 'doc-b'])
    const batchGenerateDocIndex = vi.fn(async (_ids: string[], onProgress?: (done: number, total: number) => void) => {
      onProgress?.(1, 2)
      onProgress?.(2, 2)
      return { success: 2, failed: 0 }
    })
    const batchDeleteDocIndex = vi.fn(async () => 2)
    const hasDocIndex = vi.fn(async () => true)

    const state = useSummaryDetailDocIndex({
      showDocumentIndex: ref(true),
      visibleDocumentIds,
      hasDocIndex,
      batchGenerateDocIndex,
      batchDeleteDocIndex,
    })

    const generateResult = await state.handleBatchGenerate()
    await state.handleBatchDelete()

    expect(generateResult).toEqual({ success: 2, failed: 0 })
    expect(batchGenerateDocIndex).toHaveBeenCalledWith(['doc-a', 'doc-b'], expect.any(Function))
    expect(state.batchProgress.value).toEqual({ done: 2, total: 2 })
    expect(batchDeleteDocIndex).toHaveBeenCalledWith(['doc-a', 'doc-b'])
    expect(state.docIndexExists.value).toEqual({})
  })
})
