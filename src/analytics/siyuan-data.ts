import { lsNotebooks, sql } from '@/api'

import type { DocumentRecord, ReferenceRecord } from './analysis'
import {
  buildInternalLinkReferences,
  collectInternalLinkTargetIds,
} from './internal-links'

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

const QUERY_LIMIT = 200000

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
  LIMIT ${QUERY_LIMIT}
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
  LIMIT ${QUERY_LIMIT}
`

const INTERNAL_LINK_SOURCE_SQL = `
  SELECT
    id,
    COALESCE(NULLIF(root_id, ''), id) AS rootId,
    markdown,
    updated
  FROM blocks
  WHERE (
      COALESCE(markdown, '') LIKE '%siyuan://blocks/%'
      OR COALESCE(markdown, '') LIKE '%((%'
    )
  LIMIT ${QUERY_LIMIT}
`

export async function loadAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const [documentRows, referenceRows, internalLinkRows, notebooksResponse] = await Promise.all([
    sql(DOCUMENT_SQL) as Promise<DocumentRow[]>,
    sql(REFERENCE_SQL) as Promise<ReferenceRow[]>,
    sql(INTERNAL_LINK_SOURCE_SQL) as Promise<InternalLinkSourceRow[]>,
    lsNotebooks(),
  ])
  const internalLinkTargetIds = collectInternalLinkTargetIds(internalLinkRows ?? [])
  const internalLinkTargets = await loadInternalLinkTargets(internalLinkTargetIds)
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
      tags: parseTags(row.tag),
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

async function loadInternalLinkTargets(targetIds: string[]): Promise<InternalLinkTargetRow[]> {
  if (targetIds.length === 0) {
    return []
  }

  const targetRows: InternalLinkTargetRow[] = []
  for (const chunk of chunkIds(targetIds, 200)) {
    const rows = await sql(`
      SELECT id, COALESCE(NULLIF(root_id, ''), id) AS rootId
      FROM blocks
      WHERE id IN (${chunk.map(quoteSql).join(', ')})
      LIMIT ${chunk.length}
    `) as InternalLinkTargetRow[]
    targetRows.push(...(rows ?? []))
  }

  return targetRows
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function mergeReferences(primary: ReferenceRecord[], fallback: ReferenceRecord[]): ReferenceRecord[] {
  const merged = [...primary]
  const existingSignatures = new Set(primary.map(referenceSignature))

  for (const reference of fallback) {
    const signature = referenceSignature(reference)
    if (existingSignatures.has(signature)) {
      continue
    }
    existingSignatures.add(signature)
    merged.push(reference)
  }

  return merged
}

function referenceSignature(reference: ReferenceRecord): string {
  return [
    reference.sourceDocumentId,
    reference.sourceBlockId,
    reference.targetDocumentId,
    reference.targetBlockId,
  ].join('::')
}
