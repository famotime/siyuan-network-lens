# LLM Wiki Single-Theme Maintenance Design

## 背景

当前 LLM Wiki 维护流程会在预览阶段对来源文档再次执行主题匹配，并可能同时生成多个主题 Wiki 页。这与当前产品语义不一致：现在用户只会从“主题文档”入口发起维护，且该主题文档的关联文档已经由用户人工确认，因此不再需要根据文档内容二次判断主题归属，也不应在一次维护中扩散到其他主题页。

当前顶部 4 个小统计卡片也沿用了旧的“多主题作用域”口径，显示的是命中源文档、命中主题、排除 Wiki 页面、未归类来源。这些指标无法直接回答“这次当前主题页会生成什么”，需要替换为单页维护视角下的生成摘要。

## 目标

将 LLM Wiki 维护逻辑收敛为“单主题维护模式”：

- 仅允许围绕当前主题文档生成和维护一个对应的 LLM Wiki 页面。
- 当前主题文档的关联去重文档全部纳入本次 Wiki 分析来源，不再进行跨主题二次归类。
- 顶部 4 个统计卡片改为单页生成摘要：来源文档、生成章节、关联引用、人工备注。
- 每个卡片提供 tooltip 说明。
- 在横向空间足够时，4 个卡片默认按两列布局展示。

## 非目标

- 不重构索引页和维护日志页的整体写回机制。
- 不修改 AI 主题模板诊断、页面规划、分节生成的核心 prompt 流程。
- 不改动主题文档识别规则，也不修改其它分析面板里的主题匹配逻辑。

## 方案

### 1. 作用域从“多主题归类”切换为“当前主题单页维护”

预览请求必须携带 `themeDocumentId`。主链路根据该主题文档定位本次维护目标，再将请求中给出的关联文档集合去重后作为来源文档集合。该集合不再调用 `buildWikiScope` 进行跨主题分组，也不再从来源文档中筛出其他主题组。

本次预览始终只会产出 1 个主题页 payload：

- `themeDocumentId` 直接来自当前请求
- `themeDocumentTitle`、目标页面标题、目标容器路径仍按现有主题页规则构建
- `sourceDocuments` 由当前主题的关联去重文档构成

若请求缺少 `themeDocumentId`，或该 id 不能解析到有效主题文档，预览直接报错，而不是退回旧的全局多主题模式。

### 2. 新的预览统计摘要

旧的 `WikiScopeSummary` 将替换为单页摘要结构，直接表达当前 Wiki 页的生成结果：

- `sourceDocumentCount`：本次纳入分析的关联去重文档数
- `generatedSectionCount`：本次生成的 Wiki 文档章节数，按 `draft.sectionMetadata` 统计，排除 `meta` 和人工备注区
- `referenceCount`：本次生成的 Wiki 文档中包含的笔记引用数量，统计生成稿中的文档级引用 `((docId "label"))`
- `manualNotesParagraphCount`：当前 Wiki 页中保留下来的人工备注段落数；按人工备注区内容以空行切分段落，忽略空白段

其中：

- `generatedSectionCount` 和 `referenceCount` 来自本次新生成 draft
- `manualNotesParagraphCount` 来自已存在 Wiki 页的完整 markdown；若页面不存在则为 `0`

### 3. 人工备注段落计数

人工备注不再是布尔态。需要从已有 Wiki 页 markdown 中解析 `## Manual notes / 人工备注` 区域，将其中正文按空行切分为段落，去掉空白段以及仅包含保留提示文案的默认占位段后，得到保留下来的人工备注段落数。

### 4. 界面更新

`WikiMaintainPanel` 顶部统计卡片改为：

- 来源文档
- 生成章节
- 关联引用
- 人工备注

每个卡片使用浏览器原生 tooltip（`title` 属性）即可，避免额外引入复杂交互。

布局改为：

- 默认 `grid-template-columns: repeat(2, minmax(0, 1fr))`
- 在窄屏断点下自动回落为单列

### 5. 写回与日志兼容

主题页写回仍沿用现有 `themePages` 数组接口，但运行时只会包含当前单个主题页。

索引页 / 维护日志页的 `scopeSummary` 继续保留旧字段结构，避免扩大写回层改动面。单主题模式下写入时固定传：

- `sourceDocumentCount = 预览来源文档数`
- `themeGroupCount = 1`
- `unclassifiedDocumentCount = 0`
- `excludedWikiDocumentCount = 0`

这样可以保持索引页和日志页生成逻辑可用，同时不再把这些旧口径暴露在预览摘要卡片里。

## 受影响文件

- `src/composables/use-analytics.ts`
  - 收敛 `prepareWikiPreview` 到单主题主链路
  - 组装新的预览摘要
- `src/composables/use-analytics-wiki.ts`
  - 定义新的预览摘要类型
  - 增加章节数 / 引用数 / 人工备注段落数解析辅助函数
- `src/components/WikiMaintainPanel.vue`
  - 替换顶部统计卡片字段、tooltip 和双列布局
- `src/i18n/ui.ts`
  - 新增卡片标题与 tooltip 文案
- `src/composables/use-analytics.test.ts`
  - 覆盖仅生成当前主题页的行为
- `src/components/WikiMaintainPanel.test.ts`
  - 覆盖新卡片文本和 tooltip
- `src/composables/use-analytics-wiki.test.ts`
  - 覆盖人工备注段落计数和引用统计辅助函数

## 测试策略

按 TDD 执行：

1. 先写失败测试，验证带 `themeDocumentId` 的预览只生成该主题页，不再出现未归类来源统计。
2. 先写失败测试，验证新卡片显示来源文档 / 生成章节 / 关联引用 / 人工备注，并附带 tooltip。
3. 先写失败测试，验证人工备注段落数按空行切分且忽略默认占位文案。
4. 写最小实现让测试通过。
5. 再跑受影响测试集和构建。

## 风险与约束

- 现有“从文档样本入口维护 Wiki”的全局模式将不再适配该主链路。如果后续仍需保留该能力，应另建独立入口和摘要模型，不应复用当前主题页面板。
- 引用计数采用生成稿中的文档级双括号引用数量作为用户可感知口径，不对块级证据或 superscript 里的 block id 引用计数。
- 人工备注段落计数依赖标题识别与 markdown 分段规则，若后续允许更自由的手工结构，需要同步扩展解析规则。
