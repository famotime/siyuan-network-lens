import { normalizeTags } from '@/analytics/document-utils'
import { normalizeDocumentPath } from '@/analytics/document-paths'
import type { PluginConfig } from '@/types/config'

export interface NotebookOption {
  id: string
  name: string
}

export interface SettingPanelData {
  notebooks: NotebookOption[]
  readTagOptions: Array<{ value: string, label: string, key: string }>
}

export async function loadSettingPanelData(params: {
  lsNotebooks: () => Promise<{ notebooks?: Array<{ id: string, name: string }> }>
  sql: (statement: string) => Promise<Array<{ tag: string | null }>>
}): Promise<SettingPanelData> {
  const [notebookResult, tagResult] = await Promise.allSettled([
    params.lsNotebooks(),
    params.sql(`
      SELECT tag
      FROM blocks
      WHERE type = 'd'
        AND COALESCE(tag, '') <> ''
      LIMIT 2000
    `),
  ])

  return {
    notebooks: notebookResult.status === 'fulfilled'
      ? (notebookResult.value?.notebooks ?? []).map(notebook => ({
          id: notebook.id,
          name: notebook.name,
        }))
      : [],
    readTagOptions: tagResult.status === 'fulfilled'
      ? collectTagOptions(tagResult.value ?? [])
      : [],
  }
}

export function ensureReadMarkerDefaults(config: PluginConfig) {
  if (!Array.isArray(config.readTagNames)) {
    config.readTagNames = []
  }
  if (typeof config.readTitlePrefixes !== 'string') {
    config.readTitlePrefixes = ''
  }
  if (typeof config.readTitleSuffixes !== 'string') {
    config.readTitleSuffixes = ''
  }
  if (typeof config.readPaths !== 'string') {
    config.readPaths = ''
  }
}

export function migrateLegacyThemeDocumentPath(config: PluginConfig, notebooks: NotebookOption[]) {
  const notebookId = config.themeNotebookId?.trim() ?? ''
  const themeDocumentPath = config.themeDocumentPath?.trim() ?? ''

  if (!notebookId || !themeDocumentPath || themeDocumentPath.includes('|') || themeDocumentPath.split('/').filter(Boolean).length >= 2) {
    return
  }

  const notebook = notebooks.find(item => item.id === notebookId)
  const notebookPrefix = notebook?.name?.trim() || notebookId
  const normalizedPath = normalizeDocumentPath(themeDocumentPath)

  if (!notebookPrefix || !normalizedPath) {
    return
  }

  config.themeDocumentPath = `/${notebookPrefix}${normalizedPath}`
}

export function collectTagOptions(rows: Array<{ tag: string | null }>): Array<{ value: string, label: string, key: string }> {
  const tags = new Set<string>()

  for (const row of rows) {
    for (const tag of normalizeTags(row.tag)) {
      tags.add(tag)
    }
  }

  return [...tags]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
    .map(tag => ({
      value: tag,
      label: tag,
      key: tag,
    }))
}
