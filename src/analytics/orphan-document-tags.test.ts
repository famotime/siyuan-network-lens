import { describe, expect, it, vi } from 'vitest'

import {
  addTagToDocumentChange,
  applyTagToOrphanDocument,
  removeTagFromDocumentChange,
} from './orphan-document-tags'

describe('orphan document tags', () => {
  it('applies a suggested tag through block attrs and preserves existing tags', async () => {
    const setBlockAttrs = vi.fn().mockResolvedValue(null)
    const getBlockAttrs = vi.fn()
      .mockResolvedValueOnce({ tags: 'AI' })
      .mockResolvedValueOnce({ tags: 'AI,AI工具' })

    const result = await applyTagToOrphanDocument({
      orphanDocumentId: 'doc-orphan',
      tag: 'AI工具',
      getBlockAttrs,
      setBlockAttrs,
    })

    expect(setBlockAttrs).toHaveBeenCalledWith('doc-orphan', { tags: 'AI,AI工具' })
    expect(result).toEqual({
      blockId: 'doc-orphan',
      baseTags: ['AI'],
      appliedTags: ['AI工具'],
    })
  })

  it('merges multiple suggested tags into the same attrs.tags value', async () => {
    const setBlockAttrs = vi.fn().mockResolvedValue(null)
    const getBlockAttrs = vi.fn().mockResolvedValue({ tags: 'AI,工具,方法论' })

    const nextChange = await addTagToDocumentChange({
      change: {
        blockId: 'doc-orphan',
        baseTags: ['AI'],
        appliedTags: ['工具'],
      },
      tag: '方法论',
      getBlockAttrs,
      setBlockAttrs,
    })

    expect(setBlockAttrs).toHaveBeenCalledWith('doc-orphan', { tags: 'AI,工具,方法论' })
    expect(nextChange).toEqual({
      blockId: 'doc-orphan',
      baseTags: ['AI'],
      appliedTags: ['工具', '方法论'],
    })
  })

  it('reverts attrs.tags to the original document tags when the last suggestion is removed', async () => {
    const setBlockAttrs = vi.fn().mockResolvedValue(null)
    const getBlockAttrs = vi.fn().mockResolvedValue({ tags: 'AI' })

    const nextChange = await removeTagFromDocumentChange({
      change: {
        blockId: 'doc-orphan',
        baseTags: ['AI'],
        appliedTags: ['AI工具'],
      },
      tag: 'AI工具',
      getBlockAttrs,
      setBlockAttrs,
    })

    expect(setBlockAttrs).toHaveBeenCalledWith('doc-orphan', { tags: 'AI' })
    expect(nextChange).toBeNull()
  })

  it('throws when the written tags cannot be verified after setBlockAttrs', async () => {
    const setBlockAttrs = vi.fn().mockResolvedValue(null)
    const getBlockAttrs = vi.fn()
      .mockResolvedValueOnce({ tags: 'AI' })
      .mockResolvedValueOnce({ tags: 'AI' })

    await expect(applyTagToOrphanDocument({
      orphanDocumentId: 'doc-orphan',
      tag: 'AI工具',
      getBlockAttrs,
      setBlockAttrs,
    })).rejects.toThrow('Failed to write doc tags')
  })
})
