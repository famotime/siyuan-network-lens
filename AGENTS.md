# AGENTS.md

## 项目定位

这是一个思源笔记插件项目，名称是“脉络镜（Network lens）”。

- 核心目标是把“文档级引用网络”转成可解释的分析结果、证据和整理动作，帮助用户维护知识结构。
- 不做大型关系图渲染，重点是诊断、证据、建议和可执行操作。
- 当前主线已经覆盖结构分析、整理辅助，以及可选 AI 能力。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vitest
- 思源插件 API / SQL

常用命令：

```bash
npm install --legacy-peer-deps
npm test
npm run build
```

`npm run build` 会更新根目录 `package.zip`，这是正常行为。

## 当前能力

### 结构分析

- 文档热度排行
- 主题社区发现
- 孤立文档、沉没文档、桥接节点识别
- 时间趋势分析
- 传播路径与高传播价值节点
- 原始引用证据查看
- 顶部统计卡片点击后的详情联动
- 已读 / 未读文档统计
- 大文档统计，支持按字数或存储体积查看

### 结构整理

- 主题筛选与关键词筛选分离
- 孤立文档支持基于主题文档的修复建议
- 主题建议可插入 / 撤销链接，多个建议会合并到同一块
- 关联分析结果可同步为文档内部链接

### AI 能力

以下能力是可选能力，部分入口还可能被 alpha 配置隐藏：

- AI Inbox / 今日建议：基于当前分析范围输出当天优先整理任务，并保留最近 3 次历史
- 孤立文档 AI 补链：给出推荐目标页、理由、草稿文案和标签建议，可直接写入链接与标签
- 文档索引：为单篇文档生成 AI 摘要、关键词、证据片段，结果存到 `ai-document-index.json`
- LLM Wiki：基于当前分析范围生成主题 wiki 预览，确认后写回主题 wiki 页、索引页和维护日志

## 稳定语义

- 节点是“文档”，边是“文档到文档的聚合引用关系”。
- 图分析阶段按无向图处理连接关系。
- 引用采集必须同时覆盖两条路径：
  - `refs` 表中 `type = 'ref_id'` 的记录
  - markdown fallback
- markdown fallback 当前支持：
  - `siyuan://blocks/<id>`
  - `((block-id "title"))`
  - `((block-id 'title'))`
- 同文档自引用不算文档级连接。
- 孤立文档 = 当前窗口内没有有效文档级入链 / 出链。
- 沉没文档 = 当前窗口没有有效连接，但历史上可能有连接，且达到沉没时长阈值。
- 主题文档名称取“配置目录下文档标题去掉前后缀后的结果”。
- 已读文档按“路径 / 标签 / 标题前缀 / 标题后缀”命中任一条件判定。
- Wiki 页面和其他派生页不应被当作普通来源文档参与分析；相关过滤依赖 `wikiPageSuffix` 与分析范围配置。
- AI 索引中的 `documentSummary*` 才是“真实文档摘要”；`summary*` 主要是补链画像，不要混用。

## 关键入口

- `src/App.vue`
  - 主界面装配：筛选器、顶部卡片、详情区、wiki 面板、文档索引按钮。
- `src/composables/use-analytics.ts`
  - 主状态容器；串起快照、筛选、报告、卡片、AI、wiki、文档索引。
- `src/composables/use-analytics-derived.ts`
  - 纯派生选择器。
- `src/composables/use-analytics-interactions.ts`
  - 链接同步、主题建议写入 / 撤销、AI 建议应用。
- `src/composables/use-analytics-ai.ts`
  - AI Inbox、孤立文档 AI 补链、连接测试。
- `src/composables/use-analytics-wiki.ts`
  - Wiki preview request、scope 与共享状态边界。
- `src/analytics/analysis.ts`
  - 核心分析入口。
- `src/analytics/analysis-context.ts`
  - 图分析与趋势分析阶段上下文。
- `src/analytics/siyuan-data.ts`
  - 数据采集主入口；先查这里。
- `src/analytics/internal-links.ts`
  - markdown fallback 内部链接解析。
- `src/analytics/theme-documents.ts`
  - 主题文档识别与主题筛选项构建。
- `src/analytics/orphan-theme-links.ts`
  - 孤立文档主题建议链接的写入与撤销。
- `src/analytics/orphan-document-tags.ts`
  - AI 标签建议的写入与撤销。
- `src/analytics/read-status.ts`
  - 已读规则匹配。
- `src/analytics/summary-card-config.ts`
  - 顶部统计卡片定义的单一来源。
- `src/analytics/summary-details.ts`
  - 顶部卡片与详情 section 的统一导出入口。
- `src/analytics/large-documents.ts`
  - 大文档字数 / 体积统计。
- `src/analytics/ai-inbox.ts`
  - AI Inbox payload 与结果规范。
- `src/analytics/ai-link-suggestions.ts`
  - 孤立文档 AI 补链与 embedding 排序。
- `src/analytics/ai-document-summary.ts`
  - 文档摘要生成与 freshness 复用。
- `src/analytics/ai-index-store.ts`
  - AI 私有索引读写。
- `src/analytics/wiki-scope.ts` / `wiki-generation.ts` / `wiki-ai.ts` / `wiki-renderer.ts` / `wiki-diff.ts` / `wiki-store.ts` / `wiki-documents.ts`
  - LLM Wiki 范围、生成、预览、diff、存储与写回。
- `src/components/SettingPanel.vue`
  - 设置页，含分析范围、主题文档、已读规则、统计卡片、AI、Wiki、调试项。
- `src/components/SummaryCardsGrid.vue` / `src/components/SummaryDetailSection.vue`
  - 顶部卡片区与详情区。
- `src/components/AIInboxPanel.vue` / `src/components/WikiMaintainPanel.vue`
  - AI Inbox 与 LLM Wiki 面板。
- `src/types/config.ts`
  - 持久化配置模型、默认值、兼容迁移。
- `src/plugin/alpha-feature-config.ts`
  - 灰度 / 隐藏配置；界面入口缺失时先查这里。
- `docs/其他插件读取 AI 索引指南.md`
  - 对外复用 AI 索引时必须同步参考的兼容文档。

## 开发约定

- 修改前优先看测试。现有测试已覆盖分析、趋势、fallback 引用、主题文档、已读规则、卡片详情、AI Inbox、AI 补链、AI 索引、wiki 生成 / 写回、关键组件和主 composable。
- 新增或修改设置项时，至少同步：
  - `src/types/config.ts`
  - `src/components/SettingPanel.vue`
  - 相关测试
- 新增或修改顶部统计卡片时，优先从 `src/analytics/summary-card-config.ts` 开始，再检查 `summary-cards`、`summary-detail-sections`、`SettingPanel`、`SummaryCardsGrid` 和相关测试。
- 修改 AI 索引结构或语义时，同步检查：
  - `src/analytics/ai-index-store.ts`
  - `src/analytics/ai-document-summary.ts`
  - `docs/其他插件读取 AI 索引指南.md`
- 修改 alpha 隐藏行为时，同步检查 `src/plugin/alpha-feature-config.ts` 与 `docs/alpha-feature-hidden-config.md`。
- 除非用户明确要求，否则不要修改 `plugin-sample-vite-vue/`。

## 常见排查

### 文档链接未识别

1. 先看 `src/analytics/internal-links.ts` 是否支持该 markdown 格式。
2. 再看 `src/analytics/siyuan-data.ts` 是否把对应块扫入快照。
3. 检查目标 block id 是否能回溯到文档根块。
4. 检查是否被时间窗口、分析范围、主题 / 关键词等筛掉。

### 文档被误判为孤立或沉没

1. 先确认当前窗口内是否真的没有有效文档级连接。
2. 排查筛选条件、分析范围排除、wiki 后缀过滤。
3. 检查是否只是同文档自引用。
4. 如果刚撤销主题建议或 AI 建议，刷新后确认是否仍残留其他连接或标签变更。

### 已读 / 未读统计不符合预期

1. 看 `src/analytics/read-status.ts`。
2. 核对设置里的路径、标签、标题前后缀。
3. 再看详情构造是否和当前 `readCardMode` 一致。

### AI 建议或文档索引不符合预期

1. 先看 AI 配置是否完整：`aiBaseUrl`、`aiApiKey`、`aiModel`；补链还可能依赖 `aiEmbeddingModel`。
2. 再看 `src/analytics/ai-inbox.ts`、`src/analytics/ai-link-suggestions.ts`、`src/analytics/ai-document-summary.ts`。
3. 如果是索引复用问题，确认读取方用的是 `documentSummary*`，不是 `summary*`。
4. 文档索引按钮未出现时，检查 `config.showDocumentIndex`。

### LLM Wiki 预览或写回异常

1. 先看 `config.wikiEnabled`、AI 配置与 `themeDocumentPath`。
2. 再看 `wiki-scope.ts`、`wiki-generation.ts`、`wiki-diff.ts`、`wiki-documents.ts`。
3. 如果界面入口缺失，先查 `src/plugin/alpha-feature-config.ts` 是否隐藏了 `llm-wiki`。

## 提交前

- 代码改动至少执行：

```bash
npm test
npm run build
```

- `npm run build` 会更新根目录 `package.zip`，通常需要一起提交。
- 仅文档改动可以不跑完整构建，但不要把“未验证”说成“已验证”。
