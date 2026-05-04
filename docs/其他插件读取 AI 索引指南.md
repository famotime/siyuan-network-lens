# 其他插件读取 AI 索引指南

本文说明其他思源插件如何读取 `network-lens` 生成的 AI 文档索引（V3 Schema）。

## 1. 索引文件位置

```ts
ai-document-index.json
```

通过 `network-lens` 插件私有存储读写：

1. 拿到 `network-lens` 插件实例
2. 调用 `loadData('ai-document-index.json')`
3. 从返回对象读取 `documentProfiles`

## 2. 快照结构（schemaVersion: 3）

```ts
interface AiDocumentIndexSnapshot {
  schemaVersion: number          // 当前为 3
  documentProfiles: Record<string, DocumentIndexProfile>
}
```

**注意：** 补链建议数据已移至独立文件 `ai-link-repair-store.json`，不再与文档索引混存。

## 3. DocumentIndexProfile 字段说明

```ts
interface DocumentIndexProfile {
  documentId: string
  sourceUpdatedAt: string        // 源文档 updated 时间戳
  sourceHash: string             // 内容哈希，用于快速判断是否变化
  title: string
  path: string
  hpath: string
  tagsJson: string               // string[] — 文档标签
  positioning: string            // 单句定位（< 120 字符）
  propositionsJson: string       // PropositionItem[] — 原文命题
  keywordsJson: string           // string[] — 关键词
  primarySourceBlocksJson: string   // SourceBlockItem[] — 核心证据块（>= 80 字符，最多 8 块）
  secondarySourceBlocksJson: string // SourceBlockItem[] — 补充证据块（30-80 字符，最多 12 块）
  generatedAt: string            // 索引生成时间 ISO 8601
}

interface PropositionItem {
  text: string                   // 命题文本
  sourceBlockIds: string[]       // 支撑该命题的证据块 ID
}

interface SourceBlockItem {
  blockId: string                // 思源块 ID
  text: string                   // 块纯文本内容
}
```

## 4. 字段语义

### positioning（定位）
一句话描述文档的主题和范围，使用中性描述性语言，不含评价性表述。

### propositions（原文命题）
3-8 条从文档中提取的事实性主张或关键观点。每条命题：
- 是可独立理解的完整陈述
- 绑定到至少一个证据块（`sourceBlockIds`）
- 使用中性语言，不含"这篇文章介绍了…"等评价表述

### primarySourceBlocks（核心证据块）
文档中最能揭示实质内容的段落，字符数 >= 80，上限 8 块。

### secondarySourceBlocks（补充证据块）
较短但仍有价值的内容段落，字符数 30-80，上限 12 块。

## 5. 最小读取示例

```ts
interface DocumentIndexProfile {
  documentId: string
  sourceUpdatedAt: string
  positioning: string
  propositionsJson: string
  keywordsJson: string
  primarySourceBlocksJson: string
  secondarySourceBlocksJson: string
}

interface PropositionItem {
  text: string
  sourceBlockIds: string[]
}

interface SourceBlockItem {
  blockId: string
  text: string
}

async function loadFreshDocumentIndex(params: {
  networkLensPlugin: {
    loadData?: (storageName: string) => Promise<any>
  } | null | undefined
  docId: string
  updated: string
}) {
  const snapshot = await params.networkLensPlugin?.loadData?.('ai-document-index.json')

  if (!snapshot || snapshot.schemaVersion < 3) {
    return null
  }

  const profile = snapshot?.documentProfiles?.[params.docId] as DocumentIndexProfile | undefined

  if (!profile) {
    return null
  }

  if (profile.sourceUpdatedAt !== params.updated) {
    return null
  }

  if (!profile.positioning?.trim()) {
    return null
  }

  return {
    positioning: profile.positioning,
    propositions: parseJsonArray<PropositionItem>(profile.propositionsJson),
    keywords: parseJsonArray<string>(profile.keywordsJson),
    primarySourceBlocks: parseJsonArray<SourceBlockItem>(profile.primarySourceBlocksJson),
    secondarySourceBlocks: parseJsonArray<SourceBlockItem>(profile.secondarySourceBlocksJson),
    generatedAt: profile.generatedAt,
  }
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
```

## 6. freshness 校验

最小校验：

```ts
profile.sourceUpdatedAt === currentDocument.updated
```

完整校验：

```ts
profile.sourceUpdatedAt === currentDocument.updated
&& typeof profile.sourceHash === 'string'
&& profile.sourceHash.length > 0
```

## 7. 不推荐的做法

- 跳过 `schemaVersion` 校验（老版本结构完全不同）
- 跳过 `sourceUpdatedAt` freshness 校验
- 将 `positioning` 视为评价性摘要（它是中性定位描述）
- 将 `propositions` 中的 `sourceBlockIds` 当作可跳过的可选字段（它们是证据链的核心）

## 8. 兼容性说明

- `schemaVersion: 3` 是当前版本
- `schemaVersion < 3` 的快照结构完全不同（旧版本使用 `semanticProfiles` 字段），不建议尝试兼容读取
- 旧版索引不包含 `positioning`、`propositionsJson`、`primarySourceBlocksJson` 等字段
- 建议读取方在 `schemaVersion < 3` 时直接返回 null，等待用户重新生成索引
