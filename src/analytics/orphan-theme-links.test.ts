import { describe, expect, it, vi } from 'vitest'

import {
  addThemeLinkToDocumentChange,
  applyThemeLinkToOrphanDocument,
  isInternalLinkOnlyParagraph,
  removeThemeLinkFromDocumentChange,
} from './orphan-theme-links'

describe('orphan theme links', () => {
  it('detects paragraphs that only contain Siyuan internal links or refs', () => {
    expect(isInternalLinkOnlyParagraph('((20260301-abc "Alpha"))\t((20260302-def "Beta"))')).toBe(true)
    expect(isInternalLinkOnlyParagraph('[Alpha](siyuan://blocks/20260301-abc)\t((20260302-def "Beta"))')).toBe(true)
    expect(isInternalLinkOnlyParagraph('[Alpha](siyuan://blocks/20260301-abc)\n{: id="20260301-abc" updated="20260313"}')).toBe(true)
    expect(isInternalLinkOnlyParagraph('((20260302-def "Beta"))\n{: id="20260302-def" updated="20260313"}')).toBe(true)
    expect(isInternalLinkOnlyParagraph('[Alpha](siyuan://blocks/20260301-abc)\t((20260302-def "Beta"))\n{: id="20260301-abc" updated="20260313"}')).toBe(true)
    expect(isInternalLinkOnlyParagraph('Alpha ((20260301-abc "Alpha"))')).toBe(false)
  })

  it('appends theme link to the first paragraph when it only contains internal links', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])
    const result = await applyThemeLinkToOrphanDocument({
      orphanDocumentId: 'doc-orphan',
      themeDocumentId: 'doc-theme',
      themeDocumentTitle: '主题-AI-索引',
      getChildBlocks: vi.fn().mockResolvedValue([
        { id: 'blk-1', type: 'p' },
      ]),
      getBlockKramdown: vi.fn().mockResolvedValue({
        id: 'blk-1',
        kramdown: '((20260301-abc "Alpha"))',
      }),
      updateBlock,
      prependBlock: vi.fn(),
    })

    expect(updateBlock).toHaveBeenCalledWith('markdown', '((20260301-abc "Alpha"))\t((doc-theme "主题-AI-索引"))', 'blk-1')
    expect(result).toEqual({
      mode: 'updated',
      blockId: 'blk-1',
      baseMarkdown: '((20260301-abc "Alpha"))',
      links: [
        { themeDocumentId: 'doc-theme', markdown: '((doc-theme "主题-AI-索引"))' },
      ],
    })
  })

  it('appends theme link before the Kramdown attribute line when the first paragraph is a Siyuan link', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])
    const result = await applyThemeLinkToOrphanDocument({
      orphanDocumentId: 'doc-orphan',
      themeDocumentId: 'doc-theme',
      themeDocumentTitle: '主题-AI-索引',
      getChildBlocks: vi.fn().mockResolvedValue([
        { id: 'blk-1', type: 'p' },
      ]),
      getBlockKramdown: vi.fn().mockResolvedValue({
        id: 'blk-1',
        kramdown: '[Alpha](siyuan://blocks/20260301-abc)\n{: id="blk-1" updated="20260313"}',
      }),
      updateBlock,
      prependBlock: vi.fn(),
    })

    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '[Alpha](siyuan://blocks/20260301-abc)\t((doc-theme "主题-AI-索引"))\n{: id="blk-1" updated="20260313"}',
      'blk-1',
    )
    expect(result.mode).toBe('updated')
  })

  it('appends theme link before the Kramdown attribute line when the first paragraph is a block ref', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])
    const result = await applyThemeLinkToOrphanDocument({
      orphanDocumentId: 'doc-orphan',
      themeDocumentId: 'doc-theme',
      themeDocumentTitle: '主题-AI-索引',
      getChildBlocks: vi.fn().mockResolvedValue([
        { id: 'blk-1', type: 'p' },
      ]),
      getBlockKramdown: vi.fn().mockResolvedValue({
        id: 'blk-1',
        kramdown: '((20260302-def "Beta"))\n{: id="blk-1" updated="20260313"}',
      }),
      updateBlock,
      prependBlock: vi.fn(),
    })

    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '((20260302-def "Beta"))\t((doc-theme "主题-AI-索引"))\n{: id="blk-1" updated="20260313"}',
      'blk-1',
    )
    expect(result.mode).toBe('updated')
  })

  it('appends theme link to the same paragraph when it contains only a Siyuan link and a block ref', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])
    const result = await applyThemeLinkToOrphanDocument({
      orphanDocumentId: 'doc-orphan',
      themeDocumentId: 'doc-theme',
      themeDocumentTitle: '主题-AI-索引',
      getChildBlocks: vi.fn().mockResolvedValue([
        { id: 'blk-1', type: 'p' },
      ]),
      getBlockKramdown: vi.fn().mockResolvedValue({
        id: 'blk-1',
        kramdown: '[Alpha](siyuan://blocks/20260301-abc)\t((20260302-def "Beta"))\n{: id="blk-1" updated="20260313"}',
      }),
      updateBlock,
      prependBlock: vi.fn(),
    })

    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '[Alpha](siyuan://blocks/20260301-abc)\t((20260302-def "Beta"))\t((doc-theme "主题-AI-索引"))\n{: id="blk-1" updated="20260313"}',
      'blk-1',
    )
    expect(result.mode).toBe('updated')
  })

  it('prepends a new paragraph when the first block is not a link-only paragraph', async () => {
    const prependBlock = vi.fn().mockResolvedValue([
      {
        doOperations: [
          { id: 'new-block-id' },
        ],
      },
    ])

    const result = await applyThemeLinkToOrphanDocument({
      orphanDocumentId: 'doc-orphan',
      themeDocumentId: 'doc-theme',
      themeDocumentTitle: '主题-AI-索引',
      getChildBlocks: vi.fn().mockResolvedValue([
        { id: 'blk-1', type: 'p' },
      ]),
      getBlockKramdown: vi.fn().mockResolvedValue({
        id: 'blk-1',
        kramdown: '正文内容',
      }),
      updateBlock: vi.fn(),
      prependBlock,
    })

    expect(prependBlock).toHaveBeenCalledWith('markdown', '((doc-theme "主题-AI-索引"))', 'doc-orphan')
    expect(result).toEqual({
      mode: 'prepended',
      blockId: 'new-block-id',
      baseMarkdown: '',
      links: [
        { themeDocumentId: 'doc-theme', markdown: '((doc-theme "主题-AI-索引"))' },
      ],
    })
  })

  it('reverts updated paragraph content when the theme suggestion is toggled off', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])

    await removeThemeLinkFromDocumentChange({
      change: {
        mode: 'updated',
        blockId: 'blk-1',
        baseMarkdown: '((20260301-abc "Alpha"))',
        links: [
          { themeDocumentId: 'doc-theme', markdown: '((doc-theme "主题-AI-索引"))' },
        ],
      },
      themeDocumentId: 'doc-theme',
      deleteBlock: vi.fn(),
      updateBlock,
    })

    expect(updateBlock).toHaveBeenCalledWith('markdown', '((20260301-abc "Alpha"))', 'blk-1')
  })

  it('merges multiple suggested theme links into the same updated paragraph', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])

    const nextChange = await addThemeLinkToDocumentChange({
      change: {
        mode: 'updated',
        blockId: 'blk-1',
        baseMarkdown: '((20260301-abc "Alpha"))',
        links: [
          { themeDocumentId: 'doc-theme-ai', markdown: '((doc-theme-ai "主题-AI-索引"))' },
        ],
      },
      themeDocumentId: 'doc-theme-ml',
      themeDocumentTitle: '主题-机器学习-索引',
      updateBlock,
    })

    expect(updateBlock).toHaveBeenCalledWith('markdown', '((20260301-abc "Alpha"))\t((doc-theme-ai "主题-AI-索引"))\t((doc-theme-ml "主题-机器学习-索引"))', 'blk-1')
    expect(nextChange.links.map(item => item.themeDocumentId)).toEqual(['doc-theme-ai', 'doc-theme-ml'])
  })

  it('keeps Kramdown attributes at the end when merging multiple suggested theme links', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])

    const nextChange = await addThemeLinkToDocumentChange({
      change: {
        mode: 'updated',
        blockId: 'blk-1',
        baseMarkdown: '[Alpha](siyuan://blocks/20260301-abc)\n{: id="blk-1" updated="20260313"}',
        links: [
          { themeDocumentId: 'doc-theme-ai', markdown: '((doc-theme-ai "主题-AI-索引"))' },
        ],
      },
      themeDocumentId: 'doc-theme-ml',
      themeDocumentTitle: '主题-机器学习-索引',
      updateBlock,
    })

    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '[Alpha](siyuan://blocks/20260301-abc)\t((doc-theme-ai "主题-AI-索引"))\t((doc-theme-ml "主题-机器学习-索引"))\n{: id="blk-1" updated="20260313"}',
      'blk-1',
    )
    expect(nextChange.links.map(item => item.themeDocumentId)).toEqual(['doc-theme-ai', 'doc-theme-ml'])
  })

  it('removes one merged theme link but keeps the same paragraph when others remain', async () => {
    const updateBlock = vi.fn().mockResolvedValue([])

    const nextChange = await removeThemeLinkFromDocumentChange({
      change: {
        mode: 'prepended',
        blockId: 'blk-1',
        baseMarkdown: '',
        links: [
          { themeDocumentId: 'doc-theme-ai', markdown: '((doc-theme-ai "主题-AI-索引"))' },
          { themeDocumentId: 'doc-theme-ml', markdown: '((doc-theme-ml "主题-机器学习-索引"))' },
        ],
      },
      themeDocumentId: 'doc-theme-ai',
      deleteBlock: vi.fn(),
      updateBlock,
    })

    expect(updateBlock).toHaveBeenCalledWith('markdown', '((doc-theme-ml "主题-机器学习-索引"))', 'blk-1')
    expect(nextChange).toEqual({
      mode: 'prepended',
      blockId: 'blk-1',
      baseMarkdown: '',
      links: [
        { themeDocumentId: 'doc-theme-ml', markdown: '((doc-theme-ml "主题-机器学习-索引"))' },
      ],
    })
  })
})
