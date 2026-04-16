import { afterEach, describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import AIInboxPanel from './AIInboxPanel.vue'

describe('AIInboxPanel', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('renders concrete targets, evidence, expected changes and draft text for inbox items', async () => {
    const app = createSSRApp({
      render: () => h(AIInboxPanel, {
        enabled: true,
        isConfigured: true,
        isExpanded: true,
        loading: false,
        testingConnection: false,
        error: '',
        connectionMessage: '',
        onGenerate: () => {},
        onTestConnection: () => {},
        onTogglePanel: () => {},
        openDocument: () => {},
        toggleAiLinkSuggestion: () => {},
        isAiLinkSuggestionActive: () => true,
        result: {
          generatedAt: '2026-04-03T08:00:00.000Z',
          summary: '今天先补 AI 主题连接。',
          items: [
            {
              id: 'task-doc-1',
              type: 'document',
              title: '修复孤立文档：AI 与机器学习整理',
              priority: 'P1',
              action: '先补到主题-AI-索引，再补到主题-机器学习-索引。\n可归入 AI 主题：((doc-theme-ai "主题-AI-索引"))',
              reason: '当前窗口内孤立，但和 AI 主题页、机器学习主题页都有明显匹配。能移出孤立文档，并把主题社区规模从 8 提升到 9。',
              documentIds: ['doc-1'],
              recommendedTargets: [
                {
                  documentId: 'doc-theme-ai',
                  title: '主题-AI-索引',
                  reason: '承担主题入口角色',
                  kind: 'theme-document',
                },
                {
                  documentId: 'doc-core-ai',
                  title: 'AI 总览',
                  reason: '补足相关专题归属',
                  kind: 'core-document',
                },
              ],
              evidence: ['当前窗口内孤立', '主题匹配命中 4 次'],
              expectedChanges: ['孤立文档数预计减少 1', 'AI 社区规模预计 +1'],
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Recommended action')
    expect(html).toContain('Why this first:')
    expect(html).toContain('修复孤立文档：')
    expect(html).toContain('AI 与机器学习整理')
    expect(html).toContain('先补到主题-AI-索引，再补到主题-机器学习-索引。')
    expect(html).toContain('可归入 AI 主题：主题-AI-索引')
    expect(html).toContain('当前窗口内孤立，但和 AI 主题页、机器学习主题页都有明显匹配。')
    expect(html).toContain('能移出孤立文档，并把主题社区规模从 8 提升到 9。')
    expect(html.indexOf('Recommended action')).toBeLessThan(html.indexOf('Why this first:'))
    expect(html).not.toContain('Recommended reason')
    expect(html).not.toContain('Expected gain')
    expect(html).not.toContain('Draft suggestion')
    expect(html).toContain('Suggested targets')
    expect(html).toContain('ai-inbox-panel__action-pills')
    expect(html).toContain('ai-inbox-panel__action-pill')
    expect((html.match(/ai-inbox-panel__action-pill--active/g) ?? [])).toHaveLength(1)
    expect(html).toContain('主题-AI-索引')
    expect(html).toContain('AI 总览')
    expect(html).toContain('承担主题入口角色')
    expect(html).toContain('Evidence')
    expect(html).toContain('主题匹配命中 4 次')
    expect(html).toContain('Expected changes')
    expect(html).toContain('AI 社区规模预计 +1')
    expect(html).not.toContain('doc-theme-ai')
    expect(html).not.toContain('doc-core-ai')
  })

  it('switches visible labels to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const app = createSSRApp({
      render: () => h(AIInboxPanel, {
        enabled: true,
        isConfigured: true,
        isExpanded: true,
        loading: false,
        testingConnection: false,
        error: '',
        connectionMessage: '',
        onGenerate: () => {},
        onTestConnection: () => {},
        onTogglePanel: () => {},
        openDocument: () => {},
        result: {
          generatedAt: '2026-04-03T08:00:00.000Z',
          summary: '今天先补 AI 主题连接。',
          items: [
            {
              id: 'task-doc-1',
              type: 'document',
              title: '修复孤立文档：AI 与机器学习整理',
              priority: 'P1',
              action: '先补到主题-AI-索引。',
              reason: '主题匹配明确。',
              documentIds: ['doc-1'],
              recommendedTargets: [
                {
                  documentId: 'doc-theme-ai',
                  title: '主题-AI-索引',
                  reason: '承担主题入口角色',
                  kind: 'theme-document',
                },
              ],
              evidence: ['主题匹配命中 4 次'],
              expectedChanges: ['孤立文档数预计减少 1'],
            },
          ],
        },
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('推荐动作')
    expect(html).toContain('推荐理由')
    expect(html).toContain('推荐目标')
    expect(html).toContain('证据')
    expect(html).toContain('处理后变化')
    expect(html).toContain('打开文档')
    expect(html).not.toContain('Recommended action')
  })
})
