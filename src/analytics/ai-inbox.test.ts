import { describe, expect, it, vi } from 'vitest'

import { createAiInboxService, fetchSiliconFlowModelCatalog, limitChatCompletionMessages, resolveAiRequestOptions, resolveAiEndpoint } from './ai-inbox'

const documents = Array.from({ length: 12 }, (_, index) => ({
  id: `doc-${index + 1}`,
  box: 'box-1',
  path: `/doc-${index + 1}.sy`,
  hpath: `/Doc ${index + 1}`,
  title: index === 0 ? 'AI 与机器学习整理' : `Doc ${index + 1}`,
  content: index === 0 ? 'AI 人工智能 机器学习 模型 训练' : '',
  created: '20260301090000',
  updated: '20260311120000',
})).concat([
  {
    id: 'doc-theme-ai',
    box: 'box-1',
    path: '/topics/theme-ai.sy',
    hpath: '/专题/主题-AI-索引',
    title: '主题-AI-索引',
    name: 'AI',
    alias: '人工智能',
    created: '20260301090000',
    updated: '20260311120000',
  },
  {
    id: 'doc-theme-ml',
    box: 'box-1',
    path: '/topics/theme-ml.sy',
    hpath: '/专题/主题-机器学习-索引',
    title: '主题-机器学习-索引',
    name: '机器学习',
    alias: 'ML',
    created: '20260301090000',
    updated: '20260311120000',
  },
])

const report = {
  summary: {
    totalDocuments: 12,
    analyzedDocuments: 12,
    totalReferences: 20,
    orphanCount: 10,
    communityCount: 4,
    dormantCount: 8,
    sparseEvidenceCount: 3,
    propagationCount: 7,
  },
  ranking: Array.from({ length: 12 }, (_, index) => ({
    documentId: `doc-${index + 1}`,
    title: `Doc ${index + 1}`,
    inboundReferences: 20 - index,
    distinctSourceDocuments: 10 - Math.min(index, 5),
    outboundReferences: 5,
    lastActiveAt: '20260311120000',
  })),
  communities: Array.from({ length: 8 }, (_, index) => ({
    id: `community-${index + 1}`,
    documentIds: [`doc-${index + 1}`, `doc-${index + 2}`],
    size: 2,
    hubDocumentIds: [`doc-${index + 1}`],
    topTags: [`tag-${index + 1}`],
    notebookIds: ['box-1'],
    missingTopicPage: index % 2 === 0,
  })),
  bridgeDocuments: Array.from({ length: 8 }, (_, index) => ({
    documentId: `doc-${index + 1}`,
    title: `Doc ${index + 1}`,
    degree: 8 - index,
  })),
  orphans: Array.from({ length: 10 }, (_, index) => ({
    documentId: `doc-${index + 1}`,
    title: `Doc ${index + 1}`,
    degree: 0,
    createdAt: '20260301090000',
    updatedAt: '20260311120000',
    historicalReferenceCount: index + 1,
    lastHistoricalAt: '20260310120000',
    hasSparseEvidence: index < 3,
  })),
  dormantDocuments: Array.from({ length: 8 }, (_, index) => ({
    documentId: `doc-${index + 1}`,
    title: `Doc ${index + 1}`,
    degree: 0,
    createdAt: '20260301090000',
    updatedAt: '20260311120000',
    historicalReferenceCount: index + 1,
    lastHistoricalAt: '20260310120000',
    hasSparseEvidence: false,
    inactivityDays: 30 + index,
    lastConnectedAt: '20260310120000',
  })),
  propagationNodes: Array.from({ length: 9 }, (_, index) => ({
    documentId: `doc-${index + 1}`,
    title: `Doc ${index + 1}`,
    degree: 5,
    score: 12 - index,
    pathPairCount: 6,
    focusDocumentCount: 4,
    communitySpan: 2,
    bridgeRole: index < 2,
  })),
  suggestions: [],
  evidenceByDocument: {},
} as any

const trends = {
  current: { referenceCount: 10 },
  previous: { referenceCount: 6 },
  risingDocuments: Array.from({ length: 9 }, (_, index) => ({
    documentId: `doc-${index + 1}`,
    title: `Doc ${index + 1}`,
    currentReferences: 8,
    previousReferences: 4,
    delta: 4 - index,
  })),
  fallingDocuments: Array.from({ length: 9 }, (_, index) => ({
    documentId: `doc-${index + 4}`,
    title: `Doc ${index + 4}`,
    currentReferences: 2,
    previousReferences: 5,
    delta: -1 - index,
  })),
  connectionChanges: {
    newCount: 7,
    brokenCount: 7,
    newEdges: Array.from({ length: 7 }, (_, index) => ({
      documentIds: [`doc-${index + 1}`, `doc-${index + 2}`],
      referenceCount: index + 1,
    })),
    brokenEdges: Array.from({ length: 7 }, (_, index) => ({
      documentIds: [`doc-${index + 5}`, `doc-${index + 6}`],
      referenceCount: index + 1,
    })),
  },
  communityTrends: Array.from({ length: 8 }, (_, index) => ({
    communityId: `community-${index + 1}`,
    documentIds: [`doc-${index + 1}`, `doc-${index + 2}`],
    hubDocumentIds: [`doc-${index + 1}`],
    topTags: [`tag-${index + 1}`],
    currentReferences: 4,
    previousReferences: 2,
    delta: 2,
  })),
  risingCommunities: [],
  dormantCommunities: [],
} as any

describe('ai inbox payload', () => {
  it('builds concrete action candidates with targets, score breakdown and expected benefits', () => {
    const service = createAiInboxService({
      forwardProxy: async () => {
        throw new Error('not used')
      },
    })

    const payload = service.buildPayload({
      documents,
      report,
      trends,
      summaryCards: [
        { key: 'orphans', label: '孤立文档', value: '10', hint: '当前窗口内没有有效文档级连接' },
      ] as any,
      filters: {},
      timeRange: '7d',
      dormantDays: 30,
      contextCapacity: 'balanced',
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
        {
          documentId: 'doc-theme-ml',
          title: '主题-机器学习-索引',
          themeName: '机器学习',
          matchTerms: ['机器学习', 'ML'],
          box: 'box-1',
          path: '/topics/theme-ml.sy',
          hpath: '/专题/主题-机器学习-索引',
        },
      ],
    })

    expect(payload.actionCandidates.length).toBeGreaterThan(0)
    expect(payload.actionCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'repair-link',
        title: '修复孤立文档：AI 与机器学习整理',
        focusDocumentIds: ['doc-1'],
        recommendedTargets: expect.arrayContaining([
          expect.objectContaining({
            documentId: 'doc-theme-ai',
            title: '主题-AI-索引',
            kind: 'theme-document',
          }),
        ]),
        expectedBenefits: expect.arrayContaining([
          expect.stringContaining('移出孤立文档'),
        ]),
        priorityScore: expect.any(Number),
        impactScore: expect.any(Number),
        urgencyScore: expect.any(Number),
        actionabilityScore: expect.any(Number),
        confidence: expect.stringMatching(/high|medium|low/),
      }),
    ]))
  })

  it('uses compact capacity to reduce the number of included signals', () => {
    const service = createAiInboxService({
      forwardProxy: async () => {
        throw new Error('not used')
      },
    })

    const payload = service.buildPayload({
      documents,
      report,
      trends,
      summaryCards: [
        { key: 'read', label: '未读文档', value: '5', hint: '未命中已读标记规则的文档数' },
        { key: 'orphans', label: '孤立文档', value: '10', hint: '当前窗口内没有有效文档级连接' },
        { key: 'ranking', label: '核心文档', value: '12', hint: '当前窗口内被引用的核心文档数' },
        { key: 'documents', label: '文档样本', value: '12', hint: '命中当前筛选条件的文档数' },
        { key: 'trends', label: '趋势观察', value: '10', hint: '当前窗口内出现变化的文档数' },
      ] as any,
      filters: {},
      timeRange: '7d',
      dormantDays: 30,
      contextCapacity: 'compact',
      themeDocuments: [],
    })

    expect(payload.context.capacity).toBe('compact')
    expect(payload.context.summaryCards).toHaveLength(4)
    expect(payload.signals.ranking).toHaveLength(3)
    expect(payload.signals.orphans).toHaveLength(3)
    expect(payload.signals.bridges).toHaveLength(3)
    expect(payload.signals.newConnections).toHaveLength(2)
    expect(payload.signals.brokenConnections).toHaveLength(2)
    expect(payload.actionCandidates).toHaveLength(3)
  })

  it('uses full capacity to include a wider signal window', () => {
    const service = createAiInboxService({
      forwardProxy: async () => {
        throw new Error('not used')
      },
    })

    const payload = service.buildPayload({
      documents,
      report,
      trends,
      summaryCards: [
        { key: 'read', label: '未读文档', value: '5', hint: '未命中已读标记规则的文档数' },
        { key: 'orphans', label: '孤立文档', value: '10', hint: '当前窗口内没有有效文档级连接' },
        { key: 'ranking', label: '核心文档', value: '12', hint: '当前窗口内被引用的核心文档数' },
        { key: 'documents', label: '文档样本', value: '12', hint: '命中当前筛选条件的文档数' },
        { key: 'trends', label: '趋势观察', value: '10', hint: '当前窗口内出现变化的文档数' },
      ] as any,
      filters: {},
      timeRange: '7d',
      dormantDays: 30,
      contextCapacity: 'full',
      themeDocuments: [],
    })

    expect(payload.context.capacity).toBe('full')
    expect(payload.context.summaryCards).toHaveLength(5)
    expect(payload.signals.ranking).toHaveLength(10)
    expect(payload.signals.orphans).toHaveLength(10)
    expect(payload.signals.propagation).toHaveLength(9)
    expect(payload.signals.newConnections).toHaveLength(7)
    expect(payload.signals.brokenConnections).toHaveLength(7)
    expect(payload.actionCandidates.length).toBeGreaterThan(6)
  })
})

describe('ai inbox request options', () => {
  it('sanitizes request options from config', () => {
    expect(resolveAiRequestOptions({
      aiRequestTimeoutSeconds: -1,
      aiMaxTokens: 0,
      aiTemperature: 9,
      aiMaxContextMessages: 0,
    } as any)).toEqual({
      timeoutMs: 30000,
      maxTokens: 10240,
      temperature: 0.7,
      maxContextMessages: 7,
    })
  })

  it('keeps system prompts and limits non-system messages by configured context count', () => {
    const messages = [
      { role: 'system', content: 'system-1' },
      { role: 'assistant', content: 'assistant-1' },
      { role: 'user', content: 'user-1' },
      { role: 'assistant', content: 'assistant-2' },
      { role: 'user', content: 'user-2' },
    ] as const

    expect(limitChatCompletionMessages(messages, 2)).toEqual([
      { role: 'system', content: 'system-1' },
      { role: 'assistant', content: 'assistant-2' },
      { role: 'user', content: 'user-2' },
    ])
  })

  it('uses configured timeout, max_tokens, temperature and context limit for chat completions', async () => {
    const forwardProxy = async (
      url: string,
      method?: string,
      payload?: any,
      headers?: any[],
      timeout?: number,
      contentType?: string,
    ) => {
      expect(url).toBe('https://api.example.com/v1/chat/completions')
      expect(method).toBe('POST')
      expect(headers).toEqual([
        { Authorization: 'Bearer sk-test' },
        { Accept: 'application/json' },
      ])
      expect(timeout).toBe(45000)
      expect(contentType).toBe('application/json')

      const body = JSON.parse(payload)
      expect(body.model).toBe('gpt-4.1-mini')
      expect(body.max_tokens).toBe(2048)
      expect(body.temperature).toBe(0.2)
      expect(body.messages).toHaveLength(2)
      expect(body.messages[0]).toEqual(expect.objectContaining({
        role: 'system',
        content: expect.stringMatching(/推荐动作.*建议草稿.*合并/),
      }))
      expect(body.messages[1]).toEqual(expect.objectContaining({
        role: 'user',
        content: expect.stringMatching(/推荐动作.*建议草稿.*合并.*为什么先做.*预估收益.*推荐理由/),
      }))

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '已整理出当前窗口的优先处理建议。',
                  items: [
                    {
                      id: 'item-1',
                      type: 'document',
                      title: '整理 Doc 1',
                      priority: 'P1',
                      action: '先补到主题-AI-索引，并补一句归属说明。\n可归入 AI 主题：((doc-theme-ai "主题-AI-索引"))',
                      reason: '当前窗口内孤立，且主题匹配信号明确。可减少 1 篇孤立文档，并恢复主题入口。',
                      confidence: 'high',
                      recommendedTargets: [
                        {
                          documentId: 'doc-theme-ai',
                          title: '主题-AI-索引',
                          reason: '主题页可作为稳定入口',
                        },
                      ],
                      evidence: ['当前窗口内孤立', '主题匹配命中 4 次'],
                      expectedChanges: ['孤立文档数预计减少 1'],
                    },
                  ],
                }),
              },
            },
          ],
        }),
        contentType: 'application/json',
        elapsed: 12,
        headers: {},
        status: 200,
        url,
      } as any
    }

    const service = createAiInboxService({ forwardProxy })

    const result = await service.generateInbox({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        aiRequestTimeoutSeconds: 45,
        aiMaxTokens: 2048,
        aiTemperature: 0.2,
        aiMaxContextMessages: 1,
      } as any,
      payload: service.buildPayload({
        documents,
        report,
        trends,
        summaryCards: [
          { key: 'read', label: '未读文档', value: '5', hint: '未命中已读标记规则的文档数' },
        ] as any,
        filters: {},
        timeRange: '7d',
        dormantDays: 30,
      }),
    })

    expect(result.summary).toBe('已整理出当前窗口的优先处理建议。')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual(expect.objectContaining({
      action: '先补到主题-AI-索引，并补一句归属说明。\n可归入 AI 主题：((doc-theme-ai "主题-AI-索引"))',
      reason: '当前窗口内孤立，且主题匹配信号明确。可减少 1 篇孤立文档，并恢复主题入口。',
      confidence: 'high',
      recommendedTargets: [
        expect.objectContaining({
          documentId: 'doc-theme-ai',
          title: '主题-AI-索引',
        }),
      ],
      evidence: ['当前窗口内孤立', '主题匹配命中 4 次'],
      expectedChanges: ['孤立文档数预计减少 1'],
    }))
  })

  it('returns the first inbox result directly even when it contains english text', async () => {
    const requests: Array<{ url: string, messages: Array<{ role: string, content: string }> }> = []
    const forwardProxy = async (
      url: string,
      method?: string,
      payload?: any,
      headers?: any[],
      timeout?: number,
      contentType?: string,
    ) => {
      const body = JSON.parse(payload)
      requests.push({
        url,
        messages: body.messages,
      })

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '5 high-priority items: create a topic page and repair orphan links.',
                  items: [
                    {
                      id: 'item-1',
                      type: 'topic-page',
                      title: 'Creating topic page: 主题-五星-索引',
                      priority: 'P1',
                      action: 'Create the page and link it to 技能, Uber AI开发实况, MiniMax M2.7. Suggested title: 主题-五星-索引',
                      reason: 'Community with 3 hub documents lacks a topic page and gained 2 new links recently. Unified entry point for this community and clearer navigation.',
                      recommendedTargets: [
                        {
                          documentId: 'doc-1',
                          title: '技能',
                          reason: 'Useful entry point for the first navigation layer.',
                        },
                      ],
                      evidence: ['Missing topic page', 'Recent community growth'],
                      expectedChanges: ['Community becomes easier to navigate'],
                    },
                  ],
                }),
              },
            },
          ],
        }),
        contentType: 'application/json',
        elapsed: 12,
        headers: {},
        status: 200,
        url,
      } as any
    }

    const service = createAiInboxService({ forwardProxy })

    const result = await service.generateInbox({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
        aiRequestTimeoutSeconds: 45,
        aiMaxTokens: 2048,
        aiTemperature: 0.2,
        aiMaxContextMessages: 3,
      } as any,
      payload: service.buildPayload({
        documents,
        report,
        trends,
        summaryCards: [
          { key: 'todaySuggestions', label: '今日建议', value: '5', hint: '当前窗口内最值得优先处理的待办' },
        ] as any,
        filters: {},
        timeRange: '7d',
        dormantDays: 30,
      }),
    })

    expect(requests).toHaveLength(1)
    expect(result).toEqual(expect.objectContaining({
      summary: '5 high-priority items: create a topic page and repair orphan links.',
      items: [
        expect.objectContaining({
          title: 'Creating topic page: 主题-五星-索引',
          action: 'Create the page and link it to 技能, Uber AI开发实况, MiniMax M2.7. Suggested title: 主题-五星-索引',
          reason: 'Community with 3 hub documents lacks a topic page and gained 2 new links recently. Unified entry point for this community and clearer navigation.',
          recommendedTargets: [
            expect.objectContaining({
              reason: 'Useful entry point for the first navigation layer.',
            }),
          ],
          evidence: ['Missing topic page', 'Recent community growth'],
          expectedChanges: ['Community becomes easier to navigate'],
        }),
      ],
    }))
  })

  it('auto-appends /v1 for SiliconFlow chat completions when base url omits it', () => {
    expect(resolveAiEndpoint('https://api.siliconflow.cn', 'chat/completions')).toBe('https://api.siliconflow.cn/v1/chat/completions')
    expect(resolveAiEndpoint('https://api.siliconflow.cn/', 'embeddings')).toBe('https://api.siliconflow.cn/v1/embeddings')
    expect(resolveAiEndpoint('https://api.siliconflow.cn', 'models')).toBe('https://api.siliconflow.cn/v1/models')
    expect(resolveAiEndpoint('https://api.siliconflow.cn/v1', 'chat/completions')).toBe('https://api.siliconflow.cn/v1/chat/completions')
  })

  it('fetches siliconflow chat and embedding model catalogs from the models endpoint', async () => {
    const requests: Array<{ url: string, method?: string, headers?: any[], timeout?: number, contentType?: string }> = []
    const catalog = await fetchSiliconFlowModelCatalog({
      config: {
        aiBaseUrl: 'https://api.siliconflow.cn',
        aiApiKey: 'sk-test',
        aiRequestTimeoutSeconds: 45,
      } as any,
      forwardProxy: async (url, method, payload, headers, timeout, contentType) => {
        requests.push({ url, method, headers, timeout, contentType })

        if (url.endsWith('sub_type=chat')) {
          return {
            body: JSON.stringify({
              data: [
                { id: 'deepseek-ai/DeepSeek-V3' },
                { id: 'Qwen/Qwen2.5-72B-Instruct' },
              ],
            }),
            status: 200,
          } as any
        }

        return {
          body: JSON.stringify({
            data: [
              { id: 'BAAI/bge-m3' },
              { id: 'Qwen/Qwen3-Embedding-8B' },
              { id: 'BAAI/bge-m3' },
            ],
          }),
          status: 200,
        } as any
      },
    })

    expect(requests).toEqual([
      {
        url: 'https://api.siliconflow.cn/v1/models?sub_type=chat',
        method: 'GET',
        headers: [
          { Authorization: 'Bearer sk-test' },
          { Accept: 'application/json' },
        ],
        timeout: 45000,
        contentType: 'application/json',
      },
      {
        url: 'https://api.siliconflow.cn/v1/models?sub_type=embedding',
        method: 'GET',
        headers: [
          { Authorization: 'Bearer sk-test' },
          { Accept: 'application/json' },
        ],
        timeout: 45000,
        contentType: 'application/json',
      },
    ])
    expect(catalog).toEqual({
      chatModels: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'],
      embeddingModels: ['BAAI/bge-m3', 'Qwen/Qwen3-Embedding-8B'],
    })
  })

  it('includes missing /v1 hints for non-2xx responses', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const service = createAiInboxService({
      forwardProxy: async () => ({
        body: '{"error":"not found"}',
        contentType: 'application/json',
        elapsed: 12,
        headers: {},
        status: 404,
        url: 'https://api.siliconflow.cn/chat/completions',
      } as any),
      logger,
    })

    await expect(service.testConnection({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.siliconflow.cn/no-v1',
        aiApiKey: 'sk-test',
        aiModel: 'deepseek-ai/DeepSeek-V3',
      } as any,
    })).rejects.toThrow(/Base URL 很可能应包含 \/v1/)
  })

  it('logs status code and full response result for non-2xx responses', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const service = createAiInboxService({
      forwardProxy: async () => ({
        body: '{"error":{"message":"max_tokens too large","type":"invalid_request_error"}}',
        contentType: 'application/json',
        elapsed: 18,
        headers: {},
        status: 400,
        url: 'https://api.siliconflow.cn/v1/chat/completions',
      } as any),
      logger,
    })

    await expect(service.testConnection({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.siliconflow.cn/v1',
        aiApiKey: 'sk-test',
        aiModel: 'deepseek-ai/DeepSeek-V3',
      } as any,
    })).rejects.toThrow(/400/)

    expect(logger.warn).toHaveBeenCalledWith(
      '[NetworkLens][AI] Non-2xx response detail',
      expect.stringContaining('状态码：400'),
    )
    expect(logger.warn).toHaveBeenCalledWith(
      '[NetworkLens][AI] Non-2xx response detail',
      expect.stringContaining('完整响应：{"error":{"message":"max_tokens too large","type":"invalid_request_error"}}'),
    )
  })

  it('logs full outbound request detail with masked authorization header', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const service = createAiInboxService({
      forwardProxy: async (url) => ({
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '连接成功',
                  items: [
                    {
                      id: 'item-1',
                      type: 'document',
                      title: '整理 Doc 1',
                      priority: 'P1',
                      action: '先补一条主题链接。',
                      reason: '当前结构证据明确，适合立即处理。',
                    },
                  ],
                }),
              },
            },
          ],
        }),
        contentType: 'application/json',
        elapsed: 9,
        headers: {},
        status: 200,
        url,
      } as any),
      logger,
    })

    await service.testConnection({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.siliconflow.cn/v1',
        aiApiKey: 'sk-test-secret',
        aiModel: 'deepseek-ai/DeepSeek-V3',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 102400,
        aiTemperature: 0.7,
        aiMaxContextMessages: 7,
      } as any,
    })

    expect(logger.info).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request start detail',
      expect.stringContaining('请求方法：POST'),
    )
    expect(logger.info).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request start detail',
      expect.stringContaining('请求地址：https://api.siliconflow.cn/v1/chat/completions'),
    )
    expect(logger.info).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request start detail',
      expect.stringContaining('"Authorization":"Bearer sk-***"'),
    )
    expect(logger.info).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request start detail',
      expect.stringContaining('"model":"deepseek-ai/DeepSeek-V3"'),
    )
    expect(logger.info).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request start detail',
      expect.not.stringContaining('sk-test-secret'),
    )
  })

  it('adds timeout troubleshooting details and emits debug logs when forward proxy throws', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const service = createAiInboxService({
      forwardProxy: async () => {
        throw new Error('forward request failed: Post "https://api.siliconflow.cn/chat/completions": context deadline exceeded v3.6.1')
      },
      logger,
    } as any)

    await expect(service.testConnection({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.siliconflow.cn',
        aiApiKey: 'sk-test',
        aiModel: 'deepseek-ai/DeepSeek-V3',
        aiRequestTimeoutSeconds: 30,
        aiMaxTokens: 10240,
        aiTemperature: 0.7,
        aiMaxContextMessages: 7,
      } as any,
    })).rejects.toThrow(/AI 请求超时/)

    expect(logger.info).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request start',
      expect.objectContaining({
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        timeoutMs: 30000,
        model: 'deepseek-ai/DeepSeek-V3',
      }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request failed',
      expect.objectContaining({
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        timeoutMs: 30000,
        model: 'deepseek-ai/DeepSeek-V3',
        errorMessage: 'forward request failed: Post "https://api.siliconflow.cn/chat/completions": context deadline exceeded v3.6.1',
      }),
    )
  })
})
