import type { WikiMaintenanceSuggestion } from './wiki-index'
import { t } from '@/i18n/ui'

export interface WikiMaintenanceResult {
  suggestions: WikiMaintenanceSuggestion[]
  revisedMarkdown: string
}

export function parseMaintenanceResponse(content: string): WikiMaintenanceResult {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    const suggestions: WikiMaintenanceSuggestion[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((s: any) => ({
        type: s.type ?? 'outdated-section',
        description: s.description ?? '',
        sectionHeading: s.sectionHeading,
      }))
      : []
    return {
      suggestions,
      revisedMarkdown: typeof parsed.revisedMarkdown === 'string' ? parsed.revisedMarkdown : '',
    }
  } catch {
    return { suggestions: [], revisedMarkdown: '' }
  }
}

const SUGGESTION_TYPE_LABELS: Record<WikiMaintenanceSuggestion['type'], () => string> = {
  'broken-link': () => {
    try { return t('llmWiki.maintain.brokenLink') } catch { return 'broken-link' }
  },
  'outdated-section': () => {
    try { return t('llmWiki.maintain.outdatedSection') } catch { return 'outdated-section' }
  },
  'missing-reference': () => {
    try { return t('llmWiki.maintain.missingReference') } catch { return 'missing-reference' }
  },
}

export function buildMaintenanceSummary(suggestions: Pick<WikiMaintenanceSuggestion, 'type'>[]): string {
  if (!suggestions.length) {
    return ''
  }
  const counts = new Map<string, number>()
  for (const s of suggestions) {
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => `${SUGGESTION_TYPE_LABELS[type as WikiMaintenanceSuggestion['type']]?.() ?? type} ×${count}`)
    .join('、')
}

export function buildMaintenanceSystemPrompt(): string {
  return [
    'You are a wiki page maintenance assistant for SiYuan notes.',
    'Review the provided wiki page content and check for:',
    '1. Broken document ID links (siyuan://blocks/<id> pointing to non-existent documents)',
    '2. Outdated sections (content that should be updated based on source documents)',
    '3. Missing references (source documents not linked from the wiki page)',
    'Return JSON with two fields: "suggestions" (array of {type, description, sectionHeading?}) and "revisedMarkdown" (the corrected full wiki page content).',
    'Do not invent content not grounded in the source materials.',
  ].join(' ')
}

export function buildMaintenanceUserPrompt(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  brokenLinkIds: string[]
}): string {
  const parts = [
    `Wiki page title: ${params.wikiPageTitle}`,
    '',
    'Wiki page content:',
    params.wikiPageMarkdown,
  ]
  if (params.brokenLinkIds.length) {
    parts.push('', `Confirmed broken link IDs: ${params.brokenLinkIds.join(', ')}`)
  }
  return parts.join('\n')
}
