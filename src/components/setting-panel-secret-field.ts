import { t } from '@/i18n/ui'

export function resolveSecretFieldMeta(isVisible: boolean, fieldLabel: string) {
  const actionLabelPrefix = isVisible ? t('shared.hide') : t('shared.show')

  return {
    inputType: isVisible ? 'text' : 'password',
    actionLabel: `${actionLabelPrefix} ${fieldLabel}`,
    icon: isVisible ? 'eye-off' : 'eye',
  } as const
}
