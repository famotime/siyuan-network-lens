import type { WikiIndexPage, WikiMaintenanceState } from '@/analytics/wiki-index'
import type { WikiMaintenanceResult } from '@/analytics/llm-wiki-maintain-service'

type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>

const WIKI_BLOCK_LINK_PATTERN = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi

export function buildMissingDependencyState(): WikiMaintenanceState {
  return {
    status: 'idle',
    suggestions: [{
      type: 'outdated-section',
      description: 'Missing dependencies: forwardProxy or getBlockKramdown not available',
    }],
  }
}

export function buildMaintenanceSuccessState(result: WikiMaintenanceResult): WikiMaintenanceState {
  return {
    status: 'suggestions-ready',
    suggestions: result.suggestions,
    diffPreview: result.revisedMarkdown,
  }
}

export function buildMaintenanceErrorState(error: unknown): WikiMaintenanceState {
  const description = error instanceof Error ? error.message : String(error)
  return {
    status: 'idle',
    suggestions: [{
      type: 'outdated-section',
      description,
    }],
  }
}

export async function probeBrokenLinkIds(
  kramdown: string,
  getBlockKramdown: GetBlockKramdownFn,
): Promise<string[]> {
  const brokenLinkIds: string[] = []
  const linkMatches = [...kramdown.matchAll(WIKI_BLOCK_LINK_PATTERN)]

  for (const match of linkMatches) {
    try {
      await getBlockKramdown(match[1])
    } catch {
      brokenLinkIds.push(match[1])
    }
  }

  return brokenLinkIds
}

export function readMaintenanceContentFromResponseBody(body: any): string {
  if (body?.error) {
    const errMsg = body.error.message || body.error.type || JSON.stringify(body.error)
    throw new Error(`LLM API error: ${errMsg}`)
  }

  return body?.choices?.[0]?.message?.content ?? ''
}

export function syncWikiPageState(pages: WikiIndexPage[], page: WikiIndexPage): WikiIndexPage[] {
  const index = pages.findIndex(item => item.documentId === page.documentId)
  if (index < 0) {
    return pages
  }

  const nextPages = [...pages]
  nextPages[index] = { ...page }
  return nextPages
}
