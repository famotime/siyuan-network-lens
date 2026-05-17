import type { Plugin } from 'siyuan'

import type {
  WikiCommandProvider,
  WikiCommandInvokeContext,
  WikiCommandInvokeResult,
  WikiPublicCommand,
} from './wiki-command-provider-types'
import { forwardProxy } from '@/api'
import {
  appendBlock,
  createDocWithMd,
  deleteBlock,
  getBlockAttrs,
  getBlockKramdown,
  getChildBlocks,
  getIDsByHPath,
  prependBlock,
  setBlockAttrs,
  updateBlock,
} from '@/api'
import { loadAnalyticsSnapshot } from '@/analytics/siyuan-data'
import { analyzeReferenceGraph, analyzeTrends } from '@/analytics/analysis'
import type { DocumentRecord } from '@/analytics/analysis'
import { collectThemeDocuments } from '@/analytics/theme-documents'
import type { ThemeDocument } from '@/analytics/theme-documents'
import { buildLinkAssociations } from '@/analytics/link-associations'
import { isAiConfigComplete } from '@/analytics/ai-inbox'
import { createAiWikiService } from '@/analytics/wiki-ai'
import { createAiDocumentIndexStoreFromPlugin } from '@/analytics/ai-index-store'
import { createAiWikiStoreFromPlugin } from '@/analytics/wiki-store'
import { buildWikiPageStorageKey } from '@/analytics/wiki-store'
import type { WikiPageSnapshotRecord } from '@/analytics/wiki-store'
import { buildWikiPreview } from '@/analytics/wiki-diff'
import { applyWikiDocuments } from '@/analytics/wiki-documents'
import { buildThemeWikiPageTitle } from '@/analytics/wiki-page-model'
import { renderThemeWikiDraft } from '@/analytics/wiki-renderer'
import { normalizeWikiSourceDocLinkTypes } from '@/analytics/wiki-source-docs'
import type { WikiSourceDocumentEntry } from '@/analytics/wiki-source-docs'
import { resolveScopedPathTarget } from '@/analytics/document-paths'
import {
  buildWikiSourceProfileMap,
  resolveExistingWikiPage,
} from '@/composables/use-analytics-wiki'
import { buildSingleThemeWikiPayload } from '@/composables/use-analytics-wiki-actions'
import {
  DEFAULT_CONFIG,
  DEFAULT_WIKI_CONTAINER_PATH,
  ensureConfigDefaults,
} from '@/types/config'
import type { PluginConfig } from '@/types/config'

const STORAGE_NAME = 'settings.json'

const COMMANDS: WikiPublicCommand[] = [
  {
    id: 'generate-llm-wiki',
    title: '生成 LLM Wiki 文档',
    description: '基于主题文档及其关联文档生成 LLM Wiki 页面',
  },
]

export function createWikiCommandProvider(options: {
  pluginVersion: string
  plugin: Plugin
}): WikiCommandProvider {
  return {
    protocol: 'wiki-command-provider',
    protocolVersion: 1,
    providerId: 'siyuan-network-lens',
    providerName: '脉络镜 / Network Lens',
    providerVersion: options.pluginVersion,
    listCommands: () => COMMANDS,
    invokeCommand: async (commandId, context) => {
      if (commandId !== 'generate-llm-wiki') {
        return {
          ok: false,
          errorCode: 'command-not-found',
          message: `未找到命令：${commandId}`,
        }
      }
      return invokeWikiGenerationDirect(options.plugin, context)
    },
  }
}

async function invokeWikiGenerationDirect(
  plugin: Plugin,
  context: WikiCommandInvokeContext,
): Promise<WikiCommandInvokeResult> {
  try {
    // 1. 读取并校验配置
    const rawConfig = await plugin.loadData(STORAGE_NAME)
    const config: PluginConfig = { ...DEFAULT_CONFIG, ...(rawConfig as PluginConfig ?? {}) }
    ensureConfigDefaults(config)

    if (!config.wikiEnabled) {
      return { ok: false, errorCode: 'wiki-not-configured', message: '请先在脉络镜设置中启用 Wiki 功能' }
    }
    if (!config.aiEnabled || !isAiConfigComplete(config)) {
      return { ok: false, errorCode: 'ai-not-configured', message: '请先在脉络镜设置中配置 AI 服务' }
    }

    const themeDocumentId = context.themeDocumentId
    if (!themeDocumentId) {
      return { ok: false, errorCode: 'execution-failed', message: '未指定主题文档 ID' }
    }

    // 2. 执行分析管线
    const snapshot = await loadAnalyticsSnapshot()
    const now = new Date()
    const timeRange = '7d' as const

    const report = analyzeReferenceGraph({
      documents: snapshot.documents,
      references: snapshot.references,
      now,
      timeRange,
      wikiPageSuffix: config.wikiPageSuffix,
      excludedPaths: config.analysisExcludedPaths,
      excludedNamePrefixes: config.analysisExcludedNamePrefixes,
      excludedNameSuffixes: config.analysisExcludedNameSuffixes,
      notebooks: snapshot.notebooks,
    })

    const trends = analyzeTrends({
      documents: snapshot.documents,
      references: snapshot.references,
      now,
      days: 7,
      timeRange,
      wikiPageSuffix: config.wikiPageSuffix,
      excludedPaths: config.analysisExcludedPaths,
      excludedNamePrefixes: config.analysisExcludedNamePrefixes,
      excludedNameSuffixes: config.analysisExcludedNameSuffixes,
      notebooks: snapshot.notebooks,
    })

    const themeDocuments = collectThemeDocuments({
      documents: snapshot.documents,
      config,
      notebooks: snapshot.notebooks,
    })

    // 3. 确定主题文档
    const themeDocument = themeDocuments.find(d => d.documentId === themeDocumentId)
      ?? findDocumentAsTheme(snapshot.documents, themeDocumentId)

    if (!themeDocument) {
      return { ok: false, errorCode: 'execution-failed', message: `未找到文档：${themeDocumentId}` }
    }

    // 4. 发现源文档
    const documentMap = new Map(snapshot.documents.map(d => [d.id, d]))
    const associations = buildLinkAssociations({
      documentId: themeDocumentId,
      references: snapshot.references,
      documentMap,
      now,
      timeRange,
    })

    const sourceDocumentIds = [
      ...associations.outbound.map(item => item.documentId),
      ...associations.inbound.map(item => item.documentId),
      ...associations.childDocuments.map(item => item.documentId),
    ]
    const sourceDocuments = [...new Set(sourceDocumentIds)]
      .map(id => documentMap.get(id))
      .filter((doc): doc is DocumentRecord => Boolean(doc) && doc.id !== themeDocumentId)

    if (!sourceDocuments.length) {
      return { ok: false, errorCode: 'execution-failed', message: '当前文档没有关联的源文档可供生成 Wiki' }
    }

    // 5. 构建 source profile（可能触发 AI 索引生成）
    const generatedAt = new Date().toISOString()
    const aiIndexStore = createAiDocumentIndexStoreFromPlugin(plugin)

    const profileResult = await buildWikiSourceProfileMap({
      sourceDocuments,
      config,
      aiIndexStore,
      forwardProxy,
      getChildBlocks,
      getBlockKramdown,
      generatedAt,
    })

    const effectiveSourceDocuments = profileResult.effectiveDocuments
    if (!effectiveSourceDocuments.length) {
      return {
        ok: false,
        errorCode: 'execution-failed',
        message: `所有源文档索引生成失败：${profileResult.skippedDocuments.map(d => d.title).join('、')}`,
      }
    }

    // 6. 构建 wiki 生成 payload
    const scopedDocumentMap = new Map(snapshot.documents.map(d => [d.id, d]))
    const payload = await buildSingleThemeWikiPayload({
      config,
      themeDocument: {
        documentId: themeDocument.documentId,
        title: themeDocument.title,
        themeName: themeDocument.themeName,
      },
      sourceDocuments: effectiveSourceDocuments,
      report,
      trends,
      documentMap: scopedDocumentMap,
      getDocumentProfile: doc => profileResult.profileMap.get(doc.id) ?? null,
      getBlockKramdown,
      fullContentEnabled: config.wikiFullContentEnabled === true,
    })

    // 7. 调用 AI Wiki 服务：诊断 → 规划 → 生成各节
    const aiWikiService = createAiWikiService({ forwardProxy })

    const wikiTarget = resolveScopedPathTarget(config.wikiContainerPath ?? '', snapshot.notebooks)
    const wikiContainerPath = wikiTarget?.path ?? ''
    const pageTitle = buildThemeWikiPageTitle(themeDocument.title, config.wikiPageSuffix ?? '')

    // 增量 diff：检查现有页面
    const aiWikiStore = createAiWikiStoreFromPlugin(plugin)
    const pageKey = buildWikiPageStorageKey({
      pageType: 'theme',
      pageTitle,
      themeDocumentId: themeDocument.documentId,
    })
    const storedRecord = aiWikiStore ? await aiWikiStore.getPageRecord(pageKey) : null

    let existingWikiContent: string | undefined
    if (storedRecord) {
      const pageHPath = wikiContainerPath
        ? `${wikiContainerPath}/${pageTitle}`
        : `${themeDocument.hpath}/${pageTitle}`
      const existingPage = await resolveExistingWikiPage({
        notebook: wikiTarget?.notebook ?? themeDocument.box,
        pageHPath,
        storedRecord,
        getIDsByHPath,
        getBlockKramdown,
      })
      existingWikiContent = existingPage?.managedMarkdown
    }

    const diagnosis = await aiWikiService.diagnoseThemeTemplate({
      config,
      payload,
      existingWikiContent,
    })

    const pagePlan = await aiWikiService.planThemePage({
      config,
      payload,
      diagnosis,
      existingWikiContent,
    })

    const sections = await Promise.all(
      pagePlan.sectionOrder.map(sectionType =>
        aiWikiService.generateThemeSection({
          config,
          payload,
          diagnosis,
          pagePlan,
          sectionType,
          existingWikiContent,
        }),
      ),
    )

    // 8. 渲染 wiki 草稿
    const sourceDocumentTitleMap = Object.fromEntries(
      payload.sourceDocuments.map(doc => [doc.documentId, doc.title]),
    )
    const draft = renderThemeWikiDraft({
      pageTitle: payload.pageTitle,
      pairedThemeDocumentId: payload.themeDocumentId,
      pairedThemeTitle: payload.themeDocumentTitle,
      generatedAt,
      model: config.aiModel?.trim() || 'unknown',
      sourceDocumentCount: payload.sourceDocuments.length,
      diagnosis,
      pagePlan,
      sections,
      sourceDocumentTitleMap,
    })

    // 9. 构建 preview diff
    const existingPageForPreview = await resolveExistingWikiPage({
      notebook: wikiTarget?.notebook ?? themeDocument.box,
      pageHPath: wikiContainerPath
        ? `${wikiContainerPath}/${pageTitle}`
        : `${themeDocument.hpath}/${pageTitle}`,
      storedRecord: storedRecord ?? undefined,
      getIDsByHPath,
      getBlockKramdown,
    })

    const preview = buildWikiPreview({
      pageType: 'theme',
      pageTitle: payload.pageTitle,
      sourceDocumentIds: payload.sourceDocuments.map(doc => doc.documentId),
      generatedAt,
      nextDraft: draft,
      existingPage: existingPageForPreview?.managedMarkdown
        ? { managedMarkdown: existingPageForPreview.managedMarkdown }
        : undefined,
      storedRecord: storedRecord ?? undefined,
    })

    // 10. 保存 preview record
    if (aiWikiStore) {
      const sourceDocumentTimestamps: Record<string, string> = {}
      for (const doc of effectiveSourceDocuments) {
        sourceDocumentTimestamps[doc.id] = doc.updated ?? ''
      }

      const nextRecord: WikiPageSnapshotRecord = {
        pageType: 'theme',
        pageTitle: payload.pageTitle,
        pageId: existingPageForPreview?.pageId ?? storedRecord?.pageId,
        themeDocumentId: payload.themeDocumentId,
        themeDocumentTitle: payload.themeDocumentTitle,
        sourceDocumentIds: payload.sourceDocuments.map(doc => doc.documentId),
        sourceDocumentEntries: [],
        sourceDocumentTimestamps,
        pageFingerprint: preview.pageFingerprint,
        managedFingerprint: preview.managedFingerprint,
        lastGeneratedAt: generatedAt,
        lastPreview: {
          generatedAt,
          status: preview.status,
          sourceDocumentIds: payload.sourceDocuments.map(doc => doc.documentId),
          pageFingerprint: preview.pageFingerprint,
          managedFingerprint: preview.managedFingerprint,
        },
        lastApply: storedRecord?.lastApply,
      }
      await aiWikiStore.savePageRecord(nextRecord)
    }

    // 11. 写入 wiki 文档
    const sourceDocumentEntries: WikiSourceDocumentEntry[] = effectiveSourceDocuments.map(doc => ({
      documentId: doc.id,
      title: doc.title || doc.hpath || doc.path || doc.id,
      linkTypes: normalizeWikiSourceDocLinkTypes(['outbound']),
    }))

    const themePageForApply = {
      pageTitle: payload.pageTitle,
      themeName: payload.themeName,
      themeDocumentId: payload.themeDocumentId,
      themeDocumentTitle: payload.themeDocumentTitle,
      themeDocumentBox: themeDocument.box,
      themeDocumentHPath: themeDocument.hpath,
      sourceDocumentIds: payload.sourceDocuments.map(doc => doc.documentId),
      sourceDocumentEntries,
      preview,
      draft,
    }

    await applyWikiDocuments({
      config: {
        themeNotebookId: config.themeNotebookId,
        themeDocumentPath: config.themeDocumentPath,
        wikiIndexTitle: config.wikiIndexTitle ?? 'LLM-Wiki-Index',
        wikiLogTitle: config.wikiLogTitle ?? 'LLM-Wiki-Maintenance-Log',
        wikiPageSuffix: config.wikiPageSuffix ?? '-llm-wiki',
        wikiContainerPath: config.wikiContainerPath ?? DEFAULT_WIKI_CONTAINER_PATH,
      },
      notebooks: snapshot.notebooks,
      generatedAt,
      scopeSummary: {
        sourceDocumentCount: effectiveSourceDocuments.length,
        themeGroupCount: 1,
        unclassifiedDocumentCount: 0,
        excludedWikiDocumentCount: 0,
      },
      scopeDescriptionLines: [
        `- 由 ${context.sourcePlugin} 触发的单文档 Wiki 生成`,
      ],
      themePages: [themePageForApply],
      unclassifiedDocuments: [],
      overwriteConflicts: false,
      store: aiWikiStore,
      api: {
        createDocWithMd,
        getIDsByHPath,
        prependBlock,
        appendBlock,
        updateBlock,
        deleteBlock,
        getChildBlocks,
        getBlockKramdown,
        getBlockAttrs,
        setBlockAttrs,
      },
    })

    return { ok: true, message: `Wiki 文档生成完成：${payload.pageTitle}` }
  } catch (error) {
    return {
      ok: false,
      errorCode: 'execution-failed',
      message: error instanceof Error ? error.message : 'Wiki 文档生成失败',
    }
  }
}

function findDocumentAsTheme(
  documents: DocumentRecord[],
  documentId: string,
): ThemeDocument | null {
  const doc = documents.find(d => d.id === documentId)
  if (!doc) {
    return null
  }
  return {
    documentId: doc.id,
    title: doc.title || doc.hpath || doc.path || doc.id,
    themeName: doc.title || doc.name || doc.id,
    matchTerms: [],
    box: doc.box,
    hpath: doc.hpath,
    path: doc.path,
  }
}
