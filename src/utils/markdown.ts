/**
 * Lightweight markdown → HTML converter for wiki preview detail dialog.
 * Handles headings, lists, blockquotes, bold, italic, inline code, and paragraphs.
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
  let inList = false

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\(\([^)\s]+\s*"[^"]*"\)\)/g, '')
      .replace(/\[[^\]]*?\]\(siyuan:\/\/[^)]*\)/g, '')
      .replace(/\{:\s[^}]*\}/g, '')
      .trim()

    if (!line) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      const level = headingMatch[1].length
      out.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`)
      continue
    }

    if (line.startsWith('> ')) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      out.push(`<blockquote>${formatInline(line.slice(2))}</blockquote>`)
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${formatInline(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }

    if (inList) {
      out.push('</ul>')
      inList = false
    }

    out.push(`<p>${formatInline(line)}</p>`)
  }

  if (inList) {
    out.push('</ul>')
  }

  return out.join('\n')
}
