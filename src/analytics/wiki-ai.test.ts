import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAiWikiService } from './wiki-ai'

describe('ai wiki service', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

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
      expect(timeout).toBe(60000)
      expect(contentType).toBe('application/json')

      const body = JSON.parse(payload)
      expect(body.model).toBe('gpt-4.1-mini')
      expect(body.messages[0].content).toMatch(/topic wiki page/)
      expect(body.messages[1].content).toMatch(/Generate structured content/)
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

  it('switches prompt copy and fallbacks to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const forwardProxy = vi.fn(async (_url: string, _method?: string, payload?: any) => {
      const body = JSON.parse(payload)
      expect(body.messages[1].content).toMatch(/请为主题 wiki 页面生成结构化内容/)

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({}),
              },
            },
          ],
        }),
        status: 200,
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
        sourceDocuments: [],
        signals: {
          coreDocuments: [],
          bridgeDocuments: [],
          propagationDocuments: [],
          orphanDocuments: [],
          risingDocuments: [],
          fallingDocuments: [],
        },
        evidence: [],
      },
    })

    expect(result).toEqual({
      overview: '暂无明显主题概览',
      keyDocuments: ['暂无关键文档建议'],
      structureObservations: ['暂无明显结构观察'],
      evidence: ['暂无明显关系证据'],
      actions: ['暂无明确整理动作'],
    })
  })
})
