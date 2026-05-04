import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  WIKI_OPTIONAL_SECTION_TYPES,
  WIKI_SECTION_TYPES,
  WIKI_SHARED_SECTION_TYPES,
  WIKI_TEMPLATE_TYPES,
  type WikiPagePlan,
  type WikiOptionalSectionType,
  type WikiSectionDraft,
  type WikiSectionFormat,
  type WikiSectionType,
  type WikiSharedSectionType,
  type WikiTemplateDiagnosis,
} from './wiki-template-model'

describe('wiki template model', () => {
  it('exposes stable template and section type constants', () => {
    expect(WIKI_TEMPLATE_TYPES).toEqual([
      'tech_topic',
      'product_howto',
      'social_topic',
      'media_list',
    ])
    expect(WIKI_SHARED_SECTION_TYPES).toEqual(['intro', 'highlights', 'sources'])
    expect(WIKI_OPTIONAL_SECTION_TYPES).toEqual([
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
    ])
    expect(WIKI_SECTION_TYPES).toEqual([
      'intro',
      'highlights',
      'sources',
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
    ])
  })

  it('uses the task 1 diagnosis, page plan, and section draft shapes', () => {
    expectTypeOf<WikiSectionFormat>().toEqualTypeOf<'overview' | 'structured' | 'qa' | 'debate' | 'catalog'>()
    expectTypeOf<WikiSharedSectionType>().toEqualTypeOf<'intro' | 'highlights' | 'sources'>()
    expectTypeOf<WikiOptionalSectionType>().toEqualTypeOf<
      | 'core_principles'
      | 'method_path'
      | 'use_cases'
      | 'basic_steps'
      | 'advanced_usage'
      | 'faq'
      | 'troubleshooting'
      | 'viewpoints'
      | 'controversies'
      | 'open_questions'
      | 'cases'
      | 'impacts'
      | 'work_map'
      | 'representative_works'
      | 'reading_order'
      | 'comparison'
      | 'misunderstandings'
    >()
    expectTypeOf<WikiTemplateDiagnosis>().toEqualTypeOf<{
      templateType: 'tech_topic' | 'product_howto' | 'social_topic' | 'media_list'
      confidence: 'high' | 'medium' | 'low'
      reason: string
      enabledModules: WikiSectionType[]
      suppressedModules: WikiSectionType[]
      evidenceSummary: string
    }>()
    expectTypeOf<WikiPagePlan>().toEqualTypeOf<{
      templateType: 'tech_topic' | 'product_howto' | 'social_topic' | 'media_list'
      confidence: 'high' | 'medium' | 'low'
      coreSections: WikiSharedSectionType[]
      optionalSections: WikiOptionalSectionType[]
      sectionOrder: WikiSectionType[]
      sectionGoals: Partial<Record<WikiSectionType, string>>
      sectionFormats: Partial<Record<WikiSectionType, WikiSectionFormat>>
    }>()
    expectTypeOf<WikiSectionDraft>().toEqualTypeOf<{
      sectionType: WikiSectionType
      title: string
      format: WikiSectionFormat
      blocks: Array<{ text: string, sourceRefs: string[] }>
      sourceRefs: string[]
    }>()

    const diagnosis: WikiTemplateDiagnosis = {
      templateType: 'tech_topic',
      confidence: 'high',
      reason: '多数命题聚焦概念和机制',
      enabledModules: ['intro', 'core_principles', 'faq'],
      suppressedModules: ['controversies'],
      evidenceSummary: '3 条命题来自 2 个核心证据块',
    }

    const pagePlan: WikiPagePlan = {
      templateType: 'product_howto',
      confidence: 'medium',
      coreSections: ['intro', 'highlights', 'sources'] satisfies WikiSharedSectionType[],
      optionalSections: ['use_cases', 'basic_steps', 'faq'] satisfies WikiOptionalSectionType[],
      sectionOrder: ['intro', 'highlights', 'use_cases', 'basic_steps', 'sources'],
      sectionGoals: {
        intro: '给出主题快速导读',
        basic_steps: '提供最短上手路径',
      },
      sectionFormats: {
        intro: 'overview',
        use_cases: 'structured',
        faq: 'qa',
      },
    }

    const sectionDraft: WikiSectionDraft = {
      sectionType: 'work_map',
      title: '作品地图',
      format: 'catalog',
      blocks: [
        {
          text: '作品 A：用于建立整体地图。',
          sourceRefs: ['doc-a', 'doc-b'],
        },
      ],
      sourceRefs: ['doc-a', 'doc-b'],
    }

    expect(diagnosis).toEqual({
      templateType: 'tech_topic',
      confidence: 'high',
      reason: '多数命题聚焦概念和机制',
      enabledModules: ['intro', 'core_principles', 'faq'],
      suppressedModules: ['controversies'],
      evidenceSummary: '3 条命题来自 2 个核心证据块',
    })
    expect(pagePlan).toEqual({
      templateType: 'product_howto',
      confidence: 'medium',
      coreSections: ['intro', 'highlights', 'sources'],
      optionalSections: ['use_cases', 'basic_steps', 'faq'],
      sectionOrder: ['intro', 'highlights', 'use_cases', 'basic_steps', 'sources'],
      sectionGoals: {
        intro: '给出主题快速导读',
        basic_steps: '提供最短上手路径',
      },
      sectionFormats: {
        intro: 'overview',
        use_cases: 'structured',
        faq: 'qa',
      },
    })
    expect(sectionDraft).toEqual({
      sectionType: 'work_map',
      title: '作品地图',
      format: 'catalog',
      blocks: [
        {
          text: '作品 A：用于建立整体地图。',
          sourceRefs: ['doc-a', 'doc-b'],
        },
      ],
      sourceRefs: ['doc-a', 'doc-b'],
    })

    expectTypeOf(pagePlan.sectionFormats.faq).toEqualTypeOf<WikiSectionFormat>()
    expectTypeOf(sectionDraft.blocks).toEqualTypeOf<Array<{ text: string, sourceRefs: string[] }>>()
  })
})
