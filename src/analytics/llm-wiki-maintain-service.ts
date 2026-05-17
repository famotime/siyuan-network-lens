import type { WikiMaintenanceSuggestion } from './wiki-index'
import { buildSinglePageMaintenancePrompt } from './llm-wiki-prompts'
import { resolveUiLocale, t, type UiLocale } from '@/i18n/ui'

export interface WikiMaintenanceResult {
  suggestions: WikiMaintenanceSuggestion[]
  revisedMarkdown: string
}

function localizeMaintenanceDescription(description: string, locale: UiLocale): string {
  const text = description.trim()
  if (!text) {
    return ''
  }

  if (locale !== 'zh_CN') {
    return text
  }

  const localized = [
    {
      pattern: /^source document\s+`?["“]?(.+?)["”]?`?\s+\(id:\s*([^)]+)\)\s+is listed in the reference section but is not cited in the page content\.?\s*consider adding relevant citations from this source where appropriate\.?$/i,
      build: (_match: RegExpMatchArray, title: string, id: string) => `来源文档「${title}」（ID：${id}）出现在参考区域中，但未在页面内容中被引用。可在合适位置补充相关引文。`,
    },
    {
      pattern: /^the page indicates (\d+) source documents in the header, but only (\d+) are cited in the content\.?\s*the ['"]ai managed area['"] section['"]s ['"]source count['"] metadata should be verified against the actual number of cited sources\.?$/i,
      build: (_match: RegExpMatchArray, total: string, cited: string) => `页面头部显示有 ${total} 篇来源文档，但正文仅引用了 ${cited} 篇。请核对“AI 管理区”中的“源文档数”是否与实际引用数量一致。`,
    },
  ] as const

  for (const item of localized) {
    const match = text.match(item.pattern)
    if (match) {
      return item.build(match, ...match.slice(1))
    }
  }

  return text
}

function normalizeSuggestionType(type: unknown): WikiMaintenanceSuggestion['type'] {
  const normalized = typeof type === 'string'
    ? type.trim().toLowerCase().replace(/[_\s]+/g, '-')
    : ''

  switch (normalized) {
    case 'broken-link':
    case 'brokenlink':
      return 'broken-link'
    case 'outdated-section':
    case 'outdated':
    case 'stale-section':
      return 'outdated-section'
    case 'missing-reference':
    case 'missingreference':
      return 'missing-reference'
    default:
      return 'outdated-section'
  }
}

export function parseMaintenanceResponse(content: string, locale = resolveUiLocale()): WikiMaintenanceResult {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
    console.info('[llm-wiki-maintain] parseMaintenanceResponse cleaned length:', cleaned.length, 'first 100 chars:', cleaned.slice(0, 100))
    const parsed = JSON.parse(cleaned)
    const suggestions: WikiMaintenanceSuggestion[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((s: any) => ({
        type: normalizeSuggestionType(s.type),
        description: localizeMaintenanceDescription(s.description ?? '', locale),
        sectionHeading: s.sectionHeading,
      }))
      : []
    return {
      suggestions,
      revisedMarkdown: typeof parsed.revisedMarkdown === 'string' ? parsed.revisedMarkdown : '',
    }
  } catch (e: any) {
    console.error('[llm-wiki-maintain] parseMaintenanceResponse failed:', e.message)
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
  return buildSinglePageMaintenancePrompt({
    wikiPageTitle: '',
    wikiPageMarkdown: '',
    brokenLinkIds: [],
  }).messages[0].content
}

export function buildMaintenanceUserPrompt(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  brokenLinkIds: string[]
  locale?: UiLocale
}): string {
  return buildSinglePageMaintenancePrompt(params).messages[1].content
}
