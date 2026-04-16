import { describe, expect, it } from 'vitest'

import { buildWikiPreview, fingerprintWikiContent } from './wiki-diff'
import type { WikiPageSnapshotRecord } from './wiki-store'

const nextDraft = {
  managedMarkdown: [
    '# 主题-AI-索引-llm-wiki',
    '',
    '## AI 管理区',
    '',
    '### 页面头信息',
    '- 配对主题页：主题-AI-索引',
    '',
    '### 主题概览',
    '新的概览',
    '',
    '### 关键文档',
    '- AI 核心',
  ].join('\n'),
  fullMarkdown: 'unused',
  sectionMetadata: [
    { key: 'meta', heading: '页面头信息', markdown: '- 配对主题页：主题-AI-索引' },
    { key: 'overview', heading: '主题概览', markdown: '新的概览' },
    { key: 'keyDocuments', heading: '关键文档', markdown: '- AI 核心' },
  ],
}

describe('wiki diff', () => {
  it('marks a missing page as create and exposes affected sections', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
    })

    expect(preview.status).toBe('create')
    expect(preview.affectedSections).toEqual(['meta', 'overview', 'keyDocuments'])
    expect(preview.sourceDocumentCount).toBe(2)
    expect(preview.oldSummary).toBe('')
    expect(preview.newSummary).toContain('新的概览')
  })

  it('marks an unchanged page when the current managed region already matches the next draft', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: nextDraft.managedMarkdown,
      },
    })

    expect(preview.status).toBe('unchanged')
    expect(preview.affectedSections).toEqual([])
  })

  it('marks a changed page as update and limits affected sections to real section changes', () => {
    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI 管理区',
          '',
          '### 页面头信息',
          '- 配对主题页：主题-AI-索引',
          '',
          '### 主题概览',
          '旧概览',
          '',
          '### 关键文档',
          '- AI 核心',
        ].join('\n'),
      },
    })

    expect(preview.status).toBe('update')
    expect(preview.affectedSections).toEqual(['overview'])
  })

  it('marks a page as conflict when the live managed fingerprint diverges from the last applied fingerprint', () => {
    const storedRecord: WikiPageSnapshotRecord = {
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      lastApply: {
        appliedAt: '2026-04-09T11:00:00.000Z',
        result: 'updated',
        sourceDocumentIds: ['doc-1', 'doc-2'],
        managedFingerprint: fingerprintWikiContent('old-managed'),
      },
    }

    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: '主题-AI-索引-llm-wiki',
      sourceDocumentIds: ['doc-1', 'doc-2'],
      generatedAt: '2026-04-09T12:00:00.000Z',
      nextDraft,
      existingPage: {
        managedMarkdown: 'live-managed',
      },
      storedRecord,
    })

    expect(preview.status).toBe('conflict')
    expect(preview.conflictReason).toContain('The current AI managed area')
  })
})
