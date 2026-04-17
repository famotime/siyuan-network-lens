import { t } from '@/i18n/ui'

export function getDocumentDetailDescription() {
  return t('analytics.documentDetailDescription')
}

export function getSuggestionTypeLabels() {
  return {
    'promote-hub': t('analytics.suggestionType.promoteHub'),
    'repair-orphan': t('analytics.suggestionType.repairOrphan'),
    'maintain-bridge': t('analytics.suggestionType.maintainBridge'),
    'archive-dormant': t('analytics.suggestionType.archiveDormant'),
  } as const
}
