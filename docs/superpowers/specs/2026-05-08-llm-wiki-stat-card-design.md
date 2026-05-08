# LLM Wiki 统计卡片设计

## 概述

在 SummaryCardsGrid 中新增 "LLM Wiki" 统计卡片，展示已生成的 wiki 页面数量。详情区域显示所有 wiki 页面文档卡片，提供 AI 聊天问答、问答保存、以及轻量级 wiki 页面维护功能。

## 1. 数据层 — Wiki Index 解析

### 新建文件：`src/analytics/wiki-index.ts`

提供 `parseWikiIndex(options)` 函数：

1. 通过 `resolveDocByTitle(config.wikiIndexTitle)` 获取 wiki index 文档
2. 读取其 kramdown 内容，解析 wiki 页面文档链接（`siyuan://blocks/<id>` 和 `((block-id "title"))` 两种格式，复用 `internal-links.ts` 的提取逻辑）
3. 按 documentId 去重，返回 `WikiIndexPage[]`

### 核心类型

```ts
interface WikiIndexPage {
  documentId: DocumentId
  title: string                    // wiki 页面标题
  themeDocumentId?: DocumentId     // 对应的主题文档 ID（从 wiki 页面标题去除 wikiPageSuffix 后缀，通过 resolveDocByTitle 解析）
  summary?: string                 // AI 维护生成的概要（缓存）
  maintenanceState?: WikiMaintenanceState
}

interface WikiMaintenanceState {
  status: 'idle' | 'reviewing' | 'suggestions-ready' | 'applying'
  suggestions?: WikiMaintenanceSuggestion[]
  diffPreview?: string             // kramdown diff
}

interface WikiMaintenanceSuggestion {
  type: 'broken-link' | 'outdated-section' | 'missing-reference'
  description: string
  sectionHeading?: string
}

interface WikiChatScope {
  mode: 'topic'                    // 顶部入口，不限主题
  | 'document'                     // 卡片入口，指定 wiki 页面
  targetPage?: WikiIndexPage       // document 模式下指定的页面
}
```

### 配置扩展

`PluginConfig` 新增 `showLlmWiki?: boolean`，`DEFAULT_CONFIG` 中默认 `true`。可见性受 `config.aiEnabled && config.wikiEnabled` 双重 gating（类似 `todaySuggestions` 的逻辑）。

## 2. 卡片集成

### 卡片注册

- `src/analytics/summary-detail-types.ts`：`SummaryCardKey` 联合类型新增 `'llmWiki'`
- `src/analytics/summary-card-config.ts`：`SUMMARY_CARD_DEFINITIONS` 新增条目，`visibilityConfigKey: 'showLlmWiki'`，`defaultVisible: true`
- `src/types/config.ts`：`PluginConfig` 新增 `showLlmWiki?: boolean`

### 卡片构建（`src/analytics/summary-cards.ts`）

`buildSummaryCards()` 新增 `'llmWiki'` 分支：
- `value` = wiki 页面去重数量（字符串）
- `hint` = i18n 描述文本
- 调用 `parseWikiIndex()` 获取计数，结果缓存到 snapshot 级别避免重复解析

### 详情区域（`src/analytics/summary-detail-sections.ts`）

`SummaryDetailSection` 的 `kind` 联合新增 `'wikiCards'`：

```ts
interface WikiCardsDetailSection {
  kind: 'wikiCards'
  title: string
  description: string
  pages: WikiIndexPage[]
}
```

`buildSummaryDetailSections()` 新增 `'llmWiki'` key，调用 `parseWikiIndex()` 构建 `WikiCardsDetailSection`。

### UI 渲染

新建 `src/components/WikiCardsSection.vue`，当 `selectedSummaryCardKey === 'llmWiki'` 时渲染：

- **顶部区域**："开始对话"聊天按钮（触发 topic 模式弹窗）
- **列表区域**：每个 `WikiIndexPage` 渲染为一个文档卡片，显示标题、主题文档关联、维护建议概要（如有）
- **每个卡片操作**：聊天按钮（触发 document 模式弹窗）、维护按钮（触发 AI 评审）

### 排序集成

`normalizeSummaryCardOrder()` 自动包含 `'llmWiki'`，拖拽排序无缝接入。

## 3. 聊天功能

### 新建文件：`src/composables/use-analytics-llm-wiki-chat.ts`

### 聊天流程（单轮，两步推理）

1. 用户通过入口按钮打开弹窗，携带 `WikiChatScope`
2. 用户输入问题，发送
3. **Step 1 — 路由**（仅 topic 模式）：将用户问题 + wiki index 中所有页面标题列表发送给 AI，AI 返回最相关的页面标题（需精确匹配列表中的标题）。通过标题匹配到 `WikiIndexPage`，获取 `documentId`。document 模式跳过此步
4. **Step 2 — 回答**：读取目标 wiki 页面 kramdown 内容作为主上下文。prompt 指示 AI 判断是否需要查看原始文档，若需要则从 wiki 页面中的 `siyuan://` 引用链接提取关联文档 ID，读取其内容作为补充上下文
5. 返回结果包含：回答文本、实际使用的 wiki 页面标题、是否引用了原始文档及文档列表

### 弹窗组件：`src/components/WikiChatDialog.vue`

- **标题栏**：显示对话范围（topic 模式显示"不限主题"，document 模式显示 wiki 页面标题）
- **范围指示器**：回答内容上方显示"基于 [页面标题] 的 Wiki 页面回答"，若有原始文档引用则追加"参考了 N 篇原始文档"
- **对话区**：单轮显示（问题 + 回答）
- **底部操作栏**：保存按钮、关闭按钮

### 复用

- AI 调用通过 `AiWikiService` 或新建 `AiLlmWikiChatService`，复用 `forwardProxy` 通道
- prompt 模板存放在 `src/analytics/llm-wiki-prompts.ts`

## 4. 保存问答

### 保存流程

1. 用户在 WikiChatDialog 中点击"保存"按钮
2. 生成保存文档的 markdown 内容：

```markdown
# {用户问题}

> 基于 Wiki 页面：[{wiki页面标题}](siyuan://blocks/{wikiDocId})
> 参考原始文档：[{doc1标题}](siyuan://blocks/{doc1Id})、...
> 对话时间：{timestamp}

{AI 回答内容}
```

3. 调用 SiYuan API 在 `wikiContainerName/Chat/` 路径下创建新文档，标题为用户问题的前 64 个字符（超出部分截断）
4. 创建完成后，在对应 wiki 页面文档末尾追加引用链接 `[{chat文档标题}](siyuan://blocks/{chatDocId})`，建立反向连接

### Chat 目录管理

- `wikiContainerName/Chat/` 目录在首次保存时自动创建
- 路径由现有 `wikiContainerName` 派生，无需额外配置

### 复用

- 文档创建使用 `src/api.ts` 中已有的 `createDocWithMd()`
- 引用链接格式复用 `siyuan://blocks/` 协议

## 5. 维护功能

### 逻辑层：`src/composables/use-analytics-llm-wiki.ts`（与 wiki 页面解析共享文件）

### 维护流程

1. 用户点击文档卡片上的"维护"按钮
2. **AI 评审**：读取 wiki 页面 kramdown 内容，发送给 AI 检查：
   - 失效的文档 ID 链接（通过 `getBlockByID()` 验证）
   - 过时的段落内容（与原始资料对比）
   - 缺失的引用
3. AI 返回结构化建议列表（`WikiMaintenanceSuggestion[]`）
4. **内嵌概要**：建议简要描述（如"发现 2 个失效链接、1 个过时段落"）嵌入文档卡片内显示，伴随"查看详情"按钮
5. **diff 预览弹窗**：点击"查看详情"后展示：
   - 当前 wiki 页面内容
   - AI 建议修改后的版本，高亮变更部分
   - 逐条勾选建议（可选择性采纳）、全部采纳、取消
6. **执行**：确认后通过 `updateBlock` 将修改后的内容写回 wiki 页面文档

### 缓存策略

- 评审结果缓存在 `WikiIndexPage.maintenanceState` 中，同一会话内不重复调用
- 用户手动刷新时清除缓存重新评审

### 失效链接验证

- 调用 `getBlockByID()` 验证文档 ID 是否存在，结果作为上下文传给 AI 辅助判断

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/analytics/wiki-index.ts` | 新建 | Wiki Index 解析、类型定义 |
| `src/analytics/llm-wiki-prompts.ts` | 新建 | 聊天和维护的 prompt 模板 |
| `src/composables/use-analytics-llm-wiki.ts` | 新建 | Wiki 页面数据管理、维护逻辑 |
| `src/composables/use-analytics-llm-wiki-chat.ts` | 新建 | 聊天路由和问答逻辑 |
| `src/components/WikiCardsSection.vue` | 新建 | LLM Wiki 卡片详情区域组件 |
| `src/components/WikiChatDialog.vue` | 新建 | 聊天弹窗组件 |
| `src/components/WikiMaintainDiffDialog.vue` | 新建 | 维护 diff 预览弹窗组件 |
| `src/analytics/summary-detail-types.ts` | 修改 | 新增 `'llmWiki'` key 和 `'wikiCards'` kind |
| `src/analytics/summary-card-config.ts` | 修改 | 注册 LLM Wiki 卡片定义 |
| `src/analytics/summary-cards.ts` | 修改 | 构建 LLM Wiki 卡片 |
| `src/analytics/summary-detail-sections.ts` | 修改 | 构建 LLM Wiki 详情区域 |
| `src/analytics/summary-card-order.ts` | 修改 | 排序包含 `'llmWiki'` |
| `src/types/config.ts` | 修改 | 新增 `showLlmWiki` 配置项 |
| `src/i18n/ui.ts` | 修改 | 新增 LLM Wiki 相关 i18n 文本 |
| `src/App.vue` | 修改 | 集成 WikiCardsSection 渲染 |
| `src/composables/use-analytics.ts` | 修改 | 接入 llm-wiki composable |
