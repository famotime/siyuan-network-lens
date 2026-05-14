import type { WikiPreviewState } from '@/composables/use-analytics'

type Translate = (key: string, params?: Record<string, any>) => string

export function buildApplyResultSummary(applyResult: WikiPreviewState['applyResult'] | undefined, t: Translate): string {
  if (!applyResult) {
    return ''
  }

  return t('wikiMaintain.applyRunSummary', applyResult.counts)
}

export function buildPreviewNoticeText(descriptionLines: string[]): string {
  const incompleteLine = descriptionLines.find(line => line.includes('不完整') || line.includes('不是完整结果') || line.includes('incomplete'))?.trim()
  const skippedDocumentLine = descriptionLines.find(line => line.trim() !== incompleteLine && (line.includes('已跳过') || line.includes('Skipped ')))?.trim()

  return [incompleteLine, skippedDocumentLine]
    .filter(Boolean)
    .join(' ')
}

export function resolveTemplateLabel(templateType: string, t: Translate) {
  switch (templateType) {
    case 'tech_topic':
      return t('wikiMaintain.templateTechTopic')
    case 'product_howto':
      return t('wikiMaintain.templateProductHowto')
    case 'social_topic':
      return t('wikiMaintain.templateSocialTopic')
    case 'media_list':
      return t('wikiMaintain.templateMediaList')
    default:
      return templateType
  }
}

export function resolveConfidenceLabel(confidence: string, t: Translate) {
  switch (confidence) {
    case 'high':
      return t('wikiMaintain.confidenceHigh')
    case 'medium':
      return t('wikiMaintain.confidenceMedium')
    case 'low':
      return t('wikiMaintain.confidenceLow')
    default:
      return confidence
  }
}

export function resolveSectionOrderLabels(labels: string[], t: Translate) {
  return labels.length ? labels.join(', ') : t('wikiMaintain.noChanges')
}

export function sanitizeSummaryText(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\(\([^)\s]+\s+"[^"]*"\)\)/g, '')
    .replace(/\[[^\]]*?\]\(siyuan:\/\/[^)]*\)/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\{:\s[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripMetaSection(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  let skipUntilNextH3 = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line.startsWith('### ')) {
      continue
    }

    const heading = line.replace(/^###\s+/, '').replace(/\s*\{:[^}]*\}$/, '').trim()
    if (heading === 'Page meta' || heading === '页面头信息') {
      skipUntilNextH3 = true
      continue
    }

    if (skipUntilNextH3) {
      return lines.slice(index).join('\n')
    }

    return lines.slice(index).join('\n')
  }

  return markdown
}

export function sortSourceDocMetas(sourceDocMetas: NonNullable<WikiPreviewState['sourceDocMetas']>) {
  const order = { new: 0, changed: 1, unchanged: 2, deleted: 3 } as const
  return [...sourceDocMetas].sort((a, b) => order[a.deltaStatus] - order[b.deltaStatus])
}

export function deltaStatusLabel(status: string, t: Translate): string {
  switch (status) {
    case 'new': return t('wikiMaintain.deltaStatusNew')
    case 'changed': return t('wikiMaintain.deltaStatusChanged')
    case 'unchanged': return t('wikiMaintain.deltaStatusUnchanged')
    case 'deleted': return t('wikiMaintain.deltaStatusDeleted')
    default: return status
  }
}

export function linkTypeLabel(linkType: string, t: Translate): string {
  switch (linkType) {
    case 'outbound': return t('wikiMaintain.linkTypeOutbound')
    case 'inbound': return t('wikiMaintain.linkTypeInbound')
    case 'child': return t('wikiMaintain.linkTypeChild')
    default: return linkType
  }
}

export function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function resolveThemeWikiDocumentId(
  page: WikiPreviewState['themePages'][number],
  applyResult: WikiPreviewState['applyResult'] | null | undefined,
): string {
  if (page.pageId) {
    return page.pageId
  }

  const appliedPage = applyResult?.themePages.find(item => item.pageTitle === page.pageTitle)
  return appliedPage?.pageId ?? ''
}
