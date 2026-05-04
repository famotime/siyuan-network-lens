import { WIKI_PAGE_HEADINGS, getWikiSectionHeading } from './wiki-page-model'
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
}): RenderedWikiDraft {
  const sections = [
    {
      key: 'meta',
      heading: getWikiSectionHeading('meta'),
      body: [
        t('wikiMaintain.pairedTopicPageLine', { value: params.pairedThemeTitle }),
        t('wikiMaintain.generatedAtLine', { value: params.generatedAt }),
        t('wikiMaintain.sourceDocsLine', { value: params.sourceDocumentCount }),
        t('wikiMaintain.modelLine', { value: params.model }),
      ].join('\n'),
    },
    ...resolveRenderedSections(params.pagePlan, params.sections),
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

function resolveRenderedSections(pagePlan: WikiPagePlan, sectionDrafts: WikiSectionDraft[]): Array<{ key: string, heading: string, body: string }> {
  const sectionDraftMap = new Map(sectionDrafts.map(section => [section.sectionType, section]))

  return pagePlan.sectionOrder.map((sectionType) => {
    const draft = sectionDraftMap.get(sectionType)
    return {
      key: sectionType,
      heading: resolveSectionHeading(sectionType, draft),
      body: normalizeSectionDraftBody(draft),
    }
  })
}

function normalizeSectionDraftBody(draft?: WikiSectionDraft): string {
  if (!draft || !draft.blocks.length) {
    return ''
  }

  if (draft.format === 'overview') {
    return draft.blocks
      .map(block => block.text.trim())
      .filter(Boolean)
      .join('\n\n')
  }

  return draft.blocks
    .map(block => block.text.trim())
    .filter(Boolean)
    .map(item => `- ${item}`)
    .join('\n')
}

function resolveSectionHeading(sectionType: string, draft?: WikiSectionDraft): string {
  if (draft?.title?.trim()) {
    return draft.title.trim()
  }

  switch (sectionType) {
    case 'intro':
      return getWikiSectionHeading('overview')
    case 'highlights':
      return getWikiSectionHeading('keyDocuments')
    case 'sources':
      return getWikiSectionHeading('evidence')
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
