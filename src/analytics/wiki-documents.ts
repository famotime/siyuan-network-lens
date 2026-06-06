import { buildDocLinkMarkdown } from './link-sync'
import { LLM_WIKI_THEME_PROMPT_VERSIONS } from './llm-wiki-prompts'
import { resolveScopedPathTarget, type NotebookPathOption } from './document-paths'
import { fingerprintWikiContent } from './wiki-diff'
import {
  WIKI_BLOCK_ATTR_KEYS,
  WIKI_PAGE_HEADINGS,
  findHeadingIndex,
  matchesWikiHeading,
  type WikiApplyResult,
  type WikiPageType,
} from './wiki-page-model'
import { WIKI_SECTION_MARKER_PREFIX, type RenderedWikiDraft } from './wiki-renderer'
import { buildWikiPageStorageKey, type AiWikiStore, type WikiPageSnapshotRecord } from './wiki-store'
import type { WikiPagePreviewResult } from './wiki-diff'
import {
  WIKI_SOURCE_DOC_LINK_TYPE_PRIORITY,
  type WikiSourceDocumentEntry,
  type WikiSourceDocLinkType,
} from './wiki-source-docs'
import { t } from '@/i18n/ui'

const INDEX_MANUAL_NOTES_MARKDOWN = [
  `## ${WIKI_PAGE_HEADINGS.manualNotes}`,
  '',
  t('wikiMaintain.manualNotesReserved'),
].join('\n')

type BlockOpFn = (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
type BlockDeleteFn = (id: string) => Promise<any>
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
  sourceDocumentEntries?: WikiSourceDocumentEntry[]
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
    wikiContainerPath: string
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
    deleteBlock: BlockDeleteFn
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
    const pageHPath = joinDocumentPath(wikiTarget.containerPath, page.pageTitle)
    const existingPageId = await resolveExistingPageId({
      notebook: wikiTarget.notebook,
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
      notebook: wikiTarget.notebook,
      hpath: pageHPath,
      pageType: 'theme',
      pageId: existingPageId,
      themeDocumentId: page.themeDocumentId,
      draft: page.draft,
      overwriteConflicts: params.overwriteConflicts,
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
  const indexPath = joinDocumentPath(wikiTarget.containerPath, params.config.wikiIndexTitle)
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
    sourceDocumentEntries: [],
    pageFingerprint: refreshedIndexState.pageFingerprint,
    managedFingerprint: refreshedIndexState.managedFingerprint,
    lastGeneratedAt: params.generatedAt,
    lastApply: {
      appliedAt: params.generatedAt,
      result: indexWriteResult.result,
      sourceDocumentIds: collectUniqueSourceDocumentIds(params.themePages, params.unclassifiedDocuments),
      pageFingerprint: refreshedIndexState.pageFingerprint,
      managedFingerprint: refreshedIndexState.managedFingerprint,
      promptVersions: { ...LLM_WIKI_THEME_PROMPT_VERSIONS },
    },
  })

  const logEntryMarkdown = buildLogEntryMarkdown({
    generatedAt: params.generatedAt,
    scopeSummary: params.scopeSummary,
    scopeDescriptionLines: params.scopeDescriptionLines,
    themePages: params.themePages,
    themeResults,
    unclassifiedDocuments: params.unclassifiedDocuments,
  })
  const logPath = joinDocumentPath(wikiTarget.containerPath, params.config.wikiLogTitle)
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
  const logWriteResult = await prependLogDocument({
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
    sourceDocumentEntries: [],
    pageFingerprint: refreshedLogState.pageFingerprint,
    managedFingerprint: refreshedLogState.pageFingerprint,
    lastGeneratedAt: params.generatedAt,
    lastApply: {
      appliedAt: params.generatedAt,
      result: logWriteResult.result,
      sourceDocumentIds: collectUniqueSourceDocumentIds(params.themePages, params.unclassifiedDocuments),
      pageFingerprint: refreshedLogState.pageFingerprint,
      managedFingerprint: refreshedLogState.pageFingerprint,
      promptVersions: { ...LLM_WIKI_THEME_PROMPT_VERSIONS },
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
    wikiContainerPath: string
  },
  notebooks?: NotebookPathOption[],
) {
  const target = resolveScopedPathTarget(config.wikiContainerPath, notebooks)
  if (!target) {
    return null
  }
  return {
    notebook: target.notebook,
    containerPath: normalizeDocumentPath(target.path),
  }
}

async function upsertManagedWikiPage(params: {
  notebook: string
  hpath: string
  pageType: Extract<WikiPageType, 'theme' | 'index'>
  pageId?: string
  themeDocumentId?: string
  draft: RenderedWikiDraft
  overwriteConflicts?: boolean
  api: {
    createDocWithMd: CreateDocWithMdFn
    prependBlock: BlockOpFn
    appendBlock: BlockOpFn
    updateBlock: BlockOpFn
    deleteBlock: BlockDeleteFn
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

  if (params.overwriteConflicts) {
    const children = await params.api.getChildBlocks(params.pageId)
    const preserveIds = new Set([
      ...structure.manualBlockIds,
      ...(structure.managedBlockId ? [structure.managedBlockId] : []),
    ])

    for (const child of children) {
      if (!preserveIds.has(child.id)) {
        await params.api.deleteBlock(child.id)
      }
    }

    if (structure.managedBlockId) {
      const managedChildren = await params.api.getChildBlocks(structure.managedBlockId)
      for (const child of managedChildren) {
        await params.api.deleteBlock(child.id)
      }
      const sectionContent = stripManagedHeadingLines(params.draft.managedMarkdown)
      if (sectionContent) {
        await params.api.prependBlock('markdown', sectionContent, structure.managedBlockId)
      }
    } else {
      await params.api.prependBlock('markdown', params.draft.managedMarkdown, params.pageId)
    }

    if (structure.manualBlockIds.length === 0) {
      await params.api.appendBlock('markdown', INDEX_MANUAL_NOTES_MARKDOWN, params.pageId)
    }
  } else {
    if (structure.managedBlockId) {
      const managedChildren = await params.api.getChildBlocks(structure.managedBlockId)
      for (const child of managedChildren) {
        await params.api.deleteBlock(child.id)
      }
      const sectionContent = stripManagedHeadingLines(params.draft.managedMarkdown)
      if (sectionContent) {
        await params.api.prependBlock('markdown', sectionContent, structure.managedBlockId)
      }
    } else {
      await params.api.prependBlock('markdown', params.draft.managedMarkdown, params.pageId)
    }

    if (!structure.manualBlockId) {
      await params.api.appendBlock('markdown', INDEX_MANUAL_NOTES_MARKDOWN, params.pageId)
    }
  }

  return {
    pageId: params.pageId,
    result: 'updated',
  }
}

async function prependLogDocument(params: {
  notebook: string
  hpath: string
  title: string
  pageId?: string
  entryMarkdown: string
  api: {
    createDocWithMd: CreateDocWithMdFn
    prependBlock: BlockOpFn
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

  await params.api.prependBlock('markdown', params.entryMarkdown, params.pageId)
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
  const themeRowsRaw = await Promise.all(
    Object.values(snapshot.pages)
      .filter(record => record.pageType === 'theme')
      .filter(record => record.pageId)
      .sort((left, right) => left.pageTitle.localeCompare(right.pageTitle, 'zh-CN'))
      .map(async (record) => {
        const pageMarkdown = record.pageId
          ? await safeReadBlockMarkdown(record.pageId, params.api.getBlockKramdown)
          : ''
        if (!pageMarkdown) {
          const pageKey = buildWikiPageStorageKey({
            pageType: record.pageType,
            pageTitle: record.pageTitle,
            themeDocumentId: record.themeDocumentId,
          })
          await params.store.deletePageRecord(pageKey)
          return null
        }
        return {
          record,
          summary: extractIntroSummary(pageMarkdown),
        }
      }),
  )
  const themeRows = themeRowsRaw.filter((row): row is NonNullable<typeof row> => row !== null)

  const managedMarkdown = [
    `# ${params.title}`,
    '',
    `## ${WIKI_PAGE_HEADINGS.managedRoot}`,
    '',
    t('analytics.wiki.markdownOverviewHeading'),
    t('analytics.wiki.markdownUpdatedAt', { value: formatLocalTime(params.generatedAt) }),
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
          return [
            t('analytics.wiki.markdownWikiPageRow', { pageLink }),
            t('analytics.wiki.markdownWikiPageRowTheme', { themeLink }),
            t('analytics.wiki.markdownWikiPageRowSummary', { summary: summary || '-' }),
            t('analytics.wiki.markdownWikiPageRowCount', { count: record.sourceDocumentIds.length }),
            ...buildSourceDocumentGroupLines(record.sourceDocumentEntries ?? []),
            t('analytics.wiki.markdownWikiPageRowUpdatedAt', { updatedAt: formatLocalTime(record.lastApply?.appliedAt || record.lastGeneratedAt) }),
          ].join('\n')
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
          t('analytics.wiki.markdownUpdatedAt', { value: formatLocalTime(params.generatedAt) }),
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
  themePages: WikiThemePageApplyInput[]
  themeResults: WikiApplyBatchResult['themePages']
  unclassifiedDocuments: Array<{
    documentId: string
    title: string
  }>
}): string {
  const resultRows = params.themeResults.map((item, index) => ({
    ...item,
    themePage: params.themePages[index],
  }))

  const createdRows = resultRows.filter(item => item.result === 'created')
  const updatedRows = resultRows.filter(item => item.result === 'updated')
  const conflictRows = resultRows.filter(item => item.themePage.preview.status === 'conflict')

  const sourceDocumentTitleMap = new Map<string, string>()
  for (const page of params.themePages) {
    for (const entry of page.sourceDocumentEntries ?? []) {
      if (!sourceDocumentTitleMap.has(entry.documentId)) {
        sourceDocumentTitleMap.set(entry.documentId, entry.title)
      }
    }
  }
  for (const document of params.unclassifiedDocuments) {
    if (!sourceDocumentTitleMap.has(document.documentId)) {
      sourceDocumentTitleMap.set(document.documentId, document.title)
    }
  }

  const sourceDocumentLinks = deduplicateLogLinks([
    ...params.themePages.flatMap(page => page.sourceDocumentIds.map(documentId => ({
      id: documentId,
      title: sourceDocumentTitleMap.get(documentId) ?? documentId,
    }))),
    ...params.unclassifiedDocuments.map(document => ({
      id: document.documentId,
      title: document.title,
    })),
  ])

  const topicLinks = deduplicateLogLinks(
    params.themePages.map(page => ({
      id: page.themeDocumentId,
      title: page.themeDocumentTitle,
    })),
  )

  return [
    `## ${formatLocalTime(params.generatedAt)}`,
    '',
    ...buildLogStatLines(t('analytics.wiki.logCreatedPages', { count: createdRows.length }), createdRows.map(item => ({
      id: item.pageId,
      title: item.pageTitle,
    }))),
    ...buildLogStatLines(t('analytics.wiki.logUpdatedPages', { count: updatedRows.length }), updatedRows.map(item => ({
      id: item.pageId,
      title: item.pageTitle,
    }))),
    ...buildLogStatLines(t('analytics.wiki.logConflictPages', { count: conflictRows.length }), conflictRows.map(item => ({
      id: item.pageId,
      title: item.pageTitle,
    }))),
    ...params.scopeDescriptionLines,
    ...buildLogStatLines(t('analytics.wiki.logMatchedSourceDocs', { count: params.scopeSummary.sourceDocumentCount }), sourceDocumentLinks),
    ...buildLogStatLines(t('analytics.wiki.logMatchedTopics', { count: params.scopeSummary.themeGroupCount }), topicLinks),
  ].join('\n')
}

function buildLogStatLines(
  summaryLine: string,
  links: Array<{ id?: string, title: string }>,
): string[] {
  const result = [summaryLine]
  const effectiveLinks = deduplicateLogLinks(links)

  if (!effectiveLinks.length) {
    return result
  }

  result.push(...effectiveLinks.map(link => `  - ${link.id ? buildDocLinkMarkdown(link.id, link.title) : link.title}`))
  return result
}

function deduplicateLogLinks(items: Array<{ id?: string, title: string }>): Array<{ id?: string, title: string }> {
  const result: Array<{ id?: string, title: string }> = []
  const seen = new Set<string>()

  for (const item of items) {
    const normalizedTitle = item.title.trim()
    const normalizedId = item.id?.trim()
    if (!normalizedTitle) {
      continue
    }
    const key = normalizedId || normalizedTitle
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push({
      id: normalizedId,
      title: normalizedTitle,
    })
  }

  return result
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
      const block = await params.getBlockKramdown(params.storedPageId)
      if (block?.kramdown) {
        return params.storedPageId
      }
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
  const rawMarkdown = await safeReadBlockMarkdown(pageId, api.getBlockKramdown)
  const fullMarkdown = stripIalFromKramdown(rawMarkdown)
  const managedMarkdown = extractManagedMarkdown(rawMarkdown)

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
  const rawMarkdown = await safeReadBlockMarkdown(pageId, api.getBlockKramdown)
  const fullMarkdown = stripIalFromKramdown(rawMarkdown)
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
  const manualBlockIds: string[] = []
  let inManualSection = false

  for (const child of children) {
    const markdown = await safeReadBlockMarkdown(child.id, api.getBlockKramdown)
    const trimmedMarkdown = markdown.trim()

    if (matchesWikiHeading(trimmedMarkdown, 'manualNotes', '##')) {
      inManualSection = true
    }

    if (inManualSection) {
      manualBlockIds.push(child.id)
    } else if (matchesWikiHeading(trimmedMarkdown, 'managedRoot', '##')) {
      managedBlockId = child.id
    }
  }

  return {
    managedBlockId: managedBlockId || undefined,
    manualBlockId: manualBlockIds[0] || undefined,
    manualBlockIds,
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
    sourceDocumentEntries: params.page.sourceDocumentEntries?.map(entry => ({
      documentId: entry.documentId,
      title: entry.title,
      linkTypes: [...entry.linkTypes],
    })) ?? [],
    pageFingerprint: params.pageFingerprint,
    managedFingerprint: params.managedFingerprint,
    lastGeneratedAt: params.page.preview.lastGeneratedAt,
    lastPreview: {
      generatedAt: params.page.preview.lastGeneratedAt,
      status: params.page.preview.status,
      sourceDocumentIds: [...params.page.sourceDocumentIds],
      pageFingerprint: params.page.preview.pageFingerprint,
      managedFingerprint: params.page.preview.managedFingerprint,
      promptVersions: { ...LLM_WIKI_THEME_PROMPT_VERSIONS },
    },
    lastApply: {
      appliedAt: params.appliedAt,
      result: params.applyResult,
      sourceDocumentIds: [...params.page.sourceDocumentIds],
      pageFingerprint: params.pageFingerprint ?? params.storedRecord?.pageFingerprint,
      managedFingerprint: params.managedFingerprint ?? params.storedRecord?.managedFingerprint,
      promptVersions: { ...LLM_WIKI_THEME_PROMPT_VERSIONS },
    },
  }
}

function buildSourceDocumentGroupLines(entries: WikiSourceDocumentEntry[]): string[] {
  if (!entries.length) {
    return []
  }

  const lines: string[] = []
  const seen = new Set<string>()

  for (const linkType of WIKI_SOURCE_DOC_LINK_TYPE_PRIORITY) {
    const grouped = entries.filter(entry => !seen.has(entry.documentId) && entry.linkTypes.includes(linkType))
    if (!grouped.length) {
      continue
    }

    lines.push(`  - ${resolveSourceGroupLabel(linkType)}:`)
    for (const entry of grouped) {
      lines.push(`    - ${buildDocLinkMarkdown(entry.documentId, entry.title)}`)
      seen.add(entry.documentId)
    }
  }

  return lines
}

function resolveSourceGroupLabel(linkType: WikiSourceDocLinkType): string {
  switch (linkType) {
    case 'inbound':
      return t('analytics.wiki.markdownSourceGroupInbound')
    case 'outbound':
      return t('analytics.wiki.markdownSourceGroupOutbound')
    case 'child':
      return t('analytics.wiki.markdownSourceGroupChild')
    default:
      return linkType
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

function extractIntroSummary(markdown: string): string {
  const sectionBodies = parseManagedSectionBodies(markdown)
  const introBody = sectionBodies.get('intro') ?? sectionBodies.get('overview') ?? firstNonMetaSection(sectionBodies)
  if (!introBody) {
    return ''
  }

  const cleaned = stripIalFromKramdown(introBody)
    .replace(/<sup>[\s\S]*?<\/sup>/g, '')
    .replace(/^\s*-\s*/gm, '')
  const firstParagraph = cleaned.split(/\n\s*\n/)[0] ?? ''
  return firstParagraph.replace(/\s+/g, ' ').trim()
}

function stripIalFromKramdown(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inIalBlock = false
  let pendingIalPrefix = ''

  for (const line of lines) {
    if (inIalBlock) {
      if (line.includes('}')) {
        inIalBlock = false
        if (pendingIalPrefix) {
          result.push(pendingIalPrefix)
          pendingIalPrefix = ''
        }
      }
      continue
    }

    const trimmed = line.trim()

    // Multi-line IAL starting inline: text {: \n  ... }
    const inlineIalStart = line.match(/^(.*?)\{:\s(?!.*\})\s*$/)
    if (inlineIalStart) {
      const prefix = inlineIalStart[1].trimEnd()
      if (prefix) {
        pendingIalPrefix = prefix
      }
      inIalBlock = true
      continue
    }

    // Standalone multi-line IAL start: {: \n  ... }
    if (trimmed.startsWith('{:') && !trimmed.includes('}')) {
      inIalBlock = true
      continue
    }

    // List item with IAL: - content {: ... }
    const listIalMatch = line.match(/^(\s*[-*]\s+)\{:\s[^}]*\}\s*$/)
    if (listIalMatch) {
      result.push(listIalMatch[1].trimEnd())
      continue
    }

    // Inline IAL at end of line: text {: ... }
    const inlineIalMatch = line.match(/^(.*?)\{:\s[^}]*\}\s*$/)
    if (inlineIalMatch) {
      const content = inlineIalMatch[1].trimEnd()
      if (content) {
        result.push(content)
      }
      continue
    }

    // Standalone IAL on single line: {: ... }
    if (/^\s*\{:\s[^}]*\}\s*$/.test(line)) {
      continue
    }

    result.push(line)
  }

  return result.join('\n').trim()
}

function extractManagedMarkdown(fullMarkdown: string): string {
  const normalized = stripIalFromKramdown(fullMarkdown)
  const manualHeadingIndex = findHeadingIndex(normalized, 'manualNotes', '##')
  if (manualHeadingIndex < 0) {
    return normalized
  }
  return normalized.slice(0, manualHeadingIndex).trim()
}

async function safeReadBlockMarkdown(blockId: string, getBlockKramdown: GetBlockKramdownFn) {
  try {
    const block = await getBlockKramdown(blockId)
    return block?.kramdown ?? ''
  } catch {
    return ''
  }
}

function parseManagedSectionBodies(markdown: string): Map<string, string> {
  const sectionMap = new Map<string, string>()
  const lines = markdown.split(/\r?\n/)
  let currentKey = ''
  let currentHeading = ''
  let bodyLines: string[] = []

  const flush = () => {
    if (!currentHeading) {
      return
    }
    sectionMap.set(normalizeDynamicSectionKey(currentKey || currentHeading), bodyLines.join('\n').trim())
  }

  for (const line of lines) {
    const markerKey = parseSectionMarker(line)
    if (markerKey) {
      flush()
      currentKey = markerKey
      currentHeading = ''
      bodyLines = []
      continue
    }

    const headingMatch = line.match(/^###\s+(.+)$/)
    if (headingMatch) {
      flush()
      currentHeading = headingMatch[1].trim()
      bodyLines = []
      continue
    }

    if (currentHeading) {
      bodyLines.push(line)
    }
  }

  flush()
  return sectionMap
}

function firstNonMetaSection(sectionMap: Map<string, string>): string {
  for (const [key, value] of sectionMap.entries()) {
    if (key !== 'meta' && value.trim()) {
      return value
    }
  }
  return ''
}

function parseSectionMarker(line: string): string {
  const trimmed = line.trim()
  if (!trimmed.startsWith(WIKI_SECTION_MARKER_PREFIX) || !trimmed.endsWith('-->')) {
    return ''
  }
  return trimmed
    .slice(WIKI_SECTION_MARKER_PREFIX.length, -3)
    .trim()
}

function normalizeDynamicSectionKey(key: string): string {
  switch (key) {
    case 'overview':
      return 'intro'
    case 'keyDocuments':
      return 'highlights'
    case 'evidence':
      return 'sources'
    case '主题概览':
    case 'Topic overview':
      return 'intro'
    default:
      return key
  }
}

function stripManagedHeadingLines(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  let skipIndex = 0

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed) {
      continue
    }
    if (trimmed.startsWith('# ') && skipIndex === 0) {
      skipIndex = index + 1
      continue
    }
    if (trimmed.startsWith('## ') && matchesWikiHeading(trimmed, 'managedRoot', '##')) {
      skipIndex = index + 1
      break
    }
  }

  return lines.slice(skipIndex).join('\n').trim()
}

function formatLocalTime(isoString?: string): string {
  if (!isoString) {
    return '-'
  }
  try {
    return new Date(isoString).toLocaleString()
  } catch {
    return isoString
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
