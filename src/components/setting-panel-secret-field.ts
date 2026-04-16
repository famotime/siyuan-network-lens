import { pickUiText } from '@/i18n/ui'

export function resolveSecretFieldMeta(isVisible: boolean, fieldLabel: string) {
  const actionLabelPrefix = pickUiText({
    en_US: isVisible ? 'Hide' : 'Show',
    zh_CN: isVisible ? '隐藏' : '显示',
  })

  return {
    inputType: isVisible ? 'text' : 'password',
    actionLabel: `${actionLabelPrefix} ${fieldLabel}`,
    icon: isVisible ? 'eye-off' : 'eye',
  } as const
}
