import type { ComputedRef, Ref } from 'vue'
import type {
  AnalyticsFilters,
  ReferenceGraphReport,
  TimeRange,
  TrendReport,
} from '@/analytics/analysis'
import type { AiLinkRepairStore } from '@/analytics/ai-link-repair-store'
import type { AiInboxResult, AiInboxService } from '@/analytics/ai-inbox'
import type {
  AiLinkSuggestionService,
  OrphanAiSuggestionState,
} from '@/analytics/ai-link-suggestions'
import type { AnalyticsSnapshot } from '@/analytics/siyuan-data'
import type { SummaryCardItem } from '@/analytics/summary-details'
import { t } from '@/i18n/ui'
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
  aiLinkRepairStore: AiLinkRepairStore | null
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
        throw new Error(t('analytics.controller.aiProxyNotInitialized'))
      }
      const result = await params.aiInboxService.testConnection({
        config: params.config,
      })
      params.aiConnectionMessage.value = result.message
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.aiConnectionTestFailed')
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
      params.aiInboxError.value = t('analytics.controller.analysisNotReady')
      return null
    }

    params.aiInboxLoading.value = true
    params.aiInboxError.value = ''
    params.aiConnectionMessage.value = ''

    try {
      if (!params.aiInboxService) {
        throw new Error(t('analytics.controller.aiProxyNotInitialized'))
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
        titleCleanupConfig: params.config,
      })
      params.aiInboxResult.value = await params.aiInboxService.generateInbox({
        config: params.config,
        payload,
      })
      return params.aiInboxResult.value
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToGenerateAiInbox')
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
        error: t('analytics.controller.analysisNotReady'),
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
        error: t('analytics.controller.currentDocNotInOrphanList'),
        result: null,
      })
      return
    }

    updateOrphanAiSuggestionState(documentId, {
      loading: true,
      statusMessage: t('analytics.controller.analyzingDocumentSemantics'),
      error: '',
      result: null,
    })

    try {
      if (!params.aiLinkSuggestionService) {
        throw new Error(t('analytics.controller.aiProxyNotInitialized'))
      }
      const result = await params.aiLinkSuggestionService.suggestForOrphan({
        config: params.config,
        sourceDocument,
        orphan,
        documents: params.snapshot.value.documents,
        themeDocuments: params.themeDocuments.value,
        existingTags: params.tagOptions.value,
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

      if (params.aiLinkRepairStore) {
        try {
          await params.aiLinkRepairStore.saveSuggestionIndex({
            config: params.config,
            sourceDocument,
            orphan,
            themeDocuments: params.themeDocuments.value,
            filters: params.filters.value,
            timeRange: params.timeRange.value,
            result,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : t('analytics.controller.failedToSaveAiIndexRecord')
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
      const message = error instanceof Error ? error.message : t('analytics.controller.failedToGenerateAiLinkSuggestions')
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
