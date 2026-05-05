import type { ComputedRef } from 'vue'

import { ensureDocumentIndex } from '@/analytics/ai-document-summary'
import type { DocumentRecord } from '@/analytics/analysis'
import type { AiDocumentIndexStore, DocumentIndexProfile } from '@/analytics/ai-index-store'
import { t } from '@/i18n/ui'
import type { PluginConfig } from '@/types/config'

type ShowMessageFn = (text: string, timeout?: number, type?: 'info' | 'error') => void
type OpenDocumentFn = (documentId: string) => void
type CreateDocWithMdFn = (notebook: string, path: string, markdown: string) => Promise<string>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string, subtype?: string }>>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>
type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type DocumentIndexControllerConfig = Pick<PluginConfig, 'aiModel'>

export function createAnalyticsDocumentIndexController(params: {
  documentMap: ComputedRef<Map<string, DocumentRecord>>
  notebookOptions: ComputedRef<Array<{ id: string, name: string }>>
  appliedConfig: ComputedRef<PluginConfig>
  aiIndexStore: AiDocumentIndexStore | null
  forwardProxy?: ForwardProxyFn
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
  createDocWithMd?: CreateDocWithMdFn
  notify: ShowMessageFn
  openDocument: OpenDocumentFn
}) {
  async function generateDocIndex(documentId: string): Promise<boolean> {
    const document = params.documentMap.value.get(documentId)
    if (!document) {
      params.notify(t('analytics.controller.documentNotFound'), 3000, 'error')
      return false
    }

    if (!params.aiIndexStore || !params.forwardProxy) {
      params.notify(t('analytics.docSummary.aiRequired'), 3000, 'error')
      return false
    }

    try {
      const result = await ensureDocumentIndex({
        config: params.appliedConfig.value,
        sourceDocument: document,
        indexStore: params.aiIndexStore,
        forwardProxy: params.forwardProxy,
        getChildBlocks: params.getChildBlocks,
        getBlockKramdown: params.getBlockKramdown,
        force: true,
      })
      params.notify(t('analytics.controller.docIndexGenerated'), 2000)
      return !result.fromCache
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.docIndexGenerateFailed')
      params.notify(message, 3000, 'error')
      return false
    }
  }

  async function hasDocIndex(documentId: string): Promise<boolean> {
    if (!params.aiIndexStore) {
      return false
    }
    const profile = await params.aiIndexStore.getDocumentProfile(documentId)
    return profile !== null && Boolean(profile.positioning)
  }

  async function getDocIndexProfile(documentId: string): Promise<DocumentIndexProfile | null> {
    if (!params.aiIndexStore) {
      return null
    }
    return params.aiIndexStore.getDocumentProfile(documentId)
  }

  async function openDocIndex(documentId: string): Promise<void> {
    const profile = await getDocIndexProfile(documentId)
    if (!profile) {
      params.notify(t('analytics.controller.docIndexNotFound'), 3000, 'error')
      return
    }

    const firstNotebook = params.notebookOptions.value[0]
    if (!firstNotebook || !params.createDocWithMd) {
      params.notify(t('analytics.controller.docIndexCreateFailed'), 3000, 'error')
      return
    }

    const documentTitle = profile.title || documentId
    const title = `📑 ${t('summaryDetail.documentIndex.viewTitle', { title: documentTitle })}`
    const safeName = title.replace(/[/:*?"<>|\\]/g, '_')
    const docPath = `/索引/${safeName}`
    const markdown = buildDocumentIndexViewMarkdown({
      profile,
      fallbackTitle: documentId,
      config: params.appliedConfig.value,
    })

    try {
      const newDocId = await params.createDocWithMd(firstNotebook.id, docPath, markdown)
      params.openDocument(newDocId)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.docIndexCreateFailed')
      params.notify(message, 3000, 'error')
    }
  }

  async function batchGenerateDocIndex(
    documentIds: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ success: number, failed: number }> {
    let success = 0
    let failed = 0

    for (let index = 0; index < documentIds.length; index += 1) {
      try {
        const result = await generateDocIndex(documentIds[index])
        if (result) {
          success += 1
        } else {
          failed += 1
        }
      } catch {
        failed += 1
      }
      onProgress?.(index + 1, documentIds.length)
    }

    return { success, failed }
  }

  async function batchDeleteDocIndex(documentIds: string[]): Promise<number> {
    if (!params.aiIndexStore) {
      return 0
    }
    await params.aiIndexStore.deleteDocumentIndex(documentIds)
    return documentIds.length
  }

  return {
    generateDocIndex,
    hasDocIndex,
    getDocIndexProfile,
    openDocIndex,
    batchGenerateDocIndex,
    batchDeleteDocIndex,
  }
}

export function buildDocumentIndexViewMarkdown(params: {
  profile: DocumentIndexProfile
  fallbackTitle: string
  config?: DocumentIndexControllerConfig
}): string {
  const documentTitle = params.profile.title || params.fallbackTitle
  const tags = parseStringArray(params.profile.tagsJson)
  const keywords = parseStringArray(params.profile.keywordsJson)
  const propositions = parseObjectArray<{ text: string, sourceBlockIds: string[] }>(params.profile.propositionsJson)
  const primaryBlocks = parseObjectArray<{ blockId: string, text: string }>(params.profile.primarySourceBlocksJson)
  const secondaryBlocks = parseObjectArray<{ blockId: string, text: string }>(params.profile.secondarySourceBlocksJson)

  const blockIndexMap = new Map<string, string>()
  const allBlocks = [...primaryBlocks, ...secondaryBlocks]
  allBlocks.forEach((block, index) => {
    blockIndexMap.set(block.blockId, String(index + 1))
  })

  function formatBlockRef(blockId: string): string {
    const index = blockIndexMap.get(blockId) || blockId
    return `^((${blockId} "${index}"))^`
  }

  const lines: string[] = []
  lines.push(`> ⚠️ ${t('summaryDetail.documentIndex.viewWarning')}`)
  lines.push('')
  lines.push(`# ${t('summaryDetail.documentIndex.viewTitle', { title: documentTitle })}`)
  lines.push('')
  lines.push(`## ${t('summaryDetail.documentIndex.viewPositioning')}`)
  lines.push('')
  lines.push(params.profile.positioning || '-')
  lines.push('')

  if (propositions.length) {
    lines.push(`## ${t('summaryDetail.documentIndex.viewPropositions')}`)
    lines.push('')
    for (const proposition of propositions) {
      const refSuffix = proposition.sourceBlockIds.length
        ? ` ${proposition.sourceBlockIds.map(id => formatBlockRef(id)).join(' ')}`
        : ''
      lines.push(`- ${proposition.text}${refSuffix}`)
    }
    lines.push('')
  }

  if (tags.length) {
    lines.push('## Tags')
    lines.push('')
    lines.push(tags.map(tag => `\`${tag}\``).join(' '))
    lines.push('')
  }

  if (keywords.length) {
    lines.push(`## ${t('summaryDetail.documentIndex.viewKeywords')}`)
    lines.push('')
    lines.push(keywords.map(keyword => `\`${keyword}\``).join(' '))
    lines.push('')
  }

  if (primaryBlocks.length) {
    lines.push(`## ${t('summaryDetail.documentIndex.viewPrimarySourceBlocks')}`)
    lines.push('')
    for (const block of primaryBlocks) {
      lines.push(`> ${block.text}`)
      lines.push(`> ${formatBlockRef(block.blockId)}`)
      lines.push('')
    }
  }

  if (secondaryBlocks.length) {
    lines.push(`## ${t('summaryDetail.documentIndex.viewSecondarySourceBlocks')}`)
    lines.push('')
    for (const block of secondaryBlocks) {
      lines.push(`> ${block.text}`)
      lines.push(`> ${formatBlockRef(block.blockId)}`)
      lines.push('')
    }
  }

  lines.push('')
  if (params.profile.generatedAt) {
    lines.push('---')
    lines.push('')
    lines.push(`*${t('summaryDetail.documentIndex.viewUpdatedAt')}: ${params.profile.generatedAt}*`)
  }

  return lines.join('\n')
}

function parseStringArray(value: string): string[] {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function parseObjectArray<T>(value: string): T[] {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
