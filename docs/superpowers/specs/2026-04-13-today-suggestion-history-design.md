# 今日建议历史快照设计

## 目标

为“今日建议详情”增加最近 3 次分析结果的持久化历史，并支持在详情头部直接切换查看历史快照：

- 每次“重新分析”成功后，保存本次完整结果快照。
- 最多保留最近 3 条历史结果，超出时挤掉最早一条。
- 在“重新分析”按钮左侧显示 `1`、`2`、`3` 三个历史按钮。
- 点击历史按钮后，详情区展示当时生成的完整快照，不受当前筛选条件变化影响。
- 鼠标悬浮历史按钮时，显示生成时间、时间窗口、筛选条件和建议数等信息。

## 约束

- 历史快照对应的是“当时分析生成的结果”，不是基于当前筛选条件重新回放或重算。
- 当前最新结果与历史快照是两种视图：
  - 最新结果来自当前内存态 `aiInboxResult`
  - 历史结果来自持久化 store
- 重新分析成功后，默认切回“最新结果”视图。
- 普通刷新分析数据时，不应清空已保存的 3 条历史快照。
- 仅持久化“今日建议详情”历史，不扩展到其他卡片。

## 设计

### 存储

- 新增独立存储文件，例如 `today-suggestion-history.json`。
- 不把历史快照写入 `PluginConfig`，避免把大体量运行态数据混入用户配置。
- 新增历史 store，统一负责：
  - 加载快照列表
  - 保存快照列表
  - 归一化旧数据或异常数据
  - 限制最多 3 条，并按生成时间从新到旧排序

### 历史快照结构

每条历史记录至少包含：

- `id`
  - 稳定的快照标识，可使用 `generatedAt` 加序号或哈希。
- `generatedAt`
  - 结果生成时间，供悬浮提示和排序使用。
- `timeRange`
  - 当时分析所用时间窗口。
- `filters`
  - 当时的笔记本、标签、主题、关键词筛选条件。
- `summaryCount`
  - 建议数量，便于悬浮提示直接展示。
- `result`
  - 完整的 `AiInboxResult`。

### 状态模型

- `useAnalyticsState` 新增：
  - `aiInboxHistory`
  - `selectedAiInboxHistoryId`
- 当前今日建议详情的展示结果改为：
  - 若 `selectedAiInboxHistoryId` 命中历史记录，则展示该历史快照；
  - 否则展示当前 `aiInboxResult`。
- 当前计数与详情区都应基于“当前展示的结果”而不是仅基于最新结果。

### 历史写入规则

- 仅在 `generateAiInbox()` 成功后写入历史。
- 写入时把“本次生成结果 + 当时筛选上下文”整体保存为一条快照。
- 若快照数超过 3：
  - 保留最新 3 条；
  - 删除最旧一条。
- 成功写入后：
  - `selectedAiInboxHistoryId` 清空；
  - 详情默认显示最新结果。

### 刷新行为

- `refresh()` 仍清空当前临时 AI 错误与最新内存态结果。
- `refresh()` 不清空 `aiInboxHistory`。
- 初始化 composable 时，从 store 读取历史快照。

### UI

- `SummaryDetailSection.vue` 在 `detail.kind === 'aiInbox'` 时：
  - 在“重新分析”按钮左侧渲染历史按钮组。
  - 按历史顺序显示 `1`、`2`、`3`。
  - 当前选中的历史按钮高亮。
  - 未选中任何历史时，表示当前在看“最新结果”。
- 历史按钮 `title` 文案至少包含：
  - 生成时间
  - 时间窗口
  - 笔记本
  - 标签
  - 主题
  - 关键词
  - 建议数

### 兼容与容错

- 如果历史存储损坏、字段缺失或结构不合法：
  - 跳过无效记录；
  - 不阻塞主分析界面。
- 若历史中存在合法记录但 `result.items` 为空，则视为无效历史，不显示按钮。

## 影响范围

- `src/analytics/ai-inbox.ts`
  - 复用 `AiInboxResult` 类型。
- `src/analytics/today-suggestion-history-store.ts`
  - 新增持久化 store。
- `src/composables/use-analytics-ai.ts`
  - 生成成功后写入历史。
- `src/composables/use-analytics.ts`
  - 载入历史、维护当前历史选择状态、切换展示结果。
- `src/components/SummaryDetailSection.vue`
  - 新增历史按钮与悬浮提示。
- `src/components/SummaryDetailSection.test.ts`
- `src/composables/use-analytics.test.ts`
- `src/analytics/today-suggestion-history-store.test.ts`

## 测试

- `src/analytics/today-suggestion-history-store.test.ts`
  - 覆盖快照读写与非法数据归一化。
  - 覆盖最多保留 3 条并淘汰最旧快照。
- `src/composables/use-analytics.test.ts`
  - 覆盖重新分析成功后写入历史。
  - 覆盖点击历史后详情切换为历史快照。
  - 覆盖刷新后历史仍保留。
  - 覆盖重新分析成功后自动回到最新结果。
- `src/components/SummaryDetailSection.test.ts`
  - 覆盖 `1/2/3` 历史按钮渲染。
  - 覆盖历史按钮位于“重新分析”左侧。
  - 覆盖按钮 `title` 包含时间和筛选摘要。
  - 覆盖历史结果展示时仍能正常渲染建议列表。
