import { describe, expect, it, vi } from 'vitest'

import { createAiWikiService } from './wiki-ai'

describe('ai wiki service', () => {
  it('requests structured theme wiki JSON and normalizes the response', async () => {
    const forwardProxy = vi.fn(async (
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
      expect(timeout).toBe(30000)
      expect(contentType).toBe('application/json')

      const body = JSON.parse(payload)
      expect(body.model).toBe('gpt-4.1-mini')
      expect(body.messages[0].content).toMatch(/主题 wiki 页面/)
      expect(body.messages[1].content).toMatch(/AI 核心/)

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overview: '当前主题聚焦 AI 与机器学习的知识编排。',
                  keyDocuments: ['优先阅读《AI 核心》'],
                  structureObservations: ['桥接点集中在《AI 导航》'],
                  evidence: ['AI 导航 -> AI 核心'],
                  actions: ['补齐《AI 核心》的主题入口'],
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
    })

    const service = createAiWikiService({ forwardProxy })
    const result = await service.generateThemeSections({
      config: {
        aiEnabled: true,
        aiBaseUrl: 'https://api.example.com/v1',
        aiApiKey: 'sk-test',
        aiModel: 'gpt-4.1-mini',
      } as any,
      payload: {
        themeName: 'AI',
        pageTitle: '主题-AI-索引-llm-wiki',
        themeDocumentId: 'doc-theme-ai',
        themeDocumentTitle: '主题-AI-索引',
        sourceDocuments: [
          {
            documentId: 'doc-core',
            title: 'AI 核心',
            summaryShort: 'AI 核心摘要',
            summaryMedium: 'AI 核心中摘要',
            keywords: ['AI'],
            evidenceSnippets: ['AI 核心内容'],
            updatedAt: '20260311120000',
          },
        ],
        signals: {
          coreDocuments: [],
          bridgeDocuments: [],
          propagationDocuments: [],
          orphanDocuments: [],
          risingDocuments: [],
          fallingDocuments: [],
        },
        evidence: ['AI 导航 -> AI 核心'],
      },
    })

    expect(result).toEqual({
      overview: '当前主题聚焦 AI 与机器学习的知识编排。',
      keyDocuments: ['优先阅读《AI 核心》'],
      structureObservations: ['桥接点集中在《AI 导航》'],
      evidence: ['AI 导航 -> AI 核心'],
      actions: ['补齐《AI 核心》的主题入口'],
    })
  })
})
