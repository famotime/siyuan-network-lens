import {
  buildWikiChatPrompt,
  buildWikiContextMessage as buildPromptWikiContextMessage,
  buildWikiRoutePrompt,
} from './llm-wiki-prompts'

export interface WikiChatResult {
  answer: string
  usedPageTitle: string
  referencedDocumentIds: string[]
}

export function parseRouteResponse(content: string): string {
  return content.trim()
}

export function parseChatResponse(content: string): { answer: string, referencedDocumentIds: string[] } {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : cleaned,
      referencedDocumentIds: Array.isArray(parsed.referencedDocumentIds)
        ? parsed.referencedDocumentIds.filter((id: any) => typeof id === 'string')
        : [],
    }
  } catch {
    return { answer: content.trim(), referencedDocumentIds: [] }
  }
}

export function buildRouteSystemPrompt(): string {
  return buildWikiRoutePrompt({
    question: '',
    pageTitles: [],
  }).messages[0].content
}

export function buildRouteUserPrompt(params: {
  question: string
  pageTitles: string[]
  pageSummaries?: string[]
}): string {
  return buildWikiRoutePrompt(params).messages[1].content
}

export function extractFirstSectionAfterHeader(kramdown: string, headerText: string): string {
  if (!kramdown) return ''
  const lines = kramdown.split('\n')
  let foundHeader = false
  let headerLevel = 0
  const sectionLines: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      if (!foundHeader) {
        if (text.includes(headerText)) {
          foundHeader = true
          headerLevel = level
        }
      } else {
        // Next heading at same or higher level → end of section
        if (level <= headerLevel) break
        sectionLines.push(line)
      }
    } else if (foundHeader) {
      sectionLines.push(line)
    }
  }

  return sectionLines.join('\n').trim().slice(0, 500)
}

export function buildChatSystemPrompt(): string {
  return buildWikiChatPrompt({
    question: '',
    wikiPageTitle: '',
    wikiPageMarkdown: '',
  }).messages[0].content
}

export function buildChatUserPrompt(params: {
  question: string
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  return buildWikiChatPrompt(params).messages[1].content
}

export function buildWikiContextMessage(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  return buildPromptWikiContextMessage(params)
}
