import { describe, expect, it } from 'vitest'
import { buildMaintenanceSummary, buildMaintenanceSystemPrompt, buildMaintenanceUserPrompt, parseMaintenanceResponse } from './llm-wiki-maintain-service'

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

  it('将 LLM 返回的建议类型别名归一化为稳定类型', () => {
    const json = JSON.stringify({
      suggestions: [
        { type: 'outdated', description: '概述需要更新' },
        { type: 'broken_link', description: '链接已失效' },
        { type: 'missing_reference', description: '引用缺失' },
      ],
      revisedMarkdown: '# 修改后的内容',
    })
    const result = parseMaintenanceResponse(json)
    expect(result.suggestions).toEqual([
      { type: 'outdated-section', description: '概述需要更新', sectionHeading: undefined },
      { type: 'broken-link', description: '链接已失效', sectionHeading: undefined },
      { type: 'missing-reference', description: '引用缺失', sectionHeading: undefined },
    ])
  })

  it('本地化英文描述兜底为中文', () => {
    const result = parseMaintenanceResponse(JSON.stringify({
      suggestions: [
        { type: 'outdated-section', description: "The page indicates 8 source documents in the header, but only 7 are cited in the content. The 'AI managed area' section's 'source count' metadata should be verified against the actual number of cited sources." },
        { type: 'missing-reference', description: 'Source document "What is the purpose of meditation? — From the wisdom of the sea" (ID: 20260510102559-l3tdyqz) is listed in the reference section but is not cited in the page content. Consider adding relevant citations from this source where appropriate.' },
      ],
      revisedMarkdown: '# 修改后的内容',
    }), 'zh_CN')

    expect(result.suggestions[0].description).toContain('页面头部显示有 8 篇来源文档')
    expect(result.suggestions[1].description).toContain('来源文档「What is the purpose of meditation? — From the wisdom of the sea」')
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

describe('buildMaintenancePrompt', () => {
  it('要求 LLM 输出中文维护建议', () => {
    expect(buildMaintenanceSystemPrompt()).toContain('如果界面语言是中文')
    expect(buildMaintenanceSystemPrompt()).toContain('Return JSON')

    const prompt = buildMaintenanceUserPrompt({
      wikiPageTitle: '正念与冥想概述-llm-wiki',
      wikiPageMarkdown: '# content',
      brokenLinkIds: ['abc'],
      locale: 'zh_CN',
    })
    expect(prompt).toContain('页面标题')
    expect(prompt).toContain('确认失效的块 ID')
  })
})
