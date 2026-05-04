export const WIKI_TEMPLATE_TYPES = [
  'tech_topic',
  'product_howto',
  'social_topic',
  'media_list',
] as const
export type WikiTemplateType = typeof WIKI_TEMPLATE_TYPES[number]

export const WIKI_SHARED_SECTION_TYPES = ['intro', 'highlights', 'sources'] as const
export const WIKI_OPTIONAL_SECTION_TYPES = [
  'core_principles',
  'method_path',
  'use_cases',
  'basic_steps',
  'advanced_usage',
  'faq',
  'troubleshooting',
  'viewpoints',
  'controversies',
  'open_questions',
  'cases',
  'impacts',
  'work_map',
  'representative_works',
  'reading_order',
  'comparison',
  'misunderstandings',
] as const
export const WIKI_SECTION_TYPES = [...WIKI_SHARED_SECTION_TYPES, ...WIKI_OPTIONAL_SECTION_TYPES] as const
export type WikiSectionType = typeof WIKI_SECTION_TYPES[number]

export type WikiSectionFormat = 'overview' | 'structured' | 'qa' | 'debate' | 'catalog'

export type WikiTemplateConfidence = 'high' | 'medium' | 'low'

export interface WikiTemplateDiagnosis {
  templateType: WikiTemplateType
  confidence: WikiTemplateConfidence
  reason: string
  enabledModules: WikiSectionType[]
  suppressedModules: WikiSectionType[]
  evidenceSummary: string
}

export interface WikiSectionDraft {
  sectionType: WikiSectionType
  title: string
  format: WikiSectionFormat
  blocks: Array<{ text: string, sourceRefs: string[] }>
  sourceRefs: string[]
}

export interface WikiPagePlan {
  templateType: WikiTemplateType
  confidence: WikiTemplateConfidence
  coreSections: WikiSectionType[]
  optionalSections: WikiSectionType[]
  sectionOrder: WikiSectionType[]
  sectionGoals: Partial<Record<WikiSectionType, string>>
  sectionFormats: Partial<Record<WikiSectionType, WikiSectionFormat>>
}
