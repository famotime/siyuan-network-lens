# LLM Wiki Prompt 集中管理与优化方案

本文记录 LLM Wiki prompt 集中管理的当前实现状态、架构边界和后续优化方向。Prompt 集中管理已完成两轮落地：先收口 LLM Wiki prompt，再扩展到 AI Inbox、AI 补链和文档索引等非 LLM Wiki 能力。

## 1. 当前实现状态

已完成：

- 新增 `src/analytics/llm-wiki-prompts.ts` 作为 LLM Wiki Prompt Registry。
- 新增 `src/analytics/llm-wiki-prompts.test.ts` 覆盖 registry 行为。
- 主题 Wiki 生成、单页维护、Wiki 聊天的 prompt builder 已统一收口。
- `wiki-ai.ts`、`llm-wiki-maintain-service.ts`、`llm-wiki-chat-service.ts` 已改为委托 registry。
- 旧导出函数仍保留为兼容层，避免破坏现有调用和测试。
- 主题 Wiki prompt 协议文案已从 `src/i18n/ui.ts` 迁入 registry 内部中英文常量。
- Wiki 预览和应用快照已支持记录主题生成 prompt 版本。
- 新增 `src/analytics/ai-prompts.ts` 作为通用 AI Prompt Registry。
- AI Inbox、连接测试、孤立文档 AI 补链、补链结果中文重写和文档索引证据编译 prompt 已统一迁入通用 registry。
- 新增 `src/analytics/ai-prompts.test.ts` 覆盖非 LLM Wiki prompt 的 id、version、schema、消息结构和关键约束。
- 新增 `src/analytics/llm-prompt-types.ts` 作为共享 prompt spec 类型定义，避免通用 AI prompt 依赖 Wiki registry 类型。

仍未实现：

- 用户自定义 prompt。
- 外部 JSON/YAML prompt 配置。
- Prompt 版本过期后的 UI 提醒。

## 2. 当前架构

Prompt Registry 文件：

- `src/analytics/llm-wiki-prompts.ts`
- `src/analytics/ai-prompts.ts`
- `src/analytics/llm-prompt-types.ts`

测试文件：

- `src/analytics/llm-wiki-prompts.test.ts`
- `src/analytics/ai-prompts.test.ts`

核心类型：

```ts
export type LlmPromptRole = 'system' | 'user' | 'assistant'

export interface LlmPromptMessage {
  role: LlmPromptRole
  content: string
}

export interface LlmPromptSpec {
  id: string
  version: number
  messages: LlmPromptMessage[]
  expectedJsonSchemaName?: string
}
```

当前 builder：

```ts
// LLM Wiki
buildThemeDiagnosisPrompt()
buildThemePagePlanPrompt()
buildThemeSectionPrompt()
buildSinglePageMaintenancePrompt()
buildWikiRoutePrompt()
buildWikiChatPrompt()
buildWikiContextMessage()

// 通用 AI 能力
buildAiInboxPrompt()
buildAiConnectionTestPrompt()
buildAiLinkSuggestionPrompt()
buildAiLinkRewritePrompt()
buildAiDocumentEvidencePrompt()
```

主题生成 prompt 版本常量：

```ts
LLM_WIKI_THEME_PROMPT_VERSIONS = {
  'llm-wiki.theme.diagnosis': 1,
  'llm-wiki.theme.plan': 1,
  'llm-wiki.theme.section': 1,
}
```

## 3. Prompt 分层现状

当前 registry 已按能力集中，但尚未拆成多个文件。

实际分层如下：

1. 通用主题 Wiki system 约束
   - `BASE_THEME_SYSTEM_PROMPT`
   - 只返回 JSON。
   - 不输出 Markdown、解释或代码块。
   - 不编造不存在的文档、主题页、关系、证据或用户可见结论。
2. 主题 Wiki 阶段 prompt
   - 模板诊断。
   - 页面规划。
   - 单 section 生成。
3. 主题 Wiki 模式 prompt
   - 增量模式。
   - 冲突章节。
   - 全文优先模式。
4. 单页维护 prompt
   - 检查断链、过期章节、缺失引用。
   - 输出 `suggestions` 与 `revisedMarkdown`。
5. Wiki 聊天 prompt
   - 页面路由。
   - 基于 Wiki 页面和可选源文档回答。
6. 通用 AI prompt
   - AI Inbox 今日建议。
   - AI 连接测试。
   - 孤立文档 AI 补链。
   - 补链结果 locale 重写。
   - 文档索引证据编译。

主题 Wiki 的中英文协议文案位于 registry 内部 `THEME_PROMPT_TEXT`，不再放在 `src/i18n/ui.ts`。

## 4. Prompt ID 与版本

当前已使用的 ID：

| ID | 用途 | 当前版本 | 是否写入快照 |
|---|---|---:|---|
| `llm-wiki.theme.diagnosis` | 主题模板诊断 | 1 | 是 |
| `llm-wiki.theme.plan` | 主题页面规划 | 1 | 是 |
| `llm-wiki.theme.section` | 主题章节生成 | 1 | 是 |
| `llm-wiki.page.maintenance` | 单页维护检修 | 1 | 否 |
| `llm-wiki.chat.route` | Wiki 页面路由 | 1 | 否 |
| `llm-wiki.chat.answer` | Wiki 问答 | 1 | 否 |
| `ai-inbox.generate` | AI Inbox 今日建议 | 1 | 否 |
| `ai.connection-test` | AI 连接测试 | 1 | 否 |
| `ai-link.suggest` | 孤立文档 AI 补链 | 1 | 否 |
| `ai-link.rewrite` | 补链结果语言重写 | 1 | 否 |
| `ai-document.evidence-compile` | 文档索引证据编译 | 1 | 否 |

当前快照记录位置：

- `WikiPreviewRecord.promptVersions`
- `WikiApplyRecord.promptVersions`

相关文件：

- `src/analytics/wiki-page-model.ts`
- `src/analytics/wiki-store.ts`
- `src/composables/use-analytics-wiki-actions.ts`
- `src/analytics/wiki-documents.ts`

版本号规则：

- prompt 文本只做格式整理，不改变模型行为：不升级版本。
- 修改输出 JSON schema：必须升级版本。
- 修改模型行为约束：建议升级版本。
- 修改 locale 文案但语义不变：通常不升级版本。
- 新增模式约束，例如新的 `sectionType` 特化规则：升级相关 prompt 版本。

## 5. 调用方边界

### `src/analytics/wiki-ai.ts`

当前职责：

- AI 请求。
- 响应解析。
- 输出归一化。

Prompt 拼接已迁出，改为调用：

- `buildThemeDiagnosisPrompt()`
- `buildThemePagePlanPrompt()`
- `buildThemeSectionPrompt()`

### `src/analytics/llm-wiki-maintain-service.ts`

当前职责：

- 维护结果解析。
- 建议类型归一化。
- 建议摘要生成。
- 兼容导出 `buildMaintenanceSystemPrompt()` 和 `buildMaintenanceUserPrompt()`。

Prompt 实际由 `buildSinglePageMaintenancePrompt()` 提供。

### `src/analytics/llm-wiki-chat-service.ts`

当前职责：

- 路由和聊天结果解析。
- `extractFirstSectionAfterHeader()` 等上下文辅助。
- 兼容导出原有 prompt 函数。

Prompt 实际由：

- `buildWikiRoutePrompt()`
- `buildWikiChatPrompt()`
- `buildWikiContextMessage()`

提供。

### `src/analytics/ai-inbox.ts`

当前职责：

- AI Inbox payload 构造。
- OpenAI 兼容请求、日志和错误提示。
- AI Inbox 返回结果解析与归一化。
- 连接测试流程。

Prompt 实际由：

- `buildAiInboxPrompt()`
- `buildAiConnectionTestPrompt()`

提供。

### `src/analytics/ai-link-suggestions.ts`

当前职责：

- 孤立文档候选目标构建与排序。
- 补链结果解析、字段别名兼容、标签建议归一化。
- 中文环境下英文结果的二次重写触发。

Prompt 实际由：

- `buildAiLinkSuggestionPrompt()`
- `buildAiLinkRewritePrompt()`

提供。

### `src/analytics/ai-document-summary.ts`

当前职责：

- 文档索引 freshness 复用。
- 证据块采集后的 AI 请求。
- 证据编译结果解析、截断修复和错误分类。

Prompt 实际由：

- `buildAiDocumentEvidencePrompt()`

提供。

## 6. i18n 边界

已从 `src/i18n/ui.ts` 移除的模型协议 key：

- `diagnoseThemeTemplatePrompt`
- `diagnoseThemeTemplateSchemaPrompt`
- `planThemePagePrompt`
- `planThemePageSchemaPrompt`
- `generateThemeSectionPrompt`
- `generateThemeSectionSchemaPrompt`
- `conservativeFallbackPrompt`
- `conflictSectionPrompt`
- `incrementalModePrompt`
- `fullContentPrompt`

`src/i18n/ui.ts` 仍保留 UI 展示文案、错误提示和 fallback 可见文案。后续维护时不要再把模型协议 prompt 放回 i18n 主树。

## 7. 测试覆盖

新增测试：

- `src/analytics/llm-wiki-prompts.test.ts`
- `src/analytics/ai-prompts.test.ts`

覆盖内容：

- 每个 builder 返回稳定 `id/version/messages`。
- 主题诊断 prompt 包含主题名和 payload。
- 页面规划 prompt 包含 diagnosis。
- 章节 prompt 包含 sectionType。
- 增量模式注入 existing wiki content。
- conflict section 注入冲突专用约束。
- full content 模式注入全文优先提示。
- 单页维护 prompt 包含页面标题、页面正文和断链 ID。
- Wiki 路由和聊天 prompt 包含页面标题、摘要、问题和源文档截断内容。
- AI Inbox prompt 包含今日任务列表约束和结构化 payload。
- AI 连接测试 prompt 保持稳定 OK 协议。
- AI 补链 prompt 保持可解析 JSON payload 和 locale 输出约束。
- 文档索引 prompt 包含文档标题、路径、标签和证据块 ID。

相关回归测试：

- `src/analytics/wiki-ai.test.ts`
- `src/analytics/llm-wiki-maintain-service.test.ts`
- `src/analytics/llm-wiki-chat-service.test.ts`
- `src/analytics/ai-inbox.test.ts`
- `src/analytics/ai-link-suggestions.test.ts`
- `src/analytics/ai-document-summary.test.ts`
- `src/composables/use-wiki-chat-session.test.ts`
- `src/composables/use-analytics-llm-wiki.test.ts`
- `src/analytics/wiki-store.test.ts`
- `src/analytics/wiki-documents.test.ts`
- `src/composables/use-analytics-wiki-actions.test.ts`

## 8. 后续优化方向

1. Prompt 过期提示
   - 当已有主题 Wiki 页记录的 `promptVersions` 低于当前版本时，在维护面板提示建议重新生成预览。
2. 更细的版本记录
   - 当前只对主题生成 prompt 写入快照。
   - 单页维护和聊天 prompt 暂不写入，因为它们不产生持久化 Wiki 生成快照。
3. Prompt 内容优化
   - 明确全文模式、索引画像、结构信号的优先级。
   - 在增量模式中更明确列出 `new / changed / deleted` 文档。
   - 为每个 JSON schema 提供最小示例，降低解析失败率。
4. 模块拆分
   - 当前已经拆成 LLM Wiki registry 与通用 AI registry。
   - 如果继续增长，可在 `src/analytics/prompts/` 下再拆为主题生成、单页维护、聊天、Inbox、补链、文档索引等内部模块，再由现有入口统一导出。
5. 外部配置化评估
   - 只有当需要用户自定义 prompt 或多套 prompt 预设时，再考虑 JSON/YAML 外置。

## 9. 当前结论

LLM Wiki Prompt Registry 和通用 AI Prompt Registry 均已落地。当前代码已经从“分散 prompt + i18n 混放”调整为“集中 builder + 兼容委托层 + 版本记录”的结构；非 LLM Wiki 的 AI Inbox、AI 补链和文档索引 prompt 也已完成统一治理。

后续重点不再是迁移，而是围绕 prompt 版本过期提示、内容质量优化、必要时的模块拆分，以及是否引入用户自定义 prompt 继续演进。
