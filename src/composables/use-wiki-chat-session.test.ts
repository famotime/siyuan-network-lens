import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import { createWikiChatSession, type ChatMessage, type WikiChatSession } from './use-wiki-chat-session'

function makePage(id: string, title: string): WikiIndexPage {
  return { documentId: id as any, title }
}

describe('createWikiChatSession', () => {
  it('初始化空会话状态', () => {
    const session = createWikiChatSession({
      scope: ref({ mode: 'topic' } as WikiChatScope),
      wikiPages: ref([]),
      forwardProxy: vi.fn(),
      getBlockKramdown: vi.fn(),
      config: ref({
        aiBaseUrl: 'http://localhost',
        aiApiKey: 'key',
        aiModel: 'model',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 4096,
        aiTemperature: 0.7,
        aiMaxContextMessages: 1,
      }),
    })

    expect(session.session.value.messages).toEqual([])
    expect(session.session.value.currentSourcePage).toBeNull()
    expect(session.session.value.isRouting).toBe(false)
    expect(session.session.value.isLoading).toBe(false)
    expect(session.session.value.error).toBeNull()
    expect(session.inputText.value).toBe('')
    expect(session.mentionPopupVisible.value).toBe(false)
  })

  it('document 模式下 currentSourcePage 初始化为目标页面', () => {
    const targetPage = makePage('doc1', '深度学习基础-llm-wiki')
    const session = createWikiChatSession({
      scope: ref({ mode: 'document', targetPage } as WikiChatScope),
      wikiPages: ref([targetPage]),
      forwardProxy: vi.fn(),
      getBlockKramdown: vi.fn(),
      config: ref({
        aiBaseUrl: 'http://localhost',
        aiApiKey: 'key',
        aiModel: 'model',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 4096,
        aiTemperature: 0.7,
        aiMaxContextMessages: 1,
      }),
    })

    expect(session.session.value.currentSourcePage).toEqual(targetPage)
  })
})

describe('sendMessage', () => {
  it('topic 模式首次消息触发路由后问答', async () => {
    const targetPage = makePage('doc1', '深度学习基础-llm-wiki')
    const mockProxy = vi.fn()
      // 第一次调用：路由
      .mockResolvedValueOnce({ body: JSON.stringify({ choices: [{ message: { content: '深度学习基础-llm-wiki' } }] }) })
      // 第二次调用：问答
      .mockResolvedValueOnce({ body: JSON.stringify({ choices: [{ message: { content: '{"answer":"反向传播是...","referencedDocumentIds":[]}' } }] }) })
    const mockGetKramdown = vi.fn().mockResolvedValue({ id: 'doc1', kramdown: '# 深度学习' })

    const session = createWikiChatSession({
      scope: ref({ mode: 'topic' } as WikiChatScope),
      wikiPages: ref([targetPage]),
      forwardProxy: mockProxy,
      getBlockKramdown: mockGetKramdown,
      config: ref({
        aiBaseUrl: 'http://localhost',
        aiApiKey: 'key',
        aiModel: 'model',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 4096,
        aiTemperature: 0.7,
        aiMaxContextMessages: 1,
      }),
    })

    session.inputText.value = '什么是反向传播？'
    await session.sendMessage()

    // 应有：路由提示 + 用户消息 + 来源确认 + AI 回复
    const messages = session.session.value.messages
    expect(messages.length).toBeGreaterThanOrEqual(3)
    expect(messages.some(m => m.role === 'user' && m.content === '什么是反向传播？')).toBe(true)
    expect(messages.some(m => m.role === 'assistant')).toBe(true)
    expect(session.session.value.currentSourcePage).toEqual(targetPage)
    expect(mockProxy).toHaveBeenCalledTimes(2)
  })

  it('document 模式直接问答不触发路由', async () => {
    const targetPage = makePage('doc1', '深度学习基础-llm-wiki')
    const mockProxy = vi.fn()
      .mockResolvedValueOnce({ body: JSON.stringify({ choices: [{ message: { content: '{"answer":"答案","referencedDocumentIds":[]}' } }] }) })
    const mockGetKramdown = vi.fn().mockResolvedValue({ id: 'doc1', kramdown: '# 内容' })

    const session = createWikiChatSession({
      scope: ref({ mode: 'document', targetPage } as WikiChatScope),
      wikiPages: ref([targetPage]),
      forwardProxy: mockProxy,
      getBlockKramdown: mockGetKramdown,
      config: ref({
        aiBaseUrl: 'http://localhost',
        aiApiKey: 'key',
        aiModel: 'model',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 4096,
        aiTemperature: 0.7,
        aiMaxContextMessages: 1,
      }),
    })

    session.inputText.value = '问题'
    await session.sendMessage()

    expect(mockProxy).toHaveBeenCalledTimes(1) // 只调用问答，无路由
    expect(session.session.value.currentSourcePage).toEqual(targetPage)
  })

  it('后续消息保持同一来源不重新路由', async () => {
    const targetPage = makePage('doc1', '深度学习基础-llm-wiki')
    const mockProxy = vi.fn()
      .mockResolvedValueOnce({ body: JSON.stringify({ choices: [{ message: { content: '{"answer":"A1","referencedDocumentIds":[]}' } }] }) })
      .mockResolvedValueOnce({ body: JSON.stringify({ choices: [{ message: { content: '{"answer":"A2","referencedDocumentIds":[]}' } }] }) })
    const mockGetKramdown = vi.fn().mockResolvedValue({ id: 'doc1', kramdown: '# 内容' })

    const session = createWikiChatSession({
      scope: ref({ mode: 'document', targetPage } as WikiChatScope),
      wikiPages: ref([targetPage]),
      forwardProxy: mockProxy,
      getBlockKramdown: mockGetKramdown,
      config: ref({
        aiBaseUrl: 'http://localhost',
        aiApiKey: 'key',
        aiModel: 'model',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 4096,
        aiTemperature: 0.7,
        aiMaxContextMessages: 1,
      }),
    })

    session.inputText.value = '问题1'
    await session.sendMessage()
    session.inputText.value = '问题2'
    await session.sendMessage()

    expect(mockProxy).toHaveBeenCalledTimes(2) // 两次问答，无路由
    const userMsgs = session.session.value.messages.filter(m => m.role === 'user')
    expect(userMsgs.map(m => m.content)).toEqual(['问题1', '问题2'])
  })

  it('空输入不发送', async () => {
    const session = createWikiChatSession({
      scope: ref({ mode: 'topic' } as WikiChatScope),
      wikiPages: ref([]),
      forwardProxy: vi.fn(),
      getBlockKramdown: vi.fn(),
      config: ref({
        aiBaseUrl: 'http://localhost',
        aiApiKey: 'key',
        aiModel: 'model',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 4096,
        aiTemperature: 0.7,
        aiMaxContextMessages: 1,
      }),
    })

    session.inputText.value = '   '
    await session.sendMessage()
    expect(session.session.value.messages).toEqual([])
  })
})
