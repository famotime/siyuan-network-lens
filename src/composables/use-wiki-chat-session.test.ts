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

  it('topic 模式路由使用索引摘要，不为所有候选页面读取正文', async () => {
    const pageA = { ...makePage('doc-a', '深度学习基础-llm-wiki'), summary: '介绍反向传播、梯度下降与训练流程。' }
    const pageB = { ...makePage('doc-b', '强化学习基础-llm-wiki'), summary: '介绍策略迭代、价值函数与探索利用。' }
    const mockProxy = vi.fn()
      .mockResolvedValueOnce({ body: JSON.stringify({ choices: [{ message: { content: '强化学习基础-llm-wiki' } }] }) })
      .mockResolvedValueOnce({ body: JSON.stringify({ choices: [{ message: { content: '{"answer":"强化学习关注奖励信号。","referencedDocumentIds":[]}' } }] }) })
    const mockGetKramdown = vi.fn(async (id: string) => ({ id, kramdown: `# ${id}` }))

    const session = createWikiChatSession({
      scope: ref({ mode: 'topic' } as WikiChatScope),
      wikiPages: ref([pageA, pageB]),
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

    session.inputText.value = '奖励函数和探索利用怎么理解？'
    await session.sendMessage()

    expect(session.session.value.currentSourcePage).toEqual(pageB)
    expect(mockGetKramdown).toHaveBeenCalledTimes(1)
    expect(mockGetKramdown).toHaveBeenCalledWith('doc-b')

    const routePayload = JSON.parse(mockProxy.mock.calls[0][2])
    expect(routePayload.messages[1].content).toContain('Summary: 介绍反向传播、梯度下降与训练流程。')
    expect(routePayload.messages[1].content).toContain('Summary: 介绍策略迭代、价值函数与探索利用。')
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

describe('buildSaveMarkdown', () => {
  it('生成包含所有问答的 Markdown', () => {
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

    // Simulate a conversation
    session.session.value.messages = [
      { id: '1', role: 'user', content: '什么是反向传播？', timestamp: 1000 },
      { id: '2', role: 'assistant', content: '反向传播是...', timestamp: 2000, sourcePage: targetPage, referencedDocumentIds: [] },
      { id: '3', role: 'user', content: '它和CNN的关系？', timestamp: 3000 },
      { id: '4', role: 'assistant', content: 'CNN使用反向传播...', timestamp: 4000, sourcePage: targetPage, referencedDocumentIds: [] },
    ]

    const md = session.buildSaveMarkdown()
    expect(md).toContain('Wiki AI Chat')
    expect(md).toContain('什么是反向传播？')
    expect(md).toContain('反向传播是...')
    expect(md).toContain('它和CNN的关系？')
    expect(md).toContain('CNN使用反向传播...')
    expect(md).toContain('siyuan://blocks/doc1')
  })

  it('空会话返回空字符串', () => {
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
    expect(session.buildSaveMarkdown()).toBe('')
  })
})
