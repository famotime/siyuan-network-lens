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
