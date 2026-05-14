# 重构计划

## 1. 项目快照

- 生成日期：2026-05-14
- 范围：`/home/quincyzou/projects/siyuan-network-lens`
- 目标：基于当前 `main` 分支最新代码，重新识别下一轮仍值得执行的重构项，先形成可批准、可追踪、测试优先的实施计划。
- 当前基线：仓库工作树干净；上一轮 `docs/refactor-plan.md` 所记录的大部分重构已完成，本文件按当前代码现状重建。
- 当前复杂度中心：`LLM Wiki` 维护链路、`SummaryDetailSection.vue` 大组件、`use-analytics.ts` 主控制器的生命周期与 watcher 编排。

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 入口与页面装配 | `src/index.ts`、`src/main.ts`、`src/App.vue` | 插件启动、Dock 装配、主界面布局、筛选器与卡片/详情区接线 | 页面层主编排已明显收敛，但仍承接较多跨模块桥接 props | `src/index.test.ts`、`src/App.test.ts` 已覆盖关键装配行为 |
| 主状态容器 | `src/composables/use-analytics.ts` | 统一管理快照、筛选、统计卡片、详情、AI Inbox、Wiki、文档索引、watcher 与刷新链路 | 文件仍约 1180 行；虽然已拆出 doc-index / wiki-actions 等控制器，但 watcher、格式化、初始化、副作用依然集中 | `src/composables/use-analytics.test.ts` 覆盖较强，但以集成用例为主，子职责缺少细粒度测试护栏 |
| LLM Wiki 维护链路 | `src/composables/use-analytics-llm-wiki.ts`、`src/analytics/llm-wiki-maintain-service.ts`、`src/components/WikiMaintainPanel.vue`、`src/components/WikiMaintainDiffDialog.vue`、`src/analytics/wiki-index.ts` | 解析 wiki 索引、审查页面、检测坏链、向 LLM 请求维护建议、展示 diff、应用回写 | 网络调用、坏链探测、状态迁移和组件交互仍有较强耦合；新近功能复杂度上升，但控制器/弹窗维度的自动化测试不足 | `llm-wiki-maintain-service.test.ts`、`WikiMaintainPanel.test.ts` 已覆盖部分纯函数与渲染，`use-analytics-llm-wiki.ts`、`WikiMaintainDiffDialog.vue` 缺少直接测试 |
| 核心分析层 | `src/analytics/analysis.ts`、`src/analytics/analysis-context.ts`、`src/analytics/siyuan-data.ts` | 图分析、趋势分析、引用快照采集与过滤 | 业务语义复杂但边界相对稳定，本轮不是最高优先级 | `analysis*.test.ts`、`siyuan-data*.test.ts` 覆盖较完整 |
| 详情区大组件 | `src/components/SummaryDetailSection.vue` | 统一承载孤立文档、沉没文档、AI Inbox、路径、证据、Wiki 卡片、文档索引等细分视图与动作 | 文件约 2000 行，包含大量 computed / handler / UI 分支，后续继续叠功能时易失控 | `SummaryDetailSection.test.ts` 有较强集成覆盖，但针对内部 helper / 批量动作缺少独立测试 |
| 设置与面板组件 | `src/components/SettingPanel.vue`、`src/components/WikiMaintainPanel.vue` | 设置项渲染、Wiki 预览与结果展示 | `SettingPanel` 已有较好分层；`WikiMaintainPanel.vue` 仍较大，展示型 helper 较多，后续可继续下沉纯视图逻辑 | `SettingPanel.test.ts`、`WikiMaintainPanel.test.ts` 覆盖关键显示路径 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | Files in Scope | 重构目标 | 行为不变约束 | 风险等级 | 重构前测试清单 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-201 | P0 | LLM Wiki 维护链路分层 | `src/composables/use-analytics-llm-wiki.ts`、`src/analytics/llm-wiki-maintain-service.ts`、`src/components/WikiMaintainDiffDialog.vue`；允许新增同目录 helper / test 文件 | 把“页面审查 orchestration / 坏链探测 / 响应归一化 / diff 选择状态”拆成更窄的可测边界，降低网络副作用与 UI 交互耦合 | `loadWikiPages/reviewPage/applyMaintenance` 对外接口保持可兼容；缺依赖、LLM 空响应、API 报错时的状态退化保持一致；默认全选建议、按原顺序 apply 的交互语义不变 | 高 | - [x] 为 `createLlmWikiController` 增加成功/缺依赖/API 失败/解析失败用例<br>- [x] 为 `WikiMaintainDiffDialog` 增加默认选中、取消选择、apply 顺序、loading 结束条件用例（以 state helper 形式固化）<br>- [x] 回归 `src/analytics/llm-wiki-maintain-service.test.ts`、`src/components/WikiMaintainPanel.test.ts` | done |
| RF-202 | P1 | `useAnalyticsState` 生命周期与 watcher 编排继续瘦身 | `src/composables/use-analytics.ts`；允许新增内部 helper/composable（如 watcher/setup/formatting bootstrap 模块） | 继续缩小主控制器，把初始化、watcher、格式化与瞬态状态复位等职责拆为可单测单元，同时保持返回 API 稳定 | `useAnalyticsState()` 返回字段与外部调用方式不变；`refresh()`、卡片顺序持久化、AI Inbox 历史、active document 同步、路径选项联动语义不变 | 高 | - [x] 补充新 helper 的单测后再移动实现<br>- [x] 回归 `src/composables/use-analytics.test.ts`<br>- [x] 回归 `src/App.test.ts`、`src/composables/use-app-filters.test.ts`、`src/composables/use-app-wiki-panel.test.ts` | done |
| RF-203 | P1 | `SummaryDetailSection.vue` 大组件拆分 | `src/components/SummaryDetailSection.vue`；允许新增 `src/components/summary-detail-*` 子组件或纯 helper | 将 AI Inbox 工具栏、批量文档索引动作、折叠状态与部分展示 helper 拆出，降低模板和脚本耦合，提升后续维护性 | 现有 props / emits / 子面板行为保持兼容；孤立文档、沉没文档、AI Inbox、路径与 Wiki 相关交互不改变；折叠/展开语义不变 | 中 | - [x] 先为将被提取的纯 helper 增补测试<br>- [x] 回归 `src/components/SummaryDetailSection.test.ts`<br>- [x] 必要时补充 `src/components/AIInboxPanel.test.ts`、`src/components/OrphanDetailPanel.test.ts` 相关回归 | done |
| RF-204 | P2 | `WikiMaintainPanel.vue` 展示逻辑清理 | `src/components/WikiMaintainPanel.vue`；允许新增 panel helper / presenter 文件 | 提取模板标签映射、摘要裁剪、section order 展示等纯展示逻辑，减少大组件内的工具函数密度 | Preview 展示文本、状态标签、按钮可用性、时间显示与打开页面快捷入口语义不变 | 低 | - [x] 为新提取的纯函数补单测<br>- [x] 回归 `src/components/WikiMaintainPanel.test.ts` | done |

优先级说明：

- `P0`：当前价值最高且回归风险最高的重构项，需先补测试护栏再动实现。
- `P1`：中高价值、边界明确，适合在 `P0` 完成后顺序推进。
- `P2`：清理型改进，优先级最低。

状态说明：

- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | Test Commands | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| RF-201 | 2026-05-14 | 2026-05-14 | `npx vitest run src/composables/use-analytics-llm-wiki.test.ts src/components/wiki-maintain-diff-state.test.ts src/analytics/llm-wiki-maintain-service.test.ts src/components/WikiMaintainPanel.test.ts`；`npm test` | pass | 新增 `llm-wiki-maintain-review.ts` 与 `wiki-maintain-diff-state.ts` 两个可测 helper；修正 `applyMaintenance` 调用 `updateBlock` 的参数顺序为 `dataType -> data -> id` |
| RF-202 | 2026-05-14 | 2026-05-14 | `npx vitest run src/composables/use-analytics-selection-sync.test.ts src/composables/use-analytics.test.ts src/App.test.ts src/composables/use-app-filters.test.ts src/composables/use-app-wiki-panel.test.ts`；`npm test` | pass | 新增 `use-analytics-selection-sync.ts` 与对应测试，把路径端点同步、证据文档选择、社区联动、summary card/order 同步、theme/tag 过滤等 watcher 逻辑从主控制器中提取 |
| RF-203 | 2026-05-14 | 2026-05-14 | `npx vitest run src/components/summary-detail-ai-inbox.test.ts src/components/use-summary-detail-doc-index.test.ts src/components/SummaryDetailSection.test.ts src/components/AIInboxPanel.test.ts src/components/OrphanDetailPanel.test.ts`；`npm test` | pass | 新增 `summary-detail-ai-inbox.ts` 与 `use-summary-detail-doc-index.ts` 及对应测试；把 AI Inbox 展示 helper 与文档索引批量动作状态从 `SummaryDetailSection.vue` 提取 |
| RF-204 | 2026-05-14 | 2026-05-14 | `npx vitest run src/components/wiki-maintain-panel-presenter.test.ts src/components/WikiMaintainPanel.test.ts`；`npm test`；`npm run build` | pass | 新增 `wiki-maintain-panel-presenter.ts` 与测试；把 apply summary、preview notice、template/confidence/delta/link label、summary sanitize、meta section strip、source meta 排序与 processing time 展示逻辑从 `WikiMaintainPanel.vue` 下沉 |

## 5. 决策与确认

- 用户批准的条目：`RF-201`、`RF-202`、`RF-203`、`RF-204`
- 延后的条目：
- 阻塞条目及原因：
- 推荐执行顺序：`RF-201` → `RF-202` → `RF-203` → `RF-204`

## 6. 下一步

1. 本轮 4 个获批条目已全部完成。
2. 已完成最终验证：`npm test` 与 `npm run build` 均通过。
3. `package.zip` 已按构建流程更新，处于可提交状态。
