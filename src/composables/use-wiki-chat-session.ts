import { computed, ref } from 'vue'
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
  const { scope, wikiPages } = options

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
