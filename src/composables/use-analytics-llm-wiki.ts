import { ref, type Ref, type ComputedRef } from 'vue'
import type { WikiIndexPage, WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { parseWikiIndexPages } from '@/analytics/wiki-index'
import { parseMaintenanceResponse, buildMaintenanceSystemPrompt, buildMaintenanceUserPrompt } from '@/analytics/llm-wiki-maintain-service'
import { resolveAiEndpoint } from '@/analytics/ai-inbox'
import {
  buildMaintenanceErrorState,
  buildMaintenanceSuccessState,
  buildMissingDependencyState,
  probeBrokenLinkIds,
  readMaintenanceContentFromResponseBody,
  syncWikiPageState,
} from './llm-wiki-maintain-review'
import type { PluginConfig } from '@/types/config'
import type { PluginLogger } from '@/utils/plugin-logger'

type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>

export interface LlmWikiController {
  wikiPages: Ref<WikiIndexPage[]>
  wikiPageCount: Ref<number>
  loadWikiPages: (kramdown: string) => void
  reviewPage: (page: WikiIndexPage) => Promise<WikiIndexPage>
  applyMaintenance: (page: WikiIndexPage, revisedMarkdown: string) => Promise<void>
}

const noopLogger: PluginLogger = { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

export function createLlmWikiController(params: {
  config: ComputedRef<PluginConfig>
  forwardProxy?: ForwardProxyFn
  getBlockKramdown?: GetBlockKramdownFn
  updateBlock?: (dataType: string, data: string, id: string) => Promise<any>
  logger?: PluginLogger
}): LlmWikiController {
  const log = params.logger ?? noopLogger
  const wikiPages = ref<WikiIndexPage[]>([])
  const wikiPageCount = ref(0)

  function loadWikiPages(kramdown: string) {
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: params.config.value.wikiPageSuffix ?? '-llm-wiki',
    })
    wikiPages.value = pages
    wikiPageCount.value = pages.length
  }

  async function reviewPage(page: WikiIndexPage): Promise<WikiIndexPage> {
    log.info('[llm-wiki-maintain] reviewPage start', page.documentId, page.title)

    if (!params.forwardProxy || !params.getBlockKramdown) {
      log.error('[llm-wiki-maintain] missing dependencies', {
        forwardProxy: !!params.forwardProxy,
        getBlockKramdown: !!params.getBlockKramdown,
      })
      page.maintenanceState = buildMissingDependencyState()
      wikiPages.value = syncWikiPageState(wikiPages.value, page)
      return page
    }

    page.maintenanceState = { status: 'reviewing' }
    wikiPages.value = syncWikiPageState(wikiPages.value, page)

    try {
      log.debug('[llm-wiki-maintain] fetching kramdown for', page.documentId)
      const block = await params.getBlockKramdown(page.documentId)
      log.debug('[llm-wiki-maintain] kramdown length', block.kramdown.length)

      const brokenLinkIds = await probeBrokenLinkIds(block.kramdown, params.getBlockKramdown)
      log.info('[llm-wiki-maintain] broken links detected', brokenLinkIds.length)

      const cfg = params.config.value
      const endpoint = resolveAiEndpoint(cfg.aiBaseUrl ?? '', 'chat/completions')
      log.info('[llm-wiki-maintain] calling LLM API', endpoint, 'model:', cfg.aiModel)
      const response = await params.forwardProxy(
        endpoint,
        'POST',
        JSON.stringify({
          model: cfg.aiModel,
          messages: [
            { role: 'system', content: buildMaintenanceSystemPrompt() },
            { role: 'user', content: buildMaintenanceUserPrompt({
              wikiPageTitle: page.title,
              wikiPageMarkdown: block.kramdown,
              brokenLinkIds,
            }) },
          ],
          max_tokens: cfg.aiMaxTokens ?? 4096,
          temperature: cfg.aiTemperature ?? 0.7,
        }),
        [
          { Authorization: `Bearer ${cfg.aiApiKey ?? ''}` },
          { Accept: 'application/json' },
        ],
        (cfg.aiRequestTimeoutSeconds ?? 60) * 1000,
        'application/json',
      )
      log.info('[llm-wiki-maintain] LLM API response received')
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
      const content = readMaintenanceContentFromResponseBody(body)
      log.info('[llm-wiki-maintain] raw LLM content length:', content.length, 'preview:', content.slice(0, 1000))
      if (!content) {
        log.warn('[llm-wiki-maintain] LLM returned empty content, full response body:', JSON.stringify(body).slice(0, 1000))
      }
      const result = parseMaintenanceResponse(content)

      log.info('[llm-wiki-maintain] parsed', result.suggestions.length, 'suggestions, revisedMarkdown length:', result.revisedMarkdown.length)
      page.maintenanceState = buildMaintenanceSuccessState(result)
      wikiPages.value = syncWikiPageState(wikiPages.value, page)
    } catch (e: any) {
      log.error('[llm-wiki-maintain] reviewPage error', e.message ?? e)
      page.maintenanceState = buildMaintenanceErrorState(e)
      wikiPages.value = syncWikiPageState(wikiPages.value, page)
    }

    return page
  }

  async function applyMaintenance(page: WikiIndexPage, revisedMarkdown: string) {
    if (!params.updateBlock) return
    page.maintenanceState = { ...page.maintenanceState, status: 'applying' }
    wikiPages.value = syncWikiPageState(wikiPages.value, page)
    try {
      await params.updateBlock('markdown', revisedMarkdown, page.documentId)
      page.maintenanceState = { status: 'idle' }
    } catch {
      page.maintenanceState = { ...page.maintenanceState, status: 'suggestions-ready' }
    }
    wikiPages.value = syncWikiPageState(wikiPages.value, page)
  }

  return {
    wikiPages,
    wikiPageCount,
    loadWikiPages,
    reviewPage,
    applyMaintenance,
  }
}
