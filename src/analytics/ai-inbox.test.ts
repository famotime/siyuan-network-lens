import { describe, expect, it, vi } from 'vitest'

import { createAiInboxService, limitChatCompletionMessages, resolveAiRequestOptions } from './ai-inbox'

const documents = Array.from({ length: 12 }, (_, index) => ({
  id: `doc-${index + 1}`,
  box: 'box-1',
  path: `/doc-${index + 1}.sy`,
  hpath: `/Doc ${index + 1}`,
  title: `Doc ${index + 1}`,
  created: '20260301090000',
  updated: '20260311120000',
}))

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
    })

    expect(payload.context.capacity).toBe('compact')
    expect(payload.context.summaryCards).toHaveLength(4)
    expect(payload.signals.ranking).toHaveLength(3)
    expect(payload.signals.orphans).toHaveLength(3)
    expect(payload.signals.bridges).toHaveLength(3)
    expect(payload.signals.newConnections).toHaveLength(2)
    expect(payload.signals.brokenConnections).toHaveLength(2)
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
    })

    expect(payload.context.capacity).toBe('full')
    expect(payload.context.summaryCards).toHaveLength(5)
    expect(payload.signals.ranking).toHaveLength(10)
    expect(payload.signals.orphans).toHaveLength(10)
    expect(payload.signals.propagation).toHaveLength(9)
    expect(payload.signals.newConnections).toHaveLength(7)
    expect(payload.signals.brokenConnections).toHaveLength(7)
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
      expect(body.messages).toEqual([
        { role: 'system', content: '你是思源笔记文档引用网络的整理助手。 你要根据给定的结构化分析结果，输出今天最值得优先处理的整理待办。 必须只输出 JSON，不要输出 Markdown、解释或代码块。 JSON 结构必须是 {"summary": string, "items": AiInboxItem[]}。 items 中每项必须包含 id、type、title、priority、why、action、benefit，可选 documentIds。 type 只能是 document、connection、topic-page、bridge-risk。 priority 用 P1、P2、P3。 优先关注孤立文档、沉没文档、桥接风险、缺主题页社区、趋势变化和关键连接补齐。' },
        { role: 'user', content: expect.stringContaining('请基于下面的文档级引用网络分析结果') },
      ])

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'summary',
                  items: [
                    {
                      id: 'item-1',
                      type: 'document',
                      title: '整理 Doc 1',
                      priority: 'P1',
                      why: 'because',
                      action: 'act',
                      benefit: 'benefit',
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

    expect(result.summary).toBe('summary')
    expect(result.items).toHaveLength(1)
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

    await expect(service.testConnection({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.siliconflow.cn',
        aiApiKey: 'sk-test',
        aiModel: 'deepseek-ai/DeepSeek-V3',
      } as any,
    })).rejects.toThrow(/Base URL 很可能应包含 \/v1/)

    expect(logger.info).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request start',
      expect.objectContaining({
        endpoint: 'https://api.siliconflow.cn/chat/completions',
        timeoutMs: 30000,
        model: 'deepseek-ai/DeepSeek-V3',
      }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      '[NetworkLens][AI] Request failed',
      expect.objectContaining({
        endpoint: 'https://api.siliconflow.cn/chat/completions',
        timeoutMs: 30000,
        model: 'deepseek-ai/DeepSeek-V3',
        errorMessage: 'forward request failed: Post "https://api.siliconflow.cn/chat/completions": context deadline exceeded v3.6.1',
      }),
    )
  })
})
