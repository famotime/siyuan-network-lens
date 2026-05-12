# LLM Wiki "维护"操作深度分析

本文档分析"脉络镜"插件中 LLM Wiki 功能的两套维护系统——它们分别运行在不同架构层次，服务于不同场景。

---

## 目录

1. [架构总览](#1-架构总览)
2. [系统一：主题页批量生成与维护（主系统）](#2-系统一主题页批量生成与维护主系统)
3. [系统二：单页 LLM 维护（辅助系统）](#3-系统二单页-llm-维护辅助系统)
4. [核心数据结构与类型](#4-核心数据结构与类型)
5. [配置项](#5-配置项)
6. [文件索引](#6-文件索引)

---

## 1. 架构总览

LLM Wiki 的"维护"操作实际包含**两套独立系统**：

| 维度 | 系统一：主题页批量生成 | 系统二：单页 LLM 维护 |
|------|----------------------|---------------------|
| **定位** | 主系统——从源文档批量生成/更新主题 Wiki 页 | 辅助系统——对已有 Wiki 页做增量检修 |
| **入口 UI** | `WikiMaintainPanel.vue`（面板内两个按钮：生成预览 + 应用变更） | 索引页中每个 Wiki 页旁边的"维护"按钮 |
| **核心控制器** | `use-analytics-wiki-actions.ts` → `prepareWikiPreview()` + `applyWikiChanges()` | `use-analytics-llm-wiki.ts` → `reviewPage()` + `applyMaintenance()` |
| **AI 调用** | 三次顺序调用（模板诊断 → 章节规划 → 章节生成） | 一次调用（检修 + 修订建议） |
| **变更检测** | Fingerprint 指纹对比 + 时间戳增量 | 断链探测 + LLM 内容分析 |
| **写入范围** | 主题页 + 索引页 + 日志页 | 单个 Wiki 页面 |
| **冲突处理** | 有（managed area 指纹不匹配时标记 conflict） | 无 |

两套系统可以独立使用，也可以配合：先用系统一批量生成，再用系统二逐页精修。

---

## 2. 系统一：主题页批量生成与维护（主系统）

### 2.1 操作流程总览

```
用户点击"生成预览"
    │
    ▼
┌─────────────────────────────────┐
│ 1. 前置校验                      │
│    - wiki 开关已启用              │
│    - AI 配置就绪                  │
│    - 快照数据存在                  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 2. 解析作用域文档                │
│    resolveWikiScopeDocuments()   │
│    - 筛选关联文档（入链/出链/子文档）│
│    - 排除 wiki 容器内已有文档      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 3. 构建源文档画像                │
│    buildWikiSourceProfileMap()   │
│    - 确保每个源文档有 AI 索引      │
│    - 提取标题、摘要、主题匹配信息   │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 4. 增量差异计算                  │
│    computeSourceDocumentDeltas() │
│    - new：上次快照中不存在         │
│    - changed：updated 时间戳变化  │
│    - unchanged：无变化            │
│    - deleted：上次存在但本次缺失   │
│                                  │
│    若无变化且有缓存 → 直接返回缓存  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 5. AI 三步生成                   │
│                                  │
│ 5a. diagnoseThemeTemplate()      │
│     → 模板类型 + 置信度           │
│                                  │
│ 5b. planThemePage()              │
│     → 章节顺序                   │
│                                  │
│ 5c. generateThemeSection() ×N    │
│     → 每个章节并行生成内容        │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 6. 渲染草稿                      │
│    renderThemeWikiDraft()        │
│    - 拼接页面标题 + managedRoot   │
│    - 每个章节添加 HTML 注释标记    │
│    - 附加 manualNotes 区域       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 7. 构建预览（差异检测）           │
│    buildWikiPreview()            │
│    - 计算新旧 managed 区域指纹    │
│    - 对比 lastApply 指纹 → 冲突  │
│    - 逐章节比较 → affectedSections│
│    → 状态: create/update/         │
│            unchanged/conflict     │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 8. 保存快照 + 计算增量统计       │
│    - sourceDocumentTimestamps    │
│    - pageFingerprint             │
│    - managedFingerprint          │
│    - delta: new/changed/         │
│      unchanged/deleted 统计      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 9. 如果是 create 状态 → 自动应用  │
│    否则展示预览面板等待用户确认    │
└─────────────────────────────────┘
```

### 2.2 核心算法详解

#### 2.2.1 源文档增量分类 (`computeSourceDocumentDeltas`)

位于 `use-analytics-wiki-actions.ts`。基于时间戳比较：

```
function computeSourceDocumentDeltas(
  currentDocuments: Array<{ id: string, updated: string }>,
  previousTimestamps: Record<string, string> | undefined,
): Map<string, 'new' | 'changed' | 'unchanged' | 'deleted'>
```

- 遍历当前快照中的所有文档
- 若文档 ID 不在上次记录中 → `new`
- 若文档 ID 在上次记录中但时间戳不同 → `changed`
- 若文档 ID 在上次记录中且时间戳相同 → `unchanged`
- 反向检查：上次记录中的 ID 不在当前快照中 → `deleted`

当所有文档都是 `unchanged` 且存在上次预览缓存时，直接返回缓存结果，跳过 AI 调用。

#### 2.2.2 指纹变更检测 (`buildWikiPreview`)

位于 `wiki-diff.ts`。使用 FNV-1a 变体哈希：

```typescript
function fingerprintWikiContent(value: string): string {
  let hash = 2166136261          // FNV offset basis
  for (let index = 0; ...) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)  // FNV prime
  }
  return `w${(hash >>> 0).toString(16)}`
}
```

状态判定逻辑：

```
如果 existingPage 存在
  且 lastApply.managedFingerprint 存在
  且 当前 managedFingerprint ≠ lastApply.managedFingerprint
  → conflict（外部编辑了 managed 区域）

否则如果没有 existingPage → create

否则如果 oldManagedFingerprint === nextManagedFingerprint → unchanged

否则 → update
```

受影响章节的检测：将旧 managed markdown 解析为 `Map<key, {heading, markdown}>`，逐 key 与新 draft 对比，包括 heading 变化和内容变化。

#### 2.2.3 文档写入 (`applyWikiDocuments`)

位于 `wiki-documents.ts`。写入三类文档：

**主题页写入：**

- **冲突跳过**：如果 `status === 'conflict'` 且未勾选"允许覆盖冲突页面"，跳过
- **未变跳过**：如果 `status === 'unchanged'`，跳过
- **新建**：调用 `createDocWithMd(notebook, path, fullMarkdown)`
- **更新**：解析页面结构（`resolveWikiPageStructure`），删除旧 managed 区子块，预填新 managed markdown，补充 manualNotes 区域

**索引页写入：**

- 读取所有已存储的主题页记录
- 每个主题页提取 intro 摘要
- 生成包含主题页列表、未分类源文档、匹配主题统计的索引 markdown
- 上写入/更新索引文档

**日志页写入：**

- 构建维护日志条目：时间戳、创建/更新/冲突计数、作用域描述、源文档列表、主题链接
- 新建日志文档或预填到现有日志文档顶部

#### 2.2.4 页面结构解析 (`resolveWikiPageStructure`)

Wiki 页面分为两个区域，由二级标题区分：

```
# 页面标题
## 📊 Managed Root（托管区域）     ← region=managed
  ### 章节 A
  ### 章节 B
  ### ...
## 📝 Manual Notes（手动笔记区域）  ← region=manual
  用户自行添加的内容
```

每个章节前面有 HTML 注释标记用于标识：
```html
<!-- network-lens-wiki-section:intro -->
### 主题概览
```

`resolveWikiPageStructure` 遍历页面子块，通过 `matchesWikiHeading` 匹配二级标题来划分 managed 块和 manual 块，确定各自的 block ID。

#### 2.2.5 章节标记与渲染 (`renderThemeWikiDraft`)

位于 `wiki-renderer.ts`。渲染流程：

1. 构建源文档引用索引映射（`sourceRefIndexMap`）
2. 按 `pagePlan.sectionOrder` 顺序渲染每个章节
3. 每个章节内容前插入 HTML 注释标记：`<!-- network-lens-wiki-section:{key} -->`
4. 章节内的源文档引用渲染为上标脚注：`<sup>((docId "序号"))</sup>`
5. sources 章节特殊处理：按源文档分组聚合证据
6. 末尾附加 `## 📝 Manual Notes` 区域

### 2.3 应用结果

`applyWikiDocuments` 返回 `WikiApplyBatchResult`：

```typescript
interface WikiApplyBatchResult {
  themePages: Array<{ pageTitle, pageId?, result }>
  indexPage: { pageTitle, pageId?, result }
  logPage: { pageTitle, pageId?, result }
  counts: { created, updated, skipped, conflict }
}
```

---

## 3. 系统二：单页 LLM 维护（辅助系统）

### 3.1 操作流程

```
用户在索引页点击某个 Wiki 页的"维护"按钮
    │
    ▼
┌──────────────────────────────────────┐
│ 1. reviewPage(page)                  │
│    - 设置状态: reviewing              │
│    - 获取页面 kramdown 内容            │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 2. 断链探测                           │
│    - 正则提取所有 siyuan://blocks/<id> │
│    - 逐一调用 getBlockKramdown 验证    │
│    - 失败的 ID 收集到 brokenLinkIds    │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 3. LLM API 调用                       │
│    endpoint: {aiBaseUrl}/chat/completions│
│    model: config.aiModel              │
│    messages:                           │
│      system: buildMaintenanceSystemPrompt()│
│      user: buildMaintenanceUserPrompt()│
│    max_tokens: config.aiMaxTokens     │
│    temperature: config.aiTemperature   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 4. parseMaintenanceResponse()         │
│    解析 JSON 响应:                     │
│    - suggestions: WikiMaintenanceSuggestion[]│
│    - revisedMarkdown: string           │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 5. 展示 diff 对话框                    │
│    WikiMaintainDiffDialog.vue          │
│    - 建议列表（可勾选）                 │
│    - 侧栏对比：当前 vs 建议内容         │
│    - "应用全部" / "应用选中"按钮        │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 6. applyMaintenance(page, revisedMarkdown)│
│    - 调用 updateBlock(pageId, 'markdown', revisedMarkdown)│
│    - 写入后状态回归 idle               │
└──────────────────────────────────────┘
```

### 3.2 LLM Prompt 设计

**系统提示词：**

```
You are a wiki page maintenance assistant for SiYuan notes.
Review the provided wiki page content and check for:
1. Broken document ID links (siyuan://blocks/<id> pointing to non-existent documents)
2. Outdated sections (content that should be updated based on source documents)
3. Missing references (source documents not linked from the wiki page)
Return JSON with two fields:
  "suggestions" (array of {type, description, sectionHeading?})
  "revisedMarkdown" (the corrected full wiki page content).
Do not invent content not grounded in the source materials.
```

**用户提示词：**

```
Wiki page title: {title}

Wiki page content:
{kramdown}

Confirmed broken link IDs: {id1}, {id2}, ...
```

LLM 返回的 JSON 结构：

```typescript
interface WikiMaintenanceResult {
  suggestions: Array<{
    type: 'broken-link' | 'outdated-section' | 'missing-reference'
    description: string
    sectionHeading?: string
  }>
  revisedMarkdown: string
}
```

### 3.3 建议类型

| type | 含义 | 检测方式 |
|------|------|---------|
| `broken-link` | 断链——指向不存在文档的 siyuan:// 链接 | 先由代码探测 `getBlockKramdown`，结果传给 LLM 确认 |
| `outdated-section` | 过期章节——内容需要根据源文档更新 | LLM 分析判断 |
| `missing-reference` | 缺失引用——源文档未被 Wiki 页引用 | LLM 分析判断 |

---

## 4. 核心数据结构与类型

### 4.1 Wiki 页面快照记录 (`WikiPageSnapshotRecord`)

存储在 `ai-wiki-index.json` 中，是两套系统的持久化基础：

```typescript
interface WikiPageSnapshotRecord {
  pageType: 'theme' | 'index' | 'log'
  pageTitle: string
  pageId?: string                        // SiYuan 文档块 ID
  themeDocumentId?: string               // 关联的主题文档 ID
  themeDocumentTitle?: string
  sourceDocumentIds: string[]            // 源文档 ID 列表
  sourceDocumentEntries?: WikiSourceDocumentEntry[]  // 含链接类型的源文档
  sourceDocumentTimestamps?: Record<string, string>  // 增量 diff 用
  pageFingerprint?: string               // 整页指纹
  managedFingerprint?: string            // managed 区域指纹
  lastGeneratedAt?: string               // 上次生成时间
  lastPreview?: WikiPreviewRecord        // 上次预览结果
  lastApply?: WikiApplyRecord            // 上次应用结果
}
```

### 4.2 预览状态 (`WikiPreviewStatus`)

```
create    → 目标页面不存在，将新建
update    → managed 区域指纹有变化，将更新
unchanged → 指纹完全一致，跳过
conflict  → 页面在上次应用后被外部编辑过
```

### 4.3 应用结果 (`WikiApplyResult`)

```
created   → 新建了文档
updated   → 更新了已有文档
skipped   → 跳过（unchanged 或冲突但未勾选覆盖）
conflict  → 冲突页面被跳过
```

### 4.4 维护状态机（系统二）

```
idle → reviewing → suggestions-ready → applying → idle
               ↘ idle（出错时回退）
```

### 4.5 Wiki Store 存储键格式

```
theme:<themeDocumentId>   — 主题页记录
index:<pageTitle>         — 索引页记录
log:<pageTitle>           — 日志页记录
```

---

## 5. 配置项

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `wikiEnabled` | `false` | 是否启用 Wiki 功能 |
| `wikiPageSuffix` | `'-llm-wiki'` | Wiki 页标题后缀（用于识别） |
| `wikiIndexTitle` | `'LLM-Wiki-Index'` | 索引页标题 |
| `wikiLogTitle` | `'LLM-Wiki-Maintenance-Log'` | 日志页标题 |
| `wikiContainerPath` | `'/知识库/LLM Wiki'` | Wiki 文档容器路径 |
| `wikiIncrementalEnabled` | `true` | 是否启用增量生成 |

---

## 6. 文件索引

### 核心源文件

| 文件 | 职责 |
|------|------|
| `src/composables/use-analytics-wiki-actions.ts` | 主系统控制器：`prepareWikiPreview()` + `applyWikiChanges()` |
| `src/composables/use-analytics-llm-wiki.ts` | 辅助系统控制器：`reviewPage()` + `applyMaintenance()` |
| `src/analytics/wiki-diff.ts` | FNV-1a 指纹计算 + 预览状态判定 + 受影响章节检测 |
| `src/analytics/wiki-documents.ts` | 文档写入编排：主题页/索引页/日志页 |
| `src/analytics/wiki-renderer.ts` | 草稿渲染：章节标记 + 源文档脚注 + 页面结构拼装 |
| `src/analytics/wiki-store.ts` | 持久化存储：快照记录的读写与归一化 |
| `src/analytics/wiki-page-model.ts` | 类型定义 + 常量（heading 名称、block 属性键） |
| `src/analytics/wiki-index.ts` | Wiki 索引页解析 + 维护状态类型定义 |
| `src/analytics/llm-wiki-maintain-service.ts` | LLM Prompt 构建 + 响应解析 + 建议汇总 |
| `src/composables/use-analytics-wiki.ts` | Wiki 预览状态类型 + 作用域解析 + 现有页面解析 |
| `src/composables/use-app-wiki-panel.ts` | App 级 Wiki 面板开关与文档切换控制器 |

### UI 组件

| 文件 | 职责 |
|------|------|
| `src/components/WikiMaintainPanel.vue` | 主维护面板：预览卡片、增量统计、源文档列表 |
| `src/components/WikiMaintainDiffDialog.vue` | 单页维护 diff 对话框：建议勾选 + 侧栏对比 |

### i18n 键空间

| 命名空间 | 使用方 |
|----------|--------|
| `wikiMaintain.*` | 系统一（WikiMaintainPanel） |
| `llmWiki.maintain.*` | 系统二（单页维护按钮和 diff 对话框） |
| `nav.llmWiki.maintain` | 导航栏"维护 LLM Wiki"标签 |

### 测试文件

| 文件 |
|------|
| `src/analytics/wiki-diff.test.ts` |
| `src/analytics/wiki-documents.test.ts` |
| `src/analytics/wiki-index.test.ts` |
| `src/analytics/llm-wiki-maintain-service.test.ts` |
| `src/composables/use-analytics-wiki.test.ts` |
| `src/composables/use-analytics-wiki-actions.test.ts` |
| `src/components/WikiMaintainPanel.test.ts` |

### 设计文档

| 文件 |
|------|
| `docs/superpowers/specs/2026-05-05-llm-wiki-single-theme-maintenance-design.md` |
| `docs/superpowers/plans/2026-05-05-llm-wiki-single-theme-maintenance.md` |
| `docs/superpowers/plans/2026-05-07-wiki-incremental-and-conflict.md` |
