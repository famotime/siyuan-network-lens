import type { WikiPageType } from './wiki-page-model'

export const WIKI_TEMPLATE_TYPES = [
  'tech_topic',
  'product_howto',
  'social_topic',
  'media_list',
] as const
export type WikiTemplateType = typeof WIKI_TEMPLATE_TYPES[number]

export const WIKI_SHARED_SECTION_TYPES = ['intro', 'highlights', 'sources'] as const
export const WIKI_OPTIONAL_SECTION_TYPES = ['faq', 'open_questions'] as const
export const WIKI_SECTION_TYPES = [...WIKI_SHARED_SECTION_TYPES, ...WIKI_OPTIONAL_SECTION_TYPES] as const
export type WikiSectionType = typeof WIKI_SECTION_TYPES[number]

export const WIKI_SECTION_FORMATS = ['paragraphs', 'bullet_list', 'qa_list'] as const
export type WikiSectionFormat = typeof WIKI_SECTION_FORMATS[number]

export interface WikiTemplateDiagnosis {
  templateType: WikiTemplateType
  confidence: number
  reasons: string[]
}

export interface WikiSectionDraft {
  type: WikiSectionType
  heading: string
  format: WikiSectionFormat
  content: string
}

export interface WikiPagePlan {
  pageType: WikiPageType
  templateType: WikiTemplateType
  title: string
  diagnosis: WikiTemplateDiagnosis
  sections: WikiSectionDraft[]
}
