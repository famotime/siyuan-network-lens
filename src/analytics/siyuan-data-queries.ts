export interface DocumentRow {
  id: string
  box: string
  path: string
  hpath: string
  title: string
  name: string | null
  alias: string | null
  content: string | null
  tag: string | null
  created: string
  updated: string
}

export interface ReferenceRow {
  id: string
  sourceBlockId: string
  sourceDocumentId: string
  targetBlockId: string
  targetDocumentId: string
  content: string | null
  sourceUpdated: string | null
}

export interface InternalLinkSourceRow {
  id: string
  rootId: string
  markdown: string | null
  content: string | null
  updated: string | null
}

export interface InternalLinkTargetRow {
  id: string
  rootId: string
}

export type SqlRunner = (query: string) => Promise<any>

export const QUERY_LIMIT = 200000

export const DOCUMENT_SQL = `
  SELECT
    doc.id,
    doc.box,
    doc.path,
    doc.hpath,
    CASE
      WHEN COALESCE(TRIM(doc.content), '') <> '' THEN doc.content
      WHEN COALESCE(TRIM(doc.name), '') <> '' THEN doc.name
      ELSE doc.hpath
    END AS title,
    doc.name,
    doc.alias,
    COALESCE(body.bodyContent, '') AS content,
    doc.tag,
    doc.created,
    doc.updated
  FROM blocks doc
  LEFT JOIN (
    SELECT
      root_id,
      GROUP_CONCAT(content, char(10)) AS bodyContent
    FROM (
      SELECT
        root_id,
        content,
        sort,
        created,
        id
      FROM blocks
      WHERE type <> 'd'
        AND COALESCE(TRIM(content), '') <> ''
      ORDER BY root_id, sort, created, id
    ) ordered_blocks
    GROUP BY root_id
  ) body ON body.root_id = doc.id
  WHERE doc.type = 'd'
  ORDER BY doc.updated DESC
  LIMIT ${QUERY_LIMIT}
`

export const REFERENCE_SQL = `
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

export const INTERNAL_LINK_SOURCE_SQL = `
  SELECT
    id,
    COALESCE(NULLIF(root_id, ''), id) AS rootId,
    markdown,
    content,
    updated
  FROM blocks
  WHERE (
      COALESCE(markdown, '') LIKE '%siyuan://blocks/%'
      OR COALESCE(markdown, '') LIKE '%((%'
      OR COALESCE(content, '') LIKE '%siyuan://blocks/%'
      OR COALESCE(content, '') LIKE '%((%'
    )
  LIMIT ${QUERY_LIMIT}
`

export function formatCurrentSiyuanTimestamp(now = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0')

  return [
    now.getFullYear().toString(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

export async function loadInternalLinkTargets(
  sqlRunner: SqlRunner,
  targetIds: string[],
): Promise<InternalLinkTargetRow[]> {
  if (targetIds.length === 0) {
    return []
  }

  const targetRows: InternalLinkTargetRow[] = []
  for (const chunk of chunkIds(targetIds, 200)) {
    const rows = await sqlRunner(`
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
