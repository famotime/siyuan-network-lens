# LLM Wiki 阶段开发计划

> 基于 `docs/LLM-Wiki集成设计方案.md` 与当前仓库结构整理。目标是把 LLM Wiki V1 的开发工作拆成可跟踪、可分阶段验收、可直接执行的任务清单。

更新时间：2026-04-10

当前进度：

- 已完成：Phase 0、Phase 1、Phase 2、Phase 3、Phase 4、Phase 5、Phase 6
- 进行中：无
- 未开始：无

---

## 1. 计划目标

V1 目标聚焦一条完整闭环：

- 基于当前筛选结果识别可维护的主题范围
- 为每个主题生成配对的 `-llm-wiki` 页面预览
- 提供页面级 diff 与冲突识别
- 用户确认后写入主题 wiki 页、索引页、维护日志页
- 默认排除 `-llm-wiki` 页面，避免污染现有网络分析

不纳入本计划：

- 插件内完整 query 助手
- 自动后台增量维护
- 实体页 / 概念页自动扩张
- 无预览直接覆盖写入

## 2. 进度跟踪约定

- 阶段状态使用：`未开始` / `进行中` / `已完成` / `阻塞`
- 开发执行时直接勾选每个任务前的 checkbox
- 一个阶段只有在“退出条件”全部满足后才能标记为 `已完成`
- 如出现设计变更，优先回写本计划，再调整实施

建议每次推进时同步补充：

- 实际开始日期
- 实际完成日期
- 阻塞项
- 对应提交或 PR 链接

## 3. 里程碑总览

| 阶段 | 名称 | 主要结果 | 依赖 |
| --- | --- | --- | --- |
| Phase 0 | 基线与约束冻结 | 配置、命名、管理边界、索引模型定稿 | 无 |
| Phase 1 | 范围识别与分析排除 | `-llm-wiki` 页面不再污染主题识别和普通分析 | Phase 0 |
| Phase 2 | 摘要与生成数据管线 | 可按主题构建 wiki 生成 payload 与草稿内容 | Phase 1 |
| Phase 3 | 预览与冲突检测 | 页面级预览、diff、状态判定可用 | Phase 2 |
| Phase 4 | 写入与索引日志 | 可安全创建/更新 wiki 页面并记录维护结果 | Phase 3 |
| Phase 5 | UI 接入与交互闭环 | 设置页、主界面入口、维护面板全部串通 | Phase 3, Phase 4 |
| Phase 6 | 稳定化与发布准备 | 回归测试、文档补齐、构建产物确认 | Phase 5 |

## 4. 当前实现差距

结合现有代码，V1 落地前有三个必须补齐的缺口：

1. 当前已有 `ai-document-index.json`，但缺少“通用文档摘要补建服务”，现有摘要写入主要依附在孤立文档 AI 补链流程上，不能直接支撑 wiki 批量维护。
2. 当前没有页面级 wiki 草稿模型、AI 管理区稳定标识、指纹与冲突判定链路。
3. 当前 UI 和状态层只覆盖分析结果、AI Inbox、孤立修复建议，尚未接入“预览 -> 确认写入 -> 打开结果页”的维护流程。

## 5. 分阶段开发计划

### Phase 0：基线与约束冻结

状态：`已完成`

实际开始日期：`2026-04-09`

实际完成日期：`2026-04-09`

对应实现：

- `src/types/config.ts`
- `src/types/config.test.ts`
- `src/analytics/wiki-page-model.ts`
- `src/analytics/wiki-page-model.test.ts`
- `src/analytics/wiki-store.ts`
- `src/analytics/wiki-store.test.ts`

目标：

- 固定 V1 配置项、页面命名规则和 AI 管理区边界
- 建立 wiki 页基础类型和私有索引模型
- 明确哪些文件负责“范围、生成、预览、写入、UI”

涉及文件：

- 修改：`src/types/config.ts`
- 修改：`src/types/config.test.ts`
- 新增：`src/analytics/wiki-page-model.ts`
- 新增：`src/analytics/wiki-store.ts`
- 参考：`docs/LLM-Wiki集成设计方案.md`

任务清单：

- [x] P0-1 在 `src/types/config.ts` 增加 LLM Wiki 配置字段：`wikiEnabled`、`wikiPageSuffix`、`wikiIndexTitle`、`wikiLogTitle`
- [x] P0-2 在 `src/types/config.ts` 的默认值和 `ensureConfigDefaults()` 中补齐归一化逻辑
- [x] P0-3 在 `src/types/config.test.ts` 增加默认值、空值回退、非法值归一化测试
- [x] P0-4 新建 `src/analytics/wiki-page-model.ts`，集中定义页面类型、section key、预览状态、冲突状态、应用结果类型
- [x] P0-5 新建 `src/analytics/wiki-store.ts`，先定义 `ai-wiki-index.json` 的 snapshot 结构、schema version、load/save 接口骨架
- [x] P0-6 明确 AI 管理区与人工备注区的稳定标识方案，约定 heading 文案和 block attrs key，作为后续 diff / 更新的唯一依据

验证：

- `npm test -- src/types/config.test.ts`
- `npm test -- src/types/config.test.ts src/analytics/wiki-page-model.test.ts src/analytics/wiki-store.test.ts`

退出条件：

- 配置模型稳定
- `wiki-page-model.ts` 的类型足以支撑后续阶段
- `ai-wiki-index.json` 的基础结构已经确定，不再在后续阶段频繁重命名

---

### Phase 1：范围识别与分析排除

状态：`已完成`

实际开始日期：`2026-04-09`

实际完成日期：`2026-04-09`

对应实现：

- `src/analytics/theme-documents.ts`
- `src/analytics/theme-documents.test.ts`
- `src/analytics/analysis.ts`
- `src/analytics/analysis.test.ts`
- `src/analytics/ai-inbox.ts`
- `src/analytics/ai-inbox.test.ts`
- `src/analytics/wiki-scope.ts`
- `src/analytics/wiki-scope.test.ts`
- `src/analytics/summary-details.ts`
- `src/composables/use-analytics.ts`

目标：

- 在分析前后统一排除 `-llm-wiki` 页面
- 让 wiki 页面不再进入主题识别、普通样本、趋势和 AI 输入
- 建立“当前筛选结果 -> wiki 维护范围”的标准构造函数

涉及文件：

- 修改：`src/analytics/theme-documents.ts`
- 修改：`src/analytics/analysis.ts`
- 修改：`src/analytics/ai-inbox.ts`
- 新增：`src/analytics/wiki-scope.ts`
- 修改：`src/analytics/theme-documents.test.ts`
- 修改：`src/analytics/analysis.test.ts`
- 修改：`src/analytics/ai-inbox.test.ts`
- 新增：`src/analytics/wiki-scope.test.ts`

任务清单：

- [x] P1-1 在 `src/analytics/wiki-page-model.ts` 或 `src/analytics/wiki-scope.ts` 中补充 wiki 页面识别 helper，统一判断标题后缀命中与页面类型
- [x] P1-2 修改 `src/analytics/theme-documents.ts`，确保命中 `wikiPageSuffix` 的页面不参与主题页识别与主题筛选项构建
- [x] P1-3 修改 `src/analytics/analysis.ts`，确保 `-llm-wiki` 页面不参与孤立、沉没、桥接、传播、趋势相关统计样本
- [x] P1-4 修改 `src/analytics/ai-inbox.ts`，确保 AI Inbox payload 默认只包含普通源文档，不把 wiki 页面再次喂给 AI
- [x] P1-5 新建 `src/analytics/wiki-scope.ts`，输入当前筛选结果、主题文档、分析结果和配置，输出：
  - 本次命中的普通源文档
  - 主题分组结果
  - 未归类来源
  - 被排除的 wiki 页面
  - 作用域摘要
- [x] P1-6 为 “第二名主题得分接近第一名可进入 top2” 预留策略参数，先在 `wiki-scope.ts` 中固化阈值，避免散落在 UI 或生成层

验证：

- `npm test -- src/analytics/theme-documents.test.ts src/analytics/analysis.test.ts src/analytics/ai-inbox.test.ts`
- `npm test -- src/analytics/theme-documents.test.ts src/analytics/analysis.test.ts src/analytics/ai-inbox.test.ts src/analytics/wiki-scope.test.ts`

退出条件：

- 新旧主题识别语义一致，唯一新增变化是 wiki 页被排除
- 分析结果不会再被 wiki 页污染
- wiki 维护范围能够稳定输出主题分组与未归类来源

---

### Phase 2：摘要复用与生成数据管线

状态：`已完成`

实际开始日期：`2026-04-09`

实际完成日期：`2026-04-09`

对应实现：

- `src/analytics/ai-document-summary.ts`
- `src/analytics/ai-document-summary.test.ts`
- `src/analytics/ai-index-store.ts`
- `src/analytics/ai-index-store.test.ts`
- `src/analytics/wiki-generation.ts`
- `src/analytics/wiki-generation.test.ts`
- `src/analytics/wiki-renderer.ts`
- `src/analytics/wiki-renderer.test.ts`
- `src/composables/use-analytics.ts`

目标：

- 复用 `ai-document-index.json` 中已有摘要
- 对缺失或过期摘要的文档补建通用摘要
- 输出每个主题 wiki 页的结构化生成 payload

涉及文件：

- 新增：`src/analytics/ai-document-summary.ts`
- 修改：`src/analytics/ai-index-store.ts`
- 新增：`src/analytics/wiki-generation.ts`
- 新增：`src/analytics/wiki-renderer.ts`
- 修改：`src/analytics/ai-index-store.test.ts`
- 新增：`src/analytics/ai-document-summary.test.ts`
- 新增：`src/analytics/wiki-generation.test.ts`
- 新增：`src/analytics/wiki-renderer.test.ts`

任务清单：

- [x] P2-1 从现有孤立文档 AI 补链链路中抽离“通用文档摘要补建”能力，新建 `src/analytics/ai-document-summary.ts`
- [x] P2-2 让通用摘要服务只依赖文档内容和 AI 配置，不依赖孤立文档场景，输出短摘要、中摘要、关键词、证据片段
- [x] P2-3 扩展 `src/analytics/ai-index-store.ts` 的读取能力，提供“读取新鲜摘要 / 判断摘要是否过期 / 保存补建摘要”接口
- [x] P2-4 新建 `src/analytics/wiki-generation.ts`，按主题收集：
  - 主题配对页信息
  - 源文档摘要
  - 核心文档、趋势、桥接、传播、孤立等结构信号
  - 代表性引用路径或证据
  - 未归类来源摘要
- [x] P2-5 定义 LLM 输出 JSON schema：`overview`、`keyDocuments`、`structureObservations`、`evidence`、`actions`
- [x] P2-6 新建 `src/analytics/wiki-renderer.ts`，把结构化 JSON 渲染为稳定 markdown，固定 section 顺序，保留人工备注区占位
- [x] P2-7 在 renderer 中同时输出机器可识别的 section metadata，避免后续 diff 只靠字符串比对

验证：

- `npm test -- src/analytics/ai-index-store.test.ts src/analytics/ai-document-summary.test.ts src/analytics/wiki-generation.test.ts src/analytics/wiki-renderer.test.ts`
- `npm test -- src/composables/use-analytics.test.ts src/analytics/ai-index-store.test.ts src/analytics/ai-document-summary.test.ts src/analytics/wiki-generation.test.ts src/analytics/wiki-renderer.test.ts`

退出条件：

- 任一主题都能从 scope 构造出完整 payload
- 已有摘要能被复用，缺失摘要能被补建
- markdown 草稿结构稳定且可预测

---

### Phase 3：预览、diff 与冲突检测

状态：`已完成`

实际开始日期：`2026-04-09`

实际完成日期：`2026-04-09`

对应实现：

- `src/analytics/wiki-diff.ts`
- `src/analytics/wiki-diff.test.ts`
- `src/analytics/wiki-store.ts`
- `src/analytics/wiki-store.test.ts`
- `src/analytics/wiki-page-model.ts`

目标：

- 为每个主题 wiki 页生成预览结果
- 给出新建 / 更新 / 无变化 / 冲突判定
- 支撑单页 diff 展示和后续确认写入

涉及文件：

- 新增：`src/analytics/wiki-diff.ts`
- 修改：`src/analytics/wiki-store.ts`
- 修改：`src/analytics/wiki-generation.ts`
- 新增：`src/analytics/wiki-diff.test.ts`
- 新增：`src/analytics/wiki-store.test.ts`

任务清单：

- [x] P3-1 在 `src/analytics/wiki-store.ts` 中落地 `ai-wiki-index.json`，记录主题页映射、上次生成时间、源文档列表、页面指纹、AI 管理区指纹、最近一次预览结果和应用结果
- [x] P3-2 新建 `src/analytics/wiki-diff.ts`，只针对 AI 管理区做 diff 计算，不把人工备注区纳入比较
- [x] P3-3 定义页面预览状态：`create`、`update`、`unchanged`、`conflict`
- [x] P3-4 通过“当前页面 AI 管理区指纹”与“上次应用指纹”比较实现冲突检测
- [x] P3-5 在预览结果中输出影响 section、源文档数、最近生成时间、冲突原因、旧内容摘要和新内容摘要
- [x] P3-6 为“无变化页面”保留可见记录，不在应用阶段重复写入

验证：

- `npm test -- src/analytics/wiki-diff.test.ts src/analytics/wiki-store.test.ts src/analytics/wiki-generation.test.ts`
- `npm test -- src/analytics/wiki-page-model.test.ts src/analytics/wiki-store.test.ts src/analytics/wiki-scope.test.ts src/analytics/ai-index-store.test.ts src/analytics/ai-document-summary.test.ts src/analytics/wiki-generation.test.ts src/analytics/wiki-renderer.test.ts src/analytics/wiki-diff.test.ts src/analytics/theme-documents.test.ts src/analytics/analysis.test.ts src/analytics/ai-inbox.test.ts src/composables/use-analytics.test.ts`

退出条件：

- 预览模型已足够驱动 UI 渲染
- 冲突页能够和普通更新页明显区分
- 同一页面重复预览时，状态判定稳定

---

### Phase 4：写入、索引页与日志页

状态：`已完成`

实际开始日期：`2026-04-09`

实际完成日期：`2026-04-09`

对应实现：

- `src/analytics/wiki-documents.ts`
- `src/analytics/wiki-documents.test.ts`

目标：

- 安全创建或更新主题 wiki 页
- 只更新 AI 管理区，不覆盖人工备注区
- 自动维护全局索引页和维护日志页

涉及文件：

- 新增：`src/analytics/wiki-documents.ts`
- 新增：`src/analytics/wiki-documents.test.ts`

任务清单：

- [x] P4-1 在 `src/analytics/wiki-documents.ts` 中封装主题 wiki 页创建 / 更新逻辑，复用 `createDocWithMd`、`prependBlock`、`updateBlock`、`getChildBlocks`、`getBlockKramdown`、`getBlockAttrs`、`setBlockAttrs`
- [x] P4-2 实现“新页面创建”流程：生成完整初始 markdown，写入 AI 管理区和人工备注区骨架
- [x] P4-3 实现“已有页面更新”流程：定位 AI 管理区，只更新对应区块，保留人工备注区不动
- [x] P4-4 在写入后回读必要块信息并刷新指纹，避免写入成功但本地索引仍旧使用旧值
- [x] P4-5 生成 / 更新全局索引页，至少写入 wiki 页清单、配对主题页、一句话摘要、源文档数、最近更新时间、未归类来源
- [x] P4-6 向全局维护日志页追加本轮记录，日志采用 append-only
- [x] P4-7 对冲突页默认跳过，仅在显式确认时允许覆盖

验证：

- `npm test -- src/analytics/wiki-documents.test.ts src/analytics/wiki-store.test.ts`
- `npm test -- src/analytics/wiki-documents.test.ts src/analytics/wiki-store.test.ts src/analytics/wiki-diff.test.ts src/analytics/wiki-renderer.test.ts src/analytics/wiki-generation.test.ts`
- `npm test -- src/analytics/wiki-page-model.test.ts src/analytics/wiki-store.test.ts src/analytics/wiki-scope.test.ts src/analytics/ai-index-store.test.ts src/analytics/ai-document-summary.test.ts src/analytics/wiki-generation.test.ts src/analytics/wiki-renderer.test.ts src/analytics/wiki-diff.test.ts src/analytics/wiki-documents.test.ts src/analytics/theme-documents.test.ts src/analytics/analysis.test.ts src/analytics/ai-inbox.test.ts src/composables/use-analytics.test.ts`

退出条件：

- 新建、更新、跳过、冲突四种结果都能正确落库
- 人工备注区不会被覆盖
- 索引页和日志页与主题 wiki 页应用结果一致

---

### Phase 5：UI 接入与交互闭环

状态：`已完成`

实际开始日期：`2026-04-10`

实际完成日期：`2026-04-10`

对应实现：

- `src/analytics/wiki-ai.ts`
- `src/analytics/wiki-ai.test.ts`
- `src/components/SettingPanel.vue`
- `src/components/SettingPanel.test.ts`
- `src/components/WikiMaintainPanel.vue`
- `src/components/WikiMaintainPanel.test.ts`
- `src/composables/use-analytics.ts`
- `src/composables/use-analytics.test.ts`
- `src/App.vue`
- `src/App.test.ts`

目标：

- 在设置页启用和配置 LLM Wiki
- 在主界面新增维护入口
- 提供作用域摘要、预览列表、单页 diff、确认写入与结果跳转

涉及文件：

- 修改：`src/components/SettingPanel.vue`
- 修改：`src/components/SettingPanel.test.ts`
- 新增：`src/components/WikiMaintainPanel.vue`
- 新增：`src/components/WikiMaintainPanel.test.ts`
- 修改：`src/composables/use-analytics.ts`
- 修改：`src/composables/use-analytics.test.ts`
- 修改：`src/App.vue`
- 修改：`src/App.test.ts`

任务清单：

- [x] P5-1 在 `src/components/SettingPanel.vue` 的 AI 分组中增加 wiki 开关、页面后缀、索引页标题、日志页标题
- [x] P5-2 在 `src/composables/use-analytics.ts` 增加状态：
  - `wikiPreviewLoading`
  - `wikiApplyLoading`
  - `wikiError`
  - `wikiPreview`
  - `prepareWikiPreview()`
  - `applyWikiChanges()`
  - `openWikiDocument()`
- [x] P5-3 在 `src/composables/use-analytics.ts` 中注入 `createDocWithMd` 以及 wiki 相关 service/store
- [x] P5-4 新建 `src/components/WikiMaintainPanel.vue`，展示：
  - 当前作用域摘要
  - 预览列表
  - 单页状态与 diff
  - 空状态 / 错误状态 / 冲突提示
  - 确认写入按钮
- [x] P5-5 修改 `src/App.vue`，在顶部操作区增加 `维护 LLM Wiki` 按钮，并挂载维护面板
- [x] P5-6 应用完成后提供快捷打开：索引页、日志页、最近更新页
- [x] P5-7 将“部分页面冲突”的处理结果反馈到 UI，不允许用户误以为整批都已成功写入

验证：

- `npm test -- src/components/SettingPanel.test.ts src/components/WikiMaintainPanel.test.ts src/analytics/wiki-ai.test.ts src/composables/use-analytics.test.ts src/App.test.ts`

退出条件：

- 用户能从主界面完整走通“生成预览 -> 查看单页 diff -> 确认写入 -> 打开结果页”
- 设置改动可持久化
- 异常、空范围、冲突、未启用 AI 等状态都有明确反馈

---

### Phase 6：稳定化、回归与发布准备

状态：`已完成`

实际开始日期：`2026-04-10`

实际完成日期：`2026-04-10`

对应实现：

- `docs/project-structure.md`
- `package.zip`

目标：

- 完成 V1 回归验证
- 补齐必要文档
- 产出可提交和可发布的构建结果

涉及文件：

- 修改：`docs/project-structure.md`
- 视需要修改：`docs/统计卡片规则与定义说明.md`
- 视需要修改：`README.md`
- 构建产物：`package.zip`

任务清单：

- [x] P6-1 跑全量测试：`npm test`
- [x] P6-2 跑构建：`npm run build`
- [x] P6-3 smoke 流程验证（通过现有与新增测试夹具覆盖以下场景）：
  - 有主题命中且有摘要缓存
  - 有主题命中但部分摘要缺失
  - 存在未归类来源
  - 存在冲突页
  - 存在无变化页
  - AI 未启用
- [x] P6-4 更新 `docs/project-structure.md`，补充新增 wiki 模块与组件职责
- [x] P6-5 校对发布时是否需要连带提交 `package.zip`

验证：

- `npm test`
- `npm run build`

退出条件：

- 自动化测试通过
- 主流程 smoke 通过
- 文档与产物齐备

## 6. 阶段依赖与并行建议

严格串行的主路径：

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6

可并行项：

- Phase 5 中 `SettingPanel.vue` 的配置接入，可在 Phase 3 完成后与 Phase 4 的写入层并行推进
- `WikiMaintainPanel.vue` 的纯展示部分，可在 Phase 3 的预览模型稳定后先行开发
- 测试文件骨架可以提前建立，但断言内容必须跟随对应阶段代码一起落地

## 7. 风险跟踪清单

- [ ] R1 摘要补建服务是否会与现有孤立文档补链提示词耦合过深
- [ ] R2 AI 管理区 block 定位是否足够稳定，能否在思源块结构变化后仍准确更新
- [ ] R3 索引页 / 日志页的文档定位策略是否会因为重命名而失效
- [ ] R4 页面级 diff 是否需要 section 级粒度，而不是整段 markdown 对比
- [ ] R5 大批量主题同时维护时，预览耗时是否超出当前 AI 超时和 token 上限

## 8. 每阶段完成定义

只有满足下面四项，阶段才算真正完成：

- 对应任务 checkbox 已全部勾选
- 本阶段测试已执行且通过
- 没有遗留的高优先级阻塞项
- 后续阶段不需要回头重做本阶段核心模型

## 9. 推荐执行顺序

推荐先把 V1 拆成三个交付批次，而不是一次性全做完：

1. 批次 A：Phase 0 + Phase 1
   - 先解决排除规则、配置和范围边界
2. 批次 B：Phase 2 + Phase 3
   - 先把“能预览”做出来，再谈写入
3. 批次 C：Phase 4 + Phase 5 + Phase 6
   - 在写入层稳定后再接 UI 闭环和发布准备

这样可以确保每一批都有明确可演示结果，并降低返工概率。
