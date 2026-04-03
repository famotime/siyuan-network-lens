# 其他插件读取 AI 索引指南

本文说明其他思源插件如何读取 `network-lens` 生成的 AI 索引，并正确区分：

- 补链画像索引
- 真实文档摘要索引

目标是避免把当前 `semanticProfiles` 中的补链结果误当成正文摘要使用。

## 1. 索引文件位置

当前索引文件名固定为：

```ts
ai-document-index.json
```

在 `network-lens` 插件内部，这个文件通过插件私有存储读写。

如果你在另一个插件中要读取它，推荐做法是：

1. 先拿到 `network-lens` 插件实例
2. 调用它的 `loadData('ai-document-index.json')`
3. 从返回对象里读取 `semanticProfiles`

不建议假设底层真实磁盘路径，因为不同环境下插件数据目录可能不同。

## 2. 当前快照结构

当前快照结构为：

```ts
interface AiDocumentIndexSnapshot {
  schemaVersion: number
  semanticProfiles: Record<string, DocumentSemanticProfileRecord>
  suggestionCache: Record<string, DocumentLinkSuggestionCacheRecord>
}
```

你真正需要关注的是：

- `schemaVersion`
- `semanticProfiles[docId]`

通常不建议其他插件直接依赖 `suggestionCache`。

## 3. `semanticProfiles` 的两类语义

### 3.1 补链画像字段

下面这组字段来自“孤立文档 AI 补链结果”，不是正文摘要：

- `summaryShort`
- `summaryMedium`
- `keywordsJson`
- `topicCandidatesJson`
- `roleHintsJson`
- `evidenceSnippetsJson`

它们更适合拿来做：

- 补链建议复用
- 候选主题/目标页参考
- 推荐理由回显

不适合直接替代“文档摘要”。

### 3.2 真实文档摘要字段

下面这组字段才应该视为“可供其他插件复用的文档摘要索引”：

- `documentSummaryShort`
- `documentSummaryMedium`
- `documentKeywordsJson`
- `documentEvidenceSnippetsJson`
- `documentSummaryUpdatedAt`

推荐用途：

- 文档摘要展示
- 摘要命中后跳过重复 AI 摘要生成
- 给其他 AI 工作流提供轻量上下文

## 4. 推荐读取顺序

其他插件按 `docId` 读取时，建议采用下面的优先级：

1. 取 `semanticProfiles[docId]`
2. 校验 `sourceUpdatedAt === 当前文档 updated`
3. 命中后优先读取 `documentSummaryShort` / `documentSummaryMedium`
4. 如果真实摘要字段不存在，再决定是否回退到你自己的摘要流程
5. 不要默认回退到 `summaryShort` / `summaryMedium`

也就是说：

- `documentSummary*` 命中：可视为真实摘要可复用
- 只有 `summary*` 命中：只能说明曾经生成过补链画像，不能说明已有正文摘要

## 5. freshness 校验

最小 freshness 校验建议：

```ts
profile.sourceUpdatedAt === currentDocument.updated
```

更稳妥的校验建议：

```ts
profile.sourceUpdatedAt === currentDocument.updated
&& typeof profile.sourceHash === 'string'
```

当前 `network-lens` 已写入：

- `sourceUpdatedAt`
- `sourceHash`

如果你只想做最小可用复用，校验 `sourceUpdatedAt` 就够了。

如果你希望降低误命中风险，建议同时把 `sourceHash` 作为后续扩展校验位预留出来。

## 6. 最小读取示例

下面是一个最小 TypeScript 示例，演示如何在其他插件里读取：

```ts
type DocumentSemanticProfileRecord = {
  documentId: string
  sourceUpdatedAt: string
  sourceHash: string
  documentSummaryShort?: string
  documentSummaryMedium?: string
  documentKeywordsJson?: string
  documentEvidenceSnippetsJson?: string
  documentSummaryUpdatedAt?: string
  summaryShort: string
  summaryMedium: string
}

async function loadFreshDocumentSummary(params: {
  networkLensPlugin: {
    loadData?: (storageName: string) => Promise<any>
  } | null | undefined
  docId: string
  updated: string
}) {
  const snapshot = await params.networkLensPlugin?.loadData?.('ai-document-index.json')
  const profile = snapshot?.semanticProfiles?.[params.docId] as DocumentSemanticProfileRecord | undefined

  if (!profile) {
    return null
  }

  if (profile.sourceUpdatedAt !== params.updated) {
    return null
  }

  if (!profile.documentSummaryShort?.trim()) {
    return null
  }

  return {
    summaryShort: profile.documentSummaryShort,
    summaryMedium: profile.documentSummaryMedium || profile.documentSummaryShort,
    keywords: parseJsonArray(profile.documentKeywordsJson),
    evidenceSnippets: parseJsonArray(profile.documentEvidenceSnippetsJson),
    indexedAt: profile.documentSummaryUpdatedAt || '',
  }
}

function parseJsonArray(value?: string): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}
```

## 7. 不推荐的读取方式

下面这些做法不建议：

- 直接把 `summaryShort` 当正文摘要显示
- 命中 `semanticProfiles[docId]` 就认为摘要可复用
- 依赖 `suggestionCache`
- 跳过 `sourceUpdatedAt` 校验

原因很直接：

- `summaryShort` 可能只是“优先补到主题页”这类补链建议摘要
- `semanticProfiles` 是复合索引，不是纯摘要表
- `suggestionCache` 绑定筛选条件、时间窗口和主题文档版本

## 8. 兼容性说明

当前 `schemaVersion` 已升级到 `2`。

兼容边界如下：

- 老索引可能只有补链画像字段，没有 `documentSummary*`
- 新索引会同时保留补链画像字段和真实摘要字段
- 读取方应把 `documentSummary*` 当可选字段处理

因此推荐读取策略是：

- 先检查 `documentSummaryShort`
- 没有就回退到你自己的摘要生成流程
- 不要自动回退到 `summaryShort`

## 9. 当前适合复用的字段清单

如果你的插件要复用“真实文档摘要”，推荐只读下面这些字段：

- `documentId`
- `sourceUpdatedAt`
- `sourceHash`
- `title`
- `path`
- `hpath`
- `tagsJson`
- `documentSummaryShort`
- `documentSummaryMedium`
- `documentKeywordsJson`
- `documentEvidenceSnippetsJson`
- `documentSummaryUpdatedAt`

如果你的插件要复用“补链画像”，再另外读取：

- `summaryShort`
- `summaryMedium`
- `keywordsJson`
- `topicCandidatesJson`
- `roleHintsJson`
- `evidenceSnippetsJson`

## 10. 推荐集成策略

对其他插件，最稳的集成方式是：

1. 先按 `docId` 读取 `semanticProfiles`
2. 用 `sourceUpdatedAt === 当前文档 updated` 做 freshness 校验
3. 命中则直接使用 `documentSummaryShort` / `documentSummaryMedium`
4. 未命中则回退到你自己的 AI 摘要流程
5. 不把补链画像字段当正文摘要兜底

这条策略能最大限度复用 `network-lens` 已有索引，同时避免语义混淆。
