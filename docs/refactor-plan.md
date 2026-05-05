# 重构计划

## 1. 项目快照

- 生成日期：2026-05-05
- 范围：`D:\MyCodingProjects\siyuan-network-lens`
- 目标：基于当前仓库结构重新识别仍然值得做的重构项，先形成可批准、可追踪、测试优先的实施计划。
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 工作树状态：存在未提交改动 `package.zip`；按 `AGENTS.md` 约定视为正常构建产物，当前计划不会修改或回退它。
- 说明：仓库中已有旧版 `docs/refactor-plan.md`，其条目大多已完成，不再反映当前主复杂度中心。本文件已按当前代码现状重建。

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 入口与页面装配 | `src/App.vue` | 页面级布局装配、筛选栏、顶部卡片显示控制、wiki 面板接线 | 模板与页面脚本仍然偏大，页面状态桥接较多，但核心编排已比旧版本收敛 | `src/App.test.ts` 覆盖主布局与关键委托行为 |
| 主状态容器 | `src/composables/use-analytics.ts` | 聚合快照、筛选、统计卡片、详情数据、AI Inbox、AI 补链、Wiki 预览/写回、文档索引动作和多组 watcher | 约 1484 行，仍是仓库最重的控制器；文档索引、wiki、AI、卡片与刷新状态仍混在一个入口里 | `src/composables/use-analytics.test.ts` 覆盖较强，但偏集成，细粒度护栏不足 |
| 派生与交互分层 | `src/composables/use-analytics-derived.ts`、`src/composables/use-analytics-interactions.ts`、`src/composables/use-analytics-ai.ts`、`src/composables/use-analytics-wiki.ts` | 承接已拆出的纯派生、交互、副作用与 wiki/AI 辅助逻辑 | 分层已经存在，但主控制器尚未进一步把“文档索引”和“wiki 应用链路”下沉到独立边界 | 各层通过 `use-analytics.test.ts` 间接覆盖，局部直测有限 |
| 核心分析层 | `src/analytics/analysis.ts`、`src/analytics/analysis-context.ts` | 图分析入口、趋势分析、路径搜索、样本过滤上下文 | 高风险核心语义已较稳定；文件仍较长，但当前复杂度比主 composable 更可控 | `src/analytics/analysis.test.ts`、`analysis-context.test.ts` 覆盖较强 |
| 数据采集层 | `src/analytics/siyuan-data.ts`、`src/analytics/internal-links.ts` | 读取文档与引用快照，合并 `refs` 与 markdown fallback | SQL、fallback 目标查找、去重合并仍耦合在单文件中，后续继续扩展采集来源时可维护性一般 | `src/analytics/siyuan-data.test.ts`、`internal-links.test.ts` 覆盖关键语义 |
| 设置页 | `src/components/SettingPanel.vue` | 分析范围、主题文档、已读规则、统计卡片、AI 与 Wiki 设置装配 | 约 754 行，仍是大组件，但 AI 相关已拆分；剩余复杂度主要来自大模板而非高风险业务耦合 | `src/components/SettingPanel.test.ts` 及相关 helper 测试已覆盖关键路径 |
| 配置与展示规则边界 | `src/types/config.ts`、`src/analytics/summary-card-config.ts` | 持久化配置模型、统计卡片定义、显示开关边界 | 是稳定边界，重构时需要避免把结构调整变成配置语义变更 | `config.test.ts`、`summary-card-config.test.ts` 等已有覆盖 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 主状态容器继续瘦身：拆出文档索引与 wiki 写入控制器 | `src/composables/use-analytics.ts`；允许新增 `src/composables/use-analytics-document-index.ts`、`src/composables/use-analytics-wiki-actions.ts` 等配套文件 | 把 `generateDocIndex/openDocIndex/batch*DocIndex` 和 `prepareWikiPreview/applyWikiChanges` 的长链动作从主入口下沉，保留 `useAnalyticsState` 外部 API 不变 | 高 | `npx vitest run src/composables/use-analytics.test.ts src/App.test.ts src/composables/use-analytics-wiki.test.ts` | `docs/project-structure.md` 需要更新 composable 分层；`README.md` 仅在结构说明有变化时更新 | done |
| RF-002 | P1 | 数据采集层分层：拆分快照查询、fallback 目标解析、引用合并 | `src/analytics/siyuan-data.ts`；允许新增 `src/analytics/siyuan-data-queries.ts`、`src/analytics/siyuan-data-merge.ts` 等 helper | 保持 `loadAnalyticsSnapshot()` 边界稳定，把 SQL 常量、目标块查找、引用去重合并拆为可单测的纯函数/窄函数 | 中 | `npx vitest run src/analytics/siyuan-data.test.ts src/analytics/internal-links.test.ts` | `docs/project-structure.md` 需要更新分析数据采集层职责；`README.md` 通常无需改动 | done |
| RF-003 | P1 | 页面装配收敛：压缩 `App.vue` 的筛选与卡片可见性桥接逻辑 | `src/App.vue`；允许新增 `src/composables/use-app-filters.ts` 或页面级 helper | 让 `App.vue` 更接近纯布局装配器，减少页面脚本中的 computed/watch/update wrapper 数量，不改变现有子组件接口与页面行为 | 中 | `npx vitest run src/App.test.ts src/components/SummaryCardsGrid.test.ts src/components/SummaryDetailSection.test.ts` | `docs/project-structure.md` 需要更新页面装配层说明；`README.md` 一般无需改动 | done |
| RF-004 | P2 | 设置页模板清理：把非 AI 的字段分组渲染数据进一步下沉 | `src/components/SettingPanel.vue`；允许新增 `src/components/setting-panel-sections.ts` 等纯数据 helper | 降低模板重复和维护成本，但不主动改变现有设置模型和交互方式 | 低 | `npx vitest run src/components/SettingPanel.test.ts src/components/setting-panel-data.test.ts` | `docs/project-structure.md` 视实际拆分结果更新；`README.md` 通常无需改动 | done |
| RF-002 | P1 | 数据采集层分层：拆分快照查询、fallback 目标解析、引用合并 | `src/analytics/siyuan-data.ts`；允许新增 `src/analytics/siyuan-data-queries.ts`、`src/analytics/siyuan-data-merge.ts` 等 helper | 保持 `loadAnalyticsSnapshot()` 边界稳定，把 SQL 常量、目标块查找、引用去重合并拆为可单测的纯函数/窄函数 | 中 | `npx vitest run src/analytics/siyuan-data.test.ts src/analytics/internal-links.test.ts` | `docs/project-structure.md` 需要更新分析数据采集层职责；`README.md` 通常无需改动 | pending |
| RF-003 | P1 | 页面装配收敛：压缩 `App.vue` 的筛选与卡片可见性桥接逻辑 | `src/App.vue`；允许新增 `src/composables/use-app-filters.ts` 或页面级 helper | 让 `App.vue` 更接近纯布局装配器，减少页面脚本中的 computed/watch/update wrapper 数量，不改变现有子组件接口与页面行为 | 中 | `npx vitest run src/App.test.ts src/components/SummaryCardsGrid.test.ts src/components/SummaryDetailSection.test.ts` | `docs/project-structure.md` 需要更新页面装配层说明；`README.md` 一般无需改动 | pending |
| RF-004 | P2 | 设置页模板清理：把非 AI 的字段分组渲染数据进一步下沉 | `src/components/SettingPanel.vue`；允许新增 `src/components/setting-panel-sections.ts` 等纯数据 helper | 降低模板重复和维护成本，但不主动改变现有设置模型和交互方式 | 低 | `npx vitest run src/components/SettingPanel.test.ts src/components/setting-panel-data.test.ts` | `docs/project-structure.md` 视实际拆分结果更新；`README.md` 通常无需改动 | pending |

优先级说明：
- `P0`：当前复杂度最高且最容易继续膨胀的中心模块，优先处理。
- `P1`：边界明确、收益稳定，但不如 `P0` 紧急。
- `P2`：清理型改进，适合作为最后一项。

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-05-05 | 2026-05-05 | `npx vitest run src/composables/use-analytics-document-index.test.ts src/composables/use-analytics-wiki-actions.test.ts src/composables/use-analytics-wiki.test.ts src/composables/use-analytics.test.ts src/App.test.ts` | pass |  | 新增 `use-analytics-document-index.test.ts` 与 `use-analytics-wiki-actions.test.ts` 作为拆分护栏；主 composable 已接入新控制器 |
| RF-002 | 2026-05-05 | 2026-05-05 | `npx vitest run src/analytics/siyuan-data-queries.test.ts src/analytics/siyuan-data-merge.test.ts src/analytics/internal-links.test.ts src/analytics/siyuan-data.test.ts` | pass |  | 新增 `siyuan-data-queries.test.ts` 与 `siyuan-data-merge.test.ts`；`siyuan-data.ts` 已收敛为快照装配入口 |
| RF-003 | 2026-05-05 | 2026-05-05 | `npx vitest run src/composables/use-app-filters.test.ts src/App.test.ts src/components/SummaryCardsGrid.test.ts src/components/SummaryDetailSection.test.ts` | pass |  | 新增 `use-app-filters.ts` 与测试；`App.vue` 的筛选选项和可见卡片桥接已下沉到页面级 helper |
| RF-004 | 2026-05-05 | 2026-05-05 | `npx vitest run src/components/setting-panel-sections.test.ts src/components/setting-panel-data.test.ts src/components/SettingPanel.test.ts` | pass |  | 新增 `setting-panel-sections.ts` 与测试；基础设置区块已改为按 section 元数据渲染 |

## 5. 决策与确认

- 用户批准的条目：`RF-001`、`RF-002`、`RF-003`、`RF-004`
- 延后的条目：无
- 阻塞条目及原因：
- 当前执行项：`RF-004`

## 6. 文档刷新

- `docs/project-structure.md`：在最后一个获批条目完成后刷新，反映 composable / analytics / page 层新边界。
- `README.md`：在最后一个获批条目完成后检查并按需刷新项目结构或开发说明。
- 最终同步检查：已完成，两个文档均已按本轮重构结果刷新。

## 7. 下一步

1. 已完成全部获批条目。
2. 已刷新 `docs/project-structure.md` 与 `README.md`，同步新增加的控制器、helper 与测试分层。
3. 已完成最终验证：`npm test` 与 `npm run build` 均通过。

## 8. 最终结果

- 完成项：`RF-001`、`RF-002`、`RF-003`、`RF-004`
- 跳过项：无
- 阻塞项：无
- 文档刷新：`docs/project-structure.md`、`README.md`
- 完整测试：`npm test` 通过，`80` 个测试文件、`362` 个测试全部通过。
- 构建验证：`npm run build` 通过，并按预期更新根目录 `package.zip`。
