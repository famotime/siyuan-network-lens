import type { ComputedRef, Ref } from 'vue'

import { buildDocumentSummary } from '@/analytics/ai-document-summary'
import type {
  AnalyticsFilters,
  ReferenceGraphReport,
  TimeRange,
  TrendReport,
} from '@/analytics/analysis'
import type { AiDocumentIndexStore } from '@/analytics/ai-index-store'
import type { AiInboxResult, AiInboxService } from '@/analytics/ai-inbox'
import type {
  AiLinkSuggestionService,
  OrphanAiSuggestionState,
} from '@/analytics/ai-link-suggestions'
import type { AnalyticsSnapshot } from '@/analytics/siyuan-data'
import type { SummaryCardItem } from '@/analytics/summary-details'
import type { ThemeDocument } from '@/analytics/theme-documents'
import type { PluginConfig } from '@/types/config'

type ShowMessageFn = (text: string, timeout?: number, type?: 'info' | 'error') => void

export function createAnalyticsAiController(params: {
  config: PluginConfig
  snapshot: Ref<AnalyticsSnapshot | null>
  report: ComputedRef<ReferenceGraphReport | null>
  trends: ComputedRef<TrendReport | null>
  summaryCards: ComputedRef<SummaryCardItem[]>
  filters: ComputedRef<AnalyticsFilters>
  timeRange: Ref<TimeRange>
  dormantDays: Ref<number>
  themeDocuments: ComputedRef<ThemeDocument[]>
  tagOptions: ComputedRef<string[]>
  aiInboxLoading: Ref<boolean>
  aiConnectionTesting: Ref<boolean>
  aiInboxError: Ref<string>
  aiConnectionMessage: Ref<string>
  aiInboxResult: Ref<AiInboxResult | null>
  orphanAiSuggestionStates: Ref<Map<string, OrphanAiSuggestionState>>
  aiInboxService: AiInboxService | null
  aiLinkSuggestionService: AiLinkSuggestionService | null
  aiIndexStore: AiDocumentIndexStore | null
  notify: ShowMessageFn
}) {
  function updateOrphanAiSuggestionState(documentId: string, nextState: OrphanAiSuggestionState) {
    const nextMap = new Map(params.orphanAiSuggestionStates.value)
    nextMap.set(documentId, nextState)
    params.orphanAiSuggestionStates.value = nextMap
  }

  async function testAiConnection() {
    params.aiConnectionTesting.value = true
    params.aiInboxError.value = ''
    params.aiConnectionMessage.value = ''

    try {
      if (!params.aiInboxService) {
        throw new Error('AI 网络代理未初始化')
      }
      const result = await params.aiInboxService.testConnection({
        config: params.config,
      })
      params.aiConnectionMessage.value = result.message
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 连接测试失败'
      params.aiInboxError.value = message
      params.notify(message, 5000, 'error')
      return {
        ok: false,
        message,
      }
    } finally {
      params.aiConnectionTesting.value = false
    }
  }

  async function generateAiInbox() {
    if (!params.report.value || !params.trends.value || !params.snapshot.value) {
      params.aiInboxError.value = '当前分析结果还未准备好，请先刷新分析'
      return null
    }

    params.aiInboxLoading.value = true
    params.aiInboxError.value = ''
    params.aiConnectionMessage.value = ''

    try {
      if (!params.aiInboxService) {
        throw new Error('AI 网络代理未初始化')
      }
      const payload = params.aiInboxService.buildPayload({
        documents: params.snapshot.value.documents,
        report: params.report.value,
        trends: params.trends.value,
        summaryCards: params.summaryCards.value,
        filters: params.filters.value,
        timeRange: params.timeRange.value,
        dormantDays: params.dormantDays.value,
        contextCapacity: params.config.aiContextCapacity,
        themeDocuments: params.themeDocuments.value,
        wikiPageSuffix: params.config.wikiPageSuffix,
      })
      params.aiInboxResult.value = await params.aiInboxService.generateInbox({
        config: params.config,
        payload,
      })
      return params.aiInboxResult.value
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 收件箱生成失败'
      params.aiInboxError.value = message
      params.notify(message, 5000, 'error')
      return null
    } finally {
      params.aiInboxLoading.value = false
    }
  }

  async function generateOrphanAiSuggestion(documentId: string) {
    if (!params.snapshot.value || !params.report.value) {
      updateOrphanAiSuggestionState(documentId, {
        loading: false,
        statusMessage: '',
        error: '当前分析结果还未准备好，请先刷新分析',
        result: null,
      })
      return
    }

    const sourceDocument = params.snapshot.value.documents.find(document => document.id === documentId)
    const orphan = params.report.value.orphans.find(item => item.documentId === documentId)
    if (!sourceDocument || !orphan) {
      updateOrphanAiSuggestionState(documentId, {
        loading: false,
        statusMessage: '',
        error: '当前文档不在孤立文档列表中',
        result: null,
      })
      return
    }

    updateOrphanAiSuggestionState(documentId, {
      loading: true,
      statusMessage: '正在分析文档语义并生成 embedding…',
      error: '',
      result: null,
    })

    try {
      if (!params.aiLinkSuggestionService) {
        throw new Error('AI 网络代理未初始化')
      }
      const result = await params.aiLinkSuggestionService.suggestForOrphan({
        config: params.config,
        sourceDocument,
        orphan,
        documents: params.snapshot.value.documents,
        themeDocuments: params.themeDocuments.value,
        availableTags: params.tagOptions.value,
        report: params.report.value,
        onProgress: (message) => {
          updateOrphanAiSuggestionState(documentId, {
            loading: true,
            statusMessage: message,
            error: '',
            result: null,
          })
        },
      })

      if (params.aiIndexStore) {
        const documentSummary = buildDocumentSummary(sourceDocument)

        if (params.aiIndexStore.saveDocumentSummary) {
          try {
            await params.aiIndexStore.saveDocumentSummary({
              config: params.config,
              sourceDocument,
              summaryShort: documentSummary.summaryShort,
              summaryMedium: documentSummary.summaryMedium,
              keywords: documentSummary.keywords,
              evidenceSnippets: documentSummary.evidenceSnippets,
              updatedAt: result.generatedAt,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : '文档摘要索引保存失败'
            params.notify(message, 5000, 'error')
          }
        }

        try {
          await params.aiIndexStore.saveSuggestionIndex({
            config: params.config,
            sourceDocument,
            orphan,
            themeDocuments: params.themeDocuments.value,
            filters: params.filters.value,
            timeRange: params.timeRange.value,
            result,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'AI 索引记录保存失败'
          params.notify(message, 5000, 'error')
        }
      }

      updateOrphanAiSuggestionState(documentId, {
        loading: false,
        statusMessage: '',
        error: '',
        result,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 补链建议生成失败'
      updateOrphanAiSuggestionState(documentId, {
        loading: false,
        statusMessage: '',
        error: message,
        result: null,
      })
      params.notify(message, 5000, 'error')
    }
  }

  return {
    testAiConnection,
    generateAiInbox,
    generateOrphanAiSuggestion,
  }
}
