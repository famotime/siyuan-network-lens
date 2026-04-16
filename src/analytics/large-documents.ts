import type { DocumentRecord } from './analysis'
import {
  compareSiyuanTimestamps as compareTimestamp,
  formatCompactDate,
  resolveDocumentTitle,
} from './document-utils'
import { pickUiText } from '@/i18n/ui'

export type LargeDocumentCardMode = 'words' | 'storage'

export interface LargeDocumentMetric {
  documentId: string
  wordCount: number
  documentBytes: number
  assetBytes: number
  totalBytes: number
  assetCount: number
}

export interface LargeDocumentRankingItem extends LargeDocumentMetric {
  title: string
  updatedAt: string
  hpath: string
}

export interface LargeDocumentSummary {
  wordDocumentCount: number
  storageDocumentCount: number
}

export const LARGE_DOCUMENT_WORD_THRESHOLD = 10000
export const LARGE_DOCUMENT_STORAGE_THRESHOLD_BYTES = 3 * 1024 * 1024

const apiModulePath = '@/api'
const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export async function loadLargeDocumentMetrics(params: {
  documents: DocumentRecord[]
  getFile?: (path: string) => Promise<unknown>
  getDocAssets?: (id: string) => Promise<unknown>
  statAsset?: (path: string) => Promise<unknown>
}): Promise<Map<string, LargeDocumentMetric>> {
  const getFile = params.getFile ?? defaultGetFile
  const getDocAssets = params.getDocAssets ?? defaultGetDocAssets
  const statAsset = params.statAsset ?? defaultStatAsset

  const documentBytesById = new Map<string, number>()
  const assetPathsByDocumentId = new Map<string, string[]>()

  await Promise.all(params.documents.map(async (document) => {
    const [filePayload, rawAssets] = await Promise.all([
      safeCall(() => getFile(toWorkspaceDocumentPath(document))),
      safeCall(() => getDocAssets(document.id)),
    ])

    documentBytesById.set(document.id, measurePayloadBytes(filePayload))
    assetPathsByDocumentId.set(document.id, normalizeAssetPaths(rawAssets))
  }))

  const uniqueAssetPaths = [...new Set([...assetPathsByDocumentId.values()].flat())]
  const assetBytesByPath = new Map<string, number>()

  await Promise.all(uniqueAssetPaths.map(async (assetPath) => {
    const assetStat = await safeCall(() => statAsset(assetPath))
    assetBytesByPath.set(assetPath, resolveAssetSize(assetStat))
  }))

  return new Map(params.documents.map((document) => {
    const assetPaths = assetPathsByDocumentId.get(document.id) ?? []
    const assetBytes = assetPaths.reduce((total, assetPath) => total + (assetBytesByPath.get(assetPath) ?? 0), 0)
    const documentBytes = documentBytesById.get(document.id) ?? 0
    const wordCount = countDocumentCharacters(document.content ?? '')

    return [
      document.id,
      {
        documentId: document.id,
        wordCount,
        documentBytes,
        assetBytes,
        totalBytes: documentBytes + assetBytes,
        assetCount: assetPaths.length,
      },
    ]
  }))
}

export function buildLargeDocumentSummary(params: {
  documents: DocumentRecord[]
  metrics?: ReadonlyMap<string, LargeDocumentMetric>
}): LargeDocumentSummary {
  const wordRanking = buildLargeDocumentRankings({
    documents: params.documents,
    metrics: params.metrics,
    mode: 'words',
    limit: Number.MAX_SAFE_INTEGER,
  })
  const storageRanking = buildLargeDocumentRankings({
    documents: params.documents,
    metrics: params.metrics,
    mode: 'storage',
    limit: Number.MAX_SAFE_INTEGER,
  })

  return {
    wordDocumentCount: wordRanking.length,
    storageDocumentCount: storageRanking.length,
  }
}

export function buildLargeDocumentRankings(params: {
  documents: DocumentRecord[]
  metrics?: ReadonlyMap<string, LargeDocumentMetric>
  mode: LargeDocumentCardMode
  limit?: number
}): LargeDocumentRankingItem[] {
  const limit = params.limit ?? Number.MAX_SAFE_INTEGER

  return params.documents
    .map((document) => {
      const metric = params.metrics?.get(document.id) ?? buildFallbackMetric(document)
      return {
        ...metric,
        title: resolveDocumentTitle(document),
        updatedAt: document.updated ?? '',
        hpath: document.hpath || document.path,
      }
    })
    .filter(item => isLargeDocument(item, params.mode))
    .sort((left, right) => {
      const leftValue = params.mode === 'words' ? left.wordCount : left.totalBytes
      const rightValue = params.mode === 'words' ? right.wordCount : right.totalBytes
      if (rightValue !== leftValue) {
        return rightValue - leftValue
      }
      return compareTimestamp(right.updatedAt, left.updatedAt) || left.title.localeCompare(right.title, 'zh-CN')
    })
    .slice(0, limit)
}

export function formatLargeDocumentBadge(mode: LargeDocumentCardMode, metric: Pick<LargeDocumentMetric, 'wordCount' | 'totalBytes'>): string {
  return mode === 'words'
    ? uiText(`${metric.wordCount} words`, `${metric.wordCount} 字`)
    : formatBytes(metric.totalBytes)
}

export function buildLargeDocumentMeta(
  mode: LargeDocumentCardMode,
  metric: Pick<LargeDocumentMetric, 'wordCount' | 'documentBytes' | 'assetBytes' | 'assetCount'>,
  updatedAt?: string,
): string {
  if (mode === 'words') {
    return uiText(
      `About ${metric.wordCount} words · Threshold ${LARGE_DOCUMENT_WORD_THRESHOLD} words · Updated ${formatCompactDate(updatedAt)}`,
      `约 ${metric.wordCount} 字 · 阈值 ${LARGE_DOCUMENT_WORD_THRESHOLD} 字 · 更新于 ${formatCompactDate(updatedAt)}`,
    )
  }

  return uiText(
    `Total size ${formatBytes(metric.documentBytes + metric.assetBytes)} · Threshold ${formatBytes(LARGE_DOCUMENT_STORAGE_THRESHOLD_BYTES)} · ${metric.assetCount} assets`,
    `总大小 ${formatBytes(metric.documentBytes + metric.assetBytes)} · 阈值 ${formatBytes(LARGE_DOCUMENT_STORAGE_THRESHOLD_BYTES)} · ${metric.assetCount} 个资源`,
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function buildFallbackMetric(document: DocumentRecord): LargeDocumentMetric {
  return {
    documentId: document.id,
    wordCount: countDocumentCharacters(document.content ?? ''),
    documentBytes: 0,
    assetBytes: 0,
    totalBytes: 0,
    assetCount: 0,
  }
}

function countDocumentCharacters(content: string): number {
  return [...content.replace(/\s+/g, '')].length
}

function toWorkspaceDocumentPath(document: Pick<DocumentRecord, 'box' | 'path'>): string {
  const normalizedPath = document.path.startsWith('/') ? document.path : `/${document.path}`
  return `/data/${document.box}${normalizedPath}`
}

function measurePayloadBytes(payload: unknown): number {
  if (payload == null) {
    return 0
  }
  if (typeof payload === 'string') {
    return new TextEncoder().encode(payload).length
  }
  if (typeof payload === 'number') {
    return payload
  }
  if (typeof Blob !== 'undefined' && payload instanceof Blob) {
    return payload.size
  }
  if (payload instanceof ArrayBuffer) {
    return payload.byteLength
  }
  if (ArrayBuffer.isView(payload)) {
    return payload.byteLength
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (typeof record.size === 'number') {
      return record.size
    }
    if (typeof record.byteLength === 'number') {
      return record.byteLength
    }
    if ('data' in record) {
      return measurePayloadBytes(record.data)
    }
    return new TextEncoder().encode(JSON.stringify(record)).length
  }

  return 0
}

function normalizeAssetPaths(payload: unknown): string[] {
  const values = extractArrayPayload(payload)

  return [...new Set(values
    .map(resolveAssetPath)
    .filter((value): value is string => Boolean(value)))]
}

function extractArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>
  for (const key of ['assets', 'files', 'data']) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[]
    }
  }

  return []
}

function resolveAssetPath(entry: unknown): string | null {
  if (typeof entry === 'string') {
    return normalizeAssetPath(entry)
  }
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const record = entry as Record<string, unknown>
  for (const key of ['path', 'assetPath', 'src', 'url']) {
    if (typeof record[key] === 'string') {
      return normalizeAssetPath(record[key] as string)
    }
  }

  return null
}

function normalizeAssetPath(value: string): string | null {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }
  if (normalized.startsWith('file://')) {
    return normalized
  }
  if (normalized.startsWith('/data/assets/')) {
    return `assets/${normalized.slice('/data/assets/'.length)}`
  }
  if (normalized.startsWith('/assets/')) {
    return `assets/${normalized.slice('/assets/'.length)}`
  }
  if (normalized.startsWith('assets/')) {
    return normalized
  }

  return null
}

function resolveAssetSize(payload: unknown): number {
  if (typeof payload === 'number') {
    return payload
  }
  if (!payload || typeof payload !== 'object') {
    return 0
  }

  const record = payload as Record<string, unknown>
  if (typeof record.size === 'number') {
    return record.size
  }
  if ('data' in record) {
    return resolveAssetSize(record.data)
  }

  return 0
}

async function safeCall<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action()
  } catch {
    return null
  }
}

function isLargeDocument(metric: Pick<LargeDocumentMetric, 'wordCount' | 'totalBytes'>, mode: LargeDocumentCardMode): boolean {
  return mode === 'words'
    ? metric.wordCount > LARGE_DOCUMENT_WORD_THRESHOLD
    : metric.totalBytes > LARGE_DOCUMENT_STORAGE_THRESHOLD_BYTES
}

async function defaultGetFile(path: string): Promise<unknown> {
  const api = await loadApiModule()
  return api.getFile(path)
}

async function defaultGetDocAssets(id: string): Promise<unknown> {
  const api = await loadApiModule()
  return api.getDocAssets(id)
}

async function defaultStatAsset(path: string): Promise<unknown> {
  const api = await loadApiModule()
  return api.statAsset(path)
}

async function loadApiModule() {
  return import(/* @vite-ignore */ apiModulePath)
}
