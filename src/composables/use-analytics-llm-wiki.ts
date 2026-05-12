import { ref, type Ref, type ComputedRef } from 'vue'
import type { WikiIndexPage, WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { parseWikiIndexPages } from '@/analytics/wiki-index'
import { parseMaintenanceResponse, buildMaintenanceSystemPrompt, buildMaintenanceUserPrompt } from '@/analytics/llm-wiki-maintain-service'
import { resolveAiEndpoint } from '@/analytics/ai-inbox'
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
  updateBlock?: (id: string, dataType: string, data: string) => Promise<any>
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
      page.maintenanceState = {
        status: 'idle',
        suggestions: [{ type: 'outdated-section', description: 'Missing dependencies: forwardProxy or getBlockKramdown not available' }],
      }
      syncWikiPageState(page)
      return page
    }

    page.maintenanceState = { status: 'reviewing' }
    syncWikiPageState(page)

    try {
      log.debug('[llm-wiki-maintain] fetching kramdown for', page.documentId)
      const block = await params.getBlockKramdown(page.documentId)
      log.debug('[llm-wiki-maintain] kramdown length', block.kramdown.length)

      const linkPattern = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
      const brokenLinkIds: string[] = []
      const linkMatches = [...block.kramdown.matchAll(linkPattern)]
      log.debug('[llm-wiki-maintain] found', linkMatches.length, 'links, probing...')
      for (const match of linkMatches) {
        try {
          await params.getBlockKramdown(match[1])
        } catch {
          brokenLinkIds.push(match[1])
        }
      }
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
      if (body.error) {
        const errMsg = body.error.message || body.error.type || JSON.stringify(body.error)
        throw new Error(`LLM API error: ${errMsg}`)
      }
      const content = body.choices?.[0]?.message?.content ?? ''
      log.info('[llm-wiki-maintain] raw LLM content length:', content.length, 'preview:', content.slice(0, 1000))
      if (!content) {
        log.warn('[llm-wiki-maintain] LLM returned empty content, full response body:', JSON.stringify(body).slice(0, 1000))
      }
      const result = parseMaintenanceResponse(content)

      log.info('[llm-wiki-maintain] parsed', result.suggestions.length, 'suggestions, revisedMarkdown length:', result.revisedMarkdown.length)
      page.maintenanceState = {
        status: 'suggestions-ready',
        suggestions: result.suggestions,
        diffPreview: result.revisedMarkdown,
      }
      syncWikiPageState(page)
    } catch (e: any) {
      log.error('[llm-wiki-maintain] reviewPage error', e.message ?? e)
      page.maintenanceState = {
        status: 'idle',
        suggestions: [{ type: 'outdated-section', description: e.message ?? String(e) }],
      }
      syncWikiPageState(page)
    }

    return page
  }

  function syncWikiPageState(page: WikiIndexPage) {
    const idx = wikiPages.value.findIndex(p => p.documentId === page.documentId)
    if (idx >= 0) {
      wikiPages.value[idx] = { ...page }
    }
  }

  async function applyMaintenance(page: WikiIndexPage, revisedMarkdown: string) {
    if (!params.updateBlock) return
    page.maintenanceState = { ...page.maintenanceState, status: 'applying' }
    try {
      await params.updateBlock(page.documentId, 'markdown', revisedMarkdown)
      page.maintenanceState = { status: 'idle' }
    } catch {
      page.maintenanceState = { ...page.maintenanceState, status: 'suggestions-ready' }
    }
  }

  return {
    wikiPages,
    wikiPageCount,
    loadWikiPages,
    reviewPage,
    applyMaintenance,
  }
}
