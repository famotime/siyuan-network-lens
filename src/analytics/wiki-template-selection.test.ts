import { describe, expect, it } from 'vitest'

import { resolveSectionOrder } from './wiki-template-selection'

describe('wiki template selection', () => {
  it('keeps shared sections at the edges and preserves enabled module order', () => {
    expect(resolveSectionOrder({
      templateType: 'tech_topic',
      enabledModules: ['intro', 'core_principles', 'faq', 'sources', 'comparison'],
      confidence: 'high',
    })).toEqual(['intro', 'highlights', 'core_principles', 'faq', 'comparison', 'sources'])
  })

  it('suppresses speculative modules when confidence is low', () => {
    expect(resolveSectionOrder({
      templateType: 'social_topic',
      enabledModules: ['intro', 'controversies', 'open_questions', 'faq', 'viewpoints', 'sources'],
      confidence: 'low',
    })).toEqual(['intro', 'highlights', 'viewpoints', 'sources'])
  })
})
