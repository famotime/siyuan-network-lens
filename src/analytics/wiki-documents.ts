import { buildDocLinkMarkdown } from './link-sync'
import { resolveScopedPathTarget, type NotebookPathOption } from './document-paths'
import { fingerprintWikiContent } from './wiki-diff'
import {
  WIKI_BLOCK_ATTR_KEYS,
  WIKI_PAGE_HEADINGS,
  getWikiHeadingCandidates,
  matchesWikiHeading,
  type WikiApplyResult,
  type WikiPageType,
} from './wiki-page-model'
import type { RenderedWikiDraft } from './wiki-renderer'
import { buildWikiPageStorageKey, type AiWikiStore, type WikiPageSnapshotRecord } from './wiki-store'
import type { WikiPagePreviewResult } from './wiki-diff'
import { t } from '@/i18n/ui'

const INDEX_MANUAL_NOTES_MARKDOWN = [
  `## ${WIKI_PAGE_HEADINGS.manualNotes}`,
  '',
  t('wikiMaintain.manualNotesReserved'),
].join('\n')

type BlockOpFn = (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>
type GetChildBlocksFn = (id: string) => Promise<Array<{ id: string, type?: string }>>
type GetIDsByHPathFn = (notebook: string, path: string) => Promise<string[]>
type GetBlockAttrsFn = (id: string) => Promise<Record<string, string>>
type SetBlockAttrsFn = (id: string, attrs: Record<string, string>) => Promise<any>
type CreateDocWithMdFn = (notebook: string, path: string, markdown: string) => Promise<string>

export interface WikiThemePageApplyInput {
  pageTitle: string
  themeName: string
  themeDocumentId: string
  themeDocumentTitle: string
  themeDocumentBox: string
  themeDocumentHPath: string
  sourceDocumentIds: string[]
  preview: WikiPagePreviewResult
  draft: RenderedWikiDraft
}

export interface WikiApplyScopeSummary {
  sourceDocumentCount: number
  themeGroupCount: number
  unclassifiedDocumentCount: number
  excludedWikiDocumentCount: number
}

export interface WikiApplyBatchResult {
  themePages: Array<{
    pageTitle: string
    pageId?: string
    result: WikiApplyResult
  }>
  indexPage: {
    pageTitle: string
    pageId?: string
    result: WikiApplyResult
  }
  logPage: {
    pageTitle: string
    pageId?: string
    result: WikiApplyResult
  }
  counts: {
    created: number
    updated: number
    skipped: number
    conflict: number
  }
}

export async function applyWikiDocuments(params: {
  config: {
    themeNotebookId?: string
    themeDocumentPath: string
    wikiIndexTitle: string
    wikiLogTitle: string
    wikiPageSuffix: string
  }
  notebooks?: NotebookPathOption[]
  generatedAt: string
  scopeSummary: WikiApplyScopeSummary
  scopeDescriptionLines: string[]
  themePages: WikiThemePageApplyInput[]
  unclassifiedDocuments: Array<{
    documentId: string
    title: string
  }>
  overwriteConflicts?: boolean
  store: AiWikiStore
  api: {
    createDocWithMd: CreateDocWithMdFn
    getIDsByHPath: GetIDsByHPathFn
    prependBlock: BlockOpFn
    appendBlock: BlockOpFn
    updateBlock: BlockOpFn
    getChildBlocks: GetChildBlocksFn
    getBlockKramdown: GetBlockKramdownFn
    getBlockAttrs: GetBlockAttrsFn
    setBlockAttrs: SetBlockAttrsFn
  }
}): Promise<WikiApplyBatchResult> {
  const wikiTarget = resolveWikiTarget(params.config, params.notebooks)
  if (!wikiTarget) {
    throw new Error(t('analytics.wiki.noValidTopicDocPathConfigured'))
  }

  const themeResults: WikiApplyBatchResult['themePages'] = []
  const themeRecords = new Map<string, WikiPageSnapshotRecord>()

  for (const page of params.themePages) {
    const pageKey = buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle: page.pageTitle,
      themeDocumentId: page.themeDocumentId,
    })
    const storedRecord = await params.store.getPageRecord(pageKey)
    const pageHPath = buildSiblingDocumentPath(page.themeDocumentHPath, page.pageTitle)
    const existingPageId = await resolveExistingPageId({
      notebook: page.themeDocumentBox,
      hpath: pageHPath,
      storedPageId: storedRecord?.pageId,
      getIDsByHPath: params.api.getIDsByHPath,
      getBlockKramdown: params.api.getBlockKramdown,
    })

    const shouldSkipConflict = page.preview.status === 'conflict' && !params.overwriteConflicts
    const shouldSkipUnchanged = page.preview.status === 'unchanged'

    if (shouldSkipConflict || shouldSkipUnchanged) {
      const liveState = existingPageId
        ? await readWikiPageState(existingPageId, params.api)
        : null
      const record = buildThemePageRecord({
        page,
        pageId: existingPageId,
        storedRecord,
        pageFingerprint: liveState?.pageFingerprint ?? page.preview.pageFingerprint,
        managedFingerprint: liveState?.managedFingerprint ?? page.preview.managedFingerprint,
        appliedAt: params.generatedAt,
        applyResult: shouldSkipConflict ? 'conflict' : 'skipped',
      })
      await params.store.savePageRecord(record)
      themeRecords.set(pageKey, record)
      themeResults.push({
        pageTitle: page.pageTitle,
        pageId: existingPageId,
        result: shouldSkipConflict ? 'conflict' : 'skipped',
      })
      continue
    }

    const writeResult = await upsertManagedWikiPage({
      notebook: page.themeDocumentBox,
      hpath: pageHPath,
      pageType: 'theme',
      pageId: existingPageId,
      themeDocumentId: page.themeDocumentId,
      draft: page.draft,
      api: params.api,
    })

    const refreshedState = await readWikiPageState(writeResult.pageId, params.api)
    await syncWikiBlockAttrs({
      pageId: writeResult.pageId,
      pageType: 'theme',
      themeDocumentId: page.themeDocumentId,
      api: params.api,
    })

    const record = buildThemePageRecord({
      page,
      pageId: writeResult.pageId,
      storedRecord,
      pageFingerprint: refreshedState.pageFingerprint,
      managedFingerprint: refreshedState.managedFingerprint,
      appliedAt: params.generatedAt,
      applyResult: writeResult.result,
    })
    await params.store.savePageRecord(record)
    themeRecords.set(pageKey, record)
    themeResults.push({
      pageTitle: page.pageTitle,
      pageId: writeResult.pageId,
      result: writeResult.result,
    })
  }

  const indexDraft = await buildIndexDraft({
    title: params.config.wikiIndexTitle,
    generatedAt: params.generatedAt,
    scopeSummary: params.scopeSummary,
    unclassifiedDocuments: params.unclassifiedDocuments,
    store: params.store,
    api: params.api,
  })
  const indexPath = joinDocumentPath(wikiTarget.path, params.config.wikiIndexTitle)
  const existingIndexPageId = await resolveExistingPageId({
    notebook: wikiTarget.notebook,
    hpath: indexPath,
    storedPageId: (await params.store.getPageRecord(buildWikiPageStorageKey({
      pageType: 'index',
      pageTitle: params.config.wikiIndexTitle,
    })))?.pageId,
    getIDsByHPath: params.api.getIDsByHPath,
    getBlockKramdown: params.api.getBlockKramdown,
  })
  const indexWriteResult = await upsertManagedWikiPage({
    notebook: wikiTarget.notebook,
    hpath: indexPath,
    pageType: 'index',
    pageId: existingIndexPageId,
    draft: indexDraft,
    api: params.api,
  })
  const refreshedIndexState = await readWikiPageState(indexWriteResult.pageId, params.api)
  await syncWikiBlockAttrs({
    pageId: indexWriteResult.pageId,
    pageType: 'index',
    api: params.api,
  })
  await params.store.savePageRecord({
    pageType: 'index',
    pageTitle: params.config.wikiIndexTitle,
    pageId: indexWriteResult.pageId,
    sourceDocumentIds: collectUniqueSourceDocumentIds(params.themePages, params.unclassifiedDocuments),
    pageFingerprint: refreshedIndexState.pageFingerprint,
    managedFingerprint: refreshedIndexState.managedFingerprint,
    lastGeneratedAt: params.generatedAt,
    lastApply: {
      appliedAt: params.generatedAt,
      result: indexWriteResult.result,
      sourceDocumentIds: collectUniqueSourceDocumentIds(params.themePages, params.unclassifiedDocuments),
      pageFingerprint: refreshedIndexState.pageFingerprint,
      managedFingerprint: refreshedIndexState.managedFingerprint,
    },
  })

  const logEntryMarkdown = buildLogEntryMarkdown({
    generatedAt: params.generatedAt,
    scopeSummary: params.scopeSummary,
    scopeDescriptionLines: params.scopeDescriptionLines,
    themeResults,
  })
  const logPath = joinDocumentPath(wikiTarget.path, params.config.wikiLogTitle)
  const existingLogPageRecord = await params.store.getPageRecord(buildWikiPageStorageKey({
    pageType: 'log',
    pageTitle: params.config.wikiLogTitle,
  }))
  const existingLogPageId = await resolveExistingPageId({
    notebook: wikiTarget.notebook,
    hpath: logPath,
    storedPageId: existingLogPageRecord?.pageId,
    getIDsByHPath: params.api.getIDsByHPath,
    getBlockKramdown: params.api.getBlockKramdown,
  })
  const logWriteResult = await appendLogDocument({
    notebook: wikiTarget.notebook,
    hpath: logPath,
    title: params.config.wikiLogTitle,
    pageId: existingLogPageId,
    entryMarkdown: logEntryMarkdown,
    api: params.api,
  })
  const refreshedLogState = await readPlainPageState(logWriteResult.pageId, params.api)
  await syncWikiBlockAttrs({
    pageId: logWriteResult.pageId,
    pageType: 'log',
    api: params.api,
  })
  await params.store.savePageRecord({
    pageType: 'log',
    pageTitle: params.config.wikiLogTitle,
    pageId: logWriteResult.pageId,
    sourceDocumentIds: collectUniqueSourceDocumentIds(params.themePages, params.unclassifiedDocuments),
    pageFingerprint: refreshedLogState.pageFingerprint,
    managedFingerprint: refreshedLogState.pageFingerprint,
    lastGeneratedAt: params.generatedAt,
    lastApply: {
      appliedAt: params.generatedAt,
      result: logWriteResult.result,
      sourceDocumentIds: collectUniqueSourceDocumentIds(params.themePages, params.unclassifiedDocuments),
      pageFingerprint: refreshedLogState.pageFingerprint,
      managedFingerprint: refreshedLogState.pageFingerprint,
    },
  })

  return {
    themePages: themeResults,
    indexPage: {
      pageTitle: params.config.wikiIndexTitle,
      pageId: indexWriteResult.pageId,
      result: indexWriteResult.result,
    },
    logPage: {
      pageTitle: params.config.wikiLogTitle,
      pageId: logWriteResult.pageId,
      result: logWriteResult.result,
    },
    counts: buildThemeResultCounts(themeResults),
  }
}

function resolveWikiTarget(
  config: {
    themeNotebookId?: string
    themeDocumentPath: string
  },
  notebooks?: NotebookPathOption[],
) {
  const target = resolveScopedPathTarget(config.themeDocumentPath, notebooks)
  if (target) {
    return target
  }

  const legacyNotebookId = config.themeNotebookId?.trim() ?? ''
  const normalizedPath = normalizeDocumentPath(config.themeDocumentPath)
  if (!legacyNotebookId || normalizedPath === '/') {
    return null
  }

  return {
    notebook: legacyNotebookId,
    path: normalizedPath,
  }
}

async function upsertManagedWikiPage(params: {
  notebook: string
  hpath: string
  pageType: Extract<WikiPageType, 'theme' | 'index'>
  pageId?: string
  themeDocumentId?: string
  draft: RenderedWikiDraft
  api: {
    createDocWithMd: CreateDocWithMdFn
    prependBlock: BlockOpFn
    appendBlock: BlockOpFn
    updateBlock: BlockOpFn
    getChildBlocks: GetChildBlocksFn
    getBlockKramdown: GetBlockKramdownFn
    getBlockAttrs: GetBlockAttrsFn
    setBlockAttrs: SetBlockAttrsFn
  }
}): Promise<{ pageId: string, result: Extract<WikiApplyResult, 'created' | 'updated'> }> {
  if (!params.pageId) {
    const pageId = await params.api.createDocWithMd(params.notebook, params.hpath, params.draft.fullMarkdown)
    return {
      pageId,
      result: 'created',
    }
  }

  const structure = await resolveWikiPageStructure(params.pageId, params.api)
  if (structure.managedBlockId) {
    await params.api.updateBlock('markdown', params.draft.managedMarkdown, structure.managedBlockId)
  } else {
    await params.api.prependBlock('markdown', params.draft.managedMarkdown, params.pageId)
  }

  if (!structure.manualBlockId) {
    await params.api.appendBlock('markdown', INDEX_MANUAL_NOTES_MARKDOWN, params.pageId)
  }

  return {
    pageId: params.pageId,
    result: 'updated',
  }
}

async function appendLogDocument(params: {
  notebook: string
  hpath: string
  title: string
  pageId?: string
  entryMarkdown: string
  api: {
    createDocWithMd: CreateDocWithMdFn
    appendBlock: BlockOpFn
  }
}): Promise<{ pageId: string, result: Extract<WikiApplyResult, 'created' | 'updated'> }> {
  if (!params.pageId) {
    const pageId = await params.api.createDocWithMd(
      params.notebook,
      params.hpath,
      [
        `# ${params.title}`,
        '',
        params.entryMarkdown,
      ].join('\n'),
    )
    return {
      pageId,
      result: 'created',
    }
  }

  await params.api.appendBlock('markdown', params.entryMarkdown, params.pageId)
  return {
    pageId: params.pageId,
    result: 'updated',
  }
}

async function buildIndexDraft(params: {
  title: string
  generatedAt: string
  scopeSummary: WikiApplyScopeSummary
  unclassifiedDocuments: Array<{ documentId: string, title: string }>
  store: AiWikiStore
  api: {
    getBlockKramdown: GetBlockKramdownFn
  }
}): Promise<RenderedWikiDraft> {
  const snapshot = await params.store.loadSnapshot()
  const themeRows = await Promise.all(
    Object.values(snapshot.pages)
      .filter(record => record.pageType === 'theme')
      .filter(record => record.pageId)
      .sort((left, right) => left.pageTitle.localeCompare(right.pageTitle, 'zh-CN'))
      .map(async (record) => {
        const pageMarkdown = record.pageId
          ? await safeReadBlockMarkdown(record.pageId, params.api.getBlockKramdown)
          : ''
        return {
          record,
          summary: extractOverviewSummary(pageMarkdown),
        }
      }),
  )

  const managedMarkdown = [
    `# ${params.title}`,
    '',
    `## ${WIKI_PAGE_HEADINGS.managedRoot}`,
    '',
    t('analytics.wiki.markdownOverviewHeading'),
    t('analytics.wiki.markdownUpdatedAt', { value: params.generatedAt }),
    t('analytics.wiki.markdownTopicWikiPages', { count: themeRows.length }),
    t('analytics.wiki.markdownUnclassifiedSources', { count: params.unclassifiedDocuments.length }),
    t('analytics.wiki.markdownMatchedTopicsThisRun', { count: params.scopeSummary.themeGroupCount }),
    '',
    t('analytics.wiki.markdownWikiPagesHeading'),
    themeRows.length
      ? themeRows.map(({ record, summary }) => {
          const pageLink = record.pageId ? buildDocLinkMarkdown(record.pageId, record.pageTitle) : record.pageTitle
          const themeLink = record.themeDocumentId && record.themeDocumentTitle
            ? buildDocLinkMarkdown(record.themeDocumentId, record.themeDocumentTitle)
            : (record.themeDocumentTitle || '-')
          return t('analytics.wiki.markdownWikiPageRow', {
            pageLink,
            themeLink,
            summary: summary || '-',
            count: record.sourceDocumentIds.length,
            updatedAt: record.lastApply?.appliedAt || record.lastGeneratedAt || '-',
          })
        }).join('\n')
      : t('analytics.wiki.markdownNoTopicWikiPagesYet'),
    '',
    t('analytics.wiki.markdownUnclassifiedSourcesHeading'),
    params.unclassifiedDocuments.length
      ? params.unclassifiedDocuments
          .map(document => `- ${buildDocLinkMarkdown(document.documentId, document.title)}`)
          .join('\n')
      : t('analytics.wiki.markdownNone'),
  ].join('\n')

  return {
    managedMarkdown,
    fullMarkdown: [
      managedMarkdown,
      '',
      INDEX_MANUAL_NOTES_MARKDOWN,
    ].join('\n'),
    sectionMetadata: [
      {
        key: 'meta',
        heading: t('analytics.wiki.overviewHeading'),
        markdown: [
          t('analytics.wiki.markdownUpdatedAt', { value: params.generatedAt }),
          t('analytics.wiki.markdownTopicWikiPages', { count: themeRows.length }),
          t('analytics.wiki.markdownUnclassifiedSources', { count: params.unclassifiedDocuments.length }),
        ].join('\n'),
      },
    ],
  }
}

function buildLogEntryMarkdown(params: {
  generatedAt: string
  scopeSummary: WikiApplyScopeSummary
  scopeDescriptionLines: string[]
  themeResults: WikiApplyBatchResult['themePages']
}): string {
  const counts = buildThemeResultCounts(params.themeResults)
  const touchedPages = params.themeResults
    .map(item => t('analytics.wiki.logTouchedPageRow', {
      result: formatApplyResultLabel(item.result),
      page: item.pageId ? buildDocLinkMarkdown(item.pageId, item.pageTitle) : item.pageTitle,
    }))
    .join('\n')

  return [
    `## ${params.generatedAt}`,
    '',
    ...params.scopeDescriptionLines,
    t('analytics.wiki.logMatchedSourceDocs', { count: params.scopeSummary.sourceDocumentCount }),
    t('analytics.wiki.logMatchedTopics', { count: params.scopeSummary.themeGroupCount }),
    t('analytics.wiki.logCreatedPages', { count: counts.created }),
    t('analytics.wiki.logUpdatedPages', { count: counts.updated }),
    t('analytics.wiki.logUnchangedPages', { count: counts.skipped }),
    t('analytics.wiki.logConflictPages', { count: counts.conflict }),
    '',
    t('analytics.wiki.logTouchedPagesHeading'),
    touchedPages || t('analytics.wiki.markdownNone'),
  ].join('\n')
}

function buildThemeResultCounts(themeResults: WikiApplyBatchResult['themePages']) {
  return themeResults.reduce(
    (counts, item) => {
      if (item.result === 'created') {
        counts.created += 1
      } else if (item.result === 'updated') {
        counts.updated += 1
      } else if (item.result === 'skipped') {
        counts.skipped += 1
      } else if (item.result === 'conflict') {
        counts.conflict += 1
      }
      return counts
    },
    {
      created: 0,
      updated: 0,
      skipped: 0,
      conflict: 0,
    },
  )
}

async function resolveExistingPageId(params: {
  notebook: string
  hpath: string
  storedPageId?: string
  getIDsByHPath: GetIDsByHPathFn
  getBlockKramdown: GetBlockKramdownFn
}): Promise<string | undefined> {
  if (params.storedPageId) {
    try {
      await params.getBlockKramdown(params.storedPageId)
      return params.storedPageId
    } catch {
      // Fall through to hpath lookup.
    }
  }

  const ids = await params.getIDsByHPath(params.notebook, params.hpath)
  return ids[0] || undefined
}

async function readWikiPageState(
  pageId: string,
  api: {
    getChildBlocks: GetChildBlocksFn
    getBlockKramdown: GetBlockKramdownFn
  },
) {
  const fullMarkdown = await safeReadBlockMarkdown(pageId, api.getBlockKramdown)
  const managedMarkdown = extractManagedMarkdown(fullMarkdown)

  return {
    fullMarkdown,
    managedMarkdown,
    pageFingerprint: fingerprintWikiContent(fullMarkdown),
    managedFingerprint: fingerprintWikiContent(managedMarkdown),
  }
}

async function readPlainPageState(
  pageId: string,
  api: {
    getBlockKramdown: GetBlockKramdownFn
  },
) {
  const fullMarkdown = await safeReadBlockMarkdown(pageId, api.getBlockKramdown)
  return {
    fullMarkdown,
    pageFingerprint: fingerprintWikiContent(fullMarkdown),
  }
}

async function resolveWikiPageStructure(
  pageId: string,
  api: {
    getChildBlocks: GetChildBlocksFn
    getBlockKramdown: GetBlockKramdownFn
  },
) {
  const children = await api.getChildBlocks(pageId)
  let managedBlockId = ''
  let manualBlockId = ''

  for (const child of children) {
    const markdown = await safeReadBlockMarkdown(child.id, api.getBlockKramdown)
    const trimmedMarkdown = markdown.trim()
    if (matchesWikiHeading(trimmedMarkdown, 'managedRoot', '##')) {
      managedBlockId = child.id
      continue
    }
    if (matchesWikiHeading(trimmedMarkdown, 'manualNotes', '##')) {
      manualBlockId = child.id
    }
  }

  return {
    managedBlockId: managedBlockId || undefined,
    manualBlockId: manualBlockId || undefined,
  }
}

async function syncWikiBlockAttrs(params: {
  pageId: string
  pageType: WikiPageType
  themeDocumentId?: string
  api: {
    getChildBlocks: GetChildBlocksFn
    getBlockKramdown: GetBlockKramdownFn
    getBlockAttrs: GetBlockAttrsFn
    setBlockAttrs: SetBlockAttrsFn
  }
}) {
  await mergeBlockAttrs(params.pageId, {
    [WIKI_BLOCK_ATTR_KEYS.pageType]: params.pageType,
    ...(params.themeDocumentId ? { [WIKI_BLOCK_ATTR_KEYS.themeDocumentId]: params.themeDocumentId } : {}),
  }, params.api)

  const children = await params.api.getChildBlocks(params.pageId)
  for (const child of children) {
    const markdown = await safeReadBlockMarkdown(child.id, params.api.getBlockKramdown)
    const trimmedMarkdown = markdown.trim()
    if (matchesWikiHeading(trimmedMarkdown, 'managedRoot', '##')) {
      await mergeBlockAttrs(child.id, {
        [WIKI_BLOCK_ATTR_KEYS.region]: 'managed',
      }, params.api)
      continue
    }
    if (matchesWikiHeading(trimmedMarkdown, 'manualNotes', '##')) {
      await mergeBlockAttrs(child.id, {
        [WIKI_BLOCK_ATTR_KEYS.region]: 'manual',
      }, params.api)
    }
  }
}

async function mergeBlockAttrs(
  blockId: string,
  nextAttrs: Record<string, string>,
  api: {
    getBlockAttrs: GetBlockAttrsFn
    setBlockAttrs: SetBlockAttrsFn
  },
) {
  const currentAttrs = await api.getBlockAttrs(blockId)
  const mergedAttrs = {
    ...currentAttrs,
    ...nextAttrs,
  }

  const hasChanged = Object.entries(nextAttrs).some(([key, value]) => currentAttrs[key] !== value)
  if (!hasChanged) {
    return
  }

  await api.setBlockAttrs(blockId, mergedAttrs)
}

function buildThemePageRecord(params: {
  page: WikiThemePageApplyInput
  pageId?: string
  storedRecord: WikiPageSnapshotRecord | null
  pageFingerprint?: string
  managedFingerprint?: string
  appliedAt: string
  applyResult: WikiApplyResult
}): WikiPageSnapshotRecord {
  return {
    pageType: 'theme',
    pageTitle: params.page.pageTitle,
    pageId: params.pageId,
    themeDocumentId: params.page.themeDocumentId,
    themeDocumentTitle: params.page.themeDocumentTitle,
    sourceDocumentIds: [...params.page.sourceDocumentIds],
    pageFingerprint: params.pageFingerprint,
    managedFingerprint: params.managedFingerprint,
    lastGeneratedAt: params.page.preview.lastGeneratedAt,
    lastPreview: {
      generatedAt: params.page.preview.lastGeneratedAt,
      status: params.page.preview.status,
      sourceDocumentIds: [...params.page.sourceDocumentIds],
      pageFingerprint: params.page.preview.pageFingerprint,
      managedFingerprint: params.page.preview.managedFingerprint,
    },
    lastApply: {
      appliedAt: params.appliedAt,
      result: params.applyResult,
      sourceDocumentIds: [...params.page.sourceDocumentIds],
      pageFingerprint: params.pageFingerprint ?? params.storedRecord?.pageFingerprint,
      managedFingerprint: params.managedFingerprint ?? params.storedRecord?.managedFingerprint,
    },
  }
}

function collectUniqueSourceDocumentIds(
  themePages: WikiThemePageApplyInput[],
  unclassifiedDocuments: Array<{ documentId: string }>,
) {
  return [...new Set([
    ...themePages.flatMap(page => page.sourceDocumentIds),
    ...unclassifiedDocuments.map(document => document.documentId),
  ])]
}

export function buildSiblingDocumentPath(themeDocumentHPath: string, pageTitle: string): string {
  const normalizedPath = normalizeDocumentPath(themeDocumentHPath)
  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  if (lastSlashIndex <= 0) {
    return `/${pageTitle}`
  }
  return `${normalizedPath.slice(0, lastSlashIndex)}/${pageTitle}`
}

function joinDocumentPath(basePath: string, title: string): string {
  const normalizedBasePath = normalizeDocumentPath(basePath)
  if (normalizedBasePath === '/') {
    return `/${title}`
  }
  return `${normalizedBasePath}/${title}`
}

function normalizeDocumentPath(path: string): string {
  const normalized = (path || '')
    .replace(/\\/g, '/')
    .replace(/\.sy$/i, '')
    .trim()
  if (!normalized) {
    return '/'
  }
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, '')
    : withLeadingSlash
}

function extractOverviewSummary(markdown: string): string {
  const heading = `### ${WIKI_PAGE_HEADINGS.overview}`
  const startIndex = markdown.indexOf(heading)
  if (startIndex < 0) {
    return ''
  }

  const bodyStartIndex = startIndex + heading.length
  const nextHeadingIndex = markdown.indexOf('\n### ', bodyStartIndex)
  const sectionBody = markdown
    .slice(bodyStartIndex, nextHeadingIndex >= 0 ? nextHeadingIndex : markdown.length)

  return sectionBody
    .replace(/^\s*-\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function extractManagedMarkdown(fullMarkdown: string): string {
  const manualHeadingIndex = getWikiHeadingCandidates('manualNotes', '##')
    .map(heading => fullMarkdown.indexOf(`\n${heading}`))
    .filter(index => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1
  if (manualHeadingIndex < 0) {
    return fullMarkdown.trim()
  }
  return fullMarkdown.slice(0, manualHeadingIndex).trim()
}

async function safeReadBlockMarkdown(blockId: string, getBlockKramdown: GetBlockKramdownFn) {
  try {
    const block = await getBlockKramdown(blockId)
    return block?.kramdown ?? ''
  } catch {
    return ''
  }
}

function formatApplyResultLabel(result: WikiApplyResult): string {
  switch (result) {
    case 'created':
      return t('analytics.wiki.resultCreated')
    case 'updated':
      return t('analytics.wiki.resultUpdated')
    case 'skipped':
      return t('analytics.wiki.resultSkipped')
    case 'conflict':
      return t('analytics.wiki.resultConflict')
    default:
      return result
  }
}
