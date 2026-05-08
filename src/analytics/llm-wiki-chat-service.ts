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
  return [
    'You are a topic routing assistant for SiYuan notes.',
    'Given a user question and a list of wiki page titles, return ONLY the single most relevant page title.',
    'Return the exact title string, nothing else.',
  ].join(' ')
}

export function buildRouteUserPrompt(params: {
  question: string
  pageTitles: string[]
  pageSummaries?: string[]
}): string {
  const lines = [
    `User question: ${params.question}`,
    '',
    'Available wiki pages:',
  ]
  for (let i = 0; i < params.pageTitles.length; i++) {
    const summary = params.pageSummaries?.[i]
    if (summary) {
      lines.push(`${i + 1}. ${params.pageTitles[i]}`)
      lines.push(`   Summary: ${summary}`)
    } else {
      lines.push(`${i + 1}. ${params.pageTitles[i]}`)
    }
  }
  lines.push('', 'Return the single most relevant page title:')
  return lines.join('\n')
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
  return [
    'You are a knowledge assistant for SiYuan notes.',
    'Answer the user question based on the provided wiki page content.',
    'If you need to reference specific source documents mentioned in the wiki page, include their document IDs in your response.',
    'Return JSON with two fields: "answer" (string) and "referencedDocumentIds" (string array, empty if no source documents were needed).',
    'Do not invent information not present in the provided context.',
  ].join(' ')
}

export function buildChatUserPrompt(params: {
  question: string
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  const parts = [
    `Wiki page: ${params.wikiPageTitle}`,
    '',
    'Wiki page content:',
    params.wikiPageMarkdown,
  ]
  if (params.sourceDocuments?.length) {
    parts.push('', 'Referenced source documents:')
    for (const doc of params.sourceDocuments) {
      parts.push(`--- Document: ${doc.title} (ID: ${doc.id}) ---`)
      parts.push(doc.markdown.slice(0, 3000))
      parts.push('')
    }
  }
  parts.push('', `User question: ${params.question}`)
  return parts.join('\n')
}

export function buildWikiContextMessage(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  const parts = [
    `Wiki page: ${params.wikiPageTitle}`,
    '',
    'Wiki page content:',
    params.wikiPageMarkdown,
  ]
  if (params.sourceDocuments?.length) {
    parts.push('', 'Referenced source documents:')
    for (const doc of params.sourceDocuments) {
      parts.push(`--- Document: ${doc.title} (ID: ${doc.id}) ---`)
      parts.push(doc.markdown.slice(0, 3000))
      parts.push('')
    }
  }
  return parts.join('\n')
}
