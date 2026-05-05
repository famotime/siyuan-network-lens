import { WIKI_PAGE_HEADINGS } from './wiki-page-model'
import type { WikiPagePlan, WikiSectionDraft, WikiTemplateDiagnosis } from './wiki-template-model'
import { t } from '@/i18n/ui'

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
        t('wikiMaintain.pairedTopicPageLine', { value: params.pairedThemeTitle }),
        t('wikiMaintain.generatedAtLine', { value: params.generatedAt }),
        t('wikiMaintain.sourceDocsLine', { value: params.sourceDocumentCount }),
        t('wikiMaintain.modelLine', { value: params.model }),
      ].join('\n'),
    },
    ...resolveRenderedSections(params.pagePlan, params.sections, titleMap, sourceRefIndexMap),
  ].map(section => ({
    key: section.key,
    heading: section.heading,
    markdown: section.body || t('wikiMaintain.noContentYet'),
  })) satisfies WikiRenderedSectionMeta[]

  const managedMarkdown = [
    `# ${params.pageTitle}`,
    '',
    `## ${WIKI_PAGE_HEADINGS.managedRoot}`,
    '',
    ...sections.flatMap(section => [
      buildSectionMarker(section.key),
      `### ${section.heading}`,
      section.markdown,
      '',
    ]),
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

function formatSourceEntry(ref: string, blockText: string, titleMap: Record<string, string>): string {
  const title = titleMap[ref]
  const refLabel = title ? `《${title}》` : ref
  return `- ((${ref} "${refLabel}")) - ${blockText}`
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

    return {
      key: sectionType,
      heading: sectionType === 'sources'
        ? t('analytics.wikiPage.sourcesHeading')
        : resolveSectionHeading(sectionType, draft),
      body: sectionType === 'sources'
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

  return draft.blocks
    .flatMap((block) => {
      const text = block.text.trim()
      if (!text) {
        return [] as string[]
      }
      const docRefs = block.sourceRefs.filter(ref => isDocumentSourceRef(ref))
      if (!docRefs.length) {
        return [`- ${text}`]
      }
      return docRefs.map(ref => formatSourceEntry(ref, text, titleMap))
    })
    .join('\n')
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
