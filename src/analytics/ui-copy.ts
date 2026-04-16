import { pickUiText } from '@/i18n/ui'

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export function getDocumentDetailDescription() {
  return uiText(
    'Follow the active document and summarize its community role, bridge position, and dormant risk.',
    '跟随当前文档，概览其社区角色、桥接位置与沉没风险。',
  )
}

export function getSuggestionTypeLabels() {
  return {
    'promote-hub': uiText('Promote to topic page', '提升为主题页'),
    'repair-orphan': uiText('Repair links', '补齐链接'),
    'maintain-bridge': uiText('Maintain bridge', '维护桥接'),
    'archive-dormant': uiText('Archive dormant', '归档沉没'),
  } as const
}
