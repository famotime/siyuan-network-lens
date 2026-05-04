import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAiWikiService } from './wiki-ai'

function buildPayload() {
  return {
    themeName: 'AI',
    pageTitle: '主题-AI-索引-llm-wiki',
    themeDocumentId: 'doc-theme-ai',
    themeDocumentTitle: '主题-AI-索引',
    sourceDocuments: [
      {
        documentId: 'doc-core',
        title: 'AI 核心',
        positioning: 'AI 核心摘要',
        propositions: [
          { text: 'AI 是模式抽取系统。', sourceBlockIds: ['blk-2'] },
        ],
        keywords: ['AI'],
        primarySourceBlocks: [
          { blockId: 'blk-2', text: 'AI 核心内容' },
        ],
        secondarySourceBlocks: [],
        sourceUpdatedAt: '20260311120000',
        generatedAt: '2026-04-09T12:00:00.000Z',
      },
    ],
    templateSignals: {
      sourceDocumentCount: 1,
      propositionCount: 1,
      primarySourceBlockCount: 1,
      secondarySourceBlockCount: 0,
    },
    analysisSignals: {
      coreDocumentIds: ['doc-core'],
      bridgeDocumentIds: [],
      propagationDocumentIds: [],
      orphanDocumentIds: [],
      risingDocumentIds: ['doc-core'],
      fallingDocumentIds: [],
      relationshipEvidence: ['AI 导航 -> AI 核心'],
    },
  }
}

function buildConfig() {
  return {
    aiEnabled: true,
    aiBaseUrl: 'https://api.example.com/v1',
    aiApiKey: 'sk-test',
    aiModel: 'gpt-4.1-mini',
  } as any
}

describe('ai wiki service', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('diagnoses template, plans page, and generates a single section with staged JSON prompts', async () => {
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
      expect(body.messages[0].content).toMatch(/Return JSON only/i)

      const userPrompt = body.messages[1].content as string
      if (userPrompt.includes('Diagnose the best wiki template')) {
        expect(userPrompt).toMatch(/AI 核心/)
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    templateType: 'tech_topic',
                    confidence: 'high',
                    reason: '主题包含技术概念与方法脉络。',
                    enabledModules: ['intro', 'highlights', 'core_principles', 'sources'],
                    suppressedModules: ['controversies'],
                    evidenceSummary: '来源文档集中在技术概念解释与结构化证据。',
                  }),
                },
              },
            ],
          }),
          status: 200,
          url,
        } as any
      }

      if (userPrompt.includes('Generate a wiki page plan')) {
        expect(userPrompt).toMatch(/tech_topic/)
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    templateType: 'tech_topic',
                    confidence: 'high',
                    coreSections: ['intro', 'highlights', 'sources'],
                    optionalSections: ['core_principles'],
                    sectionOrder: ['intro', 'highlights', 'core_principles', 'sources'],
                    sectionGoals: {
                      intro: '概括主题定位',
                      highlights: '列出关键文档与关系',
                      core_principles: '总结核心原则',
                      sources: '保留证据来源',
                    },
                    sectionFormats: {
                      intro: 'overview',
                      highlights: 'structured',
                      core_principles: 'structured',
                      sources: 'catalog',
                    },
                  }),
                },
              },
            ],
          }),
          status: 200,
          url,
        } as any
      }

      expect(userPrompt).toMatch(/Generate exactly one wiki section/i)
      expect(userPrompt).toMatch(/core_principles/)

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sectionType: 'core_principles',
                  title: '核心原则',
                  format: 'structured',
                  blocks: [
                    {
                      text: 'AI 主题的核心原则是先建立概念锚点，再补充关系证据。',
                      sourceRefs: ['blk-2'],
                    },
                  ],
                  sourceRefs: ['blk-2'],
                }),
              },
            },
          ],
        }),
        status: 200,
        url,
      } as any
    })

    const service = createAiWikiService({ forwardProxy })
    const payload = buildPayload()
    const config = buildConfig()

    const diagnosis = await service.diagnoseThemeTemplate({ config, payload })
    expect(diagnosis).toEqual({
      templateType: 'tech_topic',
      confidence: 'high',
      reason: '主题包含技术概念与方法脉络。',
      enabledModules: ['intro', 'highlights', 'core_principles', 'sources'],
      suppressedModules: ['controversies'],
      evidenceSummary: '来源文档集中在技术概念解释与结构化证据。',
    })

    const pagePlan = await service.planThemePage({ config, payload, diagnosis })
    expect(pagePlan).toEqual({
      templateType: 'tech_topic',
      confidence: 'high',
      coreSections: ['intro', 'highlights', 'sources'],
      optionalSections: ['core_principles'],
      sectionOrder: ['intro', 'highlights', 'core_principles', 'sources'],
      sectionGoals: {
        intro: '概括主题定位',
        highlights: '列出关键文档与关系',
        core_principles: '总结核心原则',
        sources: '保留证据来源',
      },
      sectionFormats: {
        intro: 'overview',
        highlights: 'structured',
        core_principles: 'structured',
        sources: 'catalog',
      },
    })

    const section = await service.generateThemeSection({
      config,
      payload,
      diagnosis,
      pagePlan,
      sectionType: 'core_principles',
    })

    expect(section).toEqual({
      sectionType: 'core_principles',
      title: '核心原则',
      format: 'structured',
      blocks: [
        {
          text: 'AI 主题的核心原则是先建立概念锚点，再补充关系证据。',
          sourceRefs: ['blk-2'],
        },
      ],
      sourceRefs: ['blk-2'],
    })

    expect(forwardProxy).toHaveBeenCalledTimes(3)
  })

  it('normalizes invalid page-plan order, keeps shared base sections, and removes suppressed modules', async () => {
    let callIndex = 0
    const forwardProxy = vi.fn(async () => {
      callIndex += 1

      if (callIndex === 1) {
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    templateType: 'tech_topic',
                    confidence: 'high',
                    reason: '主题适合技术型模板。',
                    enabledModules: ['intro', 'highlights', 'faq', 'comparison', 'sources'],
                    suppressedModules: ['faq'],
                    evidenceSummary: '存在稳定结构信号。',
                  }),
                },
              },
            ],
          }),
          status: 200,
        } as any
      }

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  templateType: 'tech_topic',
                  confidence: 'high',
                  coreSections: ['sources'],
                  optionalSections: ['faq', 'comparison', 'misunderstandings'],
                  sectionOrder: ['faq', 'comparison', 'sources', 'faq'],
                  sectionGoals: {
                    faq: '不应保留',
                    comparison: '补充对比视角',
                    sources: '保留来源证据',
                  },
                  sectionFormats: {
                    faq: 'qa',
                    comparison: 'structured',
                    sources: 'catalog',
                  },
                }),
              },
            },
          ],
        }),
        status: 200,
      } as any
    })

    const service = createAiWikiService({ forwardProxy })
    const diagnosis = await service.diagnoseThemeTemplate({
      config: buildConfig(),
      payload: buildPayload(),
    })
    const pagePlan = await service.planThemePage({
      config: buildConfig(),
      payload: buildPayload(),
      diagnosis,
    })

    expect(pagePlan.coreSections).toEqual(['intro', 'highlights', 'sources'])
    expect(pagePlan.optionalSections).toEqual(['comparison', 'misunderstandings'])
    expect(pagePlan.sectionOrder).toEqual(['intro', 'highlights', 'comparison', 'misunderstandings', 'sources'])
    expect(pagePlan.sectionOrder).not.toContain('faq')
    expect(pagePlan.sectionGoals).toEqual({
      intro: expect.stringMatching(/Fallback|回退/),
      comparison: '补充对比视角',
      sources: '保留来源证据',
    })
    expect(pagePlan.sectionFormats).toEqual({
      comparison: 'structured',
      sources: 'catalog',
    })
  })

  it('coerces the returned section type to the requested section contract', async () => {
    const forwardProxy = vi.fn(async () => ({
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sectionType: 'sources',
                title: '常见问题',
                format: 'qa',
                blocks: [
                  {
                    text: '问题 1：如何补链？',
                    sourceRefs: ['blk-2'],
                  },
                ],
                sourceRefs: ['blk-2'],
              }),
            },
          },
        ],
      }),
      status: 200,
    }) as any)

    const service = createAiWikiService({ forwardProxy })
    const section = await service.generateThemeSection({
      config: buildConfig(),
      payload: buildPayload(),
      diagnosis: {
        templateType: 'tech_topic',
        confidence: 'high',
        reason: '主题适合技术型模板。',
        enabledModules: ['intro', 'highlights', 'faq', 'sources'],
        suppressedModules: [],
        evidenceSummary: '存在稳定结构信号。',
      },
      pagePlan: {
        templateType: 'tech_topic',
        confidence: 'high',
        coreSections: ['intro', 'highlights', 'sources'],
        optionalSections: ['faq'],
        sectionOrder: ['intro', 'highlights', 'faq', 'sources'],
        sectionGoals: {
          faq: '回答高频问题',
        },
        sectionFormats: {
          faq: 'qa',
        },
      },
      sectionType: 'faq',
    })

    expect(section).toEqual({
      sectionType: 'faq',
      title: '常见问题',
      format: 'qa',
      blocks: [
        {
          text: '问题 1：如何补链？',
          sourceRefs: ['blk-2'],
        },
      ],
      sourceRefs: ['blk-2'],
    })
  })

  it('keeps the legacy whole-page section API working via staged calls', async () => {
    const forwardProxy = vi.fn(async (_url: string, _method?: string, payload?: any) => {
      const userPrompt = JSON.parse(payload).messages[1].content as string

      if (userPrompt.includes('Diagnose the best wiki template')) {
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    templateType: 'tech_topic',
                    confidence: 'medium',
                    reason: '结构信号有限，但仍偏技术主题。',
                    enabledModules: ['intro', 'highlights', 'sources'],
                    suppressedModules: ['faq'],
                    evidenceSummary: '当前仅有少量结构化资料。',
                  }),
                },
              },
            ],
          }),
          status: 200,
        } as any
      }

      if (userPrompt.includes('Generate a wiki page plan')) {
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    templateType: 'tech_topic',
                    confidence: 'medium',
                    coreSections: ['intro', 'highlights', 'sources'],
                    optionalSections: ['comparison', 'misunderstandings'],
                    sectionOrder: ['intro', 'highlights', 'comparison', 'misunderstandings', 'sources'],
                    sectionGoals: {
                      intro: '整体概括',
                      highlights: '关键资料',
                      comparison: '补充对比视角',
                      misunderstandings: '澄清常见误解',
                      sources: '汇总来源',
                    },
                    sectionFormats: {
                      intro: 'overview',
                      highlights: 'structured',
                      comparison: 'structured',
                      misunderstandings: 'qa',
                      sources: 'catalog',
                    },
                  }),
                },
              },
            ],
          }),
          status: 200,
        } as any
      }

      if (userPrompt.includes('"sectionType":"intro"')) {
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sectionType: 'intro',
                    title: '主题概览',
                    format: 'overview',
                    blocks: [
                      { text: '当前主题聚焦 AI 与机器学习的知识编排。', sourceRefs: ['blk-2'] },
                    ],
                    sourceRefs: ['blk-2'],
                  }),
                },
              },
            ],
          }),
          status: 200,
        } as any
      }

      if (userPrompt.includes('"sectionType":"highlights"')) {
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sectionType: 'highlights',
                    title: '关键文档',
                    format: 'structured',
                    blocks: [
                      { text: '优先阅读《AI 核心》', sourceRefs: ['doc-core'] },
                    ],
                    sourceRefs: ['doc-core'],
                  }),
                },
              },
            ],
          }),
          status: 200,
        } as any
      }

      if (userPrompt.includes('"sectionType":"comparison"')) {
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sectionType: 'comparison',
                    title: '结构观察',
                    format: 'structured',
                    blocks: [
                      { text: '桥接点集中在《AI 导航》。', sourceRefs: ['doc-core'] },
                    ],
                    sourceRefs: ['doc-core'],
                  }),
                },
              },
            ],
          }),
          status: 200,
        } as any
      }

      if (userPrompt.includes('"sectionType":"sources"')) {
        return {
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sectionType: 'sources',
                    title: '关系证据',
                    format: 'catalog',
                    blocks: [
                      { text: 'AI 导航 -> AI 核心', sourceRefs: ['blk-2'] },
                    ],
                    sourceRefs: ['blk-2'],
                  }),
                },
              },
            ],
          }),
          status: 200,
        } as any
      }

      return {
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sectionType: 'misunderstandings',
                  title: '整理动作',
                  format: 'qa',
                  blocks: [
                    { text: '补齐《AI 核心》的主题入口。', sourceRefs: ['doc-core'] },
                  ],
                  sourceRefs: ['doc-core'],
                }),
              },
            },
          ],
        }),
        status: 200,
      } as any
    })

    const service = createAiWikiService({ forwardProxy })
    const result = await service.generateThemeSections({
      config: buildConfig(),
      payload: buildPayload(),
    })

    expect(result).toEqual({
      overview: '当前主题聚焦 AI 与机器学习的知识编排。',
      keyDocuments: ['优先阅读《AI 核心》'],
      structureObservations: ['桥接点集中在《AI 导航》。'],
      evidence: ['AI 导航 -> AI 核心'],
      actions: ['补齐《AI 核心》的主题入口。'],
    })
  })

  it('switches prompt copy and fallbacks to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const forwardProxy = vi.fn(async (_url: string, _method?: string, payload?: any) => {
      const userPrompt = JSON.parse(payload).messages[1].content as string

      if (userPrompt.includes('最适合的模板类型')) {
        expect(userPrompt).toMatch(/请诊断当前主题 wiki 最适合的模板类型/)
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
      }

      if (userPrompt.includes('规划主题 wiki 页面结构')) {
        expect(userPrompt).toMatch(/请基于模板诊断结果规划主题 wiki 页面结构/)
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
      }

      expect(userPrompt).toMatch(/请只生成一个 wiki 章节草稿/)
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
    const payload = {
      ...buildPayload(),
      sourceDocuments: [],
      templateSignals: {
        sourceDocumentCount: 0,
        propositionCount: 0,
        primarySourceBlockCount: 0,
        secondarySourceBlockCount: 0,
      },
      analysisSignals: {
        coreDocumentIds: [],
        bridgeDocumentIds: [],
        propagationDocumentIds: [],
        orphanDocumentIds: [],
        risingDocumentIds: [],
        fallingDocumentIds: [],
        relationshipEvidence: [],
      },
    }

    const diagnosis = await service.diagnoseThemeTemplate({
      config: buildConfig(),
      payload,
    })
    const pagePlan = await service.planThemePage({
      config: buildConfig(),
      payload,
      diagnosis,
    })
    const section = await service.generateThemeSection({
      config: buildConfig(),
      payload,
      diagnosis,
      pagePlan,
      sectionType: 'intro',
    })

    expect(diagnosis).toEqual({
      templateType: 'tech_topic',
      confidence: 'low',
      reason: '回退：暂无足够证据支持明确模板判断',
      enabledModules: ['intro', 'highlights', 'sources'],
      suppressedModules: [],
      evidenceSummary: '回退：当前缺少足够的来源文档与分析信号',
    })
    expect(pagePlan).toEqual({
      templateType: 'tech_topic',
      confidence: 'low',
      coreSections: ['intro', 'highlights', 'sources'],
      optionalSections: [],
      sectionOrder: ['intro', 'highlights', 'sources'],
      sectionGoals: {
        intro: '回退：因模型未返回完整有效的页面规划，已使用保守回退规划。',
      },
      sectionFormats: {},
    })
    expect(section).toEqual({
      sectionType: 'intro',
      title: '回退：主题概览',
      format: 'overview',
      blocks: [
        {
          text: '回退：暂无明显主题概览',
          sourceRefs: [],
        },
      ],
      sourceRefs: [],
    })
  })
})
