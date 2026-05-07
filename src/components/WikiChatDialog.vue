<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import { parseRouteResponse, parseChatResponse } from '@/analytics/llm-wiki-chat-service'
import {
  buildRouteSystemPrompt,
  buildRouteUserPrompt,
  buildChatSystemPrompt,
  buildChatUserPrompt,
} from '@/analytics/llm-wiki-chat-service'
import type { WikiChatResult } from '@/analytics/llm-wiki-chat-service'
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
  }
}>()

const emit = defineEmits<{
  close: []
  save: [result: WikiChatResult & { question: string, usedPage: WikiIndexPage }]
}>()

const question = ref('')
const loading = ref(false)
const error = ref('')
const chatResult = ref<(WikiChatResult & { question: string, usedPage: WikiIndexPage }) | null>(null)

const dialogTitle = computed(() => {
  if (props.scope.mode === 'topic') {
    return t('llmWiki.chat.topicMode')
  }
  return t('llmWiki.chat.documentMode', { title: props.scope.targetPage?.title ?? '' })
})

const scopeIndicator = computed(() => {
  if (!chatResult.value) return ''
  const page = chatResult.value.usedPage
  if (chatResult.value.referencedDocumentIds.length > 0) {
    return t('llmWiki.chat.scopeWithReferences', {
      title: page.title,
      count: chatResult.value.referencedDocumentIds.length,
    })
  }
  return t('llmWiki.chat.scopeIndicator', { title: page.title })
})

async function sendQuestion() {
  if (!question.value.trim() || loading.value) return

  loading.value = true
  error.value = ''
  chatResult.value = null

  try {
    let targetPage: WikiIndexPage | undefined

    if (props.scope.mode === 'topic') {
      const pageTitles = props.wikiPages.map(p => p.title)
      const routeResponse = await callAi(
        buildRouteSystemPrompt(),
        buildRouteUserPrompt({ question: question.value, pageTitles }),
      )
      const matchedTitle = parseRouteResponse(routeResponse)
      targetPage = props.wikiPages.find(p => p.title === matchedTitle)
      if (!targetPage) {
        targetPage = props.wikiPages[0]
      }
    } else {
      targetPage = props.scope.targetPage
    }

    if (!targetPage) {
      error.value = t('llmWiki.chat.noWikiPages')
      return
    }

    const wikiBlock = await props.getBlockKramdown(targetPage.documentId)
    const chatResponse = await callAi(
      buildChatSystemPrompt(),
      buildChatUserPrompt({
        question: question.value,
        wikiPageTitle: targetPage.title,
        wikiPageMarkdown: wikiBlock.kramdown,
      }),
    )
    const parsed = parseChatResponse(chatResponse)

    chatResult.value = {
      ...parsed,
      usedPageTitle: targetPage.title,
      question: question.value,
      usedPage: targetPage,
    }
  } catch (e: any) {
    error.value = e.message ?? String(e)
  } finally {
    loading.value = false
  }
}

async function callAi(systemPrompt: string, userPrompt: string): Promise<string> {
  const endpoint = `${props.config.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
  const response = await props.forwardProxy(
    endpoint,
    'POST',
    {
      model: props.config.aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: props.config.aiMaxTokens,
      temperature: props.config.aiTemperature,
    },
    [['Authorization', `Bearer ${props.config.aiApiKey}`]],
    props.config.aiRequestTimeoutSeconds * 1000,
    'application/json',
  )
  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
  return body.choices?.[0]?.message?.content ?? ''
}

function saveResult() {
  if (chatResult.value) {
    emit('save', chatResult.value)
  }
}
</script>

<template>
  <div class="wiki-chat-dialog">
    <div class="wiki-chat-dialog__header">
      <h3>{{ dialogTitle }}</h3>
      <button @click="emit('close')">
        {{ t('llmWiki.chat.close') }}
      </button>
    </div>
    <div class="wiki-chat-dialog__body">
      <div class="wiki-chat-dialog__input-row">
        <input
          v-model="question"
          :placeholder="t('llmWiki.chat.inputPlaceholder')"
          :disabled="loading"
          @keyup.enter="sendQuestion"
        >
        <button
          :disabled="loading || !question.trim()"
          @click="sendQuestion"
        >
          {{ loading ? t('llmWiki.chat.thinking') : t('llmWiki.chat.send') }}
        </button>
      </div>
      <div
        v-if="error"
        class="wiki-chat-dialog__error"
      >
        {{ error }}
      </div>
      <div
        v-if="chatResult"
        class="wiki-chat-dialog__result"
      >
        <div class="wiki-chat-dialog__scope">
          {{ scopeIndicator }}
        </div>
        <div class="wiki-chat-dialog__question">
          {{ chatResult.question }}
        </div>
        <div class="wiki-chat-dialog__answer">
          {{ chatResult.answer }}
        </div>
      </div>
    </div>
    <div
      v-if="chatResult"
      class="wiki-chat-dialog__footer"
    >
      <button @click="saveResult">
        {{ t('llmWiki.chat.save') }}
      </button>
    </div>
  </div>
</template>
