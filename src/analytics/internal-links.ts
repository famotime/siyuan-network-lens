import type { ReferenceRecord } from './analysis'

interface InternalLinkSourceRow {
  id: string
  rootId: string
  markdown: string | null
  updated: string | null
}

interface InternalLinkTargetRow {
  id: string
  rootId: string
}

interface MarkdownReferenceTarget {
  targetBlockId: string
  content: string
}

const SIYUAN_BLOCK_URL_PATTERN = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
const BLOCK_REFERENCE_PATTERN = /\(\(\s*([^)\s"']+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)\)/g

export function collectInternalLinkTargetIds(sourceRows: InternalLinkSourceRow[]): string[] {
  const targetIds = new Set<string>()

  for (const row of sourceRows) {
    for (const target of extractMarkdownReferenceTargets(row.markdown ?? '')) {
      targetIds.add(target.targetBlockId)
    }
  }

  return [...targetIds]
}

export function buildInternalLinkReferences(params: {
  sourceRows: InternalLinkSourceRow[]
  targetRows: InternalLinkTargetRow[]
}): ReferenceRecord[] {
  const targetRootMap = new Map(params.targetRows.map(row => [row.id, row.rootId || row.id]))
  const references: ReferenceRecord[] = []

  for (const row of params.sourceRows) {
    const sourceDocumentId = row.rootId || row.id
    const targets = extractMarkdownReferenceTargets(row.markdown ?? '')

    targets.forEach((target, targetIndex) => {
      const targetDocumentId = targetRootMap.get(target.targetBlockId)
      if (!targetDocumentId || sourceDocumentId === targetDocumentId) {
        return
      }

      references.push({
        id: `markdown-ref:${row.id}:${target.targetBlockId}:${targetIndex}`,
        sourceBlockId: row.id,
        sourceDocumentId,
        targetBlockId: target.targetBlockId,
        targetDocumentId,
        content: target.content,
        sourceUpdated: row.updated ?? '',
      })
    })
  }

  return references
}

function extractMarkdownReferenceTargets(markdown: string): MarkdownReferenceTarget[] {
  return [
    ...extractSiyuanBlockTargets(markdown),
    ...extractBlockReferenceTargets(markdown),
  ]
}

function extractSiyuanBlockTargets(markdown: string): MarkdownReferenceTarget[] {
  return [...markdown.matchAll(SIYUAN_BLOCK_URL_PATTERN)].map(match => ({
    targetBlockId: match[1],
    content: match[0],
  }))
}

function extractBlockReferenceTargets(markdown: string): MarkdownReferenceTarget[] {
  return [...markdown.matchAll(BLOCK_REFERENCE_PATTERN)].map(match => ({
    targetBlockId: match[1],
    content: match[0],
  }))
}
