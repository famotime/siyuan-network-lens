export interface SettingPanelBaseField {
  modelKey: string
  label: string
  placeholder?: string
  type: 'text' | 'tag-multiselect'
  fullWidth?: boolean
  options?: Array<{ value: string, label: string, key: string }>
  allLabel?: string
  emptyLabel?: string
  selectionUnit?: string
}

export interface SettingPanelBaseSection {
  key: 'analysisScope' | 'topicDocs' | 'readRules'
  title: string
  description: string
  fields: SettingPanelBaseField[]
}

export function buildBaseSettingSections(params: {
  readTagOptions: Array<{ value: string, label: string, key: string }>
  t: (key: string) => string
}): SettingPanelBaseSection[] {
  return [
    {
      key: 'analysisScope',
      title: params.t('settings.analysisScope.title'),
      description: params.t('settings.analysisScope.description'),
      fields: [
        {
          modelKey: 'analysisExcludedPaths',
          label: params.t('settings.analysisScope.excludedPaths'),
          placeholder: params.t('settings.analysisScope.excludedPathsPlaceholder'),
          type: 'text',
          fullWidth: true,
        },
        {
          modelKey: 'analysisExcludedNamePrefixes',
          label: params.t('settings.analysisScope.namePrefixes'),
          placeholder: params.t('settings.analysisScope.namePrefixesPlaceholder'),
          type: 'text',
        },
        {
          modelKey: 'analysisExcludedNameSuffixes',
          label: params.t('settings.analysisScope.nameSuffixes'),
          placeholder: params.t('settings.analysisScope.nameSuffixesPlaceholder'),
          type: 'text',
        },
      ],
    },
    {
      key: 'topicDocs',
      title: params.t('settings.topicDocs.title'),
      description: params.t('settings.topicDocs.description'),
      fields: [
        {
          modelKey: 'themeDocumentPath',
          label: params.t('settings.topicDocs.pathLabel'),
          placeholder: params.t('settings.topicDocs.pathPlaceholder'),
          type: 'text',
          fullWidth: true,
        },
        {
          modelKey: 'themeNamePrefix',
          label: params.t('settings.topicDocs.namePrefixes'),
          placeholder: params.t('settings.topicDocs.namePrefixesPlaceholder'),
          type: 'text',
        },
        {
          modelKey: 'themeNameSuffix',
          label: params.t('settings.topicDocs.nameSuffixes'),
          placeholder: params.t('settings.topicDocs.nameSuffixesPlaceholder'),
          type: 'text',
        },
      ],
    },
    {
      key: 'readRules',
      title: params.t('settings.readRules.title'),
      description: params.t('settings.readRules.description'),
      fields: [
        {
          modelKey: 'readPaths',
          label: params.t('settings.readRules.readPaths'),
          placeholder: params.t('settings.readRules.readPathsPlaceholder'),
          type: 'text',
          fullWidth: true,
        },
        {
          modelKey: 'readTagNames',
          label: params.t('settings.readRules.readTags'),
          type: 'tag-multiselect',
          fullWidth: true,
          options: params.readTagOptions,
          allLabel: params.t('settings.readRules.noneSelected'),
          emptyLabel: params.t('settings.readRules.noTagsAvailable'),
          selectionUnit: params.t('settings.readRules.tagUnit'),
        },
        {
          modelKey: 'readTitlePrefixes',
          label: params.t('settings.readRules.titlePrefixes'),
          placeholder: params.t('settings.readRules.titlePrefixesPlaceholder'),
          type: 'text',
        },
        {
          modelKey: 'readTitleSuffixes',
          label: params.t('settings.readRules.titleSuffixes'),
          placeholder: params.t('settings.readRules.titleSuffixesPlaceholder'),
          type: 'text',
        },
      ],
    },
  ]
}
