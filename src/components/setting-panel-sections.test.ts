import { describe, expect, it } from 'vitest'

import { buildBaseSettingSections } from './setting-panel-sections'

describe('setting-panel-sections', () => {
  it('builds the analysis, topic, and read sections with stable field metadata', () => {
    const sections = buildBaseSettingSections({
      readTagOptions: [
        { value: '已读', label: '已读', key: '已读' },
      ],
      t: (key: string) => key,
    })

    expect(sections.map(section => section.key)).toEqual([
      'analysisScope',
      'topicDocs',
      'readRules',
    ])

    expect(sections[0]).toEqual(expect.objectContaining({
      title: 'settings.analysisScope.title',
      description: 'settings.analysisScope.description',
      fields: expect.arrayContaining([
        expect.objectContaining({ modelKey: 'analysisExcludedPaths', placeholder: 'settings.analysisScope.excludedPathsPlaceholder' }),
      ]),
    }))
    expect(sections[1].fields.map(field => field.modelKey)).toEqual([
      'themeDocumentPath',
      'themeNamePrefix',
      'themeNameSuffix',
    ])
    expect(sections[2].fields.find(field => field.modelKey === 'readTagNames')).toEqual(expect.objectContaining({
      type: 'tag-multiselect',
      options: [{ value: '已读', label: '已读', key: '已读' }],
    }))
  })
})
