<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import { createWikiChatSession } from '@/composables/use-wiki-chat-session'
import { createPluginLogger } from '@/utils/plugin-logger'
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
    enableConsoleLogging?: boolean
  }
}>()

const emit = defineEmits<{
  close: []
  save: [markdown: string]
}>()

const logger = createPluginLogger(() => props.config.enableConsoleLogging === true)

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
  logger,
})

const messagesRef = ref<HTMLElement>()
const inputRef = ref<HTMLTextAreaElement>()
const mentionSelectedIndex = ref(0)

// Auto-scroll to bottom on new messages
watch(() => session.value.messages.length, async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
})

// Reset mention selection when filter changes
watch(() => filteredPages.value.length, () => {
  mentionSelectedIndex.value = 0
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
  if (mentionPopupVisible.value && filteredPages.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionSelectedIndex.value = Math.min(filteredPages.value.length - 1, mentionSelectedIndex.value + 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionSelectedIndex.value = Math.max(0, mentionSelectedIndex.value - 1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const page = filteredPages.value[mentionSelectedIndex.value]
      if (page) {
        selectMention(page)
      }
      return
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function selectMention(page: WikiIndexPage) {
  switchSource(page)
  mentionSelectedIndex.value = 0
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

// --- Drag-to-move & Resize ---
const DIALOG_MIN_WIDTH = 360
const DIALOG_MIN_HEIGHT = 300
const DIALOG_DEFAULT_WIDTH = 520

const dialogWidth = ref(DIALOG_DEFAULT_WIDTH)
const dialogHeight = ref(0)
const dialogTop = ref(0)
const dialogLeft = ref(0)
const isPositioned = ref(false)

function centerDialog() {
  dialogWidth.value = DIALOG_DEFAULT_WIDTH
  dialogHeight.value = 0
  dialogLeft.value = Math.max(0, (window.innerWidth - DIALOG_DEFAULT_WIDTH) / 2)
  dialogTop.value = Math.max(0, (window.innerHeight - 600) / 2)
  isPositioned.value = true
}

onMounted(centerDialog)

// Drag state
let dragStartX = 0
let dragStartY = 0
let dragStartTop = 0
let dragStartLeft = 0

function onDragStart(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.ghost-button')) return
  e.preventDefault()
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartTop = dialogTop.value
  dragStartLeft = dialogLeft.value
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.body.style.userSelect = 'none'
}

function onDragMove(e: MouseEvent) {
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  dialogLeft.value = Math.max(0, Math.min(window.innerWidth - 100, dragStartLeft + dx))
  dialogTop.value = Math.max(0, Math.min(window.innerHeight - 60, dragStartTop + dy))
}

function onDragEnd() {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.userSelect = ''
}

// Resize state
let resizeStartX = 0
let resizeStartY = 0
let resizeStartWidth = 0
let resizeStartHeight = 0

function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  resizeStartX = e.clientX
  resizeStartY = e.clientY
  resizeStartWidth = dialogWidth.value
  resizeStartHeight = (rootRef.value?.offsetHeight ?? 600)
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.userSelect = 'none'
}

function onResizeMove(e: MouseEvent) {
  const dx = e.clientX - resizeStartX
  const dy = e.clientY - resizeStartY
  dialogWidth.value = Math.max(DIALOG_MIN_WIDTH, Math.min(window.innerWidth - dialogLeft.value - 20, resizeStartWidth + dx))
  const newHeight = Math.max(DIALOG_MIN_HEIGHT, Math.min(window.innerHeight - dialogTop.value - 20, resizeStartHeight + dy))
  dialogHeight.value = newHeight
}

function onResizeEnd() {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.userSelect = ''
}

// Escape 键关闭对话框
function onKeydownEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydownEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydownEscape)
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.userSelect = ''
})

const rootRef = ref<HTMLElement>()
</script>

<template>
  <div
    ref="rootRef"
    class="wiki-chat-dialog"
    :class="{ 'wiki-chat-dialog--positioned': isPositioned }"
    :style="{
      width: dialogWidth + 'px',
      top: dialogTop + 'px',
      left: dialogLeft + 'px',
      height: dialogHeight ? dialogHeight + 'px' : undefined,
    }"
  >
    <!-- Header -->
    <div
      class="wiki-chat-dialog__header"
      @mousedown="onDragStart"
    >
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
        {{ session.currentSourcePage?.title ?? t('llmWiki.chat.sourcePending') }}
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
          <div class="wiki-chat-dialog__avatar wiki-chat-dialog__avatar--user" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
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
          <div class="wiki-chat-dialog__avatar wiki-chat-dialog__avatar--assistant" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z"/></svg>
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
                <svg class="wiki-chat-dialog__inline-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> {{ msg.sourcePage.title }}
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
        v-for="(page, index) in filteredPages"
        :key="page.documentId"
        class="wiki-chat-dialog__mention-item"
        :class="{ 'wiki-chat-dialog__mention-item--active': index === mentionSelectedIndex }"
        @mousedown.prevent="selectMention(page)"
      >
        <svg class="wiki-chat-dialog__inline-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> {{ page.title }}
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
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
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

    <!-- Resize Handle -->
    <div
      class="wiki-chat-dialog__resize-handle"
      @mousedown="onResizeStart"
    />
  </div>
</template>

<style scoped>
.wiki-chat-dialog {
  position: fixed;
  max-height: 80vh;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: var(--z-modal, 1000);
  overflow: hidden;
}
.wiki-chat-dialog--positioned {
  /* positioned via inline style */
}

/* Header */
.wiki-chat-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
  cursor: move;
  user-select: none;
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
.wiki-chat-dialog__mention-item--active {
  background: var(--b3-theme-primary-lightest);
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

/* Resize Handle */
.wiki-chat-dialog__resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}
.wiki-chat-dialog__resize-handle::after {
  content: '';
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--b3-border-color);
  border-bottom: 2px solid var(--b3-border-color);
}

/* SVG 内联图标的对齐 */
.wiki-chat-dialog__inline-icon {
  vertical-align: -2px;
  flex-shrink: 0;
}
</style>
