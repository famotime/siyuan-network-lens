import { describe, expect, it } from 'vitest'
import { buildMaintenanceSummary, parseMaintenanceResponse } from './llm-wiki-maintain-service'

describe('parseMaintenanceResponse', () => {
  it('解析有效的 JSON 响应', () => {
    const json = JSON.stringify({
      suggestions: [
        { type: 'broken-link', description: '链接 aaa 已失效', sectionHeading: '概述' },
        { type: 'outdated-section', description: '关键文档段落过时' },
      ],
      revisedMarkdown: '# 修改后的内容',
    })
    const result = parseMaintenanceResponse(json)
    expect(result.suggestions).toHaveLength(2)
    expect(result.suggestions[0].type).toBe('broken-link')
    expect(result.revisedMarkdown).toBe('# 修改后的内容')
  })

  it('处理 markdown fence 包裹的 JSON', () => {
    const json = '```json\n{"suggestions":[],"revisedMarkdown":"内容"}\n```'
    const result = parseMaintenanceResponse(json)
    expect(result.suggestions).toHaveLength(0)
    expect(result.revisedMarkdown).toBe('内容')
  })

  it('无效 JSON 返回空建议', () => {
    const result = parseMaintenanceResponse('not json')
    expect(result.suggestions).toHaveLength(0)
    expect(result.revisedMarkdown).toBe('')
  })
})

describe('buildMaintenanceSummary', () => {
  it('无建议时返回空字符串', () => {
    expect(buildMaintenanceSummary([])).toBe('')
  })

  it('按类型统计建议数量', () => {
    const summary = buildMaintenanceSummary([
      { type: 'broken-link', description: 'a' },
      { type: 'broken-link', description: 'b' },
      { type: 'outdated-section', description: 'c' },
    ])
    expect(summary).toContain('2')
    expect(summary).toContain('1')
  })
})
