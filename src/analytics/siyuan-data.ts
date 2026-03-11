import { lsNotebooks, sql } from '@/api'

import type { DocumentRecord, ReferenceRecord } from './analysis'

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

interface DocumentRow {
  id: string
  box: string
  path: string
  hpath: string
  title: string
  tag: string | null
  created: string
  updated: string
}

interface ReferenceRow {
  id: string
  sourceBlockId: string
  sourceDocumentId: string
  targetBlockId: string
  targetDocumentId: string
  content: string | null
  sourceUpdated: string | null
}

const DOCUMENT_SQL = `
  SELECT
    id,
    box,
    path,
    hpath,
    CASE
      WHEN COALESCE(TRIM(content), '') <> '' THEN content
      WHEN COALESCE(TRIM(name), '') <> '' THEN name
      ELSE hpath
    END AS title,
    tag,
    created,
    updated
  FROM blocks
  WHERE type = 'd'
  ORDER BY updated DESC
`

const REFERENCE_SQL = `
  SELECT
    r.id AS id,
    r.block_id AS sourceBlockId,
    r.root_id AS sourceDocumentId,
    r.def_block_id AS targetBlockId,
    r.def_block_root_id AS targetDocumentId,
    COALESCE(r.content, src_block.content, '') AS content,
    COALESCE(src_block.updated, src_doc.updated, '') AS sourceUpdated
  FROM refs r
  LEFT JOIN blocks src_block ON src_block.id = r.block_id
  LEFT JOIN blocks src_doc ON src_doc.id = r.root_id
  WHERE r.type = 'ref_id'
    AND r.root_id <> r.def_block_root_id
  ORDER BY sourceUpdated DESC
`

export async function loadAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const [documentRows, referenceRows, notebooksResponse] = await Promise.all([
    sql(DOCUMENT_SQL) as Promise<DocumentRow[]>,
    sql(REFERENCE_SQL) as Promise<ReferenceRow[]>,
    lsNotebooks(),
  ])

  return {
    documents: (documentRows ?? []).map(row => ({
      id: row.id,
      box: row.box,
      path: row.path,
      hpath: row.hpath,
      title: row.title,
      tags: parseTags(row.tag),
      created: row.created,
      updated: row.updated,
    })),
    references: (referenceRows ?? []).map(row => ({
      id: row.id,
      sourceBlockId: row.sourceBlockId,
      sourceDocumentId: row.sourceDocumentId,
      targetBlockId: row.targetBlockId,
      targetDocumentId: row.targetDocumentId,
      content: row.content ?? '',
      sourceUpdated: row.sourceUpdated ?? '',
    })),
    notebooks: (notebooksResponse?.notebooks ?? []).map(notebook => ({
      id: notebook.id,
      name: notebook.name,
    })),
    fetchedAt: new Date().toISOString(),
  }
}

function parseTags(raw: string | null): string[] {
  if (!raw) {
    return []
  }
  return raw
    .split(/[,\s#]+/)
    .map(tag => tag.trim())
    .filter(Boolean)
}
