import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { renderSimpleMarkdown } from '@/utils/markdown'

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase()
}

function extractSection(markdown: string, heading: string): string {
  if (!markdown || !heading) return ''
  const lines = markdown.split(/\r?\n/)
  const normalizedHeading = normalizeHeading(heading)
  let capturing = false
  const result: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const currentHeading = normalizeHeading(headingMatch[2])
      if (currentHeading === normalizedHeading || currentHeading.includes(normalizedHeading) || normalizedHeading.includes(currentHeading)) {
        capturing = true
        continue
      }
      if (capturing) break
    }

    if (capturing) result.push(line)
  }

  return result.join('\n').trim()
}

function buildRenderedHtml(markdown: string): string {
  if (!markdown) {
    return ''
  }

  return renderSimpleMarkdown(markdown, {
    preserveSiyuanLinkLabels: true,
    stripHtmlTags: true,
  })
}

export function buildSuggestionSnippetPreview(params: {
  suggestion: WikiMaintenanceSuggestion
  currentMarkdown: string
  revisedMarkdown: string
}): {
  currentSectionMarkdown: string
  revisedSectionMarkdown: string
  currentHtml: string
  revisedHtml: string
  currentDiffHtml: string
  revisedDiffHtml: string
  hasDiff: boolean
} {
  const heading = params.suggestion.sectionHeading?.trim() ?? ''
  const currentSectionMarkdown = heading ? extractSection(params.currentMarkdown, heading) : ''
  const revisedSectionMarkdown = heading ? extractSection(params.revisedMarkdown, heading) : ''
  const diff = buildLineDiff(currentSectionMarkdown, revisedSectionMarkdown)

  return {
    currentSectionMarkdown,
    revisedSectionMarkdown,
    currentHtml: buildRenderedHtml(currentSectionMarkdown),
    revisedHtml: buildRenderedHtml(revisedSectionMarkdown),
    currentDiffHtml: buildDiffHtml(diff.removed, 'removed'),
    revisedDiffHtml: buildDiffHtml(diff.added, 'added'),
    hasDiff: currentSectionMarkdown.trim() !== revisedSectionMarkdown.trim(),
  }
}

function buildLineDiff(currentMarkdown: string, revisedMarkdown: string): {
  removed: string[]
  added: string[]
} {
  const currentLines = currentMarkdown.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const revisedLines = revisedMarkdown.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

  return {
    removed: currentLines.filter(line => !revisedLines.includes(line)),
    added: revisedLines.filter(line => !currentLines.includes(line)),
  }
}

function buildDiffHtml(lines: string[], variant: 'removed' | 'added'): string {
  if (!lines.length) {
    return ''
  }

  return lines
    .map((line) => {
      const rendered = buildRenderedHtml(line)
      return `<div class="suggestion-card__diff-line suggestion-card__diff-line--${variant}">${rendered}</div>`
    })
    .join('')
}
