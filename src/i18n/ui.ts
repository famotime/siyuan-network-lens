export type UiLocale = 'en_US' | 'zh_CN'

type UiTextMap = {
  en_US: string
  zh_CN: string
}

export function normalizeUiLocale(locale?: string | null): UiLocale {
  const normalized = (locale ?? '').trim().toLowerCase()
  if (normalized.startsWith('zh')) {
    return 'zh_CN'
  }
  return 'en_US'
}

export function resolveUiLocale(): UiLocale {
  const globalValue = globalThis as typeof globalThis & {
    siyuan?: {
      config?: {
        lang?: string
      }
    }
  }

  return normalizeUiLocale(globalValue.siyuan?.config?.lang ?? 'en_US')
}

export function pickUiText(text: UiTextMap, locale = resolveUiLocale()): string {
  return locale === 'zh_CN' ? text.zh_CN : text.en_US
}
