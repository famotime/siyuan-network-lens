# LLM Wiki 多轮对话聊天窗口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform WikiChatDialog from a single-turn Q&A dialog into a standard multi-turn AI chat window with bubble messages, avatars, @-mention source switching, and conversation-level save.

**Architecture:** New `use-wiki-chat-session.ts` composable manages all chat state (message history, routing, @ detection, context building). WikiChatDialog.vue becomes a thin UI shell. `llm-wiki-chat-service.ts` gets a new `buildWikiContextMessage()` function. All styling uses SiYuan CSS variables.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, SiYuan CSS variables

---

### Task 1: Add i18n keys for multi-turn chat UI

**Files:**
- Modify: `src/i18n/ui.ts:2953-3011`

- [ ] **Step 1: Add new i18n keys under `llmWiki.chat`**

Open `src/i18n/ui.ts` and find the `llmWiki.chat` section (line 2953). Add the following keys after the existing `noWikiPages` entry (line 3010):

```ts
      noWikiPages: {
        en_US: 'No wiki pages found. Generate wiki pages first.',
        zh_CN: '未找到 Wiki 页面，请先生成 Wiki 页面。',
      },
      // --- new keys below ---
      sourceLabel: {
        en_US: 'Source',
        zh_CN: '来源',
      },
      switchSource: {
        en_US: 'Switch',
        zh_CN: '切换',
      },
      autoMatching: {
        en_US: 'Matching best wiki page...',
        zh_CN: '正在匹配最佳 Wiki 页面...',
      },
      sourceConfirmed: {
        en_US: 'Source: {title}',
        zh_CN: '答复来源: {title}',
      },
      sourceSwitched: {
        en_US: 'Source switched: {from} → {to}',
        zh_CN: '来源已切换: {from} → {to}',
      },
      mentionPlaceholder: {
        en_US: 'Select wiki source page',
        zh_CN: '选择 Wiki 来源页面',
      },
      inputWithMentionHint: {
        en_US: 'Ask a question... Use @ to switch source',
        zh_CN: '输入问题... 使用 @ 切换来源',
      },
      saveConversation: {
        en_US: 'Save conversation',
        zh_CN: '保存对话',
      },
      chatTitle: {
        en_US: 'Wiki AI Chat',
        zh_CN: 'Wiki AI 对话',
      },
```

- [ ] **Step 2: Verify i18n keys compile**

Run: `npx vitest run src/i18n/ui.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/i18n/ui.ts
git commit -m "feat: 多轮聊天窗口 i18n 键"
```

---

### Task 2: Add `buildWikiContextMessage` to chat service

**Files:**
- Modify: `src/analytics/llm-wiki-chat-service.ts`
- Test: `src/analytics/llm-wiki-chat-service.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/analytics/llm-wiki-chat-service.test.ts` and append:

```ts
import { buildWikiContextMessage } from './llm-wiki-chat-service'

describe('buildWikiContextMessage', () => {
  it('包含页面标题和内容', () => {
    const result = buildWikiContextMessage({
      wikiPageTitle: '深度学习基础-llm-wiki',
      wikiPageMarkdown: '# 深度学习\n\n反向传播是...',
    })
    expect(result).toContain('深度学习基础-llm-wiki')
    expect(result).toContain('# 深度学习')
    expect(result).toContain('反向传播是...')
  })

  it('包含引用源文档时截断到 3000 字符', () => {
    const longMarkdown = 'x'.repeat(5000)
    const result = buildWikiContextMessage({
      wikiPageTitle: 'Test',
      wikiPageMarkdown: 'content',
      sourceDocuments: [{ id: 'doc1', title: 'Source', markdown: longMarkdown }],
    })
    expect(result).toContain('Source')
    expect(result).toContain('doc1')
    // The source doc content should be truncated
    expect(result.length).toBeLessThan(5000 + 200) // 200 chars for headers
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analytics/llm-wiki-chat-service.test.ts`
Expected: FAIL — `buildWikiContextMessage` not exported

- [ ] **Step 3: Implement `buildWikiContextMessage`**

Open `src/analytics/llm-wiki-chat-service.ts` and add after `buildChatUserPrompt` (line 83):

```ts
export function buildWikiContextMessage(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  const parts = [
    `Wiki page: ${params.wikiPageTitle}`,
    '',
    'Wiki page content:',
    params.wikiPageMarkdown,
  ]
  if (params.sourceDocuments?.length) {
    parts.push('', 'Referenced source documents:')
    for (const doc of params.sourceDocuments) {
      parts.push(`--- Document: ${doc.title} (ID: ${doc.id}) ---`)
      parts.push(doc.markdown.slice(0, 3000))
      parts.push('')
    }
  }
  return parts.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/analytics/llm-wiki-chat-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/llm-wiki-chat-service.ts src/analytics/llm-wiki-chat-service.test.ts
git commit -m "feat: buildWikiContextMessage 用于多轮聊天上下文构建"
```

---

### Task 3: Create `use-wiki-chat-session.ts` composable — types and core state

**Files:**
- Create: `src/composables/use-wiki-chat-session.ts`
- Test: `src/composables/use-wiki-chat-session.test.ts`

- [ ] **Step 1: Write failing tests for types and state initialization**

Create `src/composables/use-wiki-chat-session.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { WikiIndexPage, WikiChatScope } from '@/analytics/wiki-index'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement types and `createWikiChatSession` factory**

Create `src/composables/use-wiki-chat-session.ts`:

```ts
import { ref, computed, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import {
  buildRouteSystemPrompt,
  buildRouteUserPrompt,
  buildChatSystemPrompt,
  buildWikiContextMessage,
  parseRouteResponse,
  parseChatResponse,
} from '@/analytics/llm-wiki-chat-service'
import { t } from '@/i18n/ui'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  sourcePage?: WikiIndexPage
  referencedDocumentIds?: string[]
  isRouting?: boolean
  sourceSwitched?: boolean
  switchFrom?: string
  switchTo?: string
}

export interface WikiChatSession {
  messages: ChatMessage[]
  currentSourcePage: WikiIndexPage | null
  isRouting: boolean
  isLoading: boolean
  error: string | null
}

export interface WikiChatSessionOptions {
  scope: Ref<WikiChatScope>
  wikiPages: Ref<WikiIndexPage[]>
  forwardProxy: (url: string, method?: string, payload?: any, headers?: any[], timeout?: number, contentType?: string) => Promise<any>
  getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
  config: Ref<{
    aiBaseUrl: string
    aiApiKey: string
    aiModel: string
    aiRequestTimeoutSeconds: number
    aiMaxTokens: number
    aiTemperature: number
    aiMaxContextMessages?: number
  }>
}

export interface WikiChatSessionController {
  session: Ref<WikiChatSession>
  inputText: Ref<string>
  mentionPopupVisible: Ref<boolean>
  mentionFilter: Ref<string>
  filteredPages: ComputedRef<WikiIndexPage[]>
  sendMessage: () => Promise<void>
  switchSource: (page: WikiIndexPage) => void
  resetSession: () => void
  buildSaveMarkdown: () => string
}

let messageIdCounter = 0
function nextMessageId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`
}

export function createWikiChatSession(options: WikiChatSessionOptions): WikiChatSessionController {
  const { scope, wikiPages, forwardProxy, getBlockKramdown, config } = options

  const initialSourcePage = scope.value.mode === 'document' ? scope.value.targetPage ?? null : null

  const session = ref<WikiChatSession>({
    messages: [],
    currentSourcePage: initialSourcePage,
    isRouting: false,
    isLoading: false,
    error: null,
  })

  const inputText = ref('')
  const mentionPopupVisible = ref(false)
  const mentionFilter = ref('')

  const filteredPages = computed(() => {
    const filter = mentionFilter.value.toLowerCase()
    return wikiPages.value
      .filter(p => p.title.toLowerCase().includes(filter))
      .slice(0, 8)
  })

  // --- @ mention detection ---
  // The component should call checkMention(cursorPos) on input events
  function checkMention(cursorPos: number) {
    const text = inputText.value
    const beforeCursor = text.slice(0, cursorPos)
    const atMatch = beforeCursor.match(/@([^@\s]*)$/)
    if (atMatch) {
      mentionFilter.value = atMatch[1]
      mentionPopupVisible.value = true
    } else {
      mentionPopupVisible.value = false
    }
  }

  function switchSource(page: WikiIndexPage) {
    const oldTitle = session.value.currentSourcePage?.title ?? ''
    inputText.value = inputText.value.replace(/@[^@\s]*\s?/, '')
    mentionPopupVisible.value = false
    session.value.currentSourcePage = page
    session.value.messages.push({
      id: nextMessageId(),
      role: 'system',
      content: t('llmWiki.chat.sourceSwitched', { from: oldTitle, to: page.title }),
      timestamp: Date.now(),
      sourceSwitched: true,
      switchFrom: oldTitle,
      switchTo: page.title,
    })
  }

  async function sendMessage(): Promise<void> {
    // stub — will be completed in Task 4
  }

  function resetSession() {
    session.value = {
      messages: [],
      currentSourcePage: scope.value.mode === 'document' ? scope.value.targetPage ?? null : null,
      isRouting: false,
      isLoading: false,
      error: null,
    }
    inputText.value = ''
    mentionPopupVisible.value = false
    mentionFilter.value = ''
  }

  function buildSaveMarkdown(): string {
    // stub — will be completed in Task 5
    return ''
  }

  return {
    session,
    inputText,
    mentionPopupVisible,
    mentionFilter,
    filteredPages,
    sendMessage,
    switchSource,
    resetSession,
    buildSaveMarkdown,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-wiki-chat-session.ts src/composables/use-wiki-chat-session.test.ts
git commit -m "feat: use-wiki-chat-session composable 核心状态与 @ 检测"
```

---

### Task 4: Implement `sendMessage` — routing and multi-turn AI calls

**Files:**
- Modify: `src/composables/use-wiki-chat-session.ts`
- Test: `src/composables/use-wiki-chat-session.test.ts`

- [ ] **Step 1: Write failing tests for sendMessage**

Append to `src/composables/use-wiki-chat-session.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: FAIL — sendMessage is a stub

- [ ] **Step 3: Implement `sendMessage`**

Replace the `sendMessage` stub in `src/composables/use-wiki-chat-session.ts` with:

```ts
  async function sendMessage(): Promise<void> {
    const text = inputText.value.trim()
    if (!text || session.value.isLoading) return

    // 1. Check for @ mention in input
    const atMatch = text.match(/@([^\s@]+)/)
    if (atMatch) {
      const mentionText = atMatch[1]
      const matchedPage = wikiPages.value.find(
        p => p.title.toLowerCase().includes(mentionText.toLowerCase()),
      )
      if (matchedPage) {
        switchSource(matchedPage)
      }
    }

    const cleanText = inputText.value.replace(/@[^\s@]+\s?/, '').trim()
    if (!cleanText) return

    // 2. Push user message
    session.value.messages.push({
      id: nextMessageId(),
      role: 'user',
      content: cleanText,
      timestamp: Date.now(),
    })
    inputText.value = ''
    session.value.error = null

    try {
      // 3. Route if needed (first message in topic mode)
      if (!session.value.currentSourcePage) {
        const routingMsgId = nextMessageId()
        session.value.messages.push({
          id: routingMsgId,
          role: 'system',
          content: t('llmWiki.chat.autoMatching'),
          timestamp: Date.now(),
          isRouting: true,
        })
        session.value.isRouting = true

        const pageTitles = wikiPages.value.map(p => p.title)
        const routeResponse = await callAiEndpoint(
          buildRouteSystemPrompt(),
          buildRouteUserPrompt({ question: cleanText, pageTitles }),
        )
        const matchedTitle = parseRouteResponse(routeResponse)
        const normalizedMatch = matchedTitle.toLowerCase().trim()
        let targetPage = wikiPages.value.find(
          p => p.title.toLowerCase().trim() === normalizedMatch,
        )
        if (!targetPage) {
          targetPage = wikiPages.value.find(
            p => p.title.toLowerCase().includes(normalizedMatch)
              || normalizedMatch.includes(p.title.toLowerCase()),
          )
        }
        if (!targetPage) {
          targetPage = wikiPages.value[0]
        }

        session.value.currentSourcePage = targetPage ?? null
        session.value.isRouting = false

        // Update routing message to confirmed
        const routingMsg = session.value.messages.find(m => m.id === routingMsgId)
        if (routingMsg && targetPage) {
          routingMsg.content = t('llmWiki.chat.sourceConfirmed', { title: targetPage.title })
          routingMsg.isRouting = false
        }
      }

      if (!session.value.currentSourcePage) {
        session.value.error = t('llmWiki.chat.noWikiPages')
        return
      }

      // 4. Fetch wiki page content
      const wikiBlock = await getBlockKramdown(session.value.currentSourcePage.documentId)

      // 5. Build context messages
      const maxContext = config.value.aiMaxContextMessages ?? 1
      const recentHistory = session.value.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-(maxContext * 2))

      const contextMessages = [
        { role: 'system' as const, content: buildChatSystemPrompt() },
        { role: 'system' as const, content: buildWikiContextMessage({
          wikiPageTitle: session.value.currentSourcePage.title,
          wikiPageMarkdown: wikiBlock.kramdown,
        }) },
        ...recentHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: cleanText },
      ]

      // 6. Call AI
      session.value.isLoading = true
      const endpoint = `${config.value.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
      const response = await forwardProxy(
        endpoint,
        'POST',
        {
          model: config.value.aiModel,
          messages: contextMessages,
          max_tokens: config.value.aiMaxTokens,
          temperature: config.value.aiTemperature,
        },
        [['Authorization', `Bearer ${config.value.aiApiKey}`]],
        config.value.aiRequestTimeoutSeconds * 1000,
        'application/json',
      )
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
      const aiContent = body.choices?.[0]?.message?.content ?? ''

      // 7. Parse and push assistant message
      const parsed = parseChatResponse(aiContent)
      session.value.messages.push({
        id: nextMessageId(),
        role: 'assistant',
        content: parsed.answer,
        timestamp: Date.now(),
        sourcePage: session.value.currentSourcePage,
        referencedDocumentIds: parsed.referencedDocumentIds,
      })
    } catch (e: any) {
      session.value.error = e.message ?? String(e)
    } finally {
      session.value.isLoading = false
    }
  }

  async function callAiEndpoint(systemPrompt: string, userPrompt: string): Promise<string> {
    const endpoint = `${config.value.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
    const response = await forwardProxy(
      endpoint,
      'POST',
      {
        model: config.value.aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.value.aiMaxTokens,
        temperature: config.value.aiTemperature,
      },
      [['Authorization', `Bearer ${config.value.aiApiKey}`]],
      config.value.aiRequestTimeoutSeconds * 1000,
      'application/json',
    )
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
    return body.choices?.[0]?.message?.content ?? ''
  }
```

Place `callAiEndpoint` as a private helper inside `createWikiChatSession`, after the `sendMessage` function.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-wiki-chat-session.ts src/composables/use-wiki-chat-session.test.ts
git commit -m "feat: sendMessage 实现两步路由与多轮上下文 AI 调用"
```

---

### Task 5: Implement `buildSaveMarkdown` for conversation-level save

**Files:**
- Modify: `src/composables/use-wiki-chat-session.ts`
- Test: `src/composables/use-wiki-chat-session.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/composables/use-wiki-chat-session.test.ts`:

```ts
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
    expect(md).toContain('Wiki AI 对话记录')
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: FAIL — buildSaveMarkdown returns empty string

- [ ] **Step 3: Implement `buildSaveMarkdown`**

Replace the `buildSaveMarkdown` stub in `src/composables/use-wiki-chat-session.ts`:

```ts
  function buildSaveMarkdown(): string {
    const msgs = session.value.messages
    const userMsgs = msgs.filter(m => m.role === 'user')
    if (userMsgs.length === 0) return ''

    const firstQuestion = userMsgs[0].content.slice(0, 30)
    const initialSource = session.value.currentSourcePage?.title ?? ''
    const now = new Date().toLocaleString()
    const lines: string[] = [
      `# ${t('llmWiki.chat.chatTitle')}`,
      `> ${t('llmWiki.chat.sourceLabel')}: ${initialSource}`,
      `> ${now}`,
      '',
      '---',
    ]

    let qIndex = 0
    for (const msg of msgs) {
      if (msg.role === 'user') {
        qIndex++
        lines.push('')
        lines.push(`## Q${qIndex}: ${msg.content}`)
      } else if (msg.role === 'assistant') {
        if (msg.sourcePage) {
          lines.push('')
          lines.push(`> 📄 ${t('llmWiki.chat.sourceLabel')}: [${msg.sourcePage.title}](siyuan://blocks/${msg.sourcePage.documentId})`)
        }
        lines.push('')
        lines.push(msg.content)
        lines.push('')
        lines.push('---')
      }
    }

    return lines.join('\n')
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-wiki-chat-session.ts src/composables/use-wiki-chat-session.test.ts
git commit -m "feat: buildSaveMarkdown 对话级保存格式"
```

---

### Task 6: Update `use-analytics-llm-wiki-chat.ts` controller

**Files:**
- Modify: `src/composables/use-analytics-llm-wiki-chat.ts`

- [ ] **Step 1: Add `aiMaxContextMessages` to config subset and remove `buildChatSaveMarkdown`**

Open `src/composables/use-analytics-llm-wiki-chat.ts`. The `buildChatSaveMarkdown` function (lines 61-74) and `WikiChatSavePayload` interface (lines 4-10) will be superseded by the session composable's `buildSaveMarkdown`. Keep them for now (App.vue still imports them) but mark them as deprecated — they will be removed when App.vue is updated in Task 8.

No code changes needed in this task — the controller's `openChat`/`closeChat`/scope management remain as-is. The session composable is instantiated inside WikiChatDialog.vue, not here.

- [ ] **Step 2: Commit (no-op)**

This task is a checkpoint — no code changes. Proceed to Task 7.

---

### Task 7: Rewrite `WikiChatDialog.vue` — template and UI

**Files:**
- Modify: `src/components/WikiChatDialog.vue`

- [ ] **Step 1: Rewrite the component**

Replace the entire content of `src/components/WikiChatDialog.vue` with:

```vue
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import { createWikiChatSession } from '@/composables/use-wiki-chat-session'
import { t } from '@/i18n/ui'

const props = defineProps<{
  scope: WikiChatScope
  wikiPages: WikiIndexPage[]
  forwardProxy: (url: string, method?: string, payload?: any, headers?: any[], timeout?: number, contentType?: string) => Promise<any>
  getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
  config: {
    aiBaseUrl: string
    aiApiKey: string
    aiModel: string
    aiRequestTimeoutSeconds: number
    aiMaxTokens: number
    aiTemperature: number
    aiMaxContextMessages?: number
  }
}>()

const emit = defineEmits<{
  close: []
  save: [markdown: string]
}>()

const {
  session,
  inputText,
  mentionPopupVisible,
  filteredPages,
  sendMessage,
  switchSource,
  buildSaveMarkdown,
} = createWikiChatSession({
  scope: ref(props.scope),
  wikiPages: ref(props.wikiPages),
  forwardProxy: props.forwardProxy,
  getBlockKramdown: props.getBlockKramdown,
  config: ref(props.config),
})

const messagesRef = ref<HTMLElement>()
const inputRef = ref<HTMLTextAreaElement>()

// Auto-scroll to bottom on new messages
watch(() => session.value.messages.length, async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
})

// @ mention detection on input
function handleInput() {
  const textarea = inputRef.value
  if (!textarea) return
  const cursorPos = textarea.selectionStart ?? inputText.value.length
  const beforeCursor = inputText.value.slice(0, cursorPos)
  const atMatch = beforeCursor.match(/@([^@\s]*)$/)
  if (atMatch) {
    mentionPopupVisible.value = true
  } else {
    mentionPopupVisible.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function selectMention(page: WikiIndexPage) {
  switchSource(page)
  inputRef.value?.focus()
}

function handleSave() {
  const md = buildSaveMarkdown()
  if (md) {
    emit('save', md)
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="wiki-chat-dialog">
    <!-- Header -->
    <div class="wiki-chat-dialog__header">
      <h3>{{ t('llmWiki.chat.chatTitle') }}</h3>
      <button
        class="ghost-button"
        @click="emit('close')"
      >
        {{ t('llmWiki.chat.close') }}
      </button>
    </div>

    <!-- Source Bar -->
    <div class="wiki-chat-dialog__source-bar">
      <span class="wiki-chat-dialog__source-tag">
        {{ t('llmWiki.chat.sourceLabel') }}
      </span>
      <span class="wiki-chat-dialog__source-title">
        {{ session.currentSourcePage?.title ?? t('llmWiki.chat.autoMatching') }}
      </span>
    </div>

    <!-- Messages -->
    <div
      ref="messagesRef"
      class="wiki-chat-dialog__messages"
    >
      <div
        v-for="msg in session.messages"
        :key="msg.id"
      >
        <!-- System hint -->
        <div
          v-if="msg.role === 'system'"
          class="wiki-chat-dialog__system-hint"
        >
          {{ msg.content }}
        </div>

        <!-- User bubble -->
        <div
          v-else-if="msg.role === 'user'"
          class="wiki-chat-dialog__bubble wiki-chat-dialog__bubble--user"
        >
          <div class="wiki-chat-dialog__avatar wiki-chat-dialog__avatar--user">
            &#x1f464;
          </div>
          <div class="wiki-chat-dialog__bubble-body">
            <div class="wiki-chat-dialog__bubble-content wiki-chat-dialog__bubble-content--user">
              {{ msg.content }}
            </div>
            <div class="wiki-chat-dialog__bubble-time">
              {{ formatTime(msg.timestamp) }}
            </div>
          </div>
        </div>

        <!-- Assistant bubble -->
        <div
          v-else
          class="wiki-chat-dialog__bubble wiki-chat-dialog__bubble--assistant"
        >
          <div class="wiki-chat-dialog__avatar wiki-chat-dialog__avatar--assistant">
            &#x1f916;
          </div>
          <div class="wiki-chat-dialog__bubble-body">
            <div class="wiki-chat-dialog__bubble-content wiki-chat-dialog__bubble-content--assistant">
              {{ msg.content }}
            </div>
            <div class="wiki-chat-dialog__bubble-meta">
              <span>{{ formatTime(msg.timestamp) }}</span>
              <span
                v-if="msg.sourcePage"
                class="wiki-chat-dialog__source-badge"
              >
                &#x1f4c4; {{ msg.sourcePage.title }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div
        v-if="session.isLoading"
        class="wiki-chat-dialog__system-hint"
      >
        {{ t('llmWiki.chat.thinking') }}
      </div>

      <!-- Error -->
      <div
        v-if="session.error"
        class="wiki-chat-dialog__error"
      >
        {{ session.error }}
      </div>
    </div>

    <!-- @ Mention Popup -->
    <div
      v-if="mentionPopupVisible && filteredPages.length > 0"
      class="wiki-chat-dialog__mention-popup"
    >
      <div class="wiki-chat-dialog__mention-header">
        {{ t('llmWiki.chat.mentionPlaceholder') }}
      </div>
      <div
        v-for="page in filteredPages"
        :key="page.documentId"
        class="wiki-chat-dialog__mention-item"
        @mousedown.prevent="selectMention(page)"
      >
        &#x1f4c4; {{ page.title }}
      </div>
    </div>

    <!-- Input Area -->
    <div class="wiki-chat-dialog__input-area">
      <textarea
        ref="inputRef"
        v-model="inputText"
        :placeholder="t('llmWiki.chat.inputWithMentionHint')"
        :disabled="session.isLoading"
        rows="1"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <button
        class="wiki-chat-dialog__send-btn"
        :disabled="session.isLoading || !inputText.trim()"
        @click="sendMessage"
      >
        &#x27a4;
      </button>
    </div>

    <!-- Footer -->
    <div
      v-if="session.messages.some(m => m.role === 'assistant')"
      class="wiki-chat-dialog__footer"
    >
      <button
        class="action-button"
        @click="handleSave"
      >
        {{ t('llmWiki.chat.saveConversation') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.wiki-chat-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 520px;
  max-height: 80vh;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
}

/* Header */
.wiki-chat-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
}
.wiki-chat-dialog__header h3 {
  margin: 0;
  font-size: 1em;
}

/* Source Bar */
.wiki-chat-dialog__source-bar {
  padding: 6px 16px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px solid var(--b3-border-color);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.wiki-chat-dialog__source-tag {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.wiki-chat-dialog__source-title {
  color: var(--b3-theme-on-surface-light);
  font-weight: 500;
}

/* Messages */
.wiki-chat-dialog__messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}

/* System hint */
.wiki-chat-dialog__system-hint {
  text-align: center;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  padding: 4px 0;
}

/* Bubble base */
.wiki-chat-dialog__bubble {
  display: flex;
  gap: 8px;
}
.wiki-chat-dialog__bubble--user {
  flex-direction: row-reverse;
}

/* Avatar */
.wiki-chat-dialog__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.wiki-chat-dialog__avatar--user {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
}
.wiki-chat-dialog__avatar--assistant {
  background: var(--b3-theme-success);
  color: var(--b3-theme-on-primary, #fff);
}

/* Bubble body */
.wiki-chat-dialog__bubble-body {
  max-width: 75%;
}
.wiki-chat-dialog__bubble--user .wiki-chat-dialog__bubble-body {
  text-align: right;
}

/* Bubble content */
.wiki-chat-dialog__bubble-content {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.6;
  display: inline-block;
  text-align: left;
  word-break: break-word;
}
.wiki-chat-dialog__bubble-content--user {
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-on-surface);
  border-radius: 16px 16px 4px 16px;
}
.wiki-chat-dialog__bubble-content--assistant {
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-on-surface);
  border-radius: 16px 16px 16px 4px;
}

/* Bubble meta */
.wiki-chat-dialog__bubble-time {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  margin-top: 4px;
}
.wiki-chat-dialog__bubble-meta {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.wiki-chat-dialog__source-badge {
  background: var(--b3-theme-success);
  color: var(--b3-theme-on-primary, #fff);
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 10px;
}

/* Error */
.wiki-chat-dialog__error {
  color: var(--b3-theme-error);
  text-align: center;
  font-size: 12px;
  padding: 8px;
}

/* Mention Popup */
.wiki-chat-dialog__mention-popup {
  margin: 0 16px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  overflow: hidden;
  font-size: 12px;
}
.wiki-chat-dialog__mention-header {
  padding: 6px 12px;
  color: var(--b3-theme-on-surface-light);
  font-size: 11px;
  border-bottom: 1px solid var(--b3-border-color);
}
.wiki-chat-dialog__mention-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.wiki-chat-dialog__mention-item:hover {
  background: var(--b3-theme-surface-light);
}

/* Input Area */
.wiki-chat-dialog__input-area {
  padding: 12px 16px;
  background: var(--b3-theme-background);
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.wiki-chat-dialog__input-area textarea {
  flex: 1;
  background: var(--b3-theme-surface-light);
  border: 1px solid var(--b3-border-color);
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  resize: none;
  font-family: inherit;
  line-height: 1.4;
  min-height: 20px;
  max-height: 100px;
}
.wiki-chat-dialog__input-area textarea::placeholder {
  color: var(--b3-theme-on-surface-light);
}
.wiki-chat-dialog__send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border: 0;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wiki-chat-dialog__send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Footer */
.wiki-chat-dialog__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.action-button,
.ghost-button {
  border: 0;
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s;
}
.action-button {
  min-width: 108px;
  padding: 10px 18px;
  border-radius: 8px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
}
.ghost-button {
  min-width: auto;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 8%, transparent);
  color: var(--b3-theme-primary);
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`
Expected: No errors related to WikiChatDialog

- [ ] **Step 3: Commit**

```bash
git add src/components/WikiChatDialog.vue
git commit -m "feat: WikiChatDialog 重写为多轮聊天窗口 UI"
```

---

### Task 8: Update `App.vue` — adapt props and save handler

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Update WikiChatDialog usage in template**

In `src/App.vue`, find the `WikiChatDialog` template block (around line 246). Update the props to pass `aiMaxContextMessages` and change the `@save` handler:

```vue
    <WikiChatDialog
      v-if="llmWikiChatDialogVisible && llmWikiChatScope"
      :scope="llmWikiChatScope"
      :wiki-pages="llmWikiPages"
      :forward-proxy="forwardProxy"
      :get-block-kramdown="getBlockKramdown"
      :config="{
        aiBaseUrl: props.config.aiBaseUrl ?? '',
        aiApiKey: props.config.aiApiKey ?? '',
        aiModel: props.config.aiModel ?? '',
        aiRequestTimeoutSeconds: props.config.aiRequestTimeoutSeconds ?? 60,
        aiMaxTokens: props.config.aiMaxTokens ?? 4096,
        aiTemperature: props.config.aiTemperature ?? 0.7,
        aiMaxContextMessages: props.config.aiMaxContextMessages ?? 1,
      }"
      @close="closeLlmWikiChat"
      @save="handleLlmWikiChatSave"
    />
```

- [ ] **Step 2: Update `handleLlmWikiChatSave` for conversation-level save**

Replace the `handleLlmWikiChatSave` function (around line 480):

```ts
async function handleLlmWikiChatSave(markdown: string) {
  const firstLine = markdown.split('\n').find(l => l.startsWith('## Q1:'))?.slice(6) ?? 'Wiki AI Chat'
  const title = firstLine.slice(0, 30)
  const containerName = props.config.wikiContainerName ?? 'LLM Wiki'
  const chatPath = `/${containerName}/Chat/${title}`
  const notebooks = snapshot.value?.notebooks ?? []
  const wikiNotebook = notebooks.find(nb => !nb.closed)
  if (!wikiNotebook) return
  try {
    const chatDocId = await createDocWithMd(wikiNotebook.id, chatPath, markdown)
    if (chatDocId) {
      // Find the first assistant message's source page for back-link
      const firstAssistant = llmWikiChatScope.value?.mode === 'document'
        ? llmWikiChatScope.value.targetPage
        : null
      if (firstAssistant) {
        const refLink = `[${title}](siyuan://blocks/${chatDocId})`
        await appendBlock(firstAssistant.documentId, 'markdown', refLink)
      }
    }
  } catch {
    // silently handle save errors
  }
}
```

- [ ] **Step 3: Remove unused imports**

In the `<script>` imports section (around line 282-283), remove the now-unused imports:

```ts
// Remove these lines:
import type { WikiChatResult } from '@/analytics/llm-wiki-chat-service'
import { buildChatSaveMarkdown } from '@/composables/use-analytics-llm-wiki-chat'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.vue
git commit -m "feat: App.vue 适配多轮聊天窗口 props 与对话级保存"
```

---

### Task 9: Clean up deprecated code

**Files:**
- Modify: `src/composables/use-analytics-llm-wiki-chat.ts`

- [ ] **Step 1: Remove `buildChatSaveMarkdown` and `WikiChatSavePayload`**

Open `src/composables/use-analytics-llm-wiki-chat.ts` and remove lines 4-10 (`WikiChatSavePayload` interface) and lines 61-74 (`buildChatSaveMarkdown` function).

The file should now only contain the controller interface and factory.

- [ ] **Step 2: Verify no remaining references**

Run: `npx grep -r "buildChatSaveMarkdown\|WikiChatSavePayload" src/ --include="*.ts" --include="*.vue"`
Expected: No matches

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/composables/use-analytics-llm-wiki-chat.ts
git commit -m "refactor: 移除已废弃的 buildChatSaveMarkdown"
```

---

### Task 10: Final integration test and lint

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run linter**

Run: `npx eslint src/composables/use-wiki-chat-session.ts src/components/WikiChatDialog.vue src/App.vue src/analytics/llm-wiki-chat-service.ts`
Expected: No errors (warnings OK)

- [ ] **Step 3: Run type check**

Run: `npx vue-tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit any lint fixes**

If linter reported issues, fix them and commit:
```bash
git add -u
git commit -m "fix: lint 修复"
```
