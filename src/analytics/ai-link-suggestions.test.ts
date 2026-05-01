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
      existingTags: ['AI', '机器学习', '知识管理'],
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
      existingTags: ['AI', '机器学习', '知识管理'],
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
      existingTags: ['AI', '机器学习'],
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

  it('cleans configured title affixes before ranking candidates and sending titles to AI', async () => {
    const requests: Array<{ url: string, body: any }> = []
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
                { embedding: [0.9, 0.1] },
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
                    summary: '可先补到核心文档。',
                    suggestions: [
                      {
                        targetDocumentId: 'doc-core',
                        targetTitle: '核心文档',
                        targetType: 'core-document',
                        confidence: 'medium',
                        reason: '标题装饰词已清理后，核心文档仍是最稳定的挂载入口。',
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
        aiRequestTimeoutSeconds: 30,
        aiMaxTokens: 1024,
        aiTemperature: 0.2,
        aiMaxContextMessages: 7,
        themeNamePrefix: '主题-',
        themeNameSuffix: '-索引',
        readTitlePrefixes: 'AI-|已读-',
        readTitleSuffixes: '-归档',
      } as any,
      sourceDocument: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/orphan.sy',
        hpath: '/笔记/AI-随手记-归档',
        title: 'AI-随手记-归档',
        tags: [],
        content: '这是一篇还没挂到入口的笔记。',
        updated: '20260311120000',
      },
      orphan: {
        documentId: 'doc-orphan',
        title: 'AI-随手记-归档',
        degree: 0,
        createdAt: '20260310120000',
        updatedAt: '20260311120000',
        historicalReferenceCount: 1,
        lastHistoricalAt: '20260310120000',
        hasSparseEvidence: false,
      },
      documents: [
        { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/AI-随手记-归档', title: 'AI-随手记-归档', tags: [], content: '这是一篇还没挂到入口的笔记。', updated: '20260311120000' },
        { id: 'doc-core', box: 'box-1', path: '/core.sy', hpath: '/笔记/已读-核心文档-归档', title: '已读-核心文档-归档', tags: [], content: '稳定入口和导航。', updated: '20260311120000' },
        { id: 'doc-theme-ai', box: 'box-1', path: '/topics/theme-ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', tags: [], content: 'AI 主题页', updated: '20260311120000' },
      ],
      themeDocuments: [
        {
          documentId: 'doc-theme-ai',
          title: '主题-AI-索引',
          themeName: 'AI',
          matchTerms: ['AI'],
          box: 'box-1',
          path: '/topics/theme-ai.sy',
          hpath: '/专题/主题-AI-索引',
        },
      ],
      existingTags: ['AI', '整理'],
      report: {
        ranking: [
          { documentId: 'doc-core', title: '已读-核心文档-归档', inboundReferences: 4, distinctSourceDocuments: 3, outboundReferences: 2, lastActiveAt: '20260311120000' },
        ],
      } as any,
    })

    expect(requests[0]?.url).toBe('https://api.example.com/v1/embeddings')
    expect(requests[0]?.body.input).toEqual([
      expect.stringContaining('Title: 随手记'),
      expect.stringContaining('Title: 核心文档'),
    ])
    expect(requests[0]?.body.input.join('\n')).not.toContain('AI-随手记-归档')
    expect(requests[0]?.body.input.join('\n')).not.toContain('已读-核心文档-归档')
    expect(requests[0]?.body.input.join('\n')).not.toContain('主题-AI-索引')

    const prompt = JSON.parse(requests[1]?.body.messages[1].content)
    expect(prompt.sourceDocument.title).toBe('随手记')
    expect(prompt.availableThemes).toEqual([
      expect.objectContaining({
        documentId: 'doc-theme-ai',
        title: 'AI',
      }),
    ])
    expect(prompt.candidates).toEqual([
      expect.objectContaining({
        id: 'doc-core',
        title: '核心文档',
        targetType: 'core-document',
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
      existingTags: ['AI', '机器学习'],
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
      existingTags: ['AI', '机器学习', '知识管理'],
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
      existingTags: ['AI'],
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

  it('rewrites english AI suggestion copy to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const requests: Array<{ url: string, body: any }> = []
    let chatRequestCount = 0
    const service = createAiLinkSuggestionService({
      forwardProxy: async (url, method, payload) => {
        requests.push({
          url,
          body: JSON.parse(payload),
        })

        if (!url.endsWith('/chat/completions')) {
          throw new Error(`unexpected request: ${url}`)
        }

        chatRequestCount += 1
        return {
          status: 200,
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify(chatRequestCount === 1
                    ? {
                        summary: 'The source document discusses hidden commands and tips for Claude Code, which aligns with existing themes related to AI programming and tools.',
                        suggestions: [
                          {
                            targetDocumentId: 'doc-theme-claude',
                            targetTitle: 'ClaudeCode',
                            targetType: 'theme-document',
                            confidence: 'medium',
                            reason: 'Directly matches the topic document, serving as the most relevant thematic entry point.',
                            draftText: 'Can fit under ClaudeCode: ((doc-theme-claude "ClaudeCode"))',
                            tagSuggestions: [
                              {
                                tag: 'Agent',
                                source: 'existing',
                                reason: 'Discusses multi-agent collaboration, relevant to the document topic.',
                              },
                            ],
                          },
                        ],
                      }
                    : {
                        summary: '源文档讨论了 Claude Code 的隐藏命令与技巧，和现有的 AI 编程与工具主题高度匹配。',
                        suggestions: [
                          {
                            targetDocumentId: 'doc-theme-claude',
                            targetTitle: 'ClaudeCode',
                            targetType: 'theme-document',
                            confidence: 'medium',
                            reason: '和主题文档直接匹配，适合作为当前最相关的主题入口。',
                            draftText: '可归入 ClaudeCode：((doc-theme-claude "ClaudeCode"))',
                            tagSuggestions: [
                              {
                                tag: 'Agent',
                                source: 'existing',
                                reason: '涉及多智能体协作，和当前文档主题相关。',
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
        aiEmbeddingModel: '',
      } as any,
      sourceDocument: {
        id: 'doc-orphan',
        box: 'box-1',
        path: '/notes/orphan.sy',
        hpath: '/笔记/Claude Code',
        title: '分享10个你可能不知道的Claude Code隐藏命令和技巧',
        tags: ['Agent'],
        content: 'Claude Code hidden commands and multi-agent tips.',
        updated: '20260418120000',
      },
      orphan: {
        documentId: 'doc-orphan',
        title: '分享10个你可能不知道的Claude Code隐藏命令和技巧',
        degree: 0,
        createdAt: '20260417120000',
        updatedAt: '20260418120000',
        historicalReferenceCount: 0,
        lastHistoricalAt: null,
        hasSparseEvidence: false,
      },
      documents: [
        { id: 'doc-orphan', box: 'box-1', path: '/notes/orphan.sy', hpath: '/笔记/Claude Code', title: '分享10个你可能不知道的Claude Code隐藏命令和技巧', tags: ['Agent'], content: 'Claude Code hidden commands and multi-agent tips.', updated: '20260418120000' },
        { id: 'doc-theme-claude', box: 'box-1', path: '/topics/claude.sy', hpath: '/专题/ClaudeCode', title: 'ClaudeCode', tags: [], content: 'Claude Code topic page', updated: '20260418120000' },
      ],
      themeDocuments: [
        {
          documentId: 'doc-theme-claude',
          title: 'ClaudeCode',
          themeName: 'ClaudeCode',
          matchTerms: ['Claude Code', 'ClaudeCode'],
          box: 'box-1',
          path: '/topics/claude.sy',
          hpath: '/专题/ClaudeCode',
        },
      ],
      existingTags: ['Agent', 'Codex', 'Prompt'],
      report: {
        ranking: [],
      } as any,
    })

    const chatRequests = requests.filter(request => request.url.endsWith('/chat/completions'))
    expect(chatRequests).toHaveLength(2)
    expect(JSON.parse(chatRequests[1]!.body.messages[1].content)).toEqual(expect.objectContaining({
      locale: 'zh_CN',
      summary: 'The source document discusses hidden commands and tips for Claude Code, which aligns with existing themes related to AI programming and tools.',
    }))
    expect(result).toEqual(expect.objectContaining({
      summary: '源文档讨论了 Claude Code 的隐藏命令与技巧，和现有的 AI 编程与工具主题高度匹配。',
      suggestions: [
        expect.objectContaining({
          targetDocumentId: 'doc-theme-claude',
          confidence: 'medium',
          reason: '和主题文档直接匹配，适合作为当前最相关的主题入口。',
          draftText: '可归入 ClaudeCode：((doc-theme-claude "ClaudeCode"))',
          tagSuggestions: [
            expect.objectContaining({
              tag: 'Agent',
              source: 'existing',
              reason: '涉及多智能体协作，和当前文档主题相关。',
            }),
          ],
        }),
      ],
    }))
  })
})
