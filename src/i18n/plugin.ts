import { pickUiText, resolveUiLocale, type UiLocale } from './ui'

const PLUGIN_TEXT = {
  pluginEyebrow: {
    en_US: 'Network Lens',
    zh_CN: '脉络镜',
  },
  pluginTitle: {
    en_US: 'Network Lens',
    zh_CN: '脉络镜',
  },
  pluginTagline: {
    en_US: 'Bring hidden knowledge back into sight.',
    zh_CN: '让隐没的知识，重现脉络',
  },
  pluginIconAlt: {
    en_US: 'Network Lens plugin icon',
    zh_CN: '脉络镜插件图标',
  },
  settingsTitle: {
    en_US: 'Network Lens Settings',
    zh_CN: '脉络镜设置',
  },
} as const

export type PluginTextKey = keyof typeof PLUGIN_TEXT

export function pickPluginText(key: PluginTextKey) {
  return pickUiText(PLUGIN_TEXT[key])
}

function resolveOppositeLocale(locale: UiLocale): UiLocale {
  return locale === 'zh_CN' ? 'en_US' : 'zh_CN'
}

export function pickOppositePluginText(key: PluginTextKey, locale = resolveUiLocale()) {
  return pickUiText(PLUGIN_TEXT[key], resolveOppositeLocale(locale))
}
