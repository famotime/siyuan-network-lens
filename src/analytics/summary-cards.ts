import type { ReferenceGraphReport, TrendReport } from './analysis'
import {
  type LargeDocumentCardMode,
  type LargeDocumentSummary,
} from './large-documents'
import type { ReadCardMode } from './read-status'
import type { SummaryCardItem } from './summary-detail-types'
import { pickUiText } from '@/i18n/ui'

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export function buildSummaryCards(params: {
  report: ReferenceGraphReport
  dormantDays: number
  documentCount?: number
  readDocumentCount?: number
  aiInboxCount?: number
  readCardMode?: ReadCardMode
  trends?: TrendReport | null
  largeDocumentSummary?: LargeDocumentSummary
  largeDocumentCardMode?: LargeDocumentCardMode
}): SummaryCardItem[] {
  const trendCount = params.trends
    ? params.trends.risingDocuments.length + params.trends.fallingDocuments.length
    : 0
  const readCardMode = params.readCardMode ?? 'unread'
  const largeDocumentCardMode = params.largeDocumentCardMode ?? 'words'
  const largeDocumentSummary = params.largeDocumentSummary ?? {
    wordDocumentCount: 0,
    storageDocumentCount: 0,
  }
  const readDocumentCount = params.readDocumentCount ?? 0
  const unreadDocumentCount = Math.max((params.documentCount ?? params.report.summary.totalDocuments) - readDocumentCount, 0)

  return [
    {
      key: 'documents',
      label: uiText('Doc sample', '文档样本'),
      value: (params.documentCount ?? params.report.summary.totalDocuments).toString(),
      hint: uiText('Docs matched by current filters', '当前筛选命中的文档'),
    },
    {
      key: 'read',
      label: readCardMode === 'read' ? uiText('Read docs', '已读文档') : uiText('Unread docs', '未读文档'),
      value: (readCardMode === 'read' ? readDocumentCount : unreadDocumentCount).toString(),
      hint: readCardMode === 'read'
        ? uiText('Docs matched by read rules', '命中已读规则的文档')
        : uiText('Docs not matched by read rules', '未命中已读规则的文档'),
    },
    {
      key: 'todaySuggestions',
      label: uiText('Today suggestions', '今日建议'),
      value: (params.aiInboxCount ?? 0).toString(),
      hint: uiText('AI-ranked suggestions for today', 'AI 排序的今日建议'),
    },
    {
      key: 'largeDocuments',
      label: largeDocumentCardMode === 'storage' ? uiText('Large docs · assets', '大文档 · 资源') : uiText('Large docs · text', '大文档 · 正文'),
      value: (largeDocumentCardMode === 'storage'
        ? largeDocumentSummary.storageDocumentCount
        : largeDocumentSummary.wordDocumentCount).toString(),
      hint: largeDocumentCardMode === 'storage'
        ? uiText('Docs larger than 3 MB in total size', '总大小超过 3 MB 的文档')
        : uiText('Docs with more than 10,000 words', '字数超过 10,000 的文档'),
    },
    {
      key: 'references',
      label: uiText('Active links', '活跃连接'),
      value: params.report.summary.totalReferences.toString(),
      hint: uiText('Doc-level references in the current window', '当前窗口内的文档级引用'),
    },
    {
      key: 'ranking',
      label: uiText('Core docs', '核心文档'),
      value: params.report.ranking.length.toString(),
      hint: uiText('Most referenced docs in the current window', '当前窗口内被引用最多的文档'),
    },
    {
      key: 'trends',
      label: uiText('Trend watch', '趋势观察'),
      value: trendCount.toString(),
      hint: uiText('Docs with activity changes in the current window', '当前窗口内活动发生变化的文档'),
    },
    {
      key: 'communities',
      label: uiText('Topic clusters', '主题社区'),
      value: params.report.summary.communityCount.toString(),
      hint: uiText('Topic clusters split by bridge nodes', '按桥接节点拆分出的主题社区'),
    },
    {
      key: 'orphans',
      label: uiText('Orphan docs', '孤立文档'),
      value: params.report.summary.orphanCount.toString(),
      hint: uiText('No valid doc-level links in the current window', '当前窗口内没有有效文档级连接'),
    },
    {
      key: 'dormant',
      label: uiText('Dormant docs', '沉没文档'),
      value: params.report.summary.dormantCount.toString(),
      hint: uiText(`No valid links for more than ${params.dormantDays} days`, `超过 ${params.dormantDays} 天没有有效连接`),
    },
    {
      key: 'bridges',
      label: uiText('Bridge docs', '桥接文档'),
      value: params.report.bridgeDocuments.length.toString(),
      hint: uiText('Docs whose removal weakens community connectivity', '移除后会削弱社区连通性的文档'),
    },
    {
      key: 'propagation',
      label: uiText('Propagation nodes', '传播节点'),
      value: params.report.summary.propagationCount.toString(),
      hint: uiText('High-impact relay nodes on key paths', '关键路径上的高影响中继节点'),
    },
  ]
}
