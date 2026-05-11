/**
 * Lightweight markdown → HTML converter for wiki preview detail dialog.
 * Handles headings, ordered/unordered lists, blockquotes, bold, italic, inline code, and paragraphs.
 * Strips SiYuan-specific artifacts (block references, siyuan:// links, IAL attrs, HTML comments).
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatInline(text: string): string {
  let result = escapeHtml(text)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  result = result.replace(/`([^`]+?)`/g, '<code>$1</code>')
  return result
}

export function renderSimpleMarkdown(source: string): string {
  const lines = source.split(/\r?\n/)
  const out: string[] = []

  let listTag: 'ul' | 'ol' | null = null

  function closeList() {
    if (!listTag) {
      return
    }

    out.push(`</${listTag}>`)
    listTag = null
  }

  function openList(nextTag: 'ul' | 'ol') {
    if (listTag === nextTag) {
      return
    }

    closeList()
    out.push(`<${nextTag}>`)
    listTag = nextTag
  }

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<sup>[\s\S]*?<\/sup>/gi, '')
      .replace(/\(\([^)\s]+\s*"([^"]*)"\)\)/g, (_match, label: string) => {
        return /^\d+$/.test(label.trim()) ? '' : label.trim()
      })
      .replace(/\[[^\]]*?\]\(siyuan:\/\/[^)]*\)/g, '')
      .replace(/\{:\s[^}]*\}/g, '')
      .trim()

    if (!line) {
      closeList()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      out.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`)
      continue
    }

    if (line.startsWith('> ')) {
      closeList()
      out.push(`<blockquote>${formatInline(line.slice(2))}</blockquote>`)
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      openList('ul')
      let content = line.replace(/^[-*]\s+/, '')
      while (/^[-*]\s+/.test(content)) {
        content = content.replace(/^[-*]\s+/, '')
      }

      out.push(`<li>${formatInline(content)}</li>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      openList('ol')
      out.push(`<li>${formatInline(line.replace(/^\d+\.\s+/, ''))}</li>`)
      continue
    }

    closeList()

    out.push(`<p>${formatInline(line)}</p>`)
  }

  closeList()

  return out.join('\n')
}
