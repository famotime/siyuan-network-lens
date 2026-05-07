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
}): string {
  return [
    `User question: ${params.question}`,
    '',
    'Available wiki pages:',
    ...params.pageTitles.map((title, i) => `${i + 1}. ${title}`),
    '',
    'Return the single most relevant page title:',
  ].join('\n')
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
