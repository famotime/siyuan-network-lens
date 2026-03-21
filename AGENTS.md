# AGENTS.md

## 项目概览

这是一个思源笔记插件项目，名称是“脉络镜（Context lens）”。

它当前聚焦的是“文档级引用网络”的结构分析与整理辅助，不做大型图谱渲染。核心目标是把文档之间的引用关系转成可解释的分析结果、证据和整理动作，帮助用户更快发现结构问题与优化入口。

当前主要输出包括：

- 文档级引用热度排行
- 主题社区发现
- 孤立文档、沉没文档、桥接节点识别
- 时间趋势分析
- 关系传播路径
- 高传播价值节点
- 原始引用证据查看
- 可操作建议
- 顶部统计卡片点击后的详情联动
- 已读/未读文档识别与详情查看

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

## 当前关键行为

### 1. 分析粒度

- 节点是“文档”
- 边是“文档到文档的聚合引用关系”
- 图分析阶段按无向图处理连接关系

### 2. 引用采集来源

当前引用数据来自两部分：

- `refs` 表中 `type = 'ref_id'` 的记录
- markdown fallback 解析出的文档链接/引用

markdown fallback 当前支持：

- `siyuan://blocks/<id>`
- `((block-id "title"))`
- `((block-id 'title'))`

关键实现位于：

- `src/analytics/siyuan-data.ts`
- `src/analytics/internal-links.ts`

如果后续出现“文档里明明有链接/引用但没识别”的问题，优先检查这两层。

### 3. 孤立文档与沉没文档定义

当前“孤立文档”的定义是：

- 当前窗口内没有有效文档级入链/出链

因此：

- 只要当前窗口内存在文档级连接，它就不应被视为孤立文档
- 即使它历史上曾经有连接，只要当前窗口内没有有效连接，仍会回到孤立文档

“沉没文档”才是：

- 当前窗口没有有效连接
- 但历史上可能有连接
- 且达到沉没时长阈值

关键实现位于：

- `src/analytics/analysis.ts`

### 4. 主题文档与孤立修复建议

当前支持在设置页配置“主题文档”：

- 指定笔记本
- 指定文档路径
- 可选名称前缀/后缀约束

符合配置的文档会被视为主题文档，主题名称取文档标题去除前后缀后的结果。

当前行为：

- 顶部筛选已拆分为“主题”和“关键词”
- 主题筛选是多选勾选下拉
- 孤立文档详情会基于主题名称匹配，给出建议链接标签
- 点击标签会给文档插入对应主题文档链接
- 如果首段仅包含思源内部链接/引用，则会在首段后用 tab 追加链接
- 否则会新增建议段落
- 同一孤立文档的多个主题建议会合并到同一个块中
- 再次点击标签会撤销对应链接；全部撤销后，刷新分析可重新回到孤立文档

关键实现位于：

- `src/analytics/theme-documents.ts`
- `src/analytics/orphan-theme-links.ts`
- `src/composables/use-analytics.ts`
- `src/composables/use-analytics-interactions.ts`

### 5. 已读/未读文档规则

当前支持在设置页配置“已读文档”规则，命中任一条件即视为已读：

- 已读标签
- 标题前缀
- 标题后缀

相关行为：

- 顶部统计卡片包含“已读/未读文档”
- 该卡片可在已读与未读视图间切换
- 点击卡片后可联动查看命中详情

关键实现位于：

- `src/analytics/read-status.ts`
- `src/analytics/summary-details.ts`
- `src/components/SettingPanel.vue`
- `src/components/SummaryCardsGrid.vue`

### 6. 传播节点定义

“高传播价值节点”当前采用可解释的启发式口径：

- 先取核心文档、桥接节点、社区 hub 文档作为焦点集合
- 再统计哪些中间文档高频出现在这些焦点之间的最短路径上

这不是严格的图论 betweenness centrality，而是面向产品交互的轻量替代实现。

### 7. 顶部统计卡片

顶部统计卡片当前支持：

- 点击后在下方展示对应详情列表
- 拖拽重排卡片顺序
- 重置为默认顺序
- 已读卡片在“已读/未读”之间切换

相关代码：

- `src/App.vue`
- `src/analytics/summary-card-order.ts`
- `src/analytics/summary-details.ts`
- `src/components/SummaryCardsGrid.vue`

## 关键目录

- `src/App.vue`
  - 主界面，负责筛选器、顶部操作区和页面级布局组装
- `src/composables/use-analytics.ts`
  - 主状态容器，组合快照、筛选、分析结果与 UI 联动状态
- `src/composables/use-analytics-derived.ts`
  - 纯派生选择器，负责标签选项、路径候选、孤立主题建议映射、详情计数与关联映射构建
- `src/composables/use-analytics-interactions.ts`
  - 交互副作用控制器，负责关联同步和孤立主题建议写入/撤销
- `src/analytics/analysis.ts`
  - 核心分析逻辑
- `src/analytics/document-utils.ts`
  - 共享 helper，统一标题回退、标签拆分、时间戳解析与时间窗口判断
- `src/analytics/siyuan-data.ts`
  - 从思源数据库读取文档与引用快照
- `src/analytics/internal-links.ts`
  - markdown fallback 内部链接解析
- `src/analytics/theme-documents.ts`
  - 主题文档识别与主题筛选项构建
- `src/analytics/orphan-theme-links.ts`
  - 孤立文档主题修复建议的插入与撤销
- `src/analytics/read-status.ts`
  - 已读规则匹配逻辑
- `src/analytics/summary-details.ts`
  - 顶部统计卡片与详情生成逻辑
- `src/analytics/summary-card-order.ts`
  - 顶部统计卡片排序、归一化与重排
- `src/components/SettingPanel.vue`
  - 设置页，包含主题文档、统计卡片、已读规则等配置
- `src/components/setting-panel-data.ts`
  - 设置页数据 helper，负责默认值修正以及笔记本/标签选项初始化
- `src/components/SummaryCardsGrid.vue`
  - 顶部统计卡片区，负责拖拽排序和已读卡片切换按钮
- `src/components/SummaryDetailSection.vue`
  - 详情区，负责列表、排行、趋势和传播路径视图
- `docs/思源笔记插件_PRD_引用网络分析器_Reference_Analytics.md`
  - 原始 PRD
- `docs/统计卡片规则与定义说明.md`
  - 当前顶部统计卡片的口径与边界说明
- `docs/project-structure.md`
  - 当前结构文档
- `reference_docs/`
  - 思源笔记插件开发者文档，包括相关 API 接口说明和示例

## 开发约定

### 1. 修改前优先看测试

当前已有测试覆盖这些关键场景：

- 图分析结果
- 趋势分析
- markdown fallback 引用采集
- 顶部统计卡片与详情生成
- 主题文档识别与孤立修复建议
- 已读规则匹配
- 卡片排序与面板折叠
- 主 composable 的派生选择器与交互动作
- 关键 UI 组件渲染

新增或修复行为时，优先补测试：

- `src/analytics/analysis.test.ts`
- `src/analytics/siyuan-data.test.ts`
- `src/analytics/summary-details.test.ts`
- `src/analytics/read-status.test.ts`
- `src/composables/use-analytics.test.ts`
- `src/components/*.test.ts`

### 2. 不要轻易改动的语义

以下语义已经按当前产品要求稳定下来，修改前先确认：

- 孤立文档 = 当前窗口内没有有效文档级连接
- 沉没文档 = 当前窗口不活跃，但历史可能有连接
- 文档链接/引用应包含 `refs` 与 markdown fallback 两条采集路径
- 同文档自引用不算文档级连接
- 主题文档名称取配置目录下文档标题去除前后缀后的结果
- 孤立修复建议支持追加到首段或复用同一个建议段落
- 顶部统计卡片点击后必须能联动下方详情列表
- “已读文档”按标签/标题前缀/标题后缀命中任一条件判定

### 3. 非任务范围文件

除非用户明确要求，否则不要修改：

- `plugin-sample-vite-vue/`
  - 这是样板目录，不是当前主插件实现

### 4. 构建与提交

提交前至少执行：

```bash
npm test
npm run build
```

构建后 `package.zip` 会变化，通常需要一起提交。

## 常见排查路径

### 文档链接未识别

优先检查：

1. `src/analytics/internal-links.ts` 是否支持该 markdown 格式
2. `src/analytics/siyuan-data.ts` 的 SQL 是否能把对应块扫出来
3. 目标 `block id` 是否能反查到文档根块
4. 是否被筛选条件或时间窗口排除

### 某文档被错误判定为孤立

优先检查：

1. 当前窗口内是否确实没有有效入链/出链
2. 是否被时间窗口、笔记本、标签、主题、关键词等筛选条件排除
3. 是否是同文档内自引用，这种不会算文档级连接
4. 如果刚刚撤销主题建议链接，刷新前后是否仍残留其他文档级链接

### 已读/未读统计不符合预期

优先检查：

1. `src/analytics/read-status.ts` 的命中规则
2. 设置页中的标签、标题前缀、标题后缀配置是否正确
3. `src/analytics/summary-details.ts` 中 read card 详情构造是否与卡片模式一致

### UI 统计和详情不一致

优先检查：

1. `src/App.vue` 中 `summaryCards`
2. `src/analytics/summary-details.ts` 中详情生成规则
3. `selectedSummaryCardKey` 与 `readCardMode` 的联动状态

## 当前状态备注

仓库近期已经完成：

- 文档级引用网络分析主流程
- `siyuan://blocks/...` 与 `((...))` fallback 引用识别
- 孤立/沉没定义修正
- 高传播价值节点面板
- 顶部统计卡片点击联动详情
- 顶部统计卡片拖拽排序与重置
- 主题文档修复建议
- 已读文档规则与统计卡片
- 分析层共享 helper 收敛
- `useAnalyticsState` 的纯派生逻辑与副作用控制器拆分
- `App.vue` 详情区与统计卡片区拆分为独立组件
- 设置页数据准备逻辑下沉到独立 helper

如果后续要继续增强，优先考虑：

- 传播节点的证据解释进一步细化
- 更多 markdown 内部链接格式兼容
- 更细的社区语义解释
