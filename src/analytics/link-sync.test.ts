import { describe, expect, it, vi } from 'vitest'

import { buildDocLinkMarkdown, syncAssociation } from './link-sync'

describe('link sync', () => {
  it('builds escaped block link markdown', () => {
    const markdown = buildDocLinkMarkdown('doc-1', 'Alpha "Quote"')
    expect(markdown).toBe('((doc-1 "Alpha \\\"Quote\\\""))')
  })

  it('syncs outbound and inbound links with correct target', async () => {
    const appendBlock = vi.fn().mockResolvedValue([])
    const prependBlock = vi.fn().mockResolvedValue([])
    const resolveTitle = (id: string) => (id === 'core' ? 'Core' : 'Target')

    await syncAssociation({
      coreDocumentId: 'core',
      targetDocumentId: 'target',
      direction: 'outbound',
      resolveTitle,
      appendBlock,
      prependBlock,
    })

    expect(prependBlock).toHaveBeenCalledWith('markdown', '((core "Core"))', 'target')

    await syncAssociation({
      coreDocumentId: 'core',
      targetDocumentId: 'target',
      direction: 'inbound',
      resolveTitle,
      appendBlock,
      prependBlock,
    })

    expect(appendBlock).toHaveBeenCalledWith('markdown', '((target "Target"))', 'core')
  })

  it('appends child document links to the core document tail', async () => {
    const appendBlock = vi.fn().mockResolvedValue([])
    const prependBlock = vi.fn().mockResolvedValue([])

    await syncAssociation({
      coreDocumentId: 'core',
      targetDocumentId: 'child',
      direction: 'child',
      resolveTitle: id => (id === 'core' ? 'Core' : 'Child'),
      appendBlock,
      prependBlock,
    })

    expect(appendBlock).toHaveBeenCalledWith('markdown', '((child "Child"))', 'core')
    expect(prependBlock).not.toHaveBeenCalled()
  })
})
