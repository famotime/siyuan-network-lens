import { afterEach, describe, expect, it } from 'vitest'

import {
  resolveAiInboxActionTargets,
  resolveAiInboxActionLines,
  resolveAiInboxItemDocumentId,
  resolveAiInboxTargetIntent,
  splitAiInboxItemTitle,
} from './ai-inbox-detail'

describe('ai inbox detail helpers', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('resolves the primary document id from inbox items', () => {
    expect(resolveAiInboxItemDocumentId({
      documentIds: ['doc-orphan', 'doc-backup'],
    } as any)).toBe('doc-orphan')

    expect(resolveAiInboxItemDocumentId({
      documentIds: [],
    } as any)).toBe('')
  })

  it('treats theme-document target pills as direct link insert actions for document suggestions', () => {
    expect(resolveAiInboxTargetIntent(
      {
        type: 'document',
        documentIds: ['doc-orphan'],
      } as any,
      {
        documentId: 'doc-theme-ai',
        title: '主题-AI-索引',
        kind: 'theme-document',
      } as any,
    )).toEqual({
      kind: 'toggle-link',
      sourceDocumentId: 'doc-orphan',
      targetDocumentId: 'doc-theme-ai',
      targetTitle: '主题-AI-索引',
    })
  })

  it('keeps non-theme targets as open-document actions even for document suggestions', () => {
    expect(resolveAiInboxTargetIntent(
      {
        type: 'document',
        documentIds: ['doc-orphan'],
      } as any,
      {
        documentId: 'doc-core',
        title: 'AI 总览',
        kind: 'core-document',
      } as any,
    )).toEqual({
      kind: 'open-document',
      documentId: 'doc-core',
    })
  })

  it('keeps theme-document targets as open-document actions for non-document suggestions', () => {
    expect(resolveAiInboxTargetIntent(
      {
        type: 'bridge-risk',
        documentIds: ['doc-bridge'],
      } as any,
      {
        documentId: 'doc-hub',
        title: 'Hub',
        kind: 'theme-document',
      } as any,
    )).toEqual({
      kind: 'open-document',
      documentId: 'doc-hub',
    })
  })

  it('splits actionable prefixes from the real document title', () => {
    expect(splitAiInboxItemTitle('修复孤立文档：AI 与机器学习整理')).toEqual({
      prefix: '修复孤立文档：',
      documentTitle: 'AI 与机器学习整理',
    })

    expect(splitAiInboxItemTitle('Alpha')).toEqual({
      prefix: '',
      documentTitle: 'Alpha',
    })
  })

  it('sanitizes inline block references in action copy before display', () => {
    expect(resolveAiInboxActionLines('先补到主题-AI-索引。\n可归入 AI 主题：((doc-theme-ai "主题-AI-索引"))')).toEqual([
      '先补到主题-AI-索引。',
      '可归入 AI 主题：主题-AI-索引',
    ])
  })

  it('falls back to theme document pills mentioned only in action text', () => {
    expect(resolveAiInboxActionTargets({
      item: {
        action: '补到 ~OpenClaw、~Skills，并说明属于哪个主题',
      } as any,
      themeDocuments: [
        {
          documentId: 'doc-openclaw',
          title: '~OpenClaw',
          themeName: 'OpenClaw',
        },
        {
          documentId: 'doc-skills',
          title: '~Skills',
          themeName: 'Skills',
        },
      ] as any,
    })).toEqual([
      expect.objectContaining({
        documentId: 'doc-openclaw',
        title: '~OpenClaw',
        kind: 'theme-document',
        reason: 'Action text mentions topic doc OpenClaw',
      }),
      expect.objectContaining({
        documentId: 'doc-skills',
        title: '~Skills',
        kind: 'theme-document',
        reason: 'Action text mentions topic doc Skills',
      }),
    ])
  })

  it('switches fallback target reasons to Chinese when the workspace locale is zh_CN', () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    expect(resolveAiInboxActionTargets({
      item: {
        action: '补到 ~OpenClaw，并说明属于哪个主题',
      } as any,
      themeDocuments: [
        {
          documentId: 'doc-openclaw',
          title: '~OpenClaw',
          themeName: 'OpenClaw',
        },
      ] as any,
    })).toEqual([
      expect.objectContaining({
        documentId: 'doc-openclaw',
        title: '~OpenClaw',
        kind: 'theme-document',
        reason: '动作文案提及主题文档 OpenClaw',
      }),
    ])
  })
})
