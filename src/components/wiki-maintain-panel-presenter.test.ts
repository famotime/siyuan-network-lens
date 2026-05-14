import { describe, expect, it } from 'vitest'

import {
  buildApplyResultSummary,
  buildPreviewNoticeText,
  deltaStatusLabel,
  formatProcessingTime,
  linkTypeLabel,
  resolveConfidenceLabel,
  resolveSectionOrderLabels,
  resolveTemplateLabel,
  resolveThemeWikiDocumentId,
  sanitizeSummaryText,
  sortSourceDocMetas,
  stripMetaSection,
} from './wiki-maintain-panel-presenter'

describe('wiki-maintain-panel-presenter', () => {
  const t = (key: string, params?: Record<string, any>) => {
    if (key === 'wikiMaintain.applyRunSummary') {
      return `Created ${params?.created}, updated ${params?.updated}, skipped ${params?.skipped}, conflicted ${params?.conflict}`
    }
    const map: Record<string, string> = {
      'wikiMaintain.templateTechTopic': 'Tech topic',
      'wikiMaintain.templateProductHowto': 'Product how-to',
      'wikiMaintain.templateSocialTopic': 'Social topic',
      'wikiMaintain.templateMediaList': 'Media list',
      'wikiMaintain.confidenceHigh': 'HIGH',
      'wikiMaintain.confidenceMedium': 'MEDIUM',
      'wikiMaintain.confidenceLow': 'LOW',
      'wikiMaintain.noChanges': 'No changes',
      'wikiMaintain.deltaStatusNew': 'New',
      'wikiMaintain.deltaStatusChanged': 'Changed',
      'wikiMaintain.deltaStatusUnchanged': 'Unchanged',
      'wikiMaintain.deltaStatusDeleted': 'Deleted',
      'wikiMaintain.linkTypeOutbound': 'Outbound',
      'wikiMaintain.linkTypeInbound': 'Inbound',
      'wikiMaintain.linkTypeChild': 'Child',
    }
    return map[key] ?? key
  }

  it('builds summary and preview notices from preview metadata', () => {
    expect(buildApplyResultSummary({ counts: { created: 1, updated: 2, skipped: 3, conflict: 4 } } as any, t)).toBe('Created 1, updated 2, skipped 3, conflicted 4')
    expect(buildPreviewNoticeText([
      '- 预览不完整：部分文档被跳过',
      '- Skipped 2 source documents',
      '- 其他说明',
    ])).toBe('- 预览不完整：部分文档被跳过 - Skipped 2 source documents')

    expect(buildPreviewNoticeText([
      '- 本次 LLM Wiki 预览不是完整结果：部分来源文档在重复生成 AI 索引失败后已被跳过。',
      '  - 有 1 篇来源文档在重试 1 次后仍无法生成 AI 索引，已跳过：Beta',
    ])).toBe('- 本次 LLM Wiki 预览不是完整结果：部分来源文档在重复生成 AI 索引失败后已被跳过。 - 有 1 篇来源文档在重试 1 次后仍无法生成 AI 索引，已跳过：Beta')
  })

  it('maps labels for template, confidence, delta status and link type', () => {
    expect(resolveTemplateLabel('tech_topic', t)).toBe('Tech topic')
    expect(resolveConfidenceLabel('medium', t)).toBe('MEDIUM')
    expect(deltaStatusLabel('deleted', t)).toBe('Deleted')
    expect(linkTypeLabel('child', t)).toBe('Child')
  })

  it('sanitizes summary markdown and strips the page meta section from detail markdown', () => {
    expect(sanitizeSummaryText('### 标题 <!-- hidden --> [文档](siyuan://blocks/doc-a) ((doc-a "Alpha")) <b>bold</b>')).toBe('标题 bold')

    expect(stripMetaSection([
      '# 标题',
      '',
      '### 页面头信息',
      '- 生成时间：今天',
      '',
      '### Topic overview',
      '内容',
    ].join('\n'))).toBe([
      '### Topic overview',
      '内容',
    ].join('\n'))
  })

  it('sorts source document metas and formats processing time', () => {
    const sorted = sortSourceDocMetas([
      { deltaStatus: 'unchanged', id: 'c' },
      { deltaStatus: 'new', id: 'a' },
      { deltaStatus: 'changed', id: 'b' },
      { deltaStatus: 'deleted', id: 'd' },
    ] as any)

    expect(sorted.map(item => item.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(formatProcessingTime(320)).toBe('320ms')
    expect(formatProcessingTime(1530)).toBe('1.5s')
  })

  it('resolves section order labels and theme wiki document id', () => {
    expect(resolveSectionOrderLabels(['Topic overview', 'Sources'], t)).toBe('Topic overview, Sources')
    expect(resolveSectionOrderLabels([], t)).toBe('No changes')

    expect(resolveThemeWikiDocumentId({ pageId: 'page-1', pageTitle: 'Wiki-1' } as any, null)).toBe('page-1')
    expect(resolveThemeWikiDocumentId({ pageTitle: 'Wiki-2' } as any, {
      themePages: [{ pageTitle: 'Wiki-2', pageId: 'page-2' }],
    } as any)).toBe('page-2')
  })
})
