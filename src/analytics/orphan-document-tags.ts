import { normalizeTags } from './document-utils'
import { t } from '@/i18n/ui'

type GetBlockAttrsFn = (id: string) => Promise<{ [key: string]: string }>
type SetBlockAttrsFn = (id: string, attrs: { [key: string]: string }) => Promise<any>

export type AppliedTagSuggestionChange = {
  blockId: string
  baseTags: string[]
  appliedTags: string[]
}

export async function applyTagToOrphanDocument(params: {
  orphanDocumentId: string
  tag: string
  getBlockAttrs: GetBlockAttrsFn
  setBlockAttrs: SetBlockAttrsFn
}): Promise<AppliedTagSuggestionChange> {
  const baseTags = await readDocumentTags(params.orphanDocumentId, params.getBlockAttrs)
  const change: AppliedTagSuggestionChange = {
    blockId: params.orphanDocumentId,
    baseTags,
    appliedTags: [params.tag],
  }

  await persistTagChange({
    documentId: params.orphanDocumentId,
    currentTags: baseTags,
    nextTags: resolveDocumentTags(change),
    getBlockAttrs: params.getBlockAttrs,
    setBlockAttrs: params.setBlockAttrs,
  })

  return change
}

export async function addTagToDocumentChange(params: {
  change: AppliedTagSuggestionChange
  tag: string
  getBlockAttrs: GetBlockAttrsFn
  setBlockAttrs: SetBlockAttrsFn
}): Promise<AppliedTagSuggestionChange> {
  if (params.change.appliedTags.includes(params.tag)) {
    return params.change
  }

  const nextChange: AppliedTagSuggestionChange = {
    ...params.change,
    appliedTags: [...params.change.appliedTags, params.tag],
  }

  await persistTagChange({
    documentId: params.change.blockId,
    currentTags: resolveDocumentTags(params.change),
    nextTags: resolveDocumentTags(nextChange),
    getBlockAttrs: params.getBlockAttrs,
    setBlockAttrs: params.setBlockAttrs,
  })

  return nextChange
}

export async function removeTagFromDocumentChange(params: {
  change: AppliedTagSuggestionChange
  tag: string
  getBlockAttrs: GetBlockAttrsFn
  setBlockAttrs: SetBlockAttrsFn
}): Promise<AppliedTagSuggestionChange | null> {
  const nextAppliedTags = params.change.appliedTags.filter(item => item !== params.tag)

  if (nextAppliedTags.length === params.change.appliedTags.length) {
    return params.change
  }

  const nextChange: AppliedTagSuggestionChange = {
    ...params.change,
    appliedTags: nextAppliedTags,
  }

  await persistTagChange({
    documentId: params.change.blockId,
    currentTags: resolveDocumentTags(params.change),
    nextTags: resolveDocumentTags(nextChange),
    getBlockAttrs: params.getBlockAttrs,
    setBlockAttrs: params.setBlockAttrs,
  })

  return nextAppliedTags.length ? nextChange : null
}

async function persistTagChange(params: {
  documentId: string
  currentTags: string[]
  nextTags: string[]
  getBlockAttrs: GetBlockAttrsFn
  setBlockAttrs: SetBlockAttrsFn
}) {
  if (sameTagMembers(params.currentTags, params.nextTags)) {
    return
  }

  await params.setBlockAttrs(params.documentId, {
    tags: params.nextTags.join(','),
  })

  const verifiedTags = await readDocumentTags(params.documentId, params.getBlockAttrs)
  if (!sameTagMembers(verifiedTags, params.nextTags)) {
    throw new Error(t('analytics.summaryDetailSource.failedToWriteDocTags'))
  }
}

async function readDocumentTags(documentId: string, getBlockAttrs: GetBlockAttrsFn): Promise<string[]> {
  const attrs = await getBlockAttrs(documentId)
  return normalizeTagList(attrs?.tags)
}

function resolveDocumentTags(change: AppliedTagSuggestionChange): string[] {
  return mergeTagLists(change.baseTags, change.appliedTags)
}

function normalizeTagList(tags?: readonly string[] | string | null): string[] {
  return dedupeTags(normalizeTags(tags))
}

function mergeTagLists(baseTags: string[], extraTags: string[]): string[] {
  return dedupeTags([...baseTags, ...extraTags])
}

function dedupeTags(tags: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const rawTag of tags) {
    const tag = rawTag.trim()
    if (!tag || seen.has(tag)) {
      continue
    }
    seen.add(tag)
    result.push(tag)
  }

  return result
}

function sameTagMembers(left: string[], right: string[]): boolean {
  const normalizedLeft = dedupeTags(left)
  const normalizedRight = dedupeTags(right)

  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }

  const rightSet = new Set(normalizedRight)
  return normalizedLeft.every(tag => rightSet.has(tag))
}
