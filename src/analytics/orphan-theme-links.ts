import { buildDocLinkMarkdown } from './link-sync'

type BlockDeleteFn = (id: string) => Promise<any>
type BlockWriteFn = (dataType: 'markdown' | 'dom', data: string, parentID: string) => Promise<any>
type BlockUpdateFn = (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string }>>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>

export type AppliedThemeLinkChange =
  {
    mode: 'prepended' | 'updated'
    blockId: string
    baseMarkdown: string
    links: Array<{
      themeDocumentId: string
      markdown: string
    }>
  }

export async function applyThemeLinkToOrphanDocument(params: {
  orphanDocumentId: string
  themeDocumentId: string
  themeDocumentTitle: string
  getChildBlocks: GetChildBlocksFn
  getBlockKramdown: GetBlockKramdownFn
  updateBlock: BlockUpdateFn
  prependBlock: BlockWriteFn
}): Promise<AppliedThemeLinkChange> {
  const linkMarkdown = buildDocLinkMarkdown(params.themeDocumentId, params.themeDocumentTitle)
  const firstChild = await resolveFirstParagraph(params.orphanDocumentId, params.getChildBlocks)

  if (firstChild) {
    const block = await params.getBlockKramdown(firstChild.id)
    const previousMarkdown = block?.kramdown ?? ''
    if (isInternalLinkOnlyParagraph(previousMarkdown)) {
      const nextMarkdown = appendLinkToParagraph(previousMarkdown, linkMarkdown)
      await params.updateBlock('markdown', nextMarkdown, firstChild.id)
      return {
        mode: 'updated',
        blockId: firstChild.id,
        baseMarkdown: previousMarkdown,
        links: [
          {
            themeDocumentId: params.themeDocumentId,
            markdown: linkMarkdown,
          },
        ],
      }
    }
  }

  const response = await params.prependBlock('markdown', linkMarkdown, params.orphanDocumentId)
  const insertedBlockId = extractInsertedBlockId(response)
  if (!insertedBlockId) {
    throw new Error('未能识别新建的主题链接块')
  }

  return {
    mode: 'prepended',
    blockId: insertedBlockId,
    baseMarkdown: '',
    links: [
      {
        themeDocumentId: params.themeDocumentId,
        markdown: linkMarkdown,
      },
    ],
  }
}

export async function addThemeLinkToDocumentChange(params: {
  change: AppliedThemeLinkChange
  themeDocumentId: string
  themeDocumentTitle: string
  updateBlock: BlockUpdateFn
}): Promise<AppliedThemeLinkChange> {
  if (params.change.links.some(item => item.themeDocumentId === params.themeDocumentId)) {
    return params.change
  }

  const nextChange: AppliedThemeLinkChange = {
    ...params.change,
    links: [
      ...params.change.links,
      {
        themeDocumentId: params.themeDocumentId,
        markdown: buildDocLinkMarkdown(params.themeDocumentId, params.themeDocumentTitle),
      },
    ],
  }

  await params.updateBlock('markdown', buildDocumentMarkdown(nextChange), params.change.blockId)
  return nextChange
}

export async function removeThemeLinkFromDocumentChange(params: {
  change: AppliedThemeLinkChange
  themeDocumentId: string
  deleteBlock: BlockDeleteFn
  updateBlock: BlockUpdateFn
}): Promise<AppliedThemeLinkChange | null> {
  const nextLinks = params.change.links.filter(item => item.themeDocumentId !== params.themeDocumentId)

  if (nextLinks.length === params.change.links.length) {
    return params.change
  }

  if (nextLinks.length === 0) {
    if (params.change.mode === 'updated') {
      await params.updateBlock('markdown', params.change.baseMarkdown, params.change.blockId)
    } else {
      await params.deleteBlock(params.change.blockId)
    }
    return null
  }

  const nextChange: AppliedThemeLinkChange = {
    ...params.change,
    links: nextLinks,
  }
  await params.updateBlock('markdown', buildDocumentMarkdown(nextChange), params.change.blockId)
  return nextChange
}

export function isInternalLinkOnlyParagraph(markdown: string): boolean {
  const normalized = splitParagraphKramdown(markdown).content
    .replace(/\[[^\]]*\]\(siyuan:\/\/blocks\/[^)]+\)/g, '')
    .replace(/\(\([^)]*\)\)/g, '')
    .replace(/siyuan:\/\/blocks\/[a-zA-Z0-9-]+/g, '')
    .replace(/[\t\r\n ]+/g, '')

  return normalized.length === 0
}

function appendLinkToParagraph(markdown: string, linkMarkdown: string): string {
  return buildParagraphMarkdown(markdown, [linkMarkdown])
}

function buildDocumentMarkdown(change: AppliedThemeLinkChange): string {
  return buildParagraphMarkdown(change.baseMarkdown, change.links.map(item => item.markdown))
}

async function resolveFirstParagraph(documentId: string, getChildBlocks: GetChildBlocksFn) {
  const children = await getChildBlocks(documentId)
  const firstChild = children[0]
  if (!firstChild || firstChild.type !== 'p') {
    return null
  }
  return firstChild
}

function extractInsertedBlockId(response: any): string {
  if (!Array.isArray(response)) {
    return ''
  }

  for (const item of response) {
    if (!item || !Array.isArray(item.doOperations)) {
      continue
    }
    for (const operation of item.doOperations) {
      if (typeof operation?.id === 'string' && operation.id) {
        return operation.id
      }
    }
  }

  return ''
}

function buildParagraphMarkdown(baseMarkdown: string, extraLinks: string[]): string {
  const { content, attributes } = splitParagraphKramdown(baseMarkdown)
  const segments = [content.trim(), ...extraLinks].filter(Boolean)
  const nextContent = segments.join('\t')

  if (!attributes) {
    return nextContent
  }

  return nextContent ? `${nextContent}\n${attributes}` : attributes
}

function splitParagraphKramdown(markdown: string): { content: string, attributes: string } {
  const trimmedEnd = markdown.replace(/\s+$/g, '')
  if (!trimmedEnd) {
    return { content: '', attributes: '' }
  }

  const lines = trimmedEnd.split('\n')
  const attributeLines: string[] = []

  while (lines.length > 1) {
    const lastLine = lines[lines.length - 1]?.trim()
    if (!lastLine || !/^\{:[^\n]*\}$/.test(lastLine)) {
      break
    }
    attributeLines.unshift(lines.pop()!.trim())
  }

  return {
    content: lines.join('\n').replace(/\s+$/g, ''),
    attributes: attributeLines.join('\n'),
  }
}
