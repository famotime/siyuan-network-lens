import { ref } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'

export interface WikiChatSavePayload {
  question: string
  answer: string
  usedPageTitle: string
  usedPageId: string
  referencedDocumentIds: string[]
}

export interface LlmWikiChatController {
  chatDialogVisible: Ref<boolean>
  chatScope: Ref<WikiChatScope | null>
  maintainDiffVisible: Ref<boolean>
  maintainTargetPage: Ref<WikiIndexPage | null>
  openChat: (scope: WikiChatScope) => void
  closeChat: () => void
  openMaintainDiff: (page: WikiIndexPage) => void
  closeMaintainDiff: () => void
}

export function createLlmWikiChatController(): LlmWikiChatController {
  const chatDialogVisible = ref(false)
  const chatScope = ref<WikiChatScope | null>(null)
  const maintainDiffVisible = ref(false)
  const maintainTargetPage = ref<WikiIndexPage | null>(null)

  function openChat(scope: WikiChatScope) {
    chatScope.value = scope
    chatDialogVisible.value = true
  }

  function closeChat() {
    chatDialogVisible.value = false
    chatScope.value = null
  }

  function openMaintainDiff(page: WikiIndexPage) {
    maintainTargetPage.value = page
    maintainDiffVisible.value = true
  }

  function closeMaintainDiff() {
    maintainDiffVisible.value = false
    maintainTargetPage.value = null
  }

  return {
    chatDialogVisible,
    chatScope,
    maintainDiffVisible,
    maintainTargetPage,
    openChat,
    closeChat,
    openMaintainDiff,
    closeMaintainDiff,
  }
}

export function buildChatSaveMarkdown(payload: WikiChatSavePayload): string {
  const parts = [
    `# ${payload.question}`,
    '',
    `> 基于 Wiki 页面：[${payload.usedPageTitle}](siyuan://blocks/${payload.usedPageId})`,
  ]
  if (payload.referencedDocumentIds.length > 0) {
    parts.push(`> 参考原始文档：${payload.referencedDocumentIds.map(id => `[${id}](siyuan://blocks/${id})`).join('、')}`)
  }
  parts.push(`> 对话时间：${new Date().toLocaleString()}`)
  parts.push('')
  parts.push(payload.answer)
  return parts.join('\n')
}
