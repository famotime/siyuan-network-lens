import { ref, type Ref, type ComputedRef } from 'vue'
import type { WikiIndexPage, WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { parseWikiIndexPages } from '@/analytics/wiki-index'
import { parseMaintenanceResponse, buildMaintenanceSystemPrompt, buildMaintenanceUserPrompt } from '@/analytics/llm-wiki-maintain-service'
import type { PluginConfig } from '@/types/config'

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
  reviewPage: (page: WikiIndexPage) => Promise<void>
  applyMaintenance: (page: WikiIndexPage, revisedMarkdown: string) => Promise<void>
}

export function createLlmWikiController(params: {
  config: ComputedRef<PluginConfig>
  forwardProxy?: ForwardProxyFn
  getBlockKramdown?: GetBlockKramdownFn
  updateBlock?: (id: string, dataType: string, data: string) => Promise<any>
}): LlmWikiController {
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

  async function reviewPage(page: WikiIndexPage) {
    if (!params.forwardProxy || !params.getBlockKramdown) return

    page.maintenanceState = { status: 'reviewing' }

    try {
      const block = await params.getBlockKramdown(page.documentId)

      const linkPattern = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
      const brokenLinkIds: string[] = []
      const linkMatches = [...block.kramdown.matchAll(linkPattern)]
      for (const match of linkMatches) {
        try {
          await params.getBlockKramdown(match[1])
        } catch {
          brokenLinkIds.push(match[1])
        }
      }

      const cfg = params.config.value
      const endpoint = `${(cfg.aiBaseUrl ?? '').replace(/\/+$/, '')}/chat/completions`
      const response = await params.forwardProxy(
        endpoint,
        'POST',
        {
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
        },
        [['Authorization', `Bearer ${cfg.aiApiKey ?? ''}`]],
        (cfg.aiRequestTimeoutSeconds ?? 60) * 1000,
        'application/json',
      )
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
      const content = body.choices?.[0]?.message?.content ?? ''
      const result = parseMaintenanceResponse(content)

      page.maintenanceState = {
        status: 'suggestions-ready',
        suggestions: result.suggestions,
        diffPreview: result.revisedMarkdown,
      }
    } catch (e: any) {
      page.maintenanceState = {
        status: 'idle',
        suggestions: [{ type: 'outdated-section', description: e.message ?? String(e) }],
      }
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
