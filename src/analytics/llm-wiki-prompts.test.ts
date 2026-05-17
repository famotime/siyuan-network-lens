import { afterEach, describe, expect, it } from 'vitest'

import {
  buildSinglePageMaintenancePrompt,
  buildThemeDiagnosisPrompt,
  buildThemePagePlanPrompt,
  buildThemeSectionPrompt,
  buildWikiChatPrompt,
  buildWikiContextMessage,
  buildWikiRoutePrompt,
} from './llm-wiki-prompts'

function buildPayload() {
  return {
    themeName: 'AI',
    pageTitle: 'AI-llm-wiki',
    themeDocumentId: 'doc-theme',
    themeDocumentTitle: 'AI',
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
        deltaStatus: 'changed' as const,
        fullContent: '# AI 核心\n\n完整原文内容',
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

describe('llm wiki prompt registry', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('builds versioned theme generation prompts with staged ids and JSON messages', () => {
    const payload = buildPayload()
    const diagnosisPrompt = buildThemeDiagnosisPrompt({ payload })
    const planPrompt = buildThemePagePlanPrompt({
      payload,
      diagnosis: {
        templateType: 'tech_topic',
        confidence: 'high',
        reason: '技术主题',
        enabledModules: ['intro', 'highlights', 'sources'],
        suppressedModules: [],
        evidenceSummary: '证据集中',
      },
    })
    const sectionPrompt = buildThemeSectionPrompt({
      payload,
      diagnosis: {
        templateType: 'tech_topic',
        confidence: 'high',
        reason: '技术主题',
        enabledModules: ['intro', 'highlights', 'conflict', 'sources'],
        suppressedModules: [],
        evidenceSummary: '证据集中',
      },
      pagePlan: {
        templateType: 'tech_topic',
        confidence: 'high',
        coreSections: ['intro', 'highlights', 'sources'],
        optionalSections: ['conflict'],
        sectionOrder: ['intro', 'conflict', 'sources'],
        sectionGoals: {},
        sectionFormats: { conflict: 'debate' },
      },
      sectionType: 'conflict',
      existingWikiContent: '# old wiki',
    })

    expect(diagnosisPrompt).toMatchObject({
      id: 'llm-wiki.theme.diagnosis',
      version: 1,
      expectedJsonSchemaName: 'WikiTemplateDiagnosis',
    })
    expect(planPrompt).toMatchObject({
      id: 'llm-wiki.theme.plan',
      version: 1,
      expectedJsonSchemaName: 'WikiPagePlan',
    })
    expect(sectionPrompt).toMatchObject({
      id: 'llm-wiki.theme.section',
      version: 1,
      expectedJsonSchemaName: 'WikiSectionDraft',
    })
    expect(diagnosisPrompt.messages.map(message => message.role)).toEqual(['system', 'user'])
    expect(diagnosisPrompt.messages[0].content).toContain('Return JSON only')
    expect(diagnosisPrompt.messages[1].content).toContain('AI 核心')
    expect(planPrompt.messages[1].content).toContain('"diagnosis"')
    expect(sectionPrompt.messages[0].content).toContain('genuine contradictions')
    expect(sectionPrompt.messages[1].content).toContain('Existing wiki page content')
    expect(sectionPrompt.messages[1].content).toContain('完整原文内容')
    expect(sectionPrompt.messages[1].content).toContain('"sectionType":"conflict"')
  })

  it('builds Chinese maintenance prompt with broken link evidence', () => {
    const prompt = buildSinglePageMaintenancePrompt({
      wikiPageTitle: '正念-llm-wiki',
      wikiPageMarkdown: '# 正念',
      brokenLinkIds: ['20260510102559-l3tdyqz'],
      locale: 'zh_CN',
    })

    expect(prompt).toMatchObject({
      id: 'llm-wiki.page.maintenance',
      version: 1,
      expectedJsonSchemaName: 'WikiMaintenanceResult',
    })
    expect(prompt.messages[0].content).toContain('Return JSON')
    expect(prompt.messages[0].content).toContain('如果界面语言是中文')
    expect(prompt.messages[1].content).toContain('页面标题：正念-llm-wiki')
    expect(prompt.messages[1].content).toContain('确认失效的块 ID：20260510102559-l3tdyqz')
  })

  it('builds route and chat prompts with stable ids', () => {
    const routePrompt = buildWikiRoutePrompt({
      question: '反向传播是什么？',
      pageTitles: ['深度学习-llm-wiki'],
      pageSummaries: ['包含反向传播说明'],
    })
    const chatPrompt = buildWikiChatPrompt({
      question: '反向传播是什么？',
      wikiPageTitle: '深度学习-llm-wiki',
      wikiPageMarkdown: '# 深度学习\n\n反向传播是...',
      sourceDocuments: [{ id: 'doc1', title: '反向传播', markdown: 'x'.repeat(5000) }],
    })
    const context = buildWikiContextMessage({
      wikiPageTitle: '深度学习-llm-wiki',
      wikiPageMarkdown: '# 深度学习',
      sourceDocuments: [{ id: 'doc1', title: '反向传播', markdown: 'x'.repeat(5000) }],
    })

    expect(routePrompt).toMatchObject({
      id: 'llm-wiki.chat.route',
      version: 1,
    })
    expect(routePrompt.messages[1].content).toContain('Summary: 包含反向传播说明')
    expect(chatPrompt).toMatchObject({
      id: 'llm-wiki.chat.answer',
      version: 1,
      expectedJsonSchemaName: 'WikiChatResult',
    })
    expect(chatPrompt.messages[1].content).toContain('User question: 反向传播是什么？')
    expect(chatPrompt.messages[1].content.length).toBeLessThan(5600)
    expect(context).toContain('深度学习-llm-wiki')
    expect(context.length).toBeLessThan(3400)
  })
})
