import { ref, watch, type Ref } from 'vue'

export function useSummaryDetailDocIndex(params: {
  showDocumentIndex: Ref<boolean>
  visibleDocumentIds: Ref<string[]>
  hasDocIndex?: (documentId: string) => Promise<boolean>
  generateDocIndex?: (documentId: string) => Promise<boolean>
  openDocIndex?: (documentId: string) => Promise<void>
  batchGenerateDocIndex?: (documentIds: string[], onProgress?: (done: number, total: number) => void) => Promise<{ success: number, failed: number }>
  batchDeleteDocIndex?: (documentIds: string[]) => Promise<number>
}) {
  const docIndexExists = ref<Record<string, boolean>>({})
  const docIndexGenerating = ref<Record<string, boolean>>({})
  const batchGenerating = ref(false)
  const batchProgress = ref({ done: 0, total: 0 })
  const batchDeleting = ref(false)

  watch(
    () => [params.showDocumentIndex.value, params.visibleDocumentIds.value.join(',')],
    async () => {
      if (!params.showDocumentIndex.value || !params.hasDocIndex) {
        docIndexExists.value = {}
        return
      }

      const next: Record<string, boolean> = {}
      for (const documentId of params.visibleDocumentIds.value) {
        next[documentId] = await params.hasDocIndex(documentId)
      }
      docIndexExists.value = next
    },
    { immediate: true },
  )

  async function handleGenerateDocIndex(documentId: string) {
    if (!params.generateDocIndex) {
      return
    }
    docIndexGenerating.value = { ...docIndexGenerating.value, [documentId]: true }
    try {
      await params.generateDocIndex(documentId)
      if (params.hasDocIndex) {
        docIndexExists.value = { ...docIndexExists.value, [documentId]: await params.hasDocIndex(documentId) }
      }
    } finally {
      const next = { ...docIndexGenerating.value }
      delete next[documentId]
      docIndexGenerating.value = next
    }
  }

  async function handleOpenDocIndex(documentId: string) {
    if (!params.openDocIndex) {
      return
    }
    await params.openDocIndex(documentId)
  }

  async function handleBatchGenerate() {
    if (!params.batchGenerateDocIndex || batchGenerating.value) {
      return
    }
    const ids = params.visibleDocumentIds.value
    if (!ids.length) {
      return
    }
    batchGenerating.value = true
    batchProgress.value = { done: 0, total: ids.length }
    try {
      const result = await params.batchGenerateDocIndex(ids, (done, total) => {
        batchProgress.value = { done, total }
      })
      if (params.hasDocIndex) {
        const next: Record<string, boolean> = { ...docIndexExists.value }
        for (const id of ids) {
          next[id] = await params.hasDocIndex(id)
        }
        docIndexExists.value = next
      }
      return result
    } finally {
      batchGenerating.value = false
    }
  }

  async function handleBatchDelete() {
    if (!params.batchDeleteDocIndex || batchDeleting.value) {
      return
    }
    const ids = params.visibleDocumentIds.value
    if (!ids.length) {
      return
    }
    batchDeleting.value = true
    try {
      await params.batchDeleteDocIndex(ids)
      docIndexExists.value = {}
    } finally {
      batchDeleting.value = false
    }
  }

  return {
    docIndexExists,
    docIndexGenerating,
    batchGenerating,
    batchProgress,
    batchDeleting,
    handleGenerateDocIndex,
    handleOpenDocIndex,
    handleBatchGenerate,
    handleBatchDelete,
  }
}
