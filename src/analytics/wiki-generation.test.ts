import { describe, expect, it } from 'vitest'

import type { ReferenceGraphReport, TrendReport } from './analysis'
import type { DocumentIndexProfile, PropositionItem, SourceBlockItem } from './ai-index-store'
import { buildWikiGenerationPayloads } from './wiki-generation'
import { buildWikiScope } from './wiki-scope'
import type { PluginConfig } from '@/types/config'

const config: PluginConfig = {
  showSummaryCards: true,
  showRanking: true,
  showCommunities: true,
  showOrphanBridge: true,
  showTrends: true,
  showPropagation: true,
  themeNotebookId: 'box-1',
  themeDocumentPath: '/专题',
  themeNamePrefix: '主题-',
  themeNameSuffix: '-索引',
  wikiPageSuffix: '-llm-wiki',
}

describe('wiki generation', () => {
  it('builds topic bundles from document index profiles', () => {
    const documents = [
      { id: 'theme-ai', box: 'box-1', path: '/topics/ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', name: 'AI', alias: '人工智能', tags: [], updated: '20260311120000' },
      { id: 'doc-core', box: 'box-1', path: '/notes/core.sy', hpath: '/笔记/AI 核心', title: 'AI 核心', content: 'AI 核心内容', tags: ['AI'], updated: '20260311120000' },
      { id: 'doc-bridge', box: 'box-1', path: '/notes/bridge.sy', hpath: '/笔记/AI 桥接', title: 'AI 桥接', content: '人工智能 桥接 节点', tags: ['AI'], updated: '20260312120000' },
      { id: 'doc-free', box: 'box-1', path: '/notes/free.sy', hpath: '/笔记/杂项', title: '杂项', content: '无主题', tags: [], updated: '20260311120000' },
    ] as any

    const scope = buildWikiScope({
      documents,
      config,
    })

    const report: ReferenceGraphReport = {
      summary: {
        totalDocuments: 3,
        analyzedDocuments: 3,
        totalReferences: 2,
        orphanCount: 0,
        communityCount: 1,
        dormantCount: 0,
        sparseEvidenceCount: 0,
        propagationCount: 1,
      },
      ranking: [
        { documentId: 'doc-core', title: 'AI 核心', inboundReferences: 3, distinctSourceDocuments: 2, outboundReferences: 1, lastActiveAt: '20260311120000' },
      ],
      communities: [
        { id: 'community-1', documentIds: ['doc-core', 'doc-bridge'], size: 2, hubDocumentIds: ['doc-core'], topTags: ['AI'], notebookIds: ['box-1'], missingTopicPage: false },
      ],
      bridgeDocuments: [
        { documentId: 'doc-bridge', title: 'AI 桥接', degree: 2 },
      ],
      orphans: [],
      dormantDocuments: [],
      propagationNodes: [
        { documentId: 'doc-bridge', title: 'AI 桥接', degree: 2, score: 4, pathPairCount: 2, focusDocumentCount: 2, communitySpan: 1, bridgeRole: true },
      ],
      suggestions: [],
      evidenceByDocument: {
        'doc-core': [
          {
            id: 'ref-1',
            sourceDocumentId: 'doc-bridge',
            sourceBlockId: 'blk-1',
            targetDocumentId: 'doc-core',
            targetBlockId: 'blk-2',
            content: '[[AI 核心]]',
            sourceUpdated: '20260311120000',
          },
        ],
      },
    }

    const trends: TrendReport = {
      current: { referenceCount: 2 },
      previous: { referenceCount: 1 },
      risingDocuments: [
        { documentId: 'doc-core', title: 'AI 核心', currentReferences: 3, previousReferences: 1, delta: 2 },
      ],
      fallingDocuments: [],
      connectionChanges: {
        newCount: 1,
        brokenCount: 0,
        newEdges: [{ documentIds: ['doc-bridge', 'doc-core'], referenceCount: 1 }],
        brokenEdges: [],
      },
      communityTrends: [
        { communityId: 'community-1', documentIds: ['doc-core', 'doc-bridge'], hubDocumentIds: ['doc-core'], topTags: ['AI'], currentReferences: 2, previousReferences: 1, delta: 1 },
      ],
      risingCommunities: [],
      dormantCommunities: [],
    }

    const profileMap = new Map<string, DocumentIndexProfile>([
      ['doc-core', {
        documentId: 'doc-core',
        sourceUpdatedAt: '20260311120000',
        sourceHash: 'h-core',
        title: 'AI 核心',
        path: '/notes/core.sy',
        hpath: '/笔记/AI 核心',
        tagsJson: '["AI"]',
        positioning: '解释 AI 核心概念与关键边界。',
        propositionsJson: JSON.stringify([
          { text: 'AI 的核心价值来自模式抽取与任务迁移。', sourceBlockIds: ['blk-2'] },
          { text: '核心概念页承担主题锚点角色。', sourceBlockIds: ['blk-3'] },
        ]),
        keywordsJson: JSON.stringify(['AI', '核心概念']),
        primarySourceBlocksJson: JSON.stringify([
          { blockId: 'blk-2', text: 'AI 核心定义段落' },
        ]),
        secondarySourceBlocksJson: JSON.stringify([
          { blockId: 'blk-3', text: 'AI 核心延伸说明' },
        ]),
        generatedAt: '2026-04-09T12:00:00.000Z',
      }],
      ['doc-bridge', {
        documentId: 'doc-bridge',
        sourceUpdatedAt: '20260312120000',
        sourceHash: 'h-bridge',
        title: 'AI 桥接',
        path: '/notes/bridge.sy',
        hpath: '/笔记/AI 桥接',
        tagsJson: '["AI"]',
        positioning: '连接 AI 基础概念与外部应用场景。',
        propositionsJson: JSON.stringify([
          { text: '桥接页负责把基础概念引到具体场景。', sourceBlockIds: ['blk-1'] },
        ]),
        keywordsJson: JSON.stringify(['AI', '桥接']),
        primarySourceBlocksJson: JSON.stringify([
          { blockId: 'blk-1', text: '桥接页中的引用证据' },
          { blockId: 'blk-4', text: '桥接页中的应用说明' },
        ]),
        secondarySourceBlocksJson: JSON.stringify([]),
        generatedAt: '2026-04-09T13:00:00.000Z',
      }],
    ])

    const payloads = buildWikiGenerationPayloads({
      config,
      scope,
      report,
      trends,
      documentMap: new Map(documents.map(document => [document.id, document])),
      getDocumentProfile: document => profileMap.get(document.id) ?? null,
    })

    expect(payloads.unclassifiedDocuments).toEqual([])
    expect(payloads.themes).toEqual([
      expect.objectContaining({
        themeName: 'AI',
        pageTitle: '主题-AI-索引-llm-wiki',
        sourceDocuments: [
          {
            documentId: 'doc-core',
            title: 'AI 核心',
            positioning: '解释 AI 核心概念与关键边界。',
            propositions: [
              { text: 'AI 的核心价值来自模式抽取与任务迁移。', sourceBlockIds: ['blk-2'] },
              { text: '核心概念页承担主题锚点角色。', sourceBlockIds: ['blk-3'] },
            ] satisfies PropositionItem[],
            keywords: ['AI', '核心概念'],
            primarySourceBlocks: [
              { blockId: 'blk-2', text: 'AI 核心定义段落' },
            ] satisfies SourceBlockItem[],
            secondarySourceBlocks: [
              { blockId: 'blk-3', text: 'AI 核心延伸说明' },
            ] satisfies SourceBlockItem[],
            sourceUpdatedAt: '20260311120000',
            generatedAt: '2026-04-09T12:00:00.000Z',
          },
          {
            documentId: 'doc-bridge',
            title: 'AI 桥接',
            positioning: '连接 AI 基础概念与外部应用场景。',
            propositions: [
              { text: '桥接页负责把基础概念引到具体场景。', sourceBlockIds: ['blk-1'] },
            ] satisfies PropositionItem[],
            keywords: ['AI', '桥接'],
            primarySourceBlocks: [
              { blockId: 'blk-1', text: '桥接页中的引用证据' },
              { blockId: 'blk-4', text: '桥接页中的应用说明' },
            ] satisfies SourceBlockItem[],
            secondarySourceBlocks: [] satisfies SourceBlockItem[],
            sourceUpdatedAt: '20260312120000',
            generatedAt: '2026-04-09T13:00:00.000Z',
          },
        ],
        templateSignals: {
          sourceDocumentCount: 2,
          propositionCount: 3,
          primarySourceBlockCount: 3,
          secondarySourceBlockCount: 1,
        },
        analysisSignals: {
          coreDocumentIds: ['doc-core'],
          bridgeDocumentIds: ['doc-bridge'],
          propagationDocumentIds: ['doc-bridge'],
          orphanDocumentIds: [],
          risingDocumentIds: ['doc-core'],
          fallingDocumentIds: [],
          relationshipEvidence: ['AI 桥接 -> AI 核心：[[AI 核心]]'],
        },
      }),
    ])
    expect(payloads.missingProfileDocumentIds).toEqual(['doc-free'])
  })

  it('fails loudly when a source document profile is missing', () => {
    const documents = [
      { id: 'theme-ai', box: 'box-1', path: '/topics/ai.sy', hpath: '/专题/主题-AI-索引', title: '主题-AI-索引', name: 'AI', alias: '人工智能', tags: [], updated: '20260311120000' },
      { id: 'doc-core', box: 'box-1', path: '/notes/core.sy', hpath: '/笔记/AI 核心', title: 'AI 核心', content: 'AI 核心内容', tags: ['AI'], updated: '20260311120000' },
    ] as any

    const scope = buildWikiScope({
      documents,
      config,
    })

    const emptyReport: ReferenceGraphReport = {
      summary: {
        totalDocuments: 2,
        analyzedDocuments: 2,
        totalReferences: 0,
        orphanCount: 0,
        communityCount: 0,
        dormantCount: 0,
        sparseEvidenceCount: 0,
        propagationCount: 0,
      },
      ranking: [],
      communities: [],
      bridgeDocuments: [],
      orphans: [],
      dormantDocuments: [],
      propagationNodes: [],
      suggestions: [],
      evidenceByDocument: {},
    }

    const emptyTrends: TrendReport = {
      current: { referenceCount: 0 },
      previous: { referenceCount: 0 },
      risingDocuments: [],
      fallingDocuments: [],
      connectionChanges: {
        newCount: 0,
        brokenCount: 0,
        newEdges: [],
        brokenEdges: [],
      },
      communityTrends: [],
      risingCommunities: [],
      dormantCommunities: [],
    }

    expect(() => buildWikiGenerationPayloads({
      config,
      scope,
      report: emptyReport,
      trends: emptyTrends,
      documentMap: new Map(documents.map(document => [document.id, document])),
      getDocumentProfile: () => null,
    })).toThrow(/missing document index profile/i)
  })
})
