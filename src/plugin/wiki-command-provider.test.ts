import { beforeEach, describe, expect, it, vi } from 'vitest'

const suggestForOrphan = vi.fn()

vi.mock('@/api', () => ({
  appendBlock: vi.fn(),
  createDocWithMd: vi.fn(),
  deleteBlock: vi.fn(),
  forwardProxy: vi.fn(),
  getBlockAttrs: vi.fn(),
  getBlockKramdown: vi.fn(),
  getChildBlocks: vi.fn(),
  getIDsByHPath: vi.fn(),
  prependBlock: vi.fn(),
  setBlockAttrs: vi.fn(),
  updateBlock: vi.fn(),
}))

vi.mock('@/analytics/siyuan-data', () => ({
  loadAnalyticsSnapshot: vi.fn(async () => ({
    documents: [
      {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/orphan.sy',
        hpath: '/孤立文档',
        title: '孤立文档',
        tags: ['旧标签'],
        content: 'AI 和知识管理内容',
        created: '20260301090000',
        updated: '20260311120000',
      },
      {
        id: 'doc-target',
        box: 'box-1',
        path: '/target.sy',
        hpath: '/AI 索引',
        title: 'AI 索引',
        tags: ['AI'],
        content: 'AI 主题入口',
        created: '20260301090000',
        updated: '20260311120000',
      },
    ],
    references: [],
    notebooks: [],
  })),
}))

vi.mock('@/analytics/ai-link-suggestions', async () => {
  const actual = await vi.importActual<any>('@/analytics/ai-link-suggestions')
  return {
    ...actual,
    createAiLinkSuggestionService: () => ({ suggestForOrphan }),
    isAiLinkSuggestionConfigComplete: () => true,
  }
})

import { createWikiCommandProvider } from './wiki-command-provider'

describe('wiki command provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    suggestForOrphan.mockResolvedValue({
      generatedAt: '2026-05-17T07:00:00.000Z',
      summary: '建议添加 AI 索引和 AI 标签',
      suggestions: [
        {
          targetDocumentId: 'doc-target',
          targetTitle: 'AI 索引',
          targetType: 'theme-document',
          confidence: 'high',
          reason: '主题匹配',
          tagSuggestions: [{ tag: 'AI', source: 'existing', reason: '内容相关' }],
        },
      ],
    })
  })

  it('returns orphan link and tag suggestions for external command callers', async () => {
    const plugin = {
      loadData: vi.fn(async () => ({
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
      })),
    }
    const provider = createWikiCommandProvider({
      plugin: plugin as any,
      pluginVersion: '0.9.6',
    })

    const result = await provider.invokeCommand('suggest-orphan-links-and-tags', {
      trigger: 'manual',
      sourcePlugin: 'siyuan-doc-assist',
      themeDocumentId: 'doc-orphan',
    })

    expect(result).toEqual({
      ok: true,
      message: '已生成 AI 关联建议：1 个链接，1 个标签',
      data: {
        generatedAt: '2026-05-17T07:00:00.000Z',
        summary: '建议添加 AI 索引和 AI 标签',
        suggestions: [
          {
            targetDocumentId: 'doc-target',
            targetTitle: 'AI 索引',
            targetType: 'theme-document',
            confidence: 'high',
            reason: '主题匹配',
            draftText: undefined,
            tagSuggestions: [{ tag: 'AI', source: 'existing', reason: '内容相关' }],
          },
        ],
      },
    })
    expect(suggestForOrphan).toHaveBeenCalledWith(expect.objectContaining({
      sourceDocument: expect.objectContaining({ id: 'doc-orphan' }),
      orphan: expect.objectContaining({ documentId: 'doc-orphan' }),
      existingTags: expect.arrayContaining(['AI', '旧标签']),
    }))
  })
})
