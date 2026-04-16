import { afterEach, describe, expect, it } from 'vitest'

import { createAiLinkSuggestionService } from './ai-link-suggestions'

describe('ai link suggestions', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('uses embeddings to rank orphan link candidates and reports friendly progress updates', async () => {
    const requests: Array<{ url: string, body: any }> = []
    const progress: string[] = []
    const service = createAiLinkSuggestionService({
      forwardProxy: async (url, method, payload) => {
        requests.push({
          url,
          body: JSON.parse(payload),
        })

        if (url.endsWith('/embeddings')) {
          return {
            status: 200,
            body: JSON.stringify({
              data: [
                { embedding: [1, 0] },
                { embedding: [0.95, 0.05] },
                { embedding: [0.2, 0.8] },
              ],
            }),
          } as any
        }

        return {
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: '优先补到主题-AI-索引。',
                    suggestions: [
                      {
                        targetDocumentId: 'doc-theme-ai',
                        targetTitle: '主题-AI-索引',
                        targetType: 'theme-document',
                        confidence: 'high',
                        reason: 'embedding 相似度最高，且主题命中明确，补链后更容易回到 AI 主题网络。',
                        draftText: '可归入 AI 主题：((doc-theme-ai "主题-AI-索引"))',
                        tagSuggestions: [
                          {
                            tag: 'AI',
                            source: 'existing',
                            reason: '当前标签集合里已有该标签，可直接复用。',
                          },
                          {
                            tag: 'AI 工具',
                            source: 'new',
                            reason: '更贴近这篇文档的工具实践语义。',
                          },
                        ],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        } as any
      },
    })

    const result = await service.suggestForOrphan({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        aiEmbeddingModel: 'text-embedding-3-small',
        aiRequestTimeoutSeconds: 30,
        aiMaxTokens: 1024,
        aiTemperature: 0.2,
        aiMaxContextMessages: 7,
      } as any,
      sourceDocument: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/orphan.sy',
        hpath: '/笔记/AI 与 机器学习',
        title: 'AI 与 机器学习 AI',
        tags: ['AI'],
        content: '人工智能 模型 机器学习',
        updated: '20260311120000',
      },
      orphan: {
        documentId: 'doc-orphan',
        title: 'AI 与 机器学习 AI',
        degree: 0,
        createdAt: '20260310120000',
        updatedAt: '20260311120000',
        historicalReferenceCount: 2,
        lastHistoricalAt: '20260310120000',
        hasSparseEvidence: true,
      },
      documents: [
        { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI 与 机器学习', title: 'AI 与 机器学习 AI', tags: ['AI'], content: '人工智能 模型 机器学习', updated: '20260311120000' },
        { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], content: 'AI 人工智能 索引', updated: '20260311120000' },
        { id: 'doc-b', box: 'box-1', path: '/b.sy', hpath: '/Beta', title: 'Beta', tags: [], content: '测试', updated: '20260311120000' },
      ],
      themeDocuments: [
        {
          documentId: 'doc-theme-ai',
          title: '主题-AI-索引',
          themeName: 'AI',
          matchTerms: ['AI', '人工智能'],
          box: 'box-1',
          path: '/topics/theme-ai.sy',
          hpath: '/专题/主题-AI-索引',
        },
      ],
      availableTags: ['AI', '机器学习', '知识管理'],
      report: {
        ranking: [
          { documentId: 'doc-b', title: 'Beta', inboundReferences: 5, distinctSourceDocuments: 3, outboundReferences: 2, lastActiveAt: '20260311120000' },
        ],
      } as any,
      onProgress: (message) => {
        progress.push(message)
      },
    })

    expect(progress).toEqual([
      'Analyzing document semantics and generating embeddings...',
      'Retrieving candidates from embeddings and structure signals...',
      'AI is analyzing...',
    ])
    expect(requests[0]?.url).toBe('https://api.example.com/v1/embeddings')
    expect(requests[0]?.body.model).toBe('text-embedding-3-small')
    expect(requests[1]?.url).toBe('https://api.example.com/v1/chat/completions')
    expect(JSON.parse(requests[1]?.body.messages[1].content)).toEqual(expect.objectContaining({
      availableThemes: [
        expect.objectContaining({
          documentId: 'doc-theme-ai',
          themeName: 'AI',
          title: '主题-AI-索引',
        }),
      ],
      availableTags: ['AI', '机器学习', '知识管理'],
    }))
    expect(result.suggestions).toEqual([
      expect.objectContaining({
        targetDocumentId: 'doc-theme-ai',
        targetTitle: '主题-AI-索引',
        confidence: 'high',
        reason: 'embedding 相似度最高，且主题命中明确，补链后更容易回到 AI 主题网络。',
        tagSuggestions: [
          expect.objectContaining({
            tag: 'AI',
            source: 'existing',
          }),
          expect.objectContaining({
            tag: 'AI 工具',
            source: 'new',
          }),
        ],
      }),
    ])
  })

  it('still returns AI suggestions when embedding model is not configured', async () => {
    const requests: string[] = []
    const progress: string[] = []
    const service = createAiLinkSuggestionService({
      forwardProxy: async (url, method, payload) => {
        requests.push(url)

        return {
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: '可先补到主题-AI-索引。',
                    suggestions: [
                      {
                        targetDocumentId: 'doc-theme-ai',
                        targetTitle: '主题-AI-索引',
                        targetType: 'theme-document',
                        confidence: 'medium',
                        reason: '未配置 embedding，但主题命中和结构角色都很明确，先补到主题页能更快回到现有网络。',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        } as any
      },
    })

    const result = await service.suggestForOrphan({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        aiEmbeddingModel: '',
        aiRequestTimeoutSeconds: 30,
        aiMaxTokens: 1024,
        aiTemperature: 0.2,
        aiMaxContextMessages: 7,
      } as any,
      sourceDocument: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/orphan.sy',
        hpath: '/笔记/AI 与 机器学习',
        title: 'AI 与 机器学习 AI',
        tags: ['AI'],
        content: '人工智能 模型 机器学习',
        updated: '20260311120000',
      },
      orphan: {
        documentId: 'doc-orphan',
        title: 'AI 与 机器学习 AI',
        degree: 0,
        createdAt: '20260310120000',
        updatedAt: '20260311120000',
        historicalReferenceCount: 2,
        lastHistoricalAt: '20260310120000',
        hasSparseEvidence: true,
      },
      documents: [
        { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI 与 机器学习', title: 'AI 与 机器学习 AI', tags: ['AI'], content: '人工智能 模型 机器学习', updated: '20260311120000' },
        { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], content: 'AI 人工智能 索引', updated: '20260311120000' },
      ],
      themeDocuments: [
        {
          documentId: 'doc-theme-ai',
          title: '主题-AI-索引',
          themeName: 'AI',
          matchTerms: ['AI', '人工智能'],
          box: 'box-1',
          path: '/topics/theme-ai.sy',
          hpath: '/专题/主题-AI-索引',
        },
      ],
      availableTags: ['AI', '机器学习'],
      report: {
        ranking: [],
      } as any,
      onProgress: (message) => {
        progress.push(message)
      },
    })

    expect(requests).toEqual(['https://api.example.com/v1/chat/completions'])
    expect(progress).toEqual([
      'Embedding Model is not configured. Falling back to topic matches and structure signals...',
      'AI is analyzing...',
    ])
    expect(result.suggestions).toEqual([
      expect.objectContaining({
        targetDocumentId: 'doc-theme-ai',
        targetTitle: '主题-AI-索引',
      }),
    ])
  })

  it('rejects OpenAI-style embedding models on SiliconFlow with a clear error', async () => {
    const service = createAiLinkSuggestionService({
      forwardProxy: async () => {
        throw new Error('should not request embeddings')
      },
    })

    await expect(service.suggestForOrphan({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.siliconflow.cn/v1',
        aiApiKey: 'sk-test',
        aiModel: 'deepseek-ai/DeepSeek-V3',
        aiEmbeddingModel: 'text-embedding-3-small',
        aiRequestTimeoutSeconds: 30,
        aiMaxTokens: 1024,
        aiTemperature: 0.2,
        aiMaxContextMessages: 7,
      } as any,
      sourceDocument: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/orphan.sy',
        hpath: '/笔记/AI 与 机器学习',
        title: 'AI 与 机器学习 AI',
        tags: ['AI'],
        content: '人工智能 模型 机器学习',
        updated: '20260311120000',
      },
      orphan: {
        documentId: 'doc-orphan',
        title: 'AI 与 机器学习 AI',
        degree: 0,
        createdAt: '20260310120000',
        updatedAt: '20260311120000',
        historicalReferenceCount: 2,
        lastHistoricalAt: '20260310120000',
        hasSparseEvidence: true,
      },
      documents: [
        { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI 与 机器学习', title: 'AI 与 机器学习 AI', tags: ['AI'], content: '人工智能 模型 机器学习', updated: '20260311120000' },
        { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], content: 'AI 人工智能 索引', updated: '20260311120000' },
      ],
      themeDocuments: [
        {
          documentId: 'doc-theme-ai',
          title: '主题-AI-索引',
          themeName: 'AI',
          matchTerms: ['AI', '人工智能'],
          box: 'box-1',
          path: '/topics/theme-ai.sy',
          hpath: '/专题/主题-AI-索引',
        },
      ],
      availableTags: ['AI', '机器学习'],
      report: {
        ranking: [],
      } as any,
    })).rejects.toThrow('For SiliconFlow, Embedding Model cannot be an OpenAI model name like text-embedding-3-small. Use models such as BAAI/bge-m3, BAAI/bge-large-zh-v1.5, or Qwen/Qwen3-Embedding instead.')
  })

  it('auto-appends /v1 for SiliconFlow requests when base url omits it', async () => {
    const requests: string[] = []
    const service = createAiLinkSuggestionService({
      forwardProxy: async (url) => {
        requests.push(url)

        if (url.endsWith('/embeddings')) {
          return {
            status: 200,
            body: JSON.stringify({
              data: [
                { embedding: [1, 0] },
                { embedding: [0.95, 0.05] },
              ],
            }),
          } as any
        }

        return {
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: '可先补到主题-AI-索引。',
                    suggestions: [
                      {
                        targetDocumentId: 'doc-theme-ai',
                        targetTitle: '主题-AI-索引',
                        targetType: 'theme-document',
                        confidence: 'medium',
                        reason: '主题命中和结构角色都很明确，补到主题页后更容易被后续笔记串起来。',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        } as any
      },
    })

    await service.suggestForOrphan({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.siliconflow.cn',
        aiApiKey: 'sk-test',
        aiModel: 'deepseek-ai/DeepSeek-V3',
        aiEmbeddingModel: 'BAAI/bge-m3',
      } as any,
      sourceDocument: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/orphan.sy',
        hpath: '/笔记/AI 与 机器学习',
        title: 'AI 与 机器学习 AI',
        tags: ['AI'],
        content: '人工智能 模型 机器学习',
        updated: '20260311120000',
      },
      orphan: {
        documentId: 'doc-orphan',
        title: 'AI 与 机器学习 AI',
        degree: 0,
        createdAt: '20260310120000',
        updatedAt: '20260311120000',
        historicalReferenceCount: 2,
        lastHistoricalAt: '20260310120000',
        hasSparseEvidence: true,
      },
      documents: [
        { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI 与 机器学习', title: 'AI 与 机器学习 AI', tags: ['AI'], content: '人工智能 模型 机器学习', updated: '20260311120000' },
        { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], content: 'AI 人工智能 索引', updated: '20260311120000' },
      ],
      themeDocuments: [
        {
          documentId: 'doc-theme-ai',
          title: '主题-AI-索引',
          themeName: 'AI',
          matchTerms: ['AI', '人工智能'],
          box: 'box-1',
          path: '/topics/theme-ai.sy',
          hpath: '/专题/主题-AI-索引',
        },
      ],
      availableTags: ['AI', '机器学习', '知识管理'],
      report: {
        ranking: [],
      } as any,
    })

    expect(requests).toEqual([
      'https://api.siliconflow.cn/v1/embeddings',
      'https://api.siliconflow.cn/v1/chat/completions',
    ])
  })

  it('switches progress copy and validation errors to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const progress: string[] = []
    const service = createAiLinkSuggestionService({
      forwardProxy: async (url) => {
        if (url.endsWith('/embeddings')) {
          return {
            status: 200,
            body: JSON.stringify({
              data: [
                { embedding: [1, 0] },
                { embedding: [0.95, 0.05] },
              ],
            }),
          } as any
        }

        return {
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: '可先补到主题-AI-索引。',
                    suggestions: [
                      {
                        targetDocumentId: 'doc-theme-ai',
                        targetTitle: '主题-AI-索引',
                        targetType: 'theme-document',
                        confidence: 'medium',
                        reason: '主题命中明确。',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        } as any
      },
    })

    await service.suggestForOrphan({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        aiEmbeddingModel: 'text-embedding-3-small',
      } as any,
      sourceDocument: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/orphan.sy',
        hpath: '/笔记/AI 与 机器学习',
        title: 'AI 与 机器学习 AI',
        tags: ['AI'],
        content: '人工智能 模型 机器学习',
        updated: '20260311120000',
      },
      orphan: {
        documentId: 'doc-orphan',
        title: 'AI 与 机器学习 AI',
        degree: 0,
        createdAt: '20260310120000',
        updatedAt: '20260311120000',
        historicalReferenceCount: 2,
        lastHistoricalAt: '20260310120000',
        hasSparseEvidence: true,
      },
      documents: [
        { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI 与 机器学习', title: 'AI 与 机器学习 AI', tags: ['AI'], content: '人工智能 模型 机器学习', updated: '20260311120000' },
        { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], content: 'AI 人工智能 索引', updated: '20260311120000' },
      ],
      themeDocuments: [
        {
          documentId: 'doc-theme-ai',
          title: '主题-AI-索引',
          themeName: 'AI',
          matchTerms: ['AI', '人工智能'],
          box: 'box-1',
          path: '/topics/theme-ai.sy',
          hpath: '/专题/主题-AI-索引',
        },
      ],
      availableTags: ['AI'],
      report: {
        ranking: [],
      } as any,
      onProgress: (message) => {
        progress.push(message)
      },
    })

    expect(progress).toEqual([
      '正在分析文档语义并生成 embedding…',
      '正在基于 embedding 与结构信号召回候选…',
      'AI 正在分析……',
    ])
  })
})
