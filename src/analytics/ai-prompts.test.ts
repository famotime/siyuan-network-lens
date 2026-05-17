import { describe, expect, it } from 'vitest'

import {
  buildAiConnectionTestPrompt,
  buildAiDocumentEvidencePrompt,
  buildAiInboxPrompt,
  buildAiLinkRewritePrompt,
  buildAiLinkSuggestionPrompt,
} from './ai-prompts'

describe('shared AI prompt registry', () => {
  it('builds versioned AI Inbox generation prompt with existing task-list constraints', () => {
    const prompt = buildAiInboxPrompt({
      payload: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        context: {
          capacity: 'compact',
          timeRange: '7d',
          dormantDays: 30,
          filters: {},
          summaryCards: [],
        },
        actionCandidates: [],
        signals: {
          ranking: [],
          orphans: [],
          dormant: [],
          bridges: [],
          propagation: [],
          communities: [],
          risingDocuments: [],
          fallingDocuments: [],
          newConnections: [],
          brokenConnections: [],
        },
      },
    })

    expect(prompt).toMatchObject({
      id: 'ai-inbox.generate',
      version: 1,
      expectedJsonSchemaName: 'AiInboxResult',
    })
    expect(prompt.messages.map(message => message.role)).toEqual(['system', 'user'])
    expect(prompt.messages[0].content).toMatch(/knowledge-organization assistant.*recommended action text.*why-this-first text/)
    expect(prompt.messages[1].content).toContain('produce one unified task list for what should be handled first today')
    expect(prompt.messages[1].content).toContain('merge recommended actions and suggestions into action')
    expect(prompt.messages[1].content).toContain('merge why-this-first plus expected gains into reason')
    expect(JSON.parse(prompt.messages[1].content.split('\n').at(-1)!)).toEqual(expect.objectContaining({
      generatedAt: '2026-05-17T00:00:00.000Z',
    }))
  })

  it('builds stable connection-test prompt', () => {
    const prompt = buildAiConnectionTestPrompt()

    expect(prompt).toMatchObject({
      id: 'ai.connection-test',
      version: 1,
    })
    expect(prompt.messages).toEqual([
      { role: 'system', content: 'You are a connection test assistant. Return OK only.' },
      { role: 'user', content: 'Reply with OK only.' },
    ])
  })

  it('builds document evidence compilation prompt with source block ids', () => {
    const prompt = buildAiDocumentEvidencePrompt({
      sourceDocument: {
        id: 'doc-1',
        box: 'box-1',
        path: '/notes/doc-1.sy',
        hpath: '/笔记/AI 索引实践',
        title: 'AI 索引实践',
        tags: ['AI', '知识管理'],
      },
      sourceBlocks: {
        primary: [
          { blockId: 'b1', text: '这是第一段证据。' },
        ],
        secondary: [
          { blockId: 'b2', text: '这是第二段证据。' },
        ],
      },
    })

    expect(prompt).toMatchObject({
      id: 'ai-document.evidence-compile',
      version: 1,
      expectedJsonSchemaName: 'EvidenceCompilationResult',
    })
    expect(prompt.messages.map(message => message.role)).toEqual(['system', 'user'])
    expect(prompt.messages[0].content).toContain('evidence compiler for a personal knowledge base')
    expect(prompt.messages[0].content).toContain('sourceBlockIds must be real block IDs')
    expect(prompt.messages[1].content).toContain('Document: AI 索引实践')
    expect(prompt.messages[1].content).toContain('Path: /笔记/AI 索引实践')
    expect(prompt.messages[1].content).toContain('Tags: AI, 知识管理')
    expect(prompt.messages[1].content).toContain('[b1] 这是第一段证据。')
    expect(prompt.messages[1].content).toContain('[b2] 这是第二段证据。')
  })

  it('builds link suggestion and rewrite prompts with locale-specific user-visible copy constraints', () => {
    const suggestionPrompt = buildAiLinkSuggestionPrompt({
      locale: 'zh_CN',
      input: {
        uiLanguage: 'zh_CN',
        sourceDocument: {
          id: 'doc-orphan',
          title: '孤立文档',
          hpath: '/孤立文档',
          tags: ['AI'],
          contentPreview: '人工智能 机器学习',
          historicalReferenceCount: 2,
          hasSparseEvidence: true,
        },
        availableThemes: [
          {
            documentId: 'doc-theme-ai',
            title: '主题-AI-索引',
            themeName: 'AI',
            matchTerms: ['AI'],
            hpath: '/专题/主题-AI-索引',
          },
        ],
        existingTags: ['AI'],
        candidates: [
          {
            id: 'doc-theme-ai',
            title: '主题-AI-索引',
            targetType: 'theme-document',
            baseScore: 0.8,
            finalScore: 0.8,
            reasons: ['主题命中'],
          },
        ],
      },
    })
    const rewritePrompt = buildAiLinkRewritePrompt({
      locale: 'zh_CN',
      result: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        summary: 'The source document matches an AI theme.',
        suggestions: [
          {
            targetDocumentId: 'doc-theme-ai',
            targetTitle: '主题-AI-索引',
            targetType: 'theme-document',
            confidence: 'medium',
            reason: 'It matches the topic page.',
          },
        ],
      },
    })

    expect(suggestionPrompt).toMatchObject({
      id: 'ai-link.suggest',
      version: 1,
      expectedJsonSchemaName: 'AiLinkSuggestionResult',
    })
    expect(suggestionPrompt.messages[0].content).toContain('link-repair assistant')
    expect(suggestionPrompt.messages[0].content).toContain('Current workspace locale is zh_CN')
    expect(suggestionPrompt.messages[0].content).toContain('Simplified Chinese')
    expect(JSON.parse(suggestionPrompt.messages[1].content)).toEqual(expect.objectContaining({
      uiLanguage: 'zh_CN',
      existingTags: ['AI'],
    }))

    expect(rewritePrompt).toMatchObject({
      id: 'ai-link.rewrite',
      version: 1,
      expectedJsonSchemaName: 'AiLinkSuggestionResult',
    })
    expect(rewritePrompt.messages[0].content).toContain('Only rewrite summary, reason, draftText, and tagSuggestions.reason')
    expect(rewritePrompt.messages[0].content).toContain('Simplified Chinese')
    expect(JSON.parse(rewritePrompt.messages[1].content)).toEqual(expect.objectContaining({
      locale: 'zh_CN',
      summary: 'The source document matches an AI theme.',
    }))
  })
})
