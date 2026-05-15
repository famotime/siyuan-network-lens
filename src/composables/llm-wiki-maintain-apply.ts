import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { matchesWikiHeading, resolveWikiSectionKeyFromHeading } from '@/analytics/wiki-page-model'
import { WIKI_SECTION_MARKER_PREFIX } from '@/analytics/wiki-renderer'

interface ParsedWikiSectionChunk {
  key: string
  heading: string
  raw: string
}

interface ParsedWikiSectionDocument {
  prefix: string
  suffix: string
  sections: ParsedWikiSectionChunk[]
}

export function resolveAppliedMaintenanceMarkdown(params: {
  currentMarkdown: string
  revisedMarkdown: string
  selectedSuggestions: WikiMaintenanceSuggestion[]
}): string {
  const currentMarkdown = params.currentMarkdown?.trim()
  const revisedMarkdown = params.revisedMarkdown?.trim()

  if (!currentMarkdown || !revisedMarkdown || !params.selectedSuggestions.length) {
    return params.revisedMarkdown
  }

  const currentDoc = parseWikiSectionDocument(currentMarkdown)
  const revisedDoc = parseWikiSectionDocument(revisedMarkdown)
  const selectedKeys = resolveSelectedSectionKeys({
    current: currentDoc,
    revised: revisedDoc,
    suggestions: params.selectedSuggestions,
  })

  if (!selectedKeys.length) {
    return params.revisedMarkdown
  }

  const revisedByKey = new Map(revisedDoc.sections.map(section => [section.key, section]))
  const currentByKey = new Map(currentDoc.sections.map(section => [section.key, section]))

  if (selectedKeys.some(key => !revisedByKey.has(key) || !currentByKey.has(key))) {
    return params.revisedMarkdown
  }

  const mergedSections = currentDoc.sections.map((section) => {
    if (!selectedKeys.includes(section.key)) {
      return section.raw
    }
    return revisedByKey.get(section.key)?.raw ?? section.raw
  })

  return [currentDoc.prefix, ...mergedSections, currentDoc.suffix]
    .filter(part => part.trim())
    .join('\n\n')
    .trim()
}

function resolveSelectedSectionKeys(params: {
  current: ParsedWikiSectionDocument
  revised: ParsedWikiSectionDocument
  suggestions: WikiMaintenanceSuggestion[]
}): string[] {
  const keys = new Set<string>()

  for (const suggestion of params.suggestions) {
    const heading = suggestion.sectionHeading?.trim()
    if (!heading) {
      continue
    }

    const resolvedKey = findSectionKeyByHeading(params.revised, heading)
      || findSectionKeyByHeading(params.current, heading)
      || resolveWikiSectionKeyFromHeading(heading)

    if (resolvedKey) {
      keys.add(resolvedKey)
    }
  }

  return [...keys]
}

function findSectionKeyByHeading(document: ParsedWikiSectionDocument, heading: string): string {
  const normalizedHeading = normalizeHeading(heading)
  if (!normalizedHeading) {
    return ''
  }

  const exact = document.sections.find(section => normalizeHeading(section.heading) === normalizedHeading)
  if (exact) {
    return exact.key
  }

  const fuzzy = document.sections.find((section) => {
    const normalizedSectionHeading = normalizeHeading(section.heading)
    return normalizedSectionHeading.includes(normalizedHeading) || normalizedHeading.includes(normalizedSectionHeading)
  })

  return fuzzy?.key ?? ''
}

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase()
}

function parseWikiSectionDocument(markdown: string): ParsedWikiSectionDocument {
  const lines = markdown.split(/\r?\n/)
  const sectionStartIndices: number[] = []

  for (let index = 0; index < lines.length; index += 1) {
    if (parseSectionMarker(lines[index])) {
      sectionStartIndices.push(index)
    }
  }

  if (!sectionStartIndices.length) {
    return {
      prefix: markdown.trim(),
      suffix: '',
      sections: [],
    }
  }

  const suffixStartIndex = findSuffixStartIndex(lines, sectionStartIndices[0])
  const firstSectionIndex = sectionStartIndices[0]
  const effectiveDocumentEnd = suffixStartIndex >= 0 ? suffixStartIndex : lines.length
  const effectiveStarts = sectionStartIndices.filter(index => index < effectiveDocumentEnd)
  const sections: ParsedWikiSectionChunk[] = []

  for (let index = 0; index < effectiveStarts.length; index += 1) {
    const start = effectiveStarts[index]
    const end = effectiveStarts[index + 1] ?? effectiveDocumentEnd
    const raw = lines.slice(start, end).join('\n').trim()
    const key = parseSectionMarker(lines[start])
    const heading = extractSectionHeading(lines.slice(start, end))

    if (!key || !raw) {
      continue
    }

    sections.push({
      key,
      heading,
      raw,
    })
  }

  return {
    prefix: lines.slice(0, firstSectionIndex).join('\n').trim(),
    suffix: suffixStartIndex >= 0 ? lines.slice(suffixStartIndex).join('\n').trim() : '',
    sections,
  }
}

function findSuffixStartIndex(lines: string[], searchStart: number): number {
  for (let index = searchStart; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed.startsWith('## ')) {
      continue
    }

    if (matchesWikiHeading(trimmed, 'manualNotes', '##')) {
      return index
    }
  }

  return -1
}

function extractSectionHeading(lines: string[]): string {
  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)$/)
    if (headingMatch) {
      return headingMatch[1].trim()
    }
  }

  return ''
}

function parseSectionMarker(line: string): string {
  const trimmed = line.trim()
  if (!trimmed.startsWith(WIKI_SECTION_MARKER_PREFIX) || !trimmed.endsWith('-->')) {
    return ''
  }

  return trimmed.slice(WIKI_SECTION_MARKER_PREFIX.length, -3).trim()
}
