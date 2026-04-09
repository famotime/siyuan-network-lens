# 项目结构

更新时间：2026-04-10

## 顶层目录

- `src/`
  - 主插件实现，包含分析逻辑、组合式状态、Vue 组件与入口文件。
- `docs/`
  - PRD、规则说明、排障记录与当前结构文档。
- `reference_docs/`
  - 思源插件开发相关参考资料。
- `plugin-sample-vite-vue/`
  - 样板工程，不属于当前主插件实现。

## 入口与生命周期

- `src/index.ts`
  - 思源插件入口，负责插件加载、Dock 注册、设置面板打开和配置持久化。
- `src/main.ts`
  - Vue 挂载层，负责主界面与设置界面的创建、销毁和根节点清理。

## 分析层

- `src/analytics/analysis.ts`
  - 文档级引用网络的核心分析入口，负责时间窗口过滤、社区、桥接、孤立、沉没、传播节点与趋势分析。
- `src/analytics/document-utils.ts`
  - 新增共享基础 helper，统一标题回退、标签拆分、思源时间戳解析、时间窗口判断与紧凑日期格式化。
- `src/analytics/summary-details.ts`
  - 顶部统计卡片定义与详情 section 组装。
- `src/analytics/siyuan-data.ts`
  - 从思源数据库读取文档和引用快照，并合并 `refs` 与 markdown fallback。
- `src/analytics/internal-links.ts`
  - markdown fallback 内部链接解析，当前支持 `siyuan://blocks/...` 与 `((...))`。
- `src/analytics/theme-documents.ts`
  - 主题文档识别、主题筛选项构建与主题名称匹配。
- `src/analytics/read-status.ts`
  - 已读规则匹配。
- `src/analytics/orphan-theme-links.ts`
  - 孤立文档主题修复建议的插入、追加与撤销。
- `src/analytics/link-associations.ts`
  - 核心文档上下游关联与子文档补充信息构建。
- `src/analytics/link-sync.ts`
  - 将关联结果同步为文档内部链接。
- `src/analytics/panel-counts.ts`
  - 各分析面板计数汇总。
- `src/analytics/panel-collapse.ts`
  - 面板折叠状态管理。
- `src/analytics/summary-card-order.ts`
  - 顶部统计卡片排序、归一化与重排规则。
- `src/analytics/time-range.ts`
  - 时间窗口选项构建。
- `src/analytics/active-document.ts`
  - 当前活动文档同步。
- `src/analytics/ui-copy.ts`
  - 建议标签等文案映射。
- `src/analytics/ai-document-summary.ts`
  - 通用文档摘要补建与 freshness 复用，供孤立文档 AI 补链和 wiki 维护共用。
- `src/analytics/ai-index-store.ts`
  - AI 私有索引读写，保存文档语义摘要、证据片段和建议缓存。
- `src/analytics/wiki-scope.ts`
  - 基于当前筛选结果构建 wiki 维护范围，输出主题分组、未归类来源和排除的 wiki 页面。
- `src/analytics/wiki-generation.ts`
  - 将主题分组、摘要索引和结构信号组合为主题 wiki 生成 payload。
- `src/analytics/wiki-ai.ts`
  - 调用 OpenAI 兼容接口生成主题 wiki 的结构化 JSON section 内容。
- `src/analytics/wiki-renderer.ts`
  - 将结构化 wiki section 渲染为稳定 markdown 草稿与 section metadata。
- `src/analytics/wiki-diff.ts`
  - 对 AI 管理区计算页面级 diff、指纹和冲突状态。
- `src/analytics/wiki-store.ts`
  - 维护 `ai-wiki-index.json` 快照，记录 wiki 页映射、预览和写入结果。
- `src/analytics/wiki-documents.ts`
  - 负责主题 wiki 页、索引页和维护日志页的创建、更新与回写。
- `src/analytics/wiki-page-model.ts`
  - 集中定义 wiki 页面类型、section key、预览状态和块属性约定。

## 组合式状态层

- `src/composables/use-analytics.ts`
  - 主状态容器。负责组合快照、筛选、分析结果、AI Inbox、LLM Wiki 预览/写入状态、watcher、公开 API 与 UI 联动状态。
- `src/composables/use-analytics-derived.ts`
  - 新增纯派生选择器。负责标签选项、路径候选、孤立主题建议映射、详情计数和关联映射构建。
- `src/composables/use-analytics-interactions.ts`
  - 新增交互副作用控制器。负责关联同步和孤立主题建议写入/撤销的状态与消息反馈。

## UI 层

- `src/App.vue`
  - 主界面，消费 `useAnalyticsState`，负责筛选器、顶部操作区、LLM Wiki 维护入口和页面级布局组装。
- `src/components/SettingPanel.vue`
  - 设置界面，负责主题文档、统计卡片开关、已读规则、AI 接入和 LLM Wiki 配置。
- `src/components/setting-panel-data.ts`
  - 新增设置页数据 helper，负责默认值修正、标签选项收集和笔记本/标签初始化加载。
- `src/components/RankingPanel.vue`
  - 核心文档排行与关联明细展示。
- `src/components/OrphanDetailPanel.vue`
  - 孤立文档详情与主题修复建议展示。
- `src/components/DormantDetailPanel.vue`
  - 沉没文档详情展示。
- `src/components/SummaryCardsGrid.vue`
  - 新增顶部统计卡片展示组件，内聚拖拽排序和已读卡片切换按钮。
- `src/components/SummaryDetailSection.vue`
  - 新增详情区展示组件，内聚列表、传播路径、趋势详情和排行详情的渲染分支。
- `src/components/WikiMaintainPanel.vue`
  - LLM Wiki 维护面板，负责作用域摘要、页面预览、冲突提示、确认写入和结果页快捷打开。
- `src/components/ThemeMultiSelect.vue`
  - 主题/标签多选控件。
- `src/components/FilterSelect.vue`
  - 筛选下拉控件。
- `src/components/DocumentTitle.vue`
  - 可点击文档标题渲染。
- `src/components/SuggestionCallout.vue`
  - 建议文案展示。
- `src/components/SiyuanTheme/*`
  - 复用的思源风格基础输入组件。

## 类型与配置

- `src/types/config.ts`
  - 插件配置模型与默认值。
- `src/types/api.d.ts`
  - 思源 API 相关类型声明。
- `src/types/index.d.ts`
  - 全局类型补充。

## 测试分布

- `src/analytics/*.test.ts`
  - 覆盖图分析、趋势、fallback 引用采集、主题文档、已读规则、wiki 生成/写入流程、卡片详情与共享 helper。
- `src/composables/use-analytics.test.ts`
  - 覆盖主 composable 的公开行为，包括 LLM Wiki 预览与写入闭环。
- `src/composables/use-analytics-derived.test.ts`
  - 覆盖新拆分出的纯派生选择器。
- `src/components/*.test.ts`
  - 覆盖关键 UI 组件、统计卡片区、详情区、LLM Wiki 面板与设置界面结构。
- `src/App.test.ts`
  - 覆盖主界面关键结构与布局约束。
