import { describe, expect, it } from 'vitest'
import { parseRouteResponse, parseChatResponse } from './llm-wiki-chat-service'

describe('parseRouteResponse', () => {
  it('返回 AI 选择的页面标题', () => {
    const result = parseRouteResponse('Vue 入门-llm-wiki')
    expect(result).toBe('Vue 入门-llm-wiki')
  })

  it('去除前后空白', () => {
    const result = parseRouteResponse('  Vue 入门-llm-wiki  ')
    expect(result).toBe('Vue 入门-llm-wiki')
  })

  it('空字符串返回空', () => {
    expect(parseRouteResponse('')).toBe('')
  })
})

describe('parseChatResponse', () => {
  it('解析包含引用的 JSON 响应', () => {
    const json = JSON.stringify({
      answer: 'Vue 是一个渐进式框架',
      referencedDocumentIds: ['doc1', 'doc2'],
    })
    const result = parseChatResponse(json)
    expect(result.answer).toBe('Vue 是一个渐进式框架')
    expect(result.referencedDocumentIds).toEqual(['doc1', 'doc2'])
  })

  it('纯文本作为降级回答', () => {
    const result = parseChatResponse('这是直接回答')
    expect(result.answer).toBe('这是直接回答')
    expect(result.referencedDocumentIds).toEqual([])
  })

  it('markdown fence 包裹的 JSON', () => {
    const json = '```json\n{"answer":"答案","referencedDocumentIds":[]}\n```'
    const result = parseChatResponse(json)
    expect(result.answer).toBe('答案')
  })
})
