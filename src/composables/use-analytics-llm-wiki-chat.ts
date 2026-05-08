import { ref } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'

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
