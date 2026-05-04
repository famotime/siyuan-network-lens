import { describe, expect, it } from 'vitest'

import {
  WIKI_OPTIONAL_SECTION_TYPES,
  WIKI_SHARED_SECTION_TYPES,
  WIKI_TEMPLATE_TYPES,
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
    expect(WIKI_OPTIONAL_SECTION_TYPES).toEqual(expect.arrayContaining(['faq', 'open_questions']))
  })
})
