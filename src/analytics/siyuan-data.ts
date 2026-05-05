import { lsNotebooks, sql } from '@/api'

import type { DocumentRecord, ReferenceRecord } from './analysis'
import {
  buildInternalLinkReferences,
  collectInternalLinkTargetIds,
} from './internal-links'
import { normalizeTags } from './document-utils'
import {
  DOCUMENT_SQL,
  INTERNAL_LINK_SOURCE_SQL,
  REFERENCE_SQL,
  formatCurrentSiyuanTimestamp,
  loadInternalLinkTargets,
  type DocumentRow,
  type InternalLinkSourceRow,
  type ReferenceRow,
} from './siyuan-data-queries'
import { mergeReferences } from './siyuan-data-merge'

export interface NotebookOption {
  id: string
  name: string
}

export interface AnalyticsSnapshot {
  documents: DocumentRecord[]
  references: ReferenceRecord[]
  notebooks: NotebookOption[]
  fetchedAt: string
}

export async function loadAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const [documentRows, referenceRows, internalLinkRows, notebooksResponse] = await Promise.all([
    sql(DOCUMENT_SQL) as Promise<DocumentRow[]>,
    sql(REFERENCE_SQL) as Promise<ReferenceRow[]>,
    sql(INTERNAL_LINK_SOURCE_SQL) as Promise<InternalLinkSourceRow[]>,
    lsNotebooks(),
  ])
  const internalLinkTargetIds = collectInternalLinkTargetIds(internalLinkRows ?? [])
  const internalLinkTargets = await loadInternalLinkTargets(sql, internalLinkTargetIds)
  const internalLinkReferences = buildInternalLinkReferences({
    sourceRows: internalLinkRows ?? [],
    targetRows: internalLinkTargets,
  })

  return {
    documents: (documentRows ?? []).map(row => ({
      id: row.id,
      box: row.box,
      path: row.path,
      hpath: row.hpath,
      title: row.title,
      name: row.name ?? '',
      alias: row.alias ?? '',
      content: row.content ?? '',
      tags: normalizeTags(row.tag),
      created: row.created,
      updated: row.updated,
    })),
    references: mergeReferences(
      (referenceRows ?? []).map(row => ({
      id: row.id,
      sourceBlockId: row.sourceBlockId,
      sourceDocumentId: row.sourceDocumentId,
      targetBlockId: row.targetBlockId,
      targetDocumentId: row.targetDocumentId,
      content: row.content ?? '',
      sourceUpdated: row.sourceUpdated ?? '',
      })),
      internalLinkReferences,
    ),
    notebooks: (notebooksResponse?.notebooks ?? []).map(notebook => ({
      id: notebook.id,
      name: notebook.name,
    })),
    fetchedAt: formatCurrentSiyuanTimestamp(),
  }
}
