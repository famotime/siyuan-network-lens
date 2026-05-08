# LLM Wiki 统计卡片实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SummaryCardsGrid 中新增 "LLM Wiki" 统计卡片，展示已生成的 wiki 页面数量，详情区域提供 wiki 页面文档卡片列表、AI 聊天问答、问答保存、以及轻量级 wiki 页面维护功能。

**Architecture:** 复用现有 Summary Card 三层管道（定义→构建→渲染），新增 `'llmWiki'` key 和 `'wikiCards'` detail kind。数据层通过解析 `wikiIndexTitle` 文档获取 wiki 页面列表。聊天和维护功能通过独立 composable + 弹窗组件实现，复用现有 AI forwardProxy 通道。

**Tech Stack:** Vue 3 Composition API, TypeScript, SiYuan Plugin API, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/analytics/wiki-index.ts` | 新建 | Wiki Index 解析、WikiIndexPage 类型定义 |
| `src/analytics/wiki-index.test.ts` | 新建 | Wiki Index 解析测试 |
| `src/analytics/llm-wiki-chat-service.ts` | 新建 | 聊天 AI 服务（路由 + 回答） |
| `src/analytics/llm-wiki-chat-service.test.ts` | 新建 | 聊天 AI 服务测试 |
| `src/analytics/llm-wiki-maintain-service.ts` | 新建 | 维护 AI 服务（评审 + diff） |
| `src/analytics/llm-wiki-maintain-service.test.ts` | 新建 | 维护 AI 服务测试 |
| `src/composables/use-analytics-llm-wiki.ts` | 新建 | Wiki 页面数据管理、维护状态 |
| `src/composables/use-analytics-llm-wiki-chat.ts` | 新建 | 聊天路由和问答逻辑 |
| `src/components/WikiCardsSection.vue` | 新建 | LLM Wiki 卡片详情区域组件 |
| `src/components/WikiChatDialog.vue` | 新建 | 聊天弹窗组件 |
| `src/components/WikiMaintainDiffDialog.vue` | 新建 | 维护 diff 预览弹窗组件 |
| `src/analytics/summary-detail-types.ts` | 修改 | 新增 `'llmWiki'` key 和 `'wikiCards'` kind |
| `src/analytics/summary-card-config.ts` | 修改 | 注册 LLM Wiki 卡片定义 |
| `src/analytics/summary-cards.ts` | 修改 | 构建 LLM Wiki 卡片 |
| `src/analytics/summary-detail-sections.ts` | 修改 | 构建 LLM Wiki 详情区域 |
| `src/types/config.ts` | 修改 | 新增 `showLlmWiki` 配置项 |
| `src/i18n/ui.ts` | 修改 | 新增 LLM Wiki 相关 i18n 文本 |
| `src/App.vue` | 修改 | 集成 WikiCardsSection 渲染 |
| `src/composables/use-analytics.ts` | 修改 | 接入 llm-wiki composable |

---

## Task 1: 类型定义与配置扩展

**Files:**
- Modify: `src/analytics/summary-detail-types.ts`
- Modify: `src/types/config.ts`
- Test: `src/analytics/summary-card-config.test.ts`

- [ ] **Step 1: 在 summary-detail-types.ts 中新增类型**

在 `SummaryCardKey` 联合类型末尾新增 `'llmWiki'`：

```ts
export type SummaryCardKey =
  | 'documents'
  | 'largeDocuments'
  | 'read'
  | 'todaySuggestions'
  | 'references'
  | 'ranking'
  | 'trends'
  | 'communities'
  | 'orphans'
  | 'dormant'
  | 'bridges'
  | 'propagation'
  | 'llmWiki'
```

在 `SummaryDetailSection` 联合类型末尾新增 `'wikiCards'` kind。先在文件顶部添加 import：

```ts
import type { WikiIndexPage } from './wiki-index'
```

然后在 `SummaryDetailSection` 联合末尾添加：

```ts
  | {
    key: 'llmWiki'
    title: string
    description: string
    kind: 'wikiCards'
    pages: WikiIndexPage[]
  }
```

更新 `ListDetailSectionKey` 排除新增的 key：

```ts
export type ListDetailSectionKey = Exclude<SummaryCardKey, 'ranking' | 'trends' | 'propagation' | 'todaySuggestions' | 'llmWiki'>
```

- [ ] **Step 2: 在 config.ts 中新增配置项**

在 `PluginConfig` 接口中新增：

```ts
  showLlmWiki?: boolean
```

在 `DEFAULT_CONFIG` 中新增（放在 `showPropagation` 之后）：

```ts
  showLlmWiki: true,
```

- [ ] **Step 3: 运行现有测试确认无破坏**

Run: `npx vitest run src/analytics/summary-card-config.test.ts src/analytics/summary-details.test.ts`
Expected: PASS（现有测试不受影响，因为新 key 有默认值）

- [ ] **Step 4: Commit**

```bash
git add src/analytics/summary-detail-types.ts src/types/config.ts
git commit -m "feat: 新增 llmWiki 卡片 key 和 wikiCards 详情类型"
```

---

## Task 2: Wiki Index 解析模块

**Files:**
- Create: `src/analytics/wiki-index.ts`
- Create: `src/analytics/wiki-index.test.ts`

- [ ] **Step 1: 编写 wiki-index.test.ts 测试**

```ts
import { describe, expect, it } from 'vitest'
import { parseWikiIndexPages, resolveThemeDocumentIdFromTitle } from './wiki-index'

describe('resolveThemeDocumentIdFromTitle', () => {
  it('去除 wikiPageSuffix 后缀得到主题文档标题', () => {
    expect(resolveThemeDocumentIdFromTitle('Vue 入门-llm-wiki', '-llm-wiki')).toBe('Vue 入门')
  })

  it('无后缀时返回原标题', () => {
    expect(resolveThemeDocumentIdFromTitle('Vue 入门', '-llm-wiki')).toBe('Vue 入门')
  })

  it('空标题返回空字符串', () => {
    expect(resolveThemeDocumentIdFromTitle('', '-llm-wiki')).toBe('')
  })
})

describe('parseWikiIndexPages', () => {
  it('从 kramdown 中提取去重的 wiki 页面', () => {
    const kramdown = `
- [页面A](siyuan://blocks/aaa111 "页面A")
- [页面B](siyuan://blocks/bbb222 "页面B")
- [页面A重复](siyuan://blocks/aaa111 "页面A")
`
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(2)
    expect(pages[0].documentId).toBe('aaa111')
    expect(pages[1].documentId).toBe('bbb222')
  })

  it('解析 block reference 格式', () => {
    const kramdown = '((ccc333 "页面C"))'
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(1)
    expect(pages[0].documentId).toBe('ccc333')
  })

  it('空内容返回空数组', () => {
    const pages = parseWikiIndexPages({
      kramdown: '',
      wikiPageSuffix: '-llm-wiki',
    })
    expect(pages).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/analytics/wiki-index.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 wiki-index.ts**

```ts
import type { DocumentId } from '@/types/index.d.ts'

const SIYUAN_BLOCK_URL_PATTERN = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
const BLOCK_REFERENCE_PATTERN = /\(\(\s*([^)\s"']+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)\)/g

export interface WikiMaintenanceState {
  status: 'idle' | 'reviewing' | 'suggestions-ready' | 'applying'
  suggestions?: WikiMaintenanceSuggestion[]
  diffPreview?: string
}

export interface WikiMaintenanceSuggestion {
  type: 'broken-link' | 'outdated-section' | 'missing-reference'
  description: string
  sectionHeading?: string
}

export interface WikiIndexPage {
  documentId: DocumentId
  title: string
  themeDocumentTitle?: string
  summary?: string
  maintenanceState?: WikiMaintenanceState
}

export interface WikiChatScope {
  mode: 'topic' | 'document'
  targetPage?: WikiIndexPage
}

export function resolveThemeDocumentIdFromTitle(
  wikiPageTitle: string,
  wikiPageSuffix: string,
): string {
  if (!wikiPageTitle) {
    return ''
  }
  if (wikiPageSuffix && wikiPageTitle.endsWith(wikiPageSuffix)) {
    return wikiPageTitle.slice(0, -wikiPageSuffix.length)
  }
  return wikiPageTitle
}

export function parseWikiIndexPages(params: {
  kramdown: string
  wikiPageSuffix: string
}): WikiIndexPage[] {
  if (!params.kramdown) {
    return []
  }

  const seen = new Set<string>()
  const pages: WikiIndexPage[] = []

  const extractTargets = (text: string): Array<{ id: string, label: string }> => {
    const targets: Array<{ id: string, label: string }> = []
    for (const match of text.matchAll(SIYUAN_BLOCK_URL_PATTERN)) {
      targets.push({ id: match[1], label: match[0] })
    }
    for (const match of text.matchAll(BLOCK_REFERENCE_PATTERN)) {
      targets.push({ id: match[1], label: match[0] })
    }
    return targets
  }

  for (const target of extractTargets(params.kramdown)) {
    if (seen.has(target.id)) {
      continue
    }
    seen.add(target.id)
    pages.push({
      documentId: target.id,
      title: target.label,
      themeDocumentTitle: resolveThemeDocumentIdFromTitle(target.label, params.wikiPageSuffix),
    })
  }

  return pages
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/analytics/wiki-index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-index.ts src/analytics/wiki-index.test.ts
git commit -m "feat: wiki index 解析模块——提取并去重 wiki 页面列表"
```

---

## Task 3: 卡片注册与 i18n

**Files:**
- Modify: `src/analytics/summary-card-config.ts`
- Modify: `src/i18n/ui.ts`
- Test: `src/analytics/summary-card-config.test.ts`

- [ ] **Step 1: 在 i18n/ui.ts 中新增 LLM Wiki 相关文本**

在 `UI_TEXT` 对象中找到 `analytics.summaryCardConfig` 节点，在其末尾新增：

```ts
    llmWikiCard: {
      en_US: 'LLM Wiki',
      zh_CN: 'LLM Wiki',
    },
    llmWikiCardDescription: {
      en_US: 'Generated LLM Wiki pages and AI chat',
      zh_CN: '已生成的 LLM Wiki 页面与 AI 对话',
    },
```

在 `analytics.summaryCards` 节点末尾新增：

```ts
    llmWiki: {
      en_US: 'LLM Wiki',
      zh_CN: 'LLM Wiki',
    },
    llmWikiPagesGenerated: {
      en_US: '{count} wiki pages generated',
      zh_CN: '已生成 {count} 个 wiki 页面',
    },
```

在 `analytics.summaryDetailSource` 节点末尾新增：

```ts
    llmWikiDescription: {
      en_US: 'All generated wiki pages with chat and maintenance tools',
      zh_CN: '所有已生成的 wiki 页面，提供对话和维护工具',
    },
```

- [ ] **Step 2: 在 summary-card-config.ts 中注册卡片**

在 `SummaryCardVisibilityConfigKey` 联合类型末尾新增 `'showLlmWiki'`：

```ts
export type SummaryCardVisibilityConfigKey =
  | 'showDocuments'
  // ... 现有项 ...
  | 'showPropagation'
  | 'showLlmWiki'
```

在 `SUMMARY_CARD_DEFINITIONS` 数组末尾新增：

```ts
  {
    key: 'llmWiki',
    visibilityConfigKey: 'showLlmWiki',
    defaultVisible: true,
    settingLabel: t('analytics.summaryCardConfig.llmWikiCard'),
    settingDescription: t('analytics.summaryCardConfig.llmWikiCardDescription'),
  },
```

在 `isSummaryCardVisible` 函数中新增 gating 逻辑（在 `todaySuggestions` 检查之后）：

```ts
  if (key === 'llmWiki') {
    return Boolean(config.aiEnabled) && Boolean((config as any).wikiEnabled)
  }
```

注意：`isSummaryCardVisible` 的 `config` 参数类型需要扩展以包含 `wikiEnabled`。将参数类型改为：

```ts
export function isSummaryCardVisible(
  config: Partial<Record<SummaryCardVisibilityConfigKey, boolean>> & { aiEnabled?: boolean, wikiEnabled?: boolean },
  key: SummaryCardKey,
): boolean {
```

- [ ] **Step 3: 运行测试**

Run: `npx vitest run src/analytics/summary-card-config.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/analytics/summary-card-config.ts src/i18n/ui.ts
git commit -m "feat: 注册 llmWiki 卡片定义及 i18n 文本"
```

---

## Task 4: 卡片构建与详情区域

**Files:**
- Modify: `src/analytics/summary-cards.ts`
- Modify: `src/analytics/summary-detail-sections.ts`

- [ ] **Step 1: 在 summary-cards.ts 中新增 llmWiki 卡片构建**

在 `buildSummaryCards` 的 params 类型中新增可选参数：

```ts
  llmWikiPageCount?: number
```

在 import 中新增（如果尚未导入）：

```ts
import type { WikiIndexPage } from './wiki-index'
```

在返回数组末尾（`propagation` 之后）新增：

```ts
    {
      key: 'llmWiki',
      label: t('analytics.summaryCards.llmWiki'),
      value: (params.llmWikiPageCount ?? 0).toString(),
      hint: t('analytics.summaryCards.llmWikiPagesGenerated', { count: params.llmWikiPageCount ?? 0 }),
    },
```

- [ ] **Step 2: 在 summary-detail-sections.ts 中新增 llmWiki 详情区域**

在 `buildSummaryDetailSections` 的 params 类型中新增可选参数：

```ts
  llmWikiPages?: WikiIndexPage[]
```

在 import 中新增：

```ts
import type { WikiIndexPage } from './wiki-index'
```

在返回对象中新增 `llmWiki` key（在 `propagation` 之后）：

```ts
    llmWiki: {
      key: 'llmWiki',
      title: t('analytics.summaryCards.llmWiki'),
      description: t('analytics.summaryDetailSource.llmWikiDescription'),
      kind: 'wikiCards',
      pages: params.llmWikiPages ?? [],
    },
```

- [ ] **Step 3: 运行现有测试确认无破坏**

Run: `npx vitest run src/analytics/summary-details.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/analytics/summary-cards.ts src/analytics/summary-detail-sections.ts
git commit -m "feat: llmWiki 卡片构建与详情区域"
```

---

## Task 5: 维护 AI 服务

**Files:**
- Create: `src/analytics/llm-wiki-maintain-service.ts`
- Create: `src/analytics/llm-wiki-maintain-service.test.ts`

- [ ] **Step 1: 编写测试**

```ts
import { describe, expect, it } from 'vitest'
import { buildMaintenanceSummary, parseMaintenanceResponse } from './llm-wiki-maintain-service'

describe('parseMaintenanceResponse', () => {
  it('解析有效的 JSON 响应', () => {
    const json = JSON.stringify({
      suggestions: [
        { type: 'broken-link', description: '链接 aaa 已失效', sectionHeading: '概述' },
        { type: 'outdated-section', description: '关键文档段落过时' },
      ],
      revisedMarkdown: '# 修改后的内容',
    })
    const result = parseMaintenanceResponse(json)
    expect(result.suggestions).toHaveLength(2)
    expect(result.suggestions[0].type).toBe('broken-link')
    expect(result.revisedMarkdown).toBe('# 修改后的内容')
  })

  it('处理 markdown fence 包裹的 JSON', () => {
    const json = '```json\n{"suggestions":[],"revisedMarkdown":"内容"}\n```'
    const result = parseMaintenanceResponse(json)
    expect(result.suggestions).toHaveLength(0)
    expect(result.revisedMarkdown).toBe('内容')
  })

  it('无效 JSON 返回空建议', () => {
    const result = parseMaintenanceResponse('not json')
    expect(result.suggestions).toHaveLength(0)
    expect(result.revisedMarkdown).toBe('')
  })
})

describe('buildMaintenanceSummary', () => {
  it('无建议时返回空字符串', () => {
    expect(buildMaintenanceSummary([])).toBe('')
  })

  it('按类型统计建议数量', () => {
    const summary = buildMaintenanceSummary([
      { type: 'broken-link', description: 'a' },
      { type: 'broken-link', description: 'b' },
      { type: 'outdated-section', description: 'c' },
    ])
    expect(summary).toContain('2')
    expect(summary).toContain('1')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/analytics/llm-wiki-maintain-service.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 llm-wiki-maintain-service.ts**

```ts
import type { WikiMaintenanceSuggestion } from './wiki-index'
import { t } from '@/i18n/ui'

export interface WikiMaintenanceResult {
  suggestions: WikiMaintenanceSuggestion[]
  revisedMarkdown: string
}

export function parseMaintenanceResponse(content: string): WikiMaintenanceResult {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    const suggestions: WikiMaintenanceSuggestion[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((s: any) => ({
        type: s.type ?? 'outdated-section',
        description: s.description ?? '',
        sectionHeading: s.sectionHeading,
      }))
      : []
    return {
      suggestions,
      revisedMarkdown: typeof parsed.revisedMarkdown === 'string' ? parsed.revisedMarkdown : '',
    }
  } catch {
    return { suggestions: [], revisedMarkdown: '' }
  }
}

const SUGGESTION_TYPE_LABELS: Record<WikiMaintenanceSuggestion['type'], () => string> = {
  'broken-link': () => t('llmWiki.maintain.brokenLink'),
  'outdated-section': () => t('llmWiki.maintain.outdatedSection'),
  'missing-reference': () => t('llmWiki.maintain.missingReference'),
}

export function buildMaintenanceSummary(suggestions: Pick<WikiMaintenanceSuggestion, 'type'>[]): string {
  if (!suggestions.length) {
    return ''
  }
  const counts = new Map<string, number>()
  for (const s of suggestions) {
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => `${SUGGESTION_TYPE_LABELS[type as WikiMaintenanceSuggestion['type']]?.() ?? type} ×${count}`)
    .join('、')
}

export function buildMaintenanceSystemPrompt(): string {
  return [
    'You are a wiki page maintenance assistant for SiYuan notes.',
    'Review the provided wiki page content and check for:',
    '1. Broken document ID links (siyuan://blocks/<id> pointing to non-existent documents)',
    '2. Outdated sections (content that should be updated based on source documents)',
    '3. Missing references (source documents not linked from the wiki page)',
    'Return JSON with two fields: "suggestions" (array of {type, description, sectionHeading?}) and "revisedMarkdown" (the corrected full wiki page content).',
    'Do not invent content not grounded in the source materials.',
  ].join(' ')
}

export function buildMaintenanceUserPrompt(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  brokenLinkIds: string[]
}): string {
  const parts = [
    `Wiki page title: ${params.wikiPageTitle}`,
    '',
    'Wiki page content:',
    params.wikiPageMarkdown,
  ]
  if (params.brokenLinkIds.length) {
    parts.push('', `Confirmed broken link IDs: ${params.brokenLinkIds.join(', ')}`)
  }
  return parts.join('\n')
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/analytics/llm-wiki-maintain-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/llm-wiki-maintain-service.ts src/analytics/llm-wiki-maintain-service.test.ts
git commit -m "feat: LLM Wiki 维护 AI 服务——评审解析与建议摘要"
```

---

## Task 6: 聊天 AI 服务

**Files:**
- Create: `src/analytics/llm-wiki-chat-service.ts`
- Create: `src/analytics/llm-wiki-chat-service.test.ts`

- [ ] **Step 1: 编写测试**

```ts
import { describe, expect, it } from 'vitest'
import { parseRouteResponse, parseChatResponse } from './llm-wiki-chat-service'

describe('parseRouteResponse', () => {
  it('返回 AI 选择的页面标题', () => {
    const result = parseRouteResponse('Vue 入门-llm-wiki')
    expect(result).toBe('Vue 入门-llm-wiki')
  })

  it('去除前后空白', () => {
    const result = parseRouteResponse('  Vue 入门-llm-wiki  ')
    expect(result).toBe('Vue 入门-llm-wiki')
  })

  it('空字符串返回空', () => {
    expect(parseRouteResponse('')).toBe('')
  })
})

describe('parseChatResponse', () => {
  it('解析包含引用的 JSON 响应', () => {
    const json = JSON.stringify({
      answer: 'Vue 是一个渐进式框架',
      referencedDocumentIds: ['doc1', 'doc2'],
    })
    const result = parseChatResponse(json)
    expect(result.answer).toBe('Vue 是一个渐进式框架')
    expect(result.referencedDocumentIds).toEqual(['doc1', 'doc2'])
  })

  it('纯文本作为降级回答', () => {
    const result = parseChatResponse('这是直接回答')
    expect(result.answer).toBe('这是直接回答')
    expect(result.referencedDocumentIds).toEqual([])
  })

  it('markdown fence 包裹的 JSON', () => {
    const json = '```json\n{"answer":"答案","referencedDocumentIds":[]}\n```'
    const result = parseChatResponse(json)
    expect(result.answer).toBe('答案')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/analytics/llm-wiki-chat-service.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 llm-wiki-chat-service.ts**

```ts
export interface WikiChatResult {
  answer: string
  usedPageTitle: string
  referencedDocumentIds: string[]
}

export function parseRouteResponse(content: string): string {
  return content.trim()
}

export function parseChatResponse(content: string): { answer: string, referencedDocumentIds: string[] } {
  try {
    const cleaned = content
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : cleaned,
      referencedDocumentIds: Array.isArray(parsed.referencedDocumentIds)
        ? parsed.referencedDocumentIds.filter((id: any) => typeof id === 'string')
        : [],
    }
  } catch {
    return { answer: content.trim(), referencedDocumentIds: [] }
  }
}

export function buildRouteSystemPrompt(): string {
  return [
    'You are a topic routing assistant for SiYuan notes.',
    'Given a user question and a list of wiki page titles, return ONLY the single most relevant page title.',
    'Return the exact title string, nothing else.',
  ].join(' ')
}

export function buildRouteUserPrompt(params: {
  question: string
  pageTitles: string[]
}): string {
  return [
    `User question: ${params.question}`,
    '',
    'Available wiki pages:',
    ...params.pageTitles.map((title, i) => `${i + 1}. ${title}`),
    '',
    'Return the single most relevant page title:',
  ].join('\n')
}

export function buildChatSystemPrompt(): string {
  return [
    'You are a knowledge assistant for SiYuan notes.',
    'Answer the user question based on the provided wiki page content.',
    'If you need to reference specific source documents mentioned in the wiki page, include their document IDs in your response.',
    'Return JSON with two fields: "answer" (string) and "referencedDocumentIds" (string array, empty if no source documents were needed).',
    'Do not invent information not present in the provided context.',
  ].join(' ')
}

export function buildChatUserPrompt(params: {
  question: string
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  const parts = [
    `Wiki page: ${params.wikiPageTitle}`,
    '',
    'Wiki page content:',
    params.wikiPageMarkdown,
  ]
  if (params.sourceDocuments?.length) {
    parts.push('', 'Referenced source documents:')
    for (const doc of params.sourceDocuments) {
      parts.push(`--- Document: ${doc.title} (ID: ${doc.id}) ---`)
      parts.push(doc.markdown.slice(0, 3000))
      parts.push('')
    }
  }
  parts.push('', `User question: ${params.question}`)
  return parts.join('\n')
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/analytics/llm-wiki-chat-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/llm-wiki-chat-service.ts src/analytics/llm-wiki-chat-service.test.ts
git commit -m "feat: LLM Wiki 聊天 AI 服务——路由与问答解析"
```

---

## Task 7: 补充 i18n 文本

**Files:**
- Modify: `src/i18n/ui.ts`

- [ ] **Step 1: 在 i18n/ui.ts 中新增聊天和维护相关文本**

在 `UI_TEXT` 中新增顶层 `llmWiki` 节点（与 `app`、`analytics` 等同级）：

```ts
  llmWiki: {
    chat: {
      startChat: {
        en_US: 'Start chat',
        zh_CN: '开始对话',
      },
      chatWithPage: {
        en_US: 'Chat',
        zh_CN: '对话',
      },
      topicMode: {
        en_US: 'Open topic — all wiki pages',
        zh_CN: '不限主题 — 所有 wiki 页面',
      },
      documentMode: {
        en_US: 'Based on: {title}',
        zh_CN: '基于：{title}',
      },
      scopeIndicator: {
        en_US: 'Answer based on wiki page: {title}',
        zh_CN: '基于 Wiki 页面「{title}」的回答',
      },
      scopeWithReferences: {
        en_US: 'Answer based on wiki page: {title}, referencing {count} source document(s)',
        zh_CN: '基于 Wiki 页面「{title}」的回答，参考了 {count} 篇原始文档',
      },
      inputPlaceholder: {
        en_US: 'Ask a question...',
        zh_CN: '输入问题...',
      },
      send: {
        en_US: 'Send',
        zh_CN: '发送',
      },
      save: {
        en_US: 'Save Q&A',
        zh_CN: '保存问答',
      },
      saved: {
        en_US: 'Saved',
        zh_CN: '已保存',
      },
      close: {
        en_US: 'Close',
        zh_CN: '关闭',
      },
      routing: {
        en_US: 'Finding relevant wiki page...',
        zh_CN: '正在匹配相关 Wiki 页面...',
      },
      thinking: {
        en_US: 'Thinking...',
        zh_CN: '思考中...',
      },
      noWikiPages: {
        en_US: 'No wiki pages found. Generate wiki pages first.',
        zh_CN: '未找到 Wiki 页面，请先生成 Wiki 页面。',
      },
    },
    maintain: {
      button: {
        en_US: 'Maintain',
        zh_CN: '维护',
      },
      reviewing: {
        en_US: 'Reviewing...',
        zh_CN: '评审中...',
      },
      viewDetails: {
        en_US: 'View details',
        zh_CN: '查看详情',
      },
      brokenLink: {
        en_US: 'broken link(s)',
        zh_CN: '失效链接',
      },
      outdatedSection: {
        en_US: 'outdated section(s)',
        zh_CN: '过时段落',
      },
      missingReference: {
        en_US: 'missing reference(s)',
        zh_CN: '缺失引用',
      },
      diffTitle: {
        en_US: 'Maintenance diff preview',
        zh_CN: '维护变更预览',
      },
      currentContent: {
        en_US: 'Current content',
        zh_CN: '当前内容',
      },
      suggestedContent: {
        en_US: 'Suggested content',
        zh_CN: '建议内容',
      },
      applyAll: {
        en_US: 'Apply all',
        zh_CN: '全部采纳',
      },
      applySelected: {
        en_US: 'Apply selected',
        zh_CN: '采纳所选',
      },
      cancel: {
        en_US: 'Cancel',
        zh_CN: '取消',
      },
      noSuggestions: {
        en_US: 'No maintenance suggestions. Page is up to date.',
        zh_CN: '无维护建议，页面内容已是最新。',
      },
      applied: {
        en_US: 'Changes applied',
        zh_CN: '变更已执行',
      },
    },
  },
```

- [ ] **Step 2: 运行 i18n 验证**

Run: `npx eslint src/i18n/ui.ts`
Expected: PASS（如果有 i18n validate plugin 的检查）

- [ ] **Step 3: Commit**

```bash
git add src/i18n/ui.ts
git commit -m "feat: LLM Wiki 聊天与维护功能 i18n 文本"
```

---

## Task 8: WikiCardsSection 详情组件

**Files:**
- Create: `src/components/WikiCardsSection.vue`

- [ ] **Step 1: 实现 WikiCardsSection.vue**

```vue
<script setup lang="ts">
import type { WikiIndexPage, WikiChatScope } from '@/analytics/wiki-index'
import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { t } from '@/i18n/ui'

const props = defineProps<{
  pages: WikiIndexPage[]
}>()

const emit = defineEmits<{
  openChat: [scope: WikiChatScope]
  maintain: [page: WikiIndexPage]
}>()

function openTopicChat() {
  emit('openChat', { mode: 'topic' })
}

function openPageChat(page: WikiIndexPage) {
  emit('openChat', { mode: 'document', targetPage: page })
}

function maintainPage(page: WikiIndexPage) {
  emit('maintain', page)
}

function buildMaintenanceSummary(page: WikiIndexPage): string {
  if (!page.maintenanceState?.suggestions?.length) {
    return ''
  }
  const counts = new Map<string, number>()
  for (const s of page.maintenanceState.suggestions) {
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1)
  }
  const parts: string[] = []
  if (counts.get('broken-link')) {
    parts.push(`${t('llmWiki.maintain.brokenLink')} ×${counts.get('broken-link')}`)
  }
  if (counts.get('outdated-section')) {
    parts.push(`${t('llmWiki.maintain.outdatedSection')} ×${counts.get('outdated-section')}`)
  }
  if (counts.get('missing-reference')) {
    parts.push(`${t('llmWiki.maintain.missingReference')} ×${counts.get('missing-reference')}`)
  }
  return parts.join('、')
}
</script>

<template>
  <div class="wiki-cards-section">
    <div class="wiki-cards-section__header">
      <button
        class="wiki-cards-section__chat-btn"
        @click="openTopicChat"
      >
        {{ t('llmWiki.chat.startChat') }}
      </button>
    </div>
    <div
      v-if="pages.length === 0"
      class="wiki-cards-section__empty"
    >
      {{ t('llmWiki.chat.noWikiPages') }}
    </div>
    <div
      v-for="page in pages"
      :key="page.documentId"
      class="wiki-card"
    >
      <div class="wiki-card__header">
        <span class="wiki-card__title">{{ page.title }}</span>
        <span
          v-if="page.themeDocumentTitle"
          class="wiki-card__theme"
        >{{ page.themeDocumentTitle }}</span>
      </div>
      <div
        v-if="page.maintenanceState?.suggestions?.length"
        class="wiki-card__maintenance-summary"
      >
        {{ buildMaintenanceSummary(page) }}
      </div>
      <div class="wiki-card__actions">
        <button
          class="wiki-card__action-btn"
          @click="openPageChat(page)"
        >
          {{ t('llmWiki.chat.chatWithPage') }}
        </button>
        <button
          class="wiki-card__action-btn"
          @click="maintainPage(page)"
        >
          {{ t('llmWiki.maintain.button') }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: PASS（可能有其他文件的已有类型问题，关注新增文件无错即可）

- [ ] **Step 3: Commit**

```bash
git add src/components/WikiCardsSection.vue
git commit -m "feat: WikiCardsSection 详情区域组件"
```

---

## Task 9: 聊天弹窗组件

**Files:**
- Create: `src/components/WikiChatDialog.vue`

- [ ] **Step 1: 实现 WikiChatDialog.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import { parseRouteResponse, parseChatResponse } from '@/analytics/llm-wiki-chat-service'
import {
  buildRouteSystemPrompt,
  buildRouteUserPrompt,
  buildChatSystemPrompt,
  buildChatUserPrompt,
} from '@/analytics/llm-wiki-chat-service'
import type { WikiChatResult } from '@/analytics/llm-wiki-chat-service'
import { t } from '@/i18n/ui'

const props = defineProps<{
  scope: WikiChatScope
  wikiPages: WikiIndexPage[]
  forwardProxy: (url: string, method?: string, payload?: any, headers?: any[], timeout?: number, contentType?: string) => Promise<any>
  getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
  config: {
    aiBaseUrl: string
    aiApiKey: string
    aiModel: string
    aiRequestTimeoutSeconds: number
    aiMaxTokens: number
    aiTemperature: number
  }
}>()

const emit = defineEmits<{
  close: []
  save: [result: WikiChatResult & { question: string, usedPage: WikiIndexPage }]
}>()

const question = ref('')
const loading = ref(false)
const error = ref('')
const chatResult = ref<(WikiChatResult & { question: string, usedPage: WikiIndexPage }) | null>(null)

const dialogTitle = computed(() => {
  if (props.scope.mode === 'topic') {
    return t('llmWiki.chat.topicMode')
  }
  return t('llmWiki.chat.documentMode', { title: props.scope.targetPage?.title ?? '' })
})

const scopeIndicator = computed(() => {
  if (!chatResult.value) return ''
  const page = chatResult.value.usedPage
  if (chatResult.value.referencedDocumentIds.length > 0) {
    return t('llmWiki.chat.scopeWithReferences', {
      title: page.title,
      count: chatResult.value.referencedDocumentIds.length,
    })
  }
  return t('llmWiki.chat.scopeIndicator', { title: page.title })
})

async function sendQuestion() {
  if (!question.value.trim() || loading.value) return

  loading.value = true
  error.value = ''
  chatResult.value = null

  try {
    let targetPage: WikiIndexPage | undefined

    if (props.scope.mode === 'topic') {
      // Step 1: Route to the most relevant wiki page
      const pageTitles = props.wikiPages.map(p => p.title)
      const routeResponse = await callAi(
        buildRouteSystemPrompt(),
        buildRouteUserPrompt({ question: question.value, pageTitles }),
      )
      const matchedTitle = parseRouteResponse(routeResponse)
      targetPage = props.wikiPages.find(p => p.title === matchedTitle)
      if (!targetPage) {
        targetPage = props.wikiPages[0]
      }
    } else {
      targetPage = props.scope.targetPage
    }

    if (!targetPage) {
      error.value = t('llmWiki.chat.noWikiPages')
      return
    }

    // Step 2: Read wiki page content and answer
    const wikiBlock = await props.getBlockKramdown(targetPage.documentId)
    const chatResponse = await callAi(
      buildChatSystemPrompt(),
      buildChatUserPrompt({
        question: question.value,
        wikiPageTitle: targetPage.title,
        wikiPageMarkdown: wikiBlock.kramdown,
      }),
    )
    const parsed = parseChatResponse(chatResponse)

    chatResult.value = {
      ...parsed,
      question: question.value,
      usedPage: targetPage,
    }
  } catch (e: any) {
    error.value = e.message ?? String(e)
  } finally {
    loading.value = false
  }
}

async function callAi(systemPrompt: string, userPrompt: string): Promise<string> {
  const endpoint = `${props.config.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
  const response = await props.forwardProxy(
    endpoint,
    'POST',
    {
      model: props.config.aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: props.config.aiMaxTokens,
      temperature: props.config.aiTemperature,
    },
    [['Authorization', `Bearer ${props.config.aiApiKey}`]],
    props.config.aiRequestTimeoutSeconds * 1000,
    'application/json',
  )
  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
  return body.choices?.[0]?.message?.content ?? ''
}

function saveResult() {
  if (chatResult.value) {
    emit('save', chatResult.value)
  }
}
</script>

<template>
  <div class="wiki-chat-dialog">
    <div class="wiki-chat-dialog__header">
      <h3>{{ dialogTitle }}</h3>
      <button @click="emit('close')">
        {{ t('llmWiki.chat.close') }}
      </button>
    </div>
    <div class="wiki-chat-dialog__body">
      <div class="wiki-chat-dialog__input-row">
        <input
          v-model="question"
          :placeholder="t('llmWiki.chat.inputPlaceholder')"
          :disabled="loading"
          @keyup.enter="sendQuestion"
        >
        <button
          :disabled="loading || !question.trim()"
          @click="sendQuestion"
        >
          {{ loading ? t('llmWiki.chat.thinking') : t('llmWiki.chat.send') }}
        </button>
      </div>
      <div
        v-if="error"
        class="wiki-chat-dialog__error"
      >
        {{ error }}
      </div>
      <div
        v-if="chatResult"
        class="wiki-chat-dialog__result"
      >
        <div class="wiki-chat-dialog__scope">
          {{ scopeIndicator }}
        </div>
        <div class="wiki-chat-dialog__question">
          {{ chatResult.question }}
        </div>
        <div class="wiki-chat-dialog__answer">
          {{ chatResult.answer }}
        </div>
      </div>
    </div>
    <div
      v-if="chatResult"
      class="wiki-chat-dialog__footer"
    >
      <button @click="saveResult">
        {{ t('llmWiki.chat.save') }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: PASS（关注新增文件）

- [ ] **Step 3: Commit**

```bash
git add src/components/WikiChatDialog.vue
git commit -m "feat: WikiChatDialog 聊天弹窗组件"
```

---

## Task 10: 维护 Diff 弹窗组件

**Files:**
- Create: `src/components/WikiMaintainDiffDialog.vue`

- [ ] **Step 1: 实现 WikiMaintainDiffDialog.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { t } from '@/i18n/ui'

const props = defineProps<{
  pageTitle: string
  currentMarkdown: string
  suggestions: WikiMaintenanceSuggestion[]
  revisedMarkdown: string
}>()

const emit = defineEmits<{
  close: []
  apply: [selectedSuggestions: WikiMaintenanceSuggestion[]]
}>()

const selectedIndices = ref<Set<number>>(new Set(props.suggestions.map((_, i) => i)))

function toggleSuggestion(index: number) {
  if (selectedIndices.value.has(index)) {
    selectedIndices.value.delete(index)
  } else {
    selectedIndices.value.add(index)
  }
}

function selectAll() {
  selectedIndices.value = new Set(props.suggestions.map((_, i) => i))
}

function applySelected() {
  const selected = [...selectedIndices.value]
    .sort((a, b) => a - b)
    .map(i => props.suggestions[i])
  emit('apply', selected)
}

const hasSelection = computed(() => selectedIndices.value.size > 0)
</script>

<template>
  <div class="wiki-maintain-diff-dialog">
    <div class="wiki-maintain-diff-dialog__header">
      <h3>{{ t('llmWiki.maintain.diffTitle') }} — {{ pageTitle }}</h3>
      <button @click="emit('close')">
        {{ t('llmWiki.chat.close') }}
      </button>
    </div>
    <div class="wiki-maintain-diff-dialog__suggestions">
      <div
        v-for="(suggestion, index) in suggestions"
        :key="index"
        class="suggestion-item"
        :class="{ 'suggestion-item--selected': selectedIndices.has(index) }"
        @click="toggleSuggestion(index)"
      >
        <input
          type="checkbox"
          :checked="selectedIndices.has(index)"
          @change="toggleSuggestion(index)"
        >
        <span class="suggestion-item__type">{{ suggestion.type }}</span>
        <span class="suggestion-item__desc">{{ suggestion.description }}</span>
        <span
          v-if="suggestion.sectionHeading"
          class="suggestion-item__section"
        >{{ suggestion.sectionHeading }}</span>
      </div>
      <div
        v-if="suggestions.length === 0"
        class="wiki-maintain-diff-dialog__empty"
      >
        {{ t('llmWiki.maintain.noSuggestions') }}
      </div>
    </div>
    <div class="wiki-maintain-diff-dialog__diff">
      <div class="wiki-maintain-diff-dialog__diff-panel">
        <h4>{{ t('llmWiki.maintain.currentContent') }}</h4>
        <pre>{{ currentMarkdown }}</pre>
      </div>
      <div class="wiki-maintain-diff-dialog__diff-panel">
        <h4>{{ t('llmWiki.maintain.suggestedContent') }}</h4>
        <pre>{{ revisedMarkdown }}</pre>
      </div>
    </div>
    <div class="wiki-maintain-diff-dialog__footer">
      <button @click="selectAll">
        {{ t('llmWiki.maintain.applyAll') }}
      </button>
      <button
        :disabled="!hasSelection"
        @click="applySelected"
      >
        {{ t('llmWiki.maintain.applySelected') }}
      </button>
      <button @click="emit('close')">
        {{ t('llmWiki.maintain.cancel') }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WikiMaintainDiffDialog.vue
git commit -m "feat: WikiMaintainDiffDialog 维护 diff 预览弹窗"
```

---

## Task 11: LLM Wiki Composable

**Files:**
- Create: `src/composables/use-analytics-llm-wiki.ts`
- Create: `src/composables/use-analytics-llm-wiki-chat.ts`

- [ ] **Step 1: 实现 use-analytics-llm-wiki.ts**

```ts
import { ref, type Ref, type ComputedRef } from 'vue'
import type { WikiIndexPage, WikiMaintenanceSuggestion } from '@/analytics/wiki-index'
import { parseWikiIndexPages } from '@/analytics/wiki-index'
import { parseMaintenanceResponse, buildMaintenanceSummary, buildMaintenanceSystemPrompt, buildMaintenanceUserPrompt } from '@/analytics/llm-wiki-maintain-service'
import type { PluginConfig } from '@/types/config'

type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type GetBlockKramdownFn = (id: string) => Promise<{ id: string, kramdown: string }>

export interface LlmWikiController {
  wikiPages: Ref<WikiIndexPage[]>
  wikiPageCount: Ref<number>
  loadWikiPages: (kramdown: string) => void
  reviewPage: (page: WikiIndexPage) => Promise<void>
  applyMaintenance: (page: WikiIndexPage, revisedMarkdown: string) => Promise<void>
}

export function createLlmWikiController(params: {
  config: ComputedRef<PluginConfig>
  forwardProxy?: ForwardProxyFn
  getBlockKramdown?: GetBlockKramdownFn
  updateBlock?: (id: string, dataType: string, data: string) => Promise<any>
}): LlmWikiController {
  const wikiPages = ref<WikiIndexPage[]>([])
  const wikiPageCount = ref(0)

  function loadWikiPages(kramdown: string) {
    const pages = parseWikiIndexPages({
      kramdown,
      wikiPageSuffix: params.config.value.wikiPageSuffix ?? '-llm-wiki',
    })
    wikiPages.value = pages
    wikiPageCount.value = pages.length
  }

  async function reviewPage(page: WikiIndexPage) {
    if (!params.forwardProxy || !params.getBlockKramdown) return

    page.maintenanceState = { status: 'reviewing' }

    try {
      const block = await params.getBlockKramdown(page.documentId)

      // Verify broken links
      const linkPattern = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
      const brokenLinkIds: string[] = []
      const linkMatches = [...block.kramdown.matchAll(linkPattern)]
      for (const match of linkMatches) {
        try {
          await params.getBlockKramdown(match[1])
        } catch {
          brokenLinkIds.push(match[1])
        }
      }

      const cfg = params.config.value
      const endpoint = `${(cfg.aiBaseUrl ?? '').replace(/\/+$/, '')}/chat/completions`
      const response = await params.forwardProxy(
        endpoint,
        'POST',
        {
          model: cfg.aiModel,
          messages: [
            { role: 'system', content: buildMaintenanceSystemPrompt() },
            { role: 'user', content: buildMaintenanceUserPrompt({
              wikiPageTitle: page.title,
              wikiPageMarkdown: block.kramdown,
              brokenLinkIds,
            }) },
          ],
          max_tokens: cfg.aiMaxTokens ?? 4096,
          temperature: cfg.aiTemperature ?? 0.7,
        },
        [['Authorization', `Bearer ${cfg.aiApiKey ?? ''}`]],
        (cfg.aiRequestTimeoutSeconds ?? 60) * 1000,
        'application/json',
      )
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
      const content = body.choices?.[0]?.message?.content ?? ''
      const result = parseMaintenanceResponse(content)

      page.maintenanceState = {
        status: 'suggestions-ready',
        suggestions: result.suggestions,
        diffPreview: result.revisedMarkdown,
      }
    } catch (e: any) {
      page.maintenanceState = {
        status: 'idle',
        suggestions: [{ type: 'outdated-section', description: e.message ?? String(e) }],
      }
    }
  }

  async function applyMaintenance(page: WikiIndexPage, revisedMarkdown: string) {
    if (!params.updateBlock) return
    page.maintenanceState = { ...page.maintenanceState, status: 'applying' }
    try {
      await params.updateBlock(page.documentId, 'markdown', revisedMarkdown)
      page.maintenanceState = { status: 'idle' }
    } catch {
      page.maintenanceState = { ...page.maintenanceState, status: 'suggestions-ready' }
    }
  }

  return {
    wikiPages,
    wikiPageCount,
    loadWikiPages,
    reviewPage,
    applyMaintenance,
  }
}
```

- [ ] **Step 2: 实现 use-analytics-llm-wiki-chat.ts**

```ts
import { ref } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import { parseWikiIndexPages } from '@/analytics/wiki-index'

export interface WikiChatSavePayload {
  question: string
  answer: string
  usedPageTitle: string
  usedPageId: string
  referencedDocumentIds: string[]
}

export interface LlmWikiChatController {
  chatDialogVisible: Ref<boolean>
  chatScope: Ref<WikiChatScope | null>
  maintainDiffVisible: Ref<boolean>
  maintainTargetPage: Ref<WikiIndexPage | null>
  openChat: (scope: WikiChatScope) => void
  closeChat: () => void
  openMaintainDiff: (page: WikiIndexPage) => void
  closeMaintainDiff: () => void
}

export function createLlmWikiChatController(): LlmWikiChatController {
  const chatDialogVisible = ref(false)
  const chatScope = ref<WikiChatScope | null>(null)
  const maintainDiffVisible = ref(false)
  const maintainTargetPage = ref<WikiIndexPage | null>(null)

  function openChat(scope: WikiChatScope) {
    chatScope.value = scope
    chatDialogVisible.value = true
  }

  function closeChat() {
    chatDialogVisible.value = false
    chatScope.value = null
  }

  function openMaintainDiff(page: WikiIndexPage) {
    maintainTargetPage.value = page
    maintainDiffVisible.value = true
  }

  function closeMaintainDiff() {
    maintainDiffVisible.value = false
    maintainTargetPage.value = null
  }

  return {
    chatDialogVisible,
    chatScope,
    maintainDiffVisible,
    maintainTargetPage,
    openChat,
    closeChat,
    openMaintainDiff,
    closeMaintainDiff,
  }
}

export function buildChatSaveMarkdown(payload: WikiChatSavePayload): string {
  const parts = [
    `# ${payload.question}`,
    '',
    `> 基于 Wiki 页面：[${payload.usedPageTitle}](siyuan://blocks/${payload.usedPageId})`,
  ]
  if (payload.referencedDocumentIds.length > 0) {
    parts.push(`> 参考原始文档：${payload.referencedDocumentIds.map(id => `[${id}](siyuan://blocks/${id})`).join('、')}`)
  }
  parts.push(`> 对话时间：${new Date().toLocaleString()}`)
  parts.push('')
  parts.push(payload.answer)
  return parts.join('\n')
}
```

- [ ] **Step 3: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: PASS（关注新增文件）

- [ ] **Step 4: Commit**

```bash
git add src/composables/use-analytics-llm-wiki.ts src/composables/use-analytics-llm-wiki-chat.ts
git commit -m "feat: LLM Wiki composable——页面管理、聊天控制、维护逻辑"
```

---

## Task 12: App.vue 与 use-analytics.ts 集成

**Files:**
- Modify: `src/composables/use-analytics.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: 在 use-analytics.ts 中接入 llm-wiki composable**

在文件顶部 import 新模块：

```ts
import { createLlmWikiController } from './use-analytics-llm-wiki'
import { createLlmWikiChatController } from './use-analytics-llm-wiki-chat'
```

在 `useAnalyticsState()` 函数内部，找到创建其他 controller 的区域，新增：

```ts
  const llmWiki = createLlmWikiController({
    config: appliedConfig,
    forwardProxy,
    getBlockKramdown,
    updateBlock,
  })

  const llmWikiChat = createLlmWikiChatController()
```

在返回对象中暴露：

```ts
    // LLM Wiki
    llmWikiPages: llmWiki.wikiPages,
    llmWikiPageCount: llmWiki.wikiPageCount,
    loadLlmWikiPages: llmWiki.loadWikiPages,
    reviewLlmWikiPage: llmWiki.reviewPage,
    applyLlmWikiMaintenance: llmWiki.applyMaintenance,
    llmWikiChatDialogVisible: llmWikiChat.chatDialogVisible,
    llmWikiChatScope: llmWikiChat.chatScope,
    llmWikiMaintainDiffVisible: llmWikiChat.maintainDiffVisible,
    llmWikiMaintainTargetPage: llmWikiChat.maintainTargetPage,
    openLlmWikiChat: llmWikiChat.openChat,
    closeLlmWikiChat: llmWikiChat.closeChat,
    openLlmWikiMaintainDiff: llmWikiChat.openMaintainDiff,
    closeLlmWikiMaintainDiff: llmWikiChat.closeMaintainDiff,
```

- [ ] **Step 2: 在 buildSummaryCards 调用处传入 llmWikiPageCount**

在 App.vue 中找到 `buildSummaryCards()` 的调用，新增参数：

```ts
llmWikiPageCount: llmWikiPageCount.value,
```

- [ ] **Step 3: 在 buildSummaryDetailSections 调用处传入 llmWikiPages**

在 App.vue 中找到 `buildSummaryDetailSections()` 的调用，新增参数：

```ts
llmWikiPages: llmWikiPages.value,
```

- [ ] **Step 4: 在 App.vue 中渲染 WikiCardsSection**

在 `SummaryDetailSection` 渲染区域找到 `kind === 'aiInbox'` 的条件分支附近，新增 `kind === 'wikiCards'` 的渲染：

```vue
<WikiCardsSection
  v-else-if="selectedSummaryCardSection?.kind === 'wikiCards'"
  :pages="selectedSummaryCardSection.pages"
  @open-chat="openLlmWikiChat"
  @maintain="handleLlmWikiMaintain"
/>
```

新增 import：

```ts
import WikiCardsSection from './components/WikiCardsSection.vue'
import WikiChatDialog from './components/WikiChatDialog.vue'
import WikiMaintainDiffDialog from './components/WikiMaintainDiffDialog.vue'
```

新增事件处理函数：

```ts
function handleLlmWikiMaintain(page: WikiIndexPage) {
  reviewLlmWikiPage(page)
  openLlmWikiMaintainDiff(page)
}
```

在模板底部（其他 dialog 附近）新增弹窗渲染：

```vue
<WikiChatDialog
  v-if="llmWikiChatDialogVisible && llmWikiChatScope"
  :scope="llmWikiChatScope"
  :wiki-pages="llmWikiPages"
  :forward-proxy="forwardProxy"
  :get-block-kramdown="getBlockKramdown"
  :config="appliedConfig"
  @close="closeLlmWikiChat"
  @save="handleLlmWikiChatSave"
/>

<WikiMaintainDiffDialog
  v-if="llmWikiMaintainDiffVisible && llmWikiMaintainTargetPage"
  :page-title="llmWikiMaintainTargetPage.title"
  :current-markdown="''"
  :suggestions="llmWikiMaintainTargetPage.maintenanceState?.suggestions ?? []"
  :revised-markdown="llmWikiMaintainTargetPage.maintenanceState?.diffPreview ?? ''"
  @close="closeLlmWikiMaintainDiff"
  @apply="handleLlmWikiMaintainApply"
/>
```

新增保存和维护确认的处理函数：

```ts
async function handleLlmWikiChatSave(result: WikiChatResult & { question: string, usedPage: WikiIndexPage }) {
  // Save logic: create doc in Chat/ directory, append reference to wiki page
  const markdown = buildChatSaveMarkdown({
    question: result.question,
    answer: result.answer,
    usedPageTitle: result.usedPage.title,
    usedPageId: result.usedPage.documentId,
    referencedDocumentIds: result.referencedDocumentIds,
  })
  const title = result.question.slice(0, 64)
  const chatPath = `/${config.value.wikiContainerName ?? 'LLM Wiki'}/Chat/${title}`
  // Find notebook for wiki container
  // Use createDocWithMd to create the doc
  // Use appendBlock to add reference link to wiki page
}

async function handleLlmWikiMaintainApply(suggestions: WikiMaintenanceSuggestion[]) {
  if (llmWikiMaintainTargetPage.value?.maintenanceState?.diffPreview) {
    await applyLlmWikiMaintenance(
      llmWikiMaintainTargetPage.value,
      llmWikiMaintainTargetPage.value.maintenanceState.diffPreview,
    )
    closeLlmWikiMaintainDiff()
  }
}
```

- [ ] **Step 5: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 运行全部测试**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/composables/use-analytics.ts src/App.vue
git commit -m "feat: App.vue 集成 LLM Wiki 统计卡片与弹窗"
```

---

## Task 13: Wiki Index 加载时机

**Files:**
- Modify: `src/composables/use-analytics.ts` 或 `src/App.vue`

- [ ] **Step 1: 在分析快照加载后触发 wiki index 解析**

在 `use-analytics.ts` 或 `App.vue` 中找到 snapshot 加载完成的 watcher，在其回调中新增：

```ts
// 当 snapshot 加载完成且 wiki 功能启用时，读取 wiki index 文档
if (appliedConfig.value.wikiEnabled && appliedConfig.value.aiEnabled && aiWikiStore) {
  const wikiIndexTitle = appliedConfig.value.wikiIndexTitle ?? 'LLM-Wiki-Index'
  const { buildWikiPageStorageKey } = await import('@/analytics/wiki-store')
  const pageKey = buildWikiPageStorageKey({ pageType: 'index', pageTitle: wikiIndexTitle })
  const indexRecord = await aiWikiStore.getPageRecord(pageKey)
  if (indexRecord?.pageId) {
    try {
      const kramdownResult = await getBlockKramdown(indexRecord.pageId)
      if (kramdownResult?.kramdown) {
        loadLlmWikiPages(kramdownResult.kramdown)
      }
    } catch {
      // wiki index 文档不存在或读取失败，静默处理
    }
  }
}
```

注意：`aiWikiStore` 和 `getBlockKramdown` 在 `useAnalyticsState()` 中已作为依赖注入可用。需要在 createLlmWikiController 的 params 中传入 `aiWikiStore`，或在 use-analytics.ts 中直接调用。

- [ ] **Step 2: 运行全部测试**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/composables/use-analytics.ts
git commit -m "feat: 分析加载时自动解析 wiki index 文档"
```

---

## Task 14: 保存问答到 Chat 目录

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 实现 handleLlmWikiChatSave 完整逻辑**

在 App.vue 中完善保存函数：

```ts
import { createDocWithMd, appendBlock } from '@/api'
import { buildChatSaveMarkdown } from '@/composables/use-analytics-llm-wiki-chat'

async function handleLlmWikiChatSave(result: { question: string, answer: string, usedPage: WikiIndexPage, referencedDocumentIds: string[] }) {
  const markdown = buildChatSaveMarkdown({
    question: result.question,
    answer: result.answer,
    usedPageTitle: result.usedPage.title,
    usedPageId: result.usedPage.documentId,
    referencedDocumentIds: result.referencedDocumentIds,
  })
  const title = result.question.slice(0, 64)
  const containerName = appliedConfig.value.wikiContainerName ?? 'LLM Wiki'
  const chatPath = `/${containerName}/Chat/${title}`

  // 查找 wiki 容器所在的 notebook
  const notebooks = snapshot.value?.notebooks ?? []
  const wikiNotebook = notebooks.find(nb => !nb.closed)
  if (!wikiNotebook) return

  const chatDocId = await createDocWithMd(wikiNotebook.id, chatPath, markdown)
  if (chatDocId) {
    // 在 wiki 页面末尾追加引用链接
    const refLink = `[${title}](siyuan://blocks/${chatDocId})`
    await appendBlock(result.usedPage.documentId, 'markdown', refLink)
    notify(t('llmWiki.chat.saved'))
  }
}
```

注意：`notify` 函数和 `snapshot` 在 use-analytics 返回对象中已存在。需要确保 `forwardProxy`、`getBlockKramdown` 等从 use-analytics 中获取。

- [ ] **Step 2: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat: 聊天问答保存到 Chat 目录并建立引用连接"
```

---

## Task 15: 端到端验证与样式完善

**Files:**
- Modify: `src/components/WikiCardsSection.vue`
- Modify: `src/components/WikiChatDialog.vue`
- Modify: `src/components/WikiMaintainDiffDialog.vue`

- [ ] **Step 1: 运行完整构建**

Run: `npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 2: 运行全部测试**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: 为三个组件补充基础样式**

在各组件的 `<style scoped>` 块中添加基础样式，确保：
- WikiCardsSection: 卡片列表使用 flex 布局，卡片有边框和 padding
- WikiChatDialog: 弹窗居中，输入框和按钮对齐
- WikiMaintainDiffDialog: 双栏 diff 布局，建议列表可勾选

- [ ] **Step 4: Commit**

```bash
git add src/components/WikiCardsSection.vue src/components/WikiChatDialog.vue src/components/WikiMaintainDiffDialog.vue
git commit -m "feat: LLM Wiki 组件样式完善与端到端验证"
```
