import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/analytics/ai-document-summary', () => ({
  ensureDocumentIndex: vi.fn(),
}))

import { ensureDocumentIndex } from '@/analytics/ai-document-summary'

import {
  buildDocumentIndexViewMarkdown,
  createAnalyticsDocumentIndexController,
} from './use-analytics-document-index'

describe('buildDocumentIndexViewMarkdown', () => {
  it('renders propositions, tags, keywords, source blocks, and numbered block refs', () => {
    const markdown = buildDocumentIndexViewMarkdown({
      profile: {
        documentId: 'doc-a',
        sourceUpdatedAt: '20260505103000',
        sourceHash: 'h-doc-a',
        title: 'Alpha / Beta',
        path: '/notes/alpha.sy',
        hpath: '/笔记/Alpha',
        tagsJson: JSON.stringify(['AI', 'ML']),
        positioning: '这是一篇测试定位。',
        propositionsJson: JSON.stringify([
          { text: '命题一', sourceBlockIds: ['blk-1', 'blk-2'] },
        ]),
        keywordsJson: JSON.stringify(['向量', '索引']),
        primarySourceBlocksJson: JSON.stringify([
          { blockId: 'blk-1', text: '主要证据一' },
        ]),
        secondarySourceBlocksJson: JSON.stringify([
          { blockId: 'blk-2', text: '次要证据二' },
        ]),
        generatedAt: '2026-05-05T10:30:00.000Z',
      },
      fallbackTitle: 'doc-a',
    })

    expect(markdown).toContain('这是一篇测试定位。')
    expect(markdown).toContain('- 命题一 ^((blk-1 "1"))^ ^((blk-2 "2"))^')
    expect(markdown).toContain('`AI` `ML`')
    expect(markdown).toContain('`向量` `索引`')
    expect(markdown).toContain('> 主要证据一')
    expect(markdown).toContain('> 次要证据二')
    expect(markdown).toContain('*')
  })
})

describe('createAnalyticsDocumentIndexController', () => {
  it('opens a rendered document index page after creating it', async () => {
    const createDocWithMd = vi.fn(async () => 'index-doc-1')
    const openDocument = vi.fn()
    const notify = vi.fn()
    const controller = createAnalyticsDocumentIndexController({
      documentMap: computed(() => new Map([
        ['doc-a', {
          id: 'doc-a',
          title: 'Alpha',
          path: '/notes/alpha.sy',
          hpath: '/笔记/Alpha',
          updated: '20260505103000',
          tags: ['AI'],
        }],
      ])),
      notebookOptions: computed(() => [{ id: 'box-1', name: 'Notebook 1' }]),
      appliedConfig: computed(() => ({ aiModel: 'gpt-4.1-mini' } as any)),
      aiIndexStore: {
        getDocumentProfile: vi.fn(async () => ({
          documentId: 'doc-a',
          sourceUpdatedAt: '20260505103000',
          sourceHash: 'h-doc-a',
          title: 'Alpha / Beta',
          path: '/notes/alpha.sy',
          hpath: '/笔记/Alpha',
          tagsJson: JSON.stringify(['AI']),
          positioning: '测试定位',
          propositionsJson: JSON.stringify([{ text: '命题一', sourceBlockIds: ['blk-1'] }]),
          keywordsJson: JSON.stringify(['索引']),
          primarySourceBlocksJson: JSON.stringify([{ blockId: 'blk-1', text: '主要证据一' }]),
          secondarySourceBlocksJson: JSON.stringify([]),
          generatedAt: '2026-05-05T10:30:00.000Z',
        })),
        deleteDocumentIndex: vi.fn(async () => undefined),
      } as any,
      forwardProxy: vi.fn(),
      getChildBlocks: vi.fn(async () => []),
      getBlockKramdown: vi.fn(async () => ({ id: '', kramdown: '' })),
      createDocWithMd,
      notify,
      openDocument,
    })

    await controller.openDocIndex('doc-a')

    expect(createDocWithMd).toHaveBeenCalledTimes(1)
    expect(createDocWithMd).toHaveBeenCalledWith(
      'box-1',
      expect.stringMatching(/^\/索引\//),
      expect.stringContaining('测试定位'),
    )
    expect(openDocument).toHaveBeenCalledWith('index-doc-1')
    expect(notify).not.toHaveBeenCalledWith(expect.stringContaining('失败'), expect.anything(), 'error')
  })

  it('generates, batches, and deletes document indexes with progress tracking', async () => {
    vi.mocked(ensureDocumentIndex).mockImplementation(async ({ sourceDocument }: any) => {
      if (sourceDocument.id === 'doc-b') {
        throw new Error('boom')
      }
      return { fromCache: sourceDocument.id === 'doc-c' }
    })

    const deleteDocumentIndex = vi.fn(async () => undefined)
    const progress = vi.fn()
    const notify = vi.fn()
    const controller = createAnalyticsDocumentIndexController({
      documentMap: computed(() => new Map([
        ['doc-a', { id: 'doc-a', title: 'Alpha', updated: '20260505103000' }],
        ['doc-b', { id: 'doc-b', title: 'Beta', updated: '20260505103000' }],
        ['doc-c', { id: 'doc-c', title: 'Gamma', updated: '20260505103000' }],
      ] as any)),
      notebookOptions: computed(() => [{ id: 'box-1', name: 'Notebook 1' }]),
      appliedConfig: computed(() => ({ aiModel: 'gpt-4.1-mini' } as any)),
      aiIndexStore: {
        getDocumentProfile: vi.fn(async () => ({ positioning: 'ok' })),
        deleteDocumentIndex,
      } as any,
      forwardProxy: vi.fn(),
      getChildBlocks: vi.fn(async () => []),
      getBlockKramdown: vi.fn(async () => ({ id: '', kramdown: '' })),
      notify,
      openDocument: vi.fn(),
    })

    expect(await controller.generateDocIndex('doc-a')).toBe(true)
    expect(await controller.generateDocIndex('doc-c')).toBe(false)

    const batchResult = await controller.batchGenerateDocIndex(['doc-a', 'doc-b', 'doc-c'], progress)

    expect(batchResult).toEqual({ success: 1, failed: 2 })
    expect(progress).toHaveBeenNthCalledWith(1, 1, 3)
    expect(progress).toHaveBeenNthCalledWith(2, 2, 3)
    expect(progress).toHaveBeenNthCalledWith(3, 3, 3)

    expect(await controller.batchDeleteDocIndex(['doc-a', 'doc-c'])).toBe(2)
    expect(deleteDocumentIndex).toHaveBeenCalledWith(['doc-a', 'doc-c'])
    expect(notify).toHaveBeenCalled()
  })
})
