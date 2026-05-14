import { describe, expect, it } from 'vitest'

import {
  buildAiInboxHistoryTooltip,
  buildSuggestionCalloutItems,
  hasSuggestionCallout,
  resolveAiInboxActionTargets,
  resolveAiInboxTypeLabel,
} from './summary-detail-ai-inbox'

describe('summary-detail-ai-inbox helpers', () => {
  it('detects whether a detail item should show a suggestion callout', () => {
    expect(hasSuggestionCallout({
      documentId: 'doc-a',
      title: 'Alpha',
      meta: '/Alpha',
      themeSuggestions: [],
    })).toBe(false)

    expect(hasSuggestionCallout({
      documentId: 'doc-a',
      title: 'Alpha',
      meta: '/Alpha',
      suggestions: [{ label: 'Repair links', text: '补链' }],
      themeSuggestions: [],
    })).toBe(true)
  })

  it('rewrites repair-links suggestions when topic matches are available', () => {
    const result = buildSuggestionCalloutItems({
      documentId: 'doc-a',
      title: 'Alpha',
      meta: '/Alpha',
      suggestions: [{ label: 'Repair links', text: '补到主题文档。' }],
      themeSuggestions: [{
        themeDocumentId: 'theme-a',
        themeDocumentTitle: '主题-AI-索引',
        themeName: 'AI',
        matchCount: 3,
      }],
    } as any)

    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('补到主题文档')
    expect(result[0].text).not.toContain('。')
  })

  it('maps ai inbox item types to translated labels', () => {
    expect(resolveAiInboxTypeLabel('connection')).toBe('Repair links')
    expect(resolveAiInboxTypeLabel('topic-page')).toBe('Build topic page')
    expect(resolveAiInboxTypeLabel('bridge-risk')).toBe('Bridge risk')
    expect(resolveAiInboxTypeLabel('document')).toBe('Document cleanup')
  })

  it('resolves ai inbox action targets and drops empty document ids', () => {
    const targets = resolveAiInboxActionTargets({
      item: {
        action: 'Link to 主题-AI-索引',
        recommendedTargets: [{ title: '空目标', documentId: '   ', kind: 'theme-document', reason: 'skip' }],
      },
      themeDocuments: [{
        documentId: 'theme-a',
        title: '主题-AI-索引',
        themeName: 'AI',
      }],
    } as any)

    expect(targets).toEqual([
      expect.objectContaining({
        documentId: 'theme-a',
        title: '主题-AI-索引',
      }),
    ])
  })

  it('builds a multiline tooltip for ai inbox history entries', () => {
    const tooltip = buildAiInboxHistoryTooltip({
      generatedAt: '2026-05-14T12:00:00.000Z',
      timeRange: '7d',
      summaryCount: 3,
      filters: {
        notebook: 'box-1',
        tags: ['AI', 'ML'],
        themeNames: ['主题-AI'],
        keyword: 'bridge',
      },
    } as any)

    expect(tooltip).toContain('Generated: 2026-05-14T12:00:00.000Z')
    expect(tooltip).toContain('Window: 7d')
    expect(tooltip).toContain('Count: 3')
    expect(tooltip).toContain('Notebook: box-1')
    expect(tooltip).toContain('Tags: AI / ML')
    expect(tooltip).toContain('Topics: 主题-AI')
    expect(tooltip).toContain('Keyword: bridge')
  })
})
