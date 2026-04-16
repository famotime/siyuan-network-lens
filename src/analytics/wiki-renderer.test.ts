import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderThemeWikiDraft } from './wiki-renderer'

afterEach(() => {
  delete (globalThis as typeof globalThis & { siyuan?: unknown }).siyuan
  vi.resetModules()
})

describe('wiki renderer', () => {
  it('renders a stable managed markdown region and preserves a manual notes placeholder', () => {
    const rendered = renderThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 2,
      llmOutput: {
        overview: '当前主题聚焦 AI 索引和桥接维护。',
        keyDocuments: ['优先阅读 AI 核心。'],
        structureObservations: ['当前桥接点集中在 AI 桥接。'],
        evidence: ['AI 桥接 -> AI 核心 在当前窗口新增 1 条连接。'],
        actions: ['补齐 AI 桥接 到主题页的入口说明。'],
      },
    })

    expect(rendered.sectionMetadata.map(item => item.key)).toEqual([
      'meta',
      'overview',
      'keyDocuments',
      'structureObservations',
      'evidence',
      'actions',
    ])
    expect(rendered.managedMarkdown).toContain('## AI managed area')
    expect(rendered.managedMarkdown).toContain('### Page meta')
    expect(rendered.managedMarkdown).toContain('### Topic overview')
    expect(rendered.managedMarkdown).toContain('### Cleanup actions')
    expect(rendered.fullMarkdown).toContain('## Manual notes')
    expect(rendered.fullMarkdown).toContain('> Reserved for manual notes')
  })

  it('renders Chinese headings and placeholders when the workspace locale is zh_CN', async () => {
    ;(globalThis as typeof globalThis & {
      siyuan?: {
        config?: {
          lang?: string
        }
      }
    }).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    vi.resetModules()

    const { renderThemeWikiDraft: renderZhThemeWikiDraft } = await import('./wiki-renderer')

    const rendered = renderZhThemeWikiDraft({
      pageTitle: '主题-AI-索引-llm-wiki',
      pairedThemeTitle: '主题-AI-索引',
      generatedAt: '2026-04-09T12:00:00.000Z',
      model: 'gpt-4.1-mini',
      sourceDocumentCount: 2,
      llmOutput: {
        overview: '',
        keyDocuments: [],
        structureObservations: [],
        evidence: [],
        actions: [],
      },
    })

    expect(rendered.managedMarkdown).toContain('## AI 管理区')
    expect(rendered.managedMarkdown).toContain('### 页面头信息')
    expect(rendered.managedMarkdown).toContain('### 主题概览')
    expect(rendered.managedMarkdown).toContain('- 暂无内容')
    expect(rendered.fullMarkdown).toContain('## 人工备注')
    expect(rendered.fullMarkdown).toContain('> 这里保留给人工补充')
  })
})
