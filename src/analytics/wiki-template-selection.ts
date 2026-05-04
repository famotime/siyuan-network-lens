import {
  WIKI_SHARED_SECTION_TYPES,
  type WikiSectionType,
  type WikiTemplateConfidence,
  type WikiTemplateType,
} from './wiki-template-model'

const LOW_CONFIDENCE_SUPPRESSED_MODULES = new Set<WikiSectionType>([
  'faq',
  'controversies',
  'open_questions',
])

export function resolveSectionOrder(params: {
  templateType: WikiTemplateType
  enabledModules: WikiSectionType[]
  confidence: WikiTemplateConfidence
}): WikiSectionType[] {
  // Task 2 only standardizes shared-section ordering and low-confidence suppression.
  // templateType will start shaping per-template ordering in the later diagnosis/planning stage.
  void params.templateType

  const middleModules = params.enabledModules.filter((module) => {
    if (WIKI_SHARED_SECTION_TYPES.includes(module as typeof WIKI_SHARED_SECTION_TYPES[number])) {
      return false
    }
    if (params.confidence === 'low' && LOW_CONFIDENCE_SUPPRESSED_MODULES.has(module)) {
      return false
    }
    return true
  })

  return ['intro', 'highlights', ...middleModules, 'sources']
}
