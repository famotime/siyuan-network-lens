import { WIKI_PAGE_HEADINGS } from './wiki-page-model'
import type { WikiPagePlan, WikiSectionDraft, WikiTemplateDiagnosis } from './wiki-template-model'
import { resolveUiLanguageTag, t } from '@/i18n/ui'

export const WIKI_SECTION_MARKER_PREFIX = '<!-- network-lens-wiki-section:'

export interface WikiRenderedSectionMeta {
  key: string
  heading: string
  markdown: string
}

export interface RenderedWikiDraft {
  managedMarkdown: string
  fullMarkdown: string
  sectionMetadata: WikiRenderedSectionMeta[]
}

export function renderThemeWikiDraft(params: {
  pageTitle: string
  pairedThemeDocumentId: string
  pairedThemeTitle: string
  generatedAt: string
  model: string
  sourceDocumentCount: number
  diagnosis: WikiTemplateDiagnosis
  pagePlan: WikiPagePlan
  sections: WikiSectionDraft[]
  sourceDocumentTitleMap?: Record<string, string>
}): RenderedWikiDraft {
  const titleMap = params.sourceDocumentTitleMap ?? {}
  const sourceRefIndexMap = buildSourceRefIndexMap(params.sections)

  const sections = [
    {
      key: 'meta',
      heading: t('analytics.wikiPage.metaHeading'),
      body: [
        t('wikiMaintain.pairedTopicPageLine', { value: `((${params.pairedThemeDocumentId} "${params.pairedThemeTitle}"))` }),
        t('wikiMaintain.generatedAtLine', { value: formatGeneratedAt(params.generatedAt) }),
        t('wikiMaintain.sourceDocsLine', { value: params.sourceDocumentCount }),
        t('wikiMaintain.modelLine', { value: params.model }),
      ].join('\n'),
    },
    ...resolveRenderedSections(params.pagePlan, params.sections, titleMap, sourceRefIndexMap),
  ].map(section => ({
    key: section.key,
    heading: section.heading,
    markdown: section.body === '' ? '' : (section.body || t('wikiMaintain.noContentYet')),
  })) satisfies WikiRenderedSectionMeta[]

  const managedMarkdown = [
    `# ${params.pageTitle}`,
    '',
    `## ${WIKI_PAGE_HEADINGS.managedRoot}`,
    '',
    ...sections.flatMap(section => {
      if (section.markdown === '') {
        return [
          buildSectionMarker(section.key),
          `### ${section.heading}`,
          '',
        ]
      }
      return [
        buildSectionMarker(section.key),
        `### ${section.heading}`,
        section.markdown,
        '',
      ]
    }),
  ].join('\n').trim()

  const fullMarkdown = [
    managedMarkdown,
    '',
    `## ${WIKI_PAGE_HEADINGS.manualNotes}`,
    '',
    t('wikiMaintain.manualNotesReserved'),
  ].join('\n')

  return {
    managedMarkdown,
    fullMarkdown,
    sectionMetadata: sections,
  }
}

function formatGeneratedAt(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) {
    return isoString
  }

  const parts = new Intl.DateTimeFormat(resolveUiLanguageTag(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const val = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''
  return `${val('year')}-${val('month')}-${val('day')} ${val('hour')}:${val('minute')}`
}

const BLOCK_ID_PATTERN = /^[0-9a-f]{22}$/

function isDocumentSourceRef(ref: string): boolean {
  return !BLOCK_ID_PATTERN.test(ref)
}

function buildSourceRefIndexMap(sections: WikiSectionDraft[]): Map<string, number> {
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const section of sections) {
    const refs = [
      ...section.sourceRefs,
      ...section.blocks.flatMap(block => block.sourceRefs),
    ]
    for (const ref of refs) {
      if (isDocumentSourceRef(ref) && !seen.has(ref)) {
        seen.add(ref)
        ordered.push(ref)
      }
    }
  }

  return new Map(ordered.map((ref, i) => [ref, i + 1]))
}

function formatInlineSourceRefs(refs: string[], sourceRefIndexMap: Map<string, number>): string {
  const docRefs = refs.filter(ref => isDocumentSourceRef(ref) && sourceRefIndexMap.has(ref))
  if (!docRefs.length) {
    return ''
  }
  const supers = docRefs
    .map(ref => `((${ref} "${sourceRefIndexMap.get(ref)}"))`)
    .join(' ')
  return ` <sup>${supers}</sup>`
}

function resolveRenderedSections(
  pagePlan: WikiPagePlan,
  sectionDrafts: WikiSectionDraft[],
  titleMap: Record<string, string>,
  sourceRefIndexMap: Map<string, number>,
): Array<{ key: string, heading: string, body: string }> {
  const sectionDraftMap = new Map(sectionDrafts.map(section => [section.sectionType, section]))

  return pagePlan.sectionOrder.map((sectionType) => {
    const draft = sectionDraftMap.get(sectionType)
    const isIntentionallyEmpty = draft && draft.blocks.length === 0

    return {
      key: sectionType,
      heading: sectionType === 'sources'
        ? t('analytics.wikiPage.sourcesHeading')
        : resolveSectionHeading(sectionType, draft),
      body: isIntentionallyEmpty
        ? ''
        : sectionType === 'sources'
          ? normalizeSourcesSectionBody(draft, titleMap)
          : normalizeSectionDraftBody(draft, sourceRefIndexMap),
    }
  })
}

function normalizeSectionDraftBody(
  draft: WikiSectionDraft | undefined,
  sourceRefIndexMap: Map<string, number>,
): string {
  if (!draft || !draft.blocks.length) {
    return ''
  }

  if (draft.format === 'overview') {
    return draft.blocks
      .map((block) => {
        const text = block.text.trim()
        if (!text) {
          return ''
        }
        const inlineRefs = formatInlineSourceRefs(block.sourceRefs, sourceRefIndexMap)
        return `${text}${inlineRefs}`
      })
      .filter(Boolean)
      .join('\n\n')
  }

  return draft.blocks
    .map((block) => {
      const text = block.text.trim()
      if (!text) {
        return ''
      }
      const inlineRefs = formatInlineSourceRefs(block.sourceRefs, sourceRefIndexMap)
      return `- ${text}${inlineRefs}`
    })
    .filter(Boolean)
    .join('\n')
}

function normalizeSourcesSectionBody(
  draft: WikiSectionDraft | undefined,
  titleMap: Record<string, string>,
): string {
  if (!draft || !draft.blocks.length) {
    return ''
  }

  const grouped = new Map<string, string[]>()
  const unlinked: string[] = []

  for (const block of draft.blocks) {
    const text = block.text.trim()
    if (!text) {
      continue
    }

    const docRefs = block.sourceRefs.filter(ref => isDocumentSourceRef(ref))
    if (!docRefs.length) {
      unlinked.push(text)
      continue
    }

    for (const ref of docRefs) {
      const existing = grouped.get(ref)
      if (existing) {
        existing.push(text)
      } else {
        grouped.set(ref, [text])
      }
    }
  }

  const lines: string[] = []
  for (const [ref, texts] of grouped) {
    const title = titleMap[ref]
    const refLabel = title ? `《${title}》` : ref
    const link = `((${ref} "${refLabel}"))`
    const body = texts.join('；')
    lines.push(`- ${link}：${body}`)
  }
  for (const text of unlinked) {
    lines.push(`- ${text}`)
  }

  return lines.join('\n')
}

function resolveSectionHeading(sectionType: string, draft?: WikiSectionDraft): string {
  if (draft?.title?.trim()) {
    return draft.title.trim()
  }

  switch (sectionType) {
    case 'intro':
      return t('analytics.wikiPage.overviewHeading')
    case 'highlights':
      return t('analytics.wikiPage.keyDocumentsHeading')
    case 'sources':
      return t('analytics.wikiPage.evidenceHeading')
    default:
      return sectionType
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
  }
}

function buildSectionMarker(sectionKey: string): string {
  return `${WIKI_SECTION_MARKER_PREFIX}${sectionKey} -->`
}
