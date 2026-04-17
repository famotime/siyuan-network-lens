import type { WikiSectionKey } from './wiki-page-model'
import { WIKI_PAGE_HEADINGS } from './wiki-page-model'
import type { WIKI_LLM_OUTPUT_KEYS } from './wiki-generation'
import { t } from '@/i18n/ui'

type ThemeWikiLlmOutput = Record<typeof WIKI_LLM_OUTPUT_KEYS[number], string | string[]>

export interface WikiRenderedSectionMeta {
  key: Exclude<WikiSectionKey, 'manualNotes'>
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
  llmOutput: ThemeWikiLlmOutput
}): RenderedWikiDraft {
  const sections: WikiRenderedSectionMeta[] = [
    {
      key: 'meta',
      heading: WIKI_PAGE_HEADINGS.meta,
      markdown: [
        t('wikiMaintain.pairedTopicPageLine', { value: params.pairedThemeTitle }),
        t('wikiMaintain.generatedAtLine', { value: params.generatedAt }),
        t('wikiMaintain.sourceDocsLine', { value: params.sourceDocumentCount }),
        t('wikiMaintain.modelLine', { value: params.model }),
      ].join('\n'),
    },
    {
      key: 'overview',
      heading: WIKI_PAGE_HEADINGS.overview,
      markdown: normalizeSectionBody(params.llmOutput.overview),
    },
    {
      key: 'keyDocuments',
      heading: WIKI_PAGE_HEADINGS.keyDocuments,
      markdown: normalizeSectionBody(params.llmOutput.keyDocuments),
    },
    {
      key: 'structureObservations',
      heading: WIKI_PAGE_HEADINGS.structureObservations,
      markdown: normalizeSectionBody(params.llmOutput.structureObservations),
    },
    {
      key: 'evidence',
      heading: WIKI_PAGE_HEADINGS.evidence,
      markdown: normalizeSectionBody(params.llmOutput.evidence),
    },
    {
      key: 'actions',
      heading: WIKI_PAGE_HEADINGS.actions,
      markdown: normalizeSectionBody(params.llmOutput.actions),
    },
  ]

  const managedMarkdown = [
    `# ${params.pageTitle}`,
    '',
    `## ${WIKI_PAGE_HEADINGS.managedRoot}`,
    '',
    ...sections.flatMap(section => [
      `### ${section.heading}`,
      section.markdown || t('wikiMaintain.noContentYet'),
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

function normalizeSectionBody(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.length
      ? value.map(item => `- ${item}`).join('\n')
      : ''
  }
  return value.trim()
}
