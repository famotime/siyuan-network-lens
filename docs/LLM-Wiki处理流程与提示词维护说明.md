# LLM Wiki 处理流程与提示词维护说明

本文由旧版维护分析与刷新检测说明迁移整合而来，并按当前源码校准 LLM Wiki 的实现进展、处理流程、提示词位置和后续维护建议。

## 1. 当前实现进展

LLM Wiki 目前已经形成三条相关链路：

1. 主题 Wiki 生成与刷新
   - 当前主链路是“单主题预览 + 确认写回”。
   - `applyWikiDocuments` 仍保留批量形态的入参，但 `prepareWikiPreview` 当前要求 `themeDocumentId`，实际一次只生成一个主题页。
   - 入口点击后先生成预览，不直接写文档；新建页状态为 `create` 时会尝试自动应用。
2. 单页 LLM 维护
   - 从 Wiki 索引页解析出主题 Wiki 页面后，可对单页做断链探测、LLM 检修和 diff 应用。
   - 支持“应用全部”或按建议 section 合并应用。
3. Wiki 聊天
   - 不是维护写回流程，但同属 LLM Wiki 的 prompt 面。
   - 包含页面路由 prompt、基于 Wiki 内容回答 prompt、多轮上下文组装。

刷新机制仍是手动触发：不会后台监听文档变化。再次点击生成预览时，系统按当前 scope 重新检查源文档索引新鲜度、必要时重建索引、重算 Wiki 草稿，再用指纹判断 `create / update / unchanged / conflict`。

## 2. 主题 Wiki 生成与刷新流程

核心控制器位于 `src/composables/use-analytics-wiki-actions.ts`。

### 2.1 预览生成

`prepareWikiPreview()` 的主要步骤：

1. 前置校验
   - `wikiEnabled`
   - `aiEnabled`
   - AI 配置完整
   - `snapshot / report / trends` 已就绪
   - `aiWikiService / aiWikiStore` 已初始化
   - 请求中存在 `themeDocumentId`
2. 确定主题文档
   - 从当前 `themeDocuments` 中按 `themeDocumentId` 找到目标主题文档。
3. 解析本轮源文档
   - `resolveWikiScopeDocuments()` 根据请求中的 `sourceDocumentIds` 解析文档。
   - 如果请求没有显式文档列表，则回退到当前 `filteredDocuments`。
   - 目标主题文档自身会从源文档中排除。
4. 保障源文档 AI 索引
   - `buildWikiSourceProfileMap()` 对每篇源文档调用 `ensureDocumentIndex()`。
   - 若索引存在且 `sourceUpdatedAt === document.updated`，复用索引。
   - 若不一致或缺失，重建该文档索引。
   - 两次尝试都失败的文档进入 `skippedSourceDocuments`。
5. 增量差异计算
   - `computeSourceDocumentDeltas()` 用当前源文档 `updated` 与 `ai-wiki-index.json` 中保存的 `sourceDocumentTimestamps` 比较。
   - 状态包括 `new / changed / unchanged / deleted`。
   - 如果启用增量、已有历史时间戳、且没有任何变化，会优先返回缓存预览。
6. 构造主题 payload
   - `buildSingleThemeWikiPayload()` 把源文档索引、结构分析信号和引用证据整理为 `WikiThemeBundle`。
   - 输入包括 propositions、关键词、主要/次要证据块、结构角色、趋势角色、同主题文档间引用证据。
   - `wikiFullContentEnabled` 开启时，会额外读取源文档完整 kramdown，并在 prompt 中提示优先使用全文。
7. 三段式 AI 生成
   - `diagnoseThemeTemplate()`：诊断模板类型和启用模块。
   - `planThemePage()`：规划页面 section 顺序、目标和格式。
   - `generateThemeSection()`：按 section 并发生成内容块。
8. 渲染草稿
   - `renderThemeWikiDraft()` 输出稳定 markdown。
   - 页面分为 `AI 管理区` 和 `人工备注区`。
   - 每个 section 带 `<!-- network-lens-wiki-section:{key} -->` 标记。
9. 构建预览
   - `resolveExistingWikiPage()` 读取已有页面。
   - `buildWikiPreview()` 计算整页和管理区指纹，判断页面状态。
10. 保存预览状态
   - 保存 `WikiPageSnapshotRecord` 到 `ai-wiki-index.json`。
   - `lastPreview.promptVersions` 会记录当前主题生成 prompt 版本。
   - 保存内存和持久化预览缓存。

### 2.2 状态判定

状态逻辑位于 `src/analytics/wiki-diff.ts`：

- `create`：目标 Wiki 页不存在。
- `update`：目标页存在，且当前 AI 管理区与新草稿不同。
- `unchanged`：目标页存在，且当前 AI 管理区与新草稿一致。
- `conflict`：目标页存在，且当前 AI 管理区与上次插件写入记录的 `lastApply.managedFingerprint` 不一致。

冲突只看 AI 管理区，不看人工备注区。用户修改人工备注区不会触发冲突；用户或外部流程修改 AI 管理区会触发冲突。

### 2.3 写回应用

`applyWikiChanges()` 调用 `src/analytics/wiki-documents.ts` 中的 `applyWikiDocuments()`。

写回规则：

- `unchanged` 跳过。
- `conflict` 默认跳过，除非用户勾选允许覆盖冲突页面。
- `create` 直接创建完整主题页。
- `update` 只替换 AI 管理区内容，并保留人工备注区。
- 写后回读页面，重新计算 `pageFingerprint / managedFingerprint`。
- `lastApply.promptVersions` 会记录当前主题生成 prompt 版本。
- 同步 Wiki 页面 block attrs。
- 重建索引页。
- 追加维护日志页。

索引页和日志页不是 LLM 输出，而是本地规则生成。索引页会读取 `ai-wiki-index.json` 中所有主题页记录，因此它是累计视角，不只是当前这次预览的镜像。

## 3. 源文档变更检测

当前机制是“手动触发的一次增量重算”。

关联文档变化能被检测到，但需要满足：

- 文档仍在当前 scope 内。
- 用户再次点击生成预览。
- 思源文档 `updated` 随内容变化而更新。

检测链路分两层：

1. 文档索引新鲜度
   - `ensureDocumentIndex()` / `getFreshDocumentProfile()` 通过 `sourceUpdatedAt` 与当前 `document.updated` 判断索引是否可复用。
   - 如果文档内容变化但 `updated` 没变，当前实现无法识别索引过期。
2. Wiki 页面内容差异
   - 新索引生成新的 Wiki draft。
   - `buildWikiPreview()` 比较新旧 AI 管理区指纹。
   - 如果 draft 没变化，仍显示 `unchanged`。

因此“文档变了”不等于“一定写回 Wiki”。只有新草稿与当前 AI 管理区不同，才会进入 `update`。

## 4. 单页 LLM 维护流程

单页维护控制器位于 `src/composables/use-analytics-llm-wiki.ts`，辅助逻辑拆在：

- `src/composables/llm-wiki-maintain-review.ts`
- `src/composables/llm-wiki-maintain-apply.ts`
- `src/analytics/llm-wiki-maintain-service.ts`

流程：

1. `loadWikiPages(kramdown)`
   - 从索引页 kramdown 中解析主题 Wiki 页面列表。
2. `reviewPage(page)`
   - 读取目标 Wiki 页 kramdown。
   - 用正则提取 `siyuan://blocks/<id>`。
   - 对每个 ID 调用 `getBlockKramdown()` 探测断链。
   - 调用 LLM，传入页面全文和确认失效的块 ID。
   - 解析 LLM 返回的 `suggestions` 与 `revisedMarkdown`。
3. 展示 diff
   - `WikiMaintainDiffDialog.vue` 展示建议列表和新旧内容。
4. `applyMaintenance(page, revisedMarkdown, selectedSuggestions)`
   - 如果未选择具体建议，直接写入 LLM 修订全文。
   - 如果选择了具体建议，`resolveAppliedMaintenanceMarkdown()` 会尽量按 section marker 合并，只替换相关 section。
   - 最终通过 `updateBlock('markdown', nextMarkdown, page.documentId)` 写回单个 Wiki 页。

单页维护不使用 `ai-wiki-index.json` 指纹冲突机制，也不会自动更新索引页和日志页。

## 5. Wiki 聊天流程

聊天相关 prompt 由 `src/analytics/llm-wiki-prompts.ts` 集中构建，`src/analytics/llm-wiki-chat-service.ts` 保留解析与兼容导出，并会被 `src/composables/use-wiki-chat-session.ts` 调用。

它包含两类 AI 请求：

- 路由：从可用 Wiki 页标题和摘要中选择最相关页面。
- 回答：基于 Wiki 页内容和可选源文档内容回答用户问题。

这条链路不写回 Wiki，但它和维护链路共享同一批 Wiki 页面内容，因此 prompt 维护时应一起纳入盘点。

## 6. 提示词清单与所在文件

### 6.1 Prompt Registry

| 项目 | 所在文件 | 当前形态 |
|---|---|---|---|
| Prompt 类型 | `src/analytics/llm-prompt-types.ts` | 共享 `LlmPromptSpec`、message、role 类型 |
| LLM Wiki Prompt Registry | `src/analytics/llm-wiki-prompts.ts` | 集中构建主题生成、单页维护、Wiki 聊天 prompt |
| 通用 AI Prompt Registry | `src/analytics/ai-prompts.ts` | 集中构建 AI Inbox、连接测试、AI 补链、文档索引 prompt |
| Prompt 测试 | `src/analytics/llm-wiki-prompts.test.ts` | 覆盖版本、消息结构、增量、冲突、全文、维护和聊天 |
| 通用 AI Prompt 测试 | `src/analytics/ai-prompts.test.ts` | 覆盖非 Wiki prompt 的版本、schema、消息结构和关键约束 |
| 主题生成 prompt 版本 | `LLM_WIKI_THEME_PROMPT_VERSIONS` | 写入预览和应用快照 |
| 主题生成中英文协议文案 | `THEME_PROMPT_TEXT` | registry 内部常量，不再放在 i18n |

当前所有 LLM Wiki prompt 都通过 registry 统一构建。`wiki-ai.ts`、`llm-wiki-maintain-service.ts`、`llm-wiki-chat-service.ts` 不再直接拼接核心 prompt，只保留 AI 请求、响应解析、归一化或兼容导出。

AI Inbox、AI 补链和文档索引等非 LLM Wiki prompt 已迁入 `src/analytics/ai-prompts.ts`。`ai-inbox.ts`、`ai-link-suggestions.ts`、`ai-document-summary.ts` 不再直接维护核心 system/user prompt，只保留 payload 构造、AI 请求、响应解析和错误处理。

### 6.2 主题 Wiki 三段式生成

| 阶段 | Builder | Prompt ID | 版本 | 输出 schema |
|---|---|---|---:|---|
| 模板诊断 | `buildThemeDiagnosisPrompt()` | `llm-wiki.theme.diagnosis` | 1 | `WikiTemplateDiagnosis` |
| 页面规划 | `buildThemePagePlanPrompt()` | `llm-wiki.theme.plan` | 1 | `WikiPagePlan` |
| 章节生成 | `buildThemeSectionPrompt()` | `llm-wiki.theme.section` | 1 | `WikiSectionDraft` |

主题 Wiki prompt 的输入由自然语言协议、可选模式说明和 JSON payload 组成：

- 通用 system 约束：基于输入证据、只返回 JSON、不编造。
- 阶段 user 指令：诊断、规划或生成单个 section。
- 模式指令：增量、冲突章节、全文优先。
- JSON payload：`payload / diagnosis / pagePlan / sectionType` 等结构化上下文。

### 6.3 单页维护

| 阶段 | 函数 | 所在文件 | 当前形态 |
|---|---|---|---|
| 维护 prompt builder | `buildSinglePageMaintenancePrompt()` | `src/analytics/llm-wiki-prompts.ts` | 返回 `LlmPromptSpec` |
| 兼容 system prompt | `buildMaintenanceSystemPrompt()` | `src/analytics/llm-wiki-maintain-service.ts` | 委托 registry |
| 兼容 user prompt | `buildMaintenanceUserPrompt()` | `src/analytics/llm-wiki-maintain-service.ts` | 委托 registry |
| 响应解析 | `parseMaintenanceResponse()` | `src/analytics/llm-wiki-maintain-service.ts` | JSON 解析 + 类型归一化 |
| 建议摘要 | `buildMaintenanceSummary()` | `src/analytics/llm-wiki-maintain-service.ts` | 本地规则 |

### 6.4 Wiki 聊天

| 阶段 | 函数 | 所在文件 | 当前形态 |
|---|---|---|---|
| 页面路由 prompt builder | `buildWikiRoutePrompt()` | `src/analytics/llm-wiki-prompts.ts` | 返回 `LlmPromptSpec` |
| 聊天回答 prompt builder | `buildWikiChatPrompt()` | `src/analytics/llm-wiki-prompts.ts` | 返回 `LlmPromptSpec` |
| 多轮上下文消息 | `buildWikiContextMessage()` | `src/analytics/llm-wiki-prompts.ts` | 集中模板函数 |
| 兼容导出 | `buildRouteSystemPrompt()` 等 | `src/analytics/llm-wiki-chat-service.ts` | 委托 registry |

### 6.5 非 LLM Wiki AI 能力

| 能力 | Builder | Prompt ID | 版本 | 输出 schema |
|---|---|---|---:|---|
| AI Inbox 今日建议 | `buildAiInboxPrompt()` | `ai-inbox.generate` | 1 | `AiInboxResult` |
| AI 连接测试 | `buildAiConnectionTestPrompt()` | `ai.connection-test` | 1 | 无 |
| 孤立文档 AI 补链 | `buildAiLinkSuggestionPrompt()` | `ai-link.suggest` | 1 | `AiLinkSuggestionResult` |
| 补链结果语言重写 | `buildAiLinkRewritePrompt()` | `ai-link.rewrite` | 1 | `AiLinkSuggestionResult` |
| 文档索引证据编译 | `buildAiDocumentEvidencePrompt()` | `ai-document.evidence-compile` | 1 | `EvidenceCompilationResult` |

非 Wiki prompt 的输入仍以结构化 payload 为主：

- AI Inbox：自然语言任务约束 + `AiInboxPayload`。
- AI 补链：候选主题、候选目标、源文档摘要、已有标签等 JSON payload。
- 补链重写：只重写用户可见字段，保留目标 ID、标题、类型、置信度和标签文本。
- 文档索引：文档标题、路径、标签和证据块列表，要求输出 proposition 时引用真实 `sourceBlockIds`。

## 7. 当前提示词维护状态

已解决：

1. prompt 分散
   - LLM Wiki prompt 已统一到 `src/analytics/llm-wiki-prompts.ts`。
   - AI Inbox、AI 补链、文档索引等通用 AI prompt 已统一到 `src/analytics/ai-prompts.ts`。
2. i18n 混放模型协议
   - 主题 Wiki 模型协议文案已迁出 `src/i18n/ui.ts`。
3. 缺少 prompt 结构测试
   - 已新增 `src/analytics/llm-wiki-prompts.test.ts`。
   - 已新增 `src/analytics/ai-prompts.test.ts`。
4. 主题生成 prompt 版本不可追踪
   - `lastPreview.promptVersions` 与 `lastApply.promptVersions` 已记录主题生成 prompt 版本。
5. 非 LLM Wiki prompt 治理
   - AI Inbox、连接测试、AI 补链、补链重写和文档索引证据编译 prompt 已完成集中治理。

仍需后续处理：

1. UI 过期提示
   - 当前已存储 prompt 版本，但尚未在维护面板提示“由旧 prompt 生成，建议重新预览”。
2. Prompt 内容质量优化
   - 可继续强化证据优先级、增量文档差异说明和 JSON schema 示例。

## 8. 当前架构取舍

### 8.1 已采用：集中 TypeScript Prompt Registry

已新增 `src/analytics/llm-wiki-prompts.ts`，集中管理 LLM Wiki 相关 prompt：

- `buildThemeDiagnosisPrompt()`
- `buildThemePagePlanPrompt()`
- `buildThemeSectionPrompt()`
- `buildSinglePageMaintenancePrompt()`
- `buildWikiRoutePrompt()`
- `buildWikiChatPrompt()`

已新增 `src/analytics/ai-prompts.ts`，集中管理通用 AI prompt：

- `buildAiInboxPrompt()`
- `buildAiConnectionTestPrompt()`
- `buildAiLinkSuggestionPrompt()`
- `buildAiLinkRewritePrompt()`
- `buildAiDocumentEvidencePrompt()`

每个 builder 返回结构化对象：

```ts
interface LlmPromptSpec {
  id: string
  version: number
  messages: Array<{ role: 'system' | 'user', content: string }>
  expectedJsonSchemaName?: string
}
```

当前收益：

- 与 TypeScript 类型、测试和 parser 最容易协同。
- 主题 Wiki prompt 文案与 UI i18n 解耦。
- 非 Wiki AI prompt 不再散落在业务模块中，后续优化可先查 registry 和对应测试。
- 已在 `WikiPreviewRecord` 和 `WikiApplyRecord` 中记录主题 prompt 版本。
- 不引入额外运行时加载和打包复杂度。

`src/i18n/ui.ts` 现在只保留 UI 展示、错误提示和用户可见 fallback 等文案，不再承载主题 Wiki 模型协议 prompt。

### 8.2 可选方案：外部 JSON/YAML Prompt 配置

可将 prompt 放到 `src/analytics/prompts/llm-wiki.zh-CN.json`、`llm-wiki.en-US.json` 或 YAML 文件。

优点：

- 非代码形式更便于产品或提示词维护者直接编辑。
- prompt diff 更集中。

缺点：

- 需要处理 Vite 打包、类型校验、插值变量校验。
- JSON/YAML 难表达复杂条件，例如冲突章节、增量模式、全文模式的组合。
- parser、schema、prompt 仍可能分离。

除非后续有“用户可配置 prompt”或“多套 prompt 预设”的明确需求，否则不建议第一步就外置为 JSON/YAML。

### 8.3 不再采用：继续放在 i18n

继续把 prompt 行为约束放在 `src/i18n/ui.ts` 的问题是：

- UI 文案和模型协议边界不清。
- prompt 变更容易被当作翻译文案变更处理。
- 很难对单个 prompt 做版本化和快照测试。

i18n 可以继续提供 UI 文案和用户可见 fallback，但不应作为 prompt 协议主仓库。

## 9. 后续演进步骤

已完成的迁移步骤：

1. 建立 `src/analytics/llm-wiki-prompts.ts`。
2. 为每类 LLM Wiki prompt 添加 `id/version`。
3. 补充 prompt registry 测试。
4. 从 `src/i18n/ui.ts` 迁出主题 Wiki 模型协议文案。
5. 在 `WikiPreviewRecord` 和 `WikiApplyRecord` 中记录主题生成 prompt 版本。
6. 建立 `src/analytics/ai-prompts.ts` 和 `src/analytics/llm-prompt-types.ts`。
7. 迁移 AI Inbox、连接测试、AI 补链、补链重写、文档索引证据编译 prompt。
8. 补充 `src/analytics/ai-prompts.test.ts`。

建议后续步骤：

1. 在维护面板展示 prompt 版本过期提示。
2. 如果 prompt registry 继续变大，拆分主题生成、单页维护、聊天、Inbox、补链、文档索引内部模块。
3. 为每个 JSON schema 增加最小输出示例。
4. 评估是否需要用户自定义 prompt 或多套 prompt 预设。

## 10. 关键文件索引

| 文件 | 职责 |
|---|---|
| `src/composables/use-analytics-wiki-actions.ts` | 主题 Wiki 预览、增量判断、三段式生成、应用入口 |
| `src/composables/use-analytics-wiki.ts` | 源文档索引保障、现有 Wiki 页读取、作用域说明、受影响 section 显示 |
| `src/analytics/llm-prompt-types.ts` | 通用 prompt spec 类型定义 |
| `src/analytics/llm-wiki-prompts.ts` | LLM Wiki Prompt Registry，集中构建主题生成、单页维护、聊天 prompt |
| `src/analytics/llm-wiki-prompts.test.ts` | Prompt Registry 结构与关键模式测试 |
| `src/analytics/ai-prompts.ts` | 通用 AI Prompt Registry，集中构建 AI Inbox、AI 补链、文档索引 prompt |
| `src/analytics/ai-prompts.test.ts` | 通用 AI Prompt Registry 结构与关键约束测试 |
| `src/analytics/wiki-ai.ts` | 主题 Wiki 三段式 AI 服务、请求和响应归一化 |
| `src/analytics/wiki-generation.ts` | Wiki payload 类型与主题 bundle 结构 |
| `src/analytics/wiki-renderer.ts` | 主题 Wiki draft 渲染、section marker、引用渲染 |
| `src/analytics/wiki-diff.ts` | 指纹计算、状态判定、受影响 section 检测 |
| `src/analytics/wiki-documents.ts` | 主题页、索引页、日志页写回 |
| `src/analytics/wiki-store.ts` | `ai-wiki-index.json` 读写，归一化 `promptVersions` |
| `src/analytics/llm-wiki-maintain-service.ts` | 单页维护响应解析、建议摘要、兼容 prompt 导出 |
| `src/composables/use-analytics-llm-wiki.ts` | 单页维护控制器 |
| `src/composables/llm-wiki-maintain-review.ts` | 单页维护断链探测和状态构造 |
| `src/composables/llm-wiki-maintain-apply.ts` | 单页维护按 section 合并应用 |
| `src/analytics/llm-wiki-chat-service.ts` | Wiki 聊天路由和回答解析、兼容 prompt 导出 |
| `src/analytics/ai-inbox.ts` | AI Inbox payload、请求和结果归一化，prompt 委托 `ai-prompts.ts` |
| `src/analytics/ai-link-suggestions.ts` | AI 补链候选、请求和结果归一化，prompt 委托 `ai-prompts.ts` |
| `src/analytics/ai-document-summary.ts` | 文档索引 freshness、请求和证据编译解析，prompt 委托 `ai-prompts.ts` |
| `src/i18n/ui.ts` | UI 展示文案和用户可见 fallback，不再承载主题 Wiki 模型协议 prompt |

## 11. 总结

当前 LLM Wiki 的核心语义是：用户手动触发，以当前 scope 和指定主题为边界，先保障源文档索引，再用三段式 LLM 生成主题 Wiki 草稿，随后通过指纹 diff 提供安全预览，最后由用户确认写回 AI 管理区并同步索引页与日志页。

提示词维护上，TypeScript Prompt Registry 已经落地。当前结构是“共享 prompt 类型 + LLM Wiki registry + 通用 AI registry + 兼容委托层 + 主题生成 prompt 版本记录”。下一步重点是 prompt 版本过期提示、内容质量优化，以及必要时将 registry 拆分为更小的内部模块。
