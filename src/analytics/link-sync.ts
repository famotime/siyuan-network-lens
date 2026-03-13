export type LinkDirection = 'outbound' | 'inbound' | 'child'

type BlockWriteFn = (dataType: 'markdown' | 'dom', data: string, parentID: string) => Promise<any>

type SyncAssociationParams = {
  coreDocumentId: string
  targetDocumentId: string
  direction: LinkDirection
  resolveTitle: (documentId: string) => string
  appendBlock: BlockWriteFn
  prependBlock: BlockWriteFn
}

export function buildDocLinkMarkdown(documentId: string, title: string) {
  const escaped = title.replace(/"/g, '\\"')
  return `((${documentId} "${escaped}"))`
}

export async function syncAssociation(params: SyncAssociationParams) {
  if (params.direction === 'outbound') {
    await params.prependBlock('markdown', buildDocLinkMarkdown(params.coreDocumentId, params.resolveTitle(params.coreDocumentId)), params.targetDocumentId)
    return
  }
  await params.appendBlock('markdown', buildDocLinkMarkdown(params.targetDocumentId, params.resolveTitle(params.targetDocumentId)), params.coreDocumentId)
}
