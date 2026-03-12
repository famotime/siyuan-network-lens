# AGENTS.md

## 项目概览

这是一个思源笔记插件项目，名称是“引用网络分析器（Reference Analytics）”。

当前目标不是做图谱渲染，而是做“文档级引用网络”的结构分析与整理辅助。核心输出包括：

- 文档级引用热度排行
- 主题社区发现
- 孤立文档、沉没文档、桥接节点识别
- 时间趋势分析
- 关系传播路径
- 高传播价值节点
- 原始引用证据查看
- 可操作建议
- 顶部统计卡片点击后的详情联动

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

关键实现位于：

- `src/analytics/siyuan-data.ts`
- `src/analytics/internal-links.ts`

如果后续出现“文档里明明有链接/引用但没识别”的问题，优先检查这两层。

### 3. 孤立文档定义

当前“孤立文档”的定义不是“当前窗口内没连接”，而是：

- 历史上从未形成过任何文档级入链/出链

因此：

- 只要文档中包含链接或引用
- 或者有其他文档指向它

它就不应被视为孤立文档。

“沉没文档”才是：

- 当前窗口没有有效连接
- 但历史上可能有连接

关键实现位于：

- `src/analytics/analysis.ts`

### 4. 传播节点定义

“高传播价值节点”当前采用可解释的启发式口径：

- 先取核心文档、桥接节点、社区 hub 文档作为焦点集合
- 再统计哪些中间文档高频出现在这些焦点之间的最短路径上

这不是严格的图论 betweenness centrality，而是面向产品交互的轻量替代实现。

### 5. 顶部统计卡片

顶部统计卡片当前已支持点击，并在下方展示对应文档详情列表。详情中的文档标题可直接打开文档。

相关代码：

- `src/App.vue`
- `src/analytics/summary-details.ts`

## 关键目录

- `src/App.vue`
  - 主界面，包含筛选器、统计卡片、各分析面板、详情联动
- `src/analytics/analysis.ts`
  - 核心分析逻辑
- `src/analytics/siyuan-data.ts`
  - 从思源数据库读取文档与引用快照
- `src/analytics/internal-links.ts`
  - markdown 中 `siyuan://blocks/...` 和 `((...))` fallback 解析
- `src/analytics/summary-details.ts`
  - 顶部统计卡片对应的详情列表生成逻辑
- `src/analytics/*.test.ts`
  - 当前主要测试覆盖点
- `docs/思源笔记插件_PRD_引用网络分析器_Reference_Analytics.md`
  - 原始 PRD
- `docs/思源笔记插件_引用网络分析器_PRD差距清单.md`
  - 当前差距收敛记录，按最新实现已完成本轮清单
- /reference_docs
  - 思源笔记插件开发者文档，包括相关API接口说明和示例


## 开发约定

### 1. 修改前优先看测试

当前已有测试覆盖这些关键场景：

- 图分析结果
- 趋势分析
- markdown fallback 引用采集
- 顶部统计卡片详情生成

新增或修复行为时，优先补测试：

- `src/analytics/analysis.test.ts`
- `src/analytics/siyuan-data.test.ts`
- `src/analytics/summary-details.test.ts`

### 2. 不要轻易改动的语义

以下语义已经按当前产品要求稳定下来，修改前先确认：

- 孤立文档 = 历史上从未形成过文档级连接
- 沉没文档 = 当前窗口不活跃，但历史可能有连接
- 文档链接/引用应包含 `refs` 与 markdown fallback 两条采集路径
- 顶部统计卡片点击后必须能联动下方详情列表

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

1. 该文档的历史入链/出链是否已进入 `ReferenceRecord`
2. 是否只是“当前窗口无连接”，实际应归类为沉没文档
3. 是否是同文档内自引用，这种不会算文档级连接

### UI 统计和详情不一致

优先检查：

1. `src/App.vue` 中 `summaryCards`
2. `src/analytics/summary-details.ts` 中详情生成规则
3. `selectedSummaryCardKey` 的联动状态

## 当前状态备注

仓库近期已经完成：

- PRD 差距清单本轮开发项
- `siyuan://blocks/...` 与 `((...))` fallback 引用识别
- 孤立/沉没定义修正
- 高传播价值节点面板
- 顶部统计卡片可点击详情

如果后续要继续增强，优先考虑：

- 传播节点的证据解释进一步细化
- 更多链接格式兼容
- 更细的社区语义解释
