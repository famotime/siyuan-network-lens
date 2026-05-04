# 文档索引与 LLM-Wiki 中间层重构方案

本文基于当前项目目标，重新审视“文档索引”能力的定位，并将方案从“给用户看的摘要页”收敛为“服务 LLM Wiki 的后台中间层”。

新的核心判断是：

- 文档索引主要不是给用户看的功能，而是开发期可观察、可调试的后台产物。
- 最终用户主要看到的是后续生成的 LLM Wiki，而不是单篇文档索引。
- 文档索引的首要目标不是“读起来顺”，而是“忠于原文、可被后续 AI 继续归纳、可批量重建”。

基于这一判断，本文将原方案统一收束为一条更清晰的链路：

`证据块 -> 原文命题 -> 单文档底稿 -> 主题归纳 Wiki`

## 1. 背景与问题

当前项目中的 `ai-document-index.json` 还带有明显的“摘要页”思路，主要问题有：

- `semanticProfiles` 同时承载正文摘要索引和 AI 补链沉淀结果，语义边界不清。
- 现有“摘要 / 详细摘要 / 关键片段”命名偏用户阅读语境，不适合做后台中间层。
- “详细摘要”容易写成概述性评价，而不是贴近原文观点、方法和事实的稳定底稿。
- “关键片段”只有纯文本，没有块级定位，无法稳定回到原文，也不适合作为后续 AI 的证据层。
- 向量嵌入当前没有实际业务价值，却仍占据配置、结构和实现复杂度。
- LLM Wiki 虽然已部分复用文档索引，但索引本身还不是一个足够稳定、足够机器可消费的中间层。

如果继续沿着“单篇摘要页”的思路优化，最终很容易把系统做成“摘要再摘要器”；这不符合“脉络镜”当前的产品目标。项目真正需要的是：

- 忠于原文的单文档底稿
- 可被主题级 AI 再次吸收和归纳的结构化内容
- 可通过原文块验证的证据层

## 2. 重新定位

## 2.1 文档索引的真实职责

文档索引在本项目中的职责，不是给用户单独阅读，而是为后续 LLM Wiki 生成提供稳定输入。

因此，它应该满足这几个条件：

- 单文档稳定：不依赖当前主题、社区、筛选条件。
- 忠于原文：尽量减少评价式转述和抽象发挥。
- 机器可消费：更像结构化底稿，而不是面向人的成文摘要。
- 可重建：索引是派生数据，旧版本可以直接删除后重建。

## 2.2 LLM Wiki 的真实职责

LLM Wiki 的职责才是把多篇单文档底稿进一步归纳成主题级知识页。

因此，职责应明确分层：

- 文档索引层：负责忠于原文地编译单篇文档。
- LLM Wiki 层：负责围绕主题做跨文档总结、归纳、整合和组织。

两层都调用 AI，但处理目标不同。

## 2.3 补链能力的定位

AI 补链不是正文索引的一部分，它属于任务层语义结果。

建议统一命名：

- 内部代码：`linkRepairProfile`
- 中文文档：`补链语义档案`

它适合承载：

- 推荐目标页
- 推荐标签
- 推荐理由
- 补链缓存

不适合承载：

- 正文摘要
- 主题总结输入
- 其他插件复用的文档底稿

## 3. 目标与非目标

## 3.1 目标

- 将正文索引与补链语义档案彻底分开。
- 将“文档索引”重构为服务 LLM Wiki 的后台中间层。
- 用“证据块 + 原文命题”的方式代替“摘要 + 详细摘要”的旧思路。
- 让 LLM Wiki 始终基于文档索引工作；索引缺失时先补索引，再基于索引生成 Wiki。
- 将“查看文档索引”保留为开发期调试入口，后续可对普通用户隐藏。
- 暂不考虑向量嵌入，直接移除相关代码和配置。
- 由于当前仍在开发阶段，不考虑兼容性和迁移；旧索引发现为旧版时直接删除并重建。

## 3.2 非目标

- 当前阶段不做全文向量检索系统。
- 当前阶段不做独立 RAG 服务。
- 当前阶段不做多主题上下文的动态单文档索引。
- 当前阶段不追求索引覆盖所有复杂文档类型。

## 4. 方向比较

### 方案 A：摘要优先索引

做法：

- 每篇文档保留一句话摘要、长摘要、关键词和若干片段。
- 后续 LLM Wiki 再基于这些摘要继续总结。

优点：

- 最容易理解和实现。

缺点：

- 很容易变成“摘要再摘要”。
- 长摘要天然会混入评价和抽象发挥。
- 对你最在意的“忠于原文”保护不够。

结论：

不推荐。

### 方案 B：命题索引

做法：

- 先筛高价值原文块。
- 再从这些原文块中抽取“原文命题”。
- 每条命题绑定对应 block id。
- 最终形成单文档稳定底稿，供 LLM Wiki 继续归纳。

优点：

- 最符合当前项目目标。
- 最有利于控制“偏离原文”。
- 更适合作为后续 AI 的结构化输入。

缺点：

- prompt 约束和测试要求更高。
- 需要补块级证据读取与校验链路。

结论：

推荐采用。

### 方案 C：原文块仓库

做法：

- 弱化单文档命题层。
- 主要保存大量原文块。
- LLM Wiki 直接在原文块层面做主题总结。

优点：

- 最忠于原文。

缺点：

- 成本更高。
- 噪声更多。
- 单篇文档索引会退化成原文缓存，而不是可消费底稿。

结论：

不推荐作为主方向。

## 5. 推荐总方案

推荐采用方案 B，并将整套能力理解为“文档证据编译链”。

一句话概括：

`文档索引不是摘要页，而是由证据块和原文命题构成的单文档底稿；LLM Wiki 再基于这些底稿做主题归纳。`

## 6. 核心链路

推荐的完整链路如下：

1. 从文档中筛选高价值原文块。
2. 基于这些原文块抽取原文命题。
3. 形成单文档稳定底稿。
4. 将多篇底稿输送给 AI，生成主题级 LLM Wiki。

这条链路比“摘要 -> 要点 -> Wiki”更适合当前项目，因为它把“忠于原文”前置成系统结构，而不是事后靠 prompt 修补。

## 7. 数据模型重构

## 7.1 正文索引存储

保留文件名：

```ts
ai-document-index.json
```

但语义上将其改造成只承载单文档稳定底稿。

建议结构：

```ts
interface AiDocumentIndexSnapshotV3 {
  schemaVersion: 3
  documentProfiles: Record<string, DocumentIndexProfile>
}

interface DocumentIndexProfile {
  documentId: string
  sourceUpdatedAt: string
  sourceHash: string
  title: string
  path: string
  hpath: string
  tagsJson: string
  positioning: string
  propositionsJson: string
  keywordsJson: string
  primarySourceBlocksJson: string
  secondarySourceBlocksJson: string
  generatedAt: string
}

interface PropositionItem {
  text: string
  sourceBlockIds: string[]
}

interface SourceBlockItem {
  blockId: string
  text: string
}
```

字段说明：

- `positioning`
  - 单句定位这篇文档在讲什么。
  - 只负责入口说明，不负责评价，不负责主题归纳。
- `propositionsJson`
  - 单文档主索引层。
  - 每条是“原文命题”，而不是漂亮摘要。
  - 每条必须绑定至少一个 `sourceBlockId`。
- `keywordsJson`
  - 次级辅助字段。
  - 仅服务检索和下游 prompt 补充，不是主结构。
- `primarySourceBlocksJson`
  - 核心证据块。
  - 明确支撑主要命题。
- `secondarySourceBlocksJson`
  - 补充证据块。
  - 提供边界、例子、背景和延伸内容。

## 7.2 补链语义档案存储

新增独立文件：

```ts
ai-link-repair-store.json
```

建议结构：

```ts
interface AiLinkRepairStoreSnapshot {
  schemaVersion: 1
  repairProfiles: Record<string, LinkRepairProfile>
  suggestionCache: Record<string, LinkRepairSuggestionCache>
}

interface LinkRepairProfile {
  documentId: string
  sourceUpdatedAt: string
  sourceHash: string
  modelVersion: string
  summary: string
  candidateTargetsJson: string
  roleHintsJson: string
  tagSuggestionsJson: string
  evidenceJson: string
  updatedAt: string
}

interface LinkRepairSuggestionCache {
  sourceDocumentId: string
  cacheKey: string
  modelVersion: string
  suggestionsJson: string
  createdAt: string
}
```

说明：

- 这部分只服务 AI 补链。
- 不再与正文索引共享记录结构。
- 不再作为 LLM Wiki 的默认输入。

## 8. 索引生成原则

索引生成不应再被理解为“让 AI 总结文档”，而应理解为“让 AI 抽取原文命题并绑定证据”。

推荐遵守以下原则：

1. `positioning` 只回答“这篇文档是什么”。
2. `propositions` 是主体，而且每条都必须是原文可支持的命题。
3. 每条命题必须绑定有效 `sourceBlockIds`，没有证据锚点的命题不进入索引。
4. `primarySourceBlocks` 和 `secondarySourceBlocks` 是第二主输入层，不是附录。
5. 索引阶段不写主题归属、结构角色、补链建议和行动建议。
6. 索引应尽量独立于当前筛选器、主题配置和社区结果，保持单文档稳定底稿属性。

## 8.1 反偏移约束

建议在 prompt 和校验中明确禁止以下内容进入 `propositions`：

- “这篇文章介绍了……”
- “作者讨论了……”
- “文中强调了……”
- “这是一篇关于……的总结”
- “很有启发”“很系统”“适合作为入门材料”这类评价性表述
- 没有证据块支持的上位概括

换句话说，`propositions` 必须更接近“命题清单”，而不是评价和“摘要段落”。

## 8.2 关键内容的正确理解

如果开发期仍需要在调试界面展示 `propositions`，可以把它显示成“关键内容”，但内部设计不应再围绕 `keyContent` 这个概念思考。

更准确的内部视角是：

- 外部调试名称：关键内容
- 内部真实语义：原文命题集合

## 9. 原文块选取策略

既然 LLM Wiki 阶段希望看到大量原文片段，那么“原文片段”就不只是辅助证据，而是索引中的第二主输入层。

### 9.1 候选块过滤

建议先规则化排除低价值块：

- 空块
- 纯格式块
- 目录型块
- 只有链接没有正文的块
- 明显的寒暄、转场、广告、来源说明
- 信息量很低的碎片块

### 9.2 证据块分层

不要把所有块都视为同一层。

建议分成：

- `primarySourceBlocks`
  - 明确支撑核心命题的块
- `secondarySourceBlocks`
  - 补充背景、边界、例子和上下文的块

这样后续 LLM Wiki 可以先读主证据，再读补充证据，减少噪声干扰。

### 9.3 先块后命题

推荐生成顺序不是“先写命题，再找证据”，而是：

1. 先选证据块
2. 再基于证据块抽取命题
3. 再把命题反向绑定到块 id

这样更有利于控制“命题漂移”和“摘要化表达”。

## 10. LLM Wiki 如何消费索引

## 10.1 总原则

LLM Wiki 始终基于文档索引工作。

固定规则：

- Wiki 生成阶段只消费正文索引
- 如果索引缺失，则先生成索引
- 索引补齐后，再基于索引生成 Wiki
- Wiki 流程本身不直接读取原文全文

## 10.2 三段式输入结构

为了避免模型把多篇文档直接熬成一层泛泛综述，建议给 Wiki AI 的输入按三段组织，而不是简单打平字段。

### 第一段：来源地图

每篇文档先提供：

- 标题
- `positioning`
- 标签、路径、更新时间等基础元信息

作用：

- 先让模型建立主题内文档分布感。

### 第二段：命题层

再按文档分组提供 `propositions`，不要先打平成主题级大列表。

作用：

- 让模型先理解“每篇文档各自讲了什么”，再做跨文档归纳。
- 减少把不同文档里的判断过早揉平的风险。

### 第三段：证据层

最后提供 `primarySourceBlocks` 和 `secondarySourceBlocks`。

作用：

- 给主题级总结提供原文锚点。
- 让模型在需要时回落到原文证据，而不是只停留在命题层。

## 10.3 不直接拼接索引生成 Wiki

Wiki 不是把多份单文档索引拼成静态页面，而是把这些底稿再交给 AI 做主题级归纳。

但这种“再总结”不能退化成泛泛综述，因此 prompt 还应加两条强约束：

- 不允许提前抹平差异
- 不允许把边缘命题硬写成主题共识

必要时，Wiki 页面中应保留一块“待归并观点 / 零散但相关命题”，而不是把所有内容都塞进主综述。

## 11. 开发期调试入口

当前“查看文档索引”通过设置页开关控制，这个机制仍然合理，但应明确定位为开发期调试能力。

建议：

- 开发期保留
- 未来普通用户默认不可见
- 主要用于快速检查：
  - 证据块选得是否准确
  - 命题是否忠于原文
  - 命题和块绑定是否稳定
  - 索引是否适合继续喂给 LLM Wiki

换句话说，它更像后台观察窗口，不是正式用户功能。

## 12. 向量嵌入处理

当前阶段不考虑向量嵌入。

建议直接执行：

- 删除 embedding 相关代码
- 从索引结构中移除 embedding 字段
- 从设置页中移除向量模型相关配置项
- 不保留占位或“以后可能会用”的兼容残留

原因：

- 当前没有明确下游收益
- 反而增加理解和维护成本
- 与当前“忠于原文的证据编译链”主目标无关

## 13. 旧索引处理策略

当前仍处于开发阶段，不考虑兼容性和迁移。

建议规则：

- 如果检测到当前索引仍是旧版结构，直接删除旧索引并重建
- 不做旧版字段迁移
- 不保留旧的补链字段兼容读取

原因：

- 旧结构本身语义就不干净
- 继续迁移只会把历史混乱带进新方案
- 当前阶段重建成本可接受，且结果更稳定

## 14. 代码层改造点

建议按以下模块推进：

- `src/analytics/ai-index-store.ts`
  - 收口为正文索引 store，去除补链职责
- 新增 `src/analytics/ai-link-repair-store.ts`
  - 承载补链语义档案与建议缓存
- `src/analytics/ai-document-summary.ts`
  - 重构为“证据块 -> 原文命题 -> 单文档底稿”生成链路
- 新增 `src/analytics/document-index-source-blocks.ts`
  - 读取文档块候选
  - 过滤低价值块
  - 输出主证据块和补充证据块
- `src/types/config.ts`
  - 删除向量模型相关配置项
- `src/components/SettingPanel.vue`
  - 删除向量模型相关设置项
- `src/composables/use-analytics.ts`
  - 调整开发期索引查看逻辑，按命题和块展示调试视图
  - 去除补链字段 fallback
- `src/composables/use-analytics-wiki.ts`
  - 明确只依赖正文索引作为唯一输入来源
  - 索引缺失时先补索引
- `src/analytics/wiki-generation.ts`
  - 改成消费 `positioning + propositions + primarySourceBlocks + secondarySourceBlocks + metadata`
- `docs/其他插件读取 AI 索引指南.md`
  - 按新 schema 重写说明

## 15. 测试建议

至少补这些测试：

- 正文索引与补链语义档案彻底分离
- 索引查看页不再回退到补链字段
- `positioning` 为中性定位句，不混入评价
- `propositions` 贴近原文观点与事实，而不是评价式概述
- 每条 proposition 至少绑定一个有效 block id
- `primarySourceBlocks` 和 `secondarySourceBlocks` 分层正确
- block 丢失时对应原文片段被丢弃
- LLM Wiki 始终只基于正文索引生成，索引缺失时先补索引
- 旧版索引被直接删除并可重建

## 16. 推荐实施顺序

### Phase 1：语义拆分与基础重构

- 拆分正文索引和补链语义档案存储
- 移除 embedding 相关代码与设置
- 旧版索引直接删除并重建

### Phase 2：证据编译链

- 增加文档块候选读取与过滤
- 增加主证据块 / 补充证据块分层
- 改造索引生成逻辑为“先块后命题”

### Phase 3：后台调试视图

- 将“查看文档索引”调整为开发期调试视图
- 重点展示：定位句、原文命题、原文块嵌入

### Phase 4：LLM Wiki 索引驱动化

- Wiki payload 只读正文索引
- 索引缺失时先补索引，再进入 Wiki 生成
- 优化主题级 prompt，使其先归纳、再整合、再保留差异

### Phase 5：索引质量优化

- 继续优化 proposition 的原文贴合度
- 继续优化证据块选取质量
- 优化基于索引的主题 Wiki 生成效果

## 17. 最终效果预期

完成后，项目中的三层语义边界将变得清晰：

1. 正文索引
   - 描述单篇文档本身
   - 由证据块和原文命题构成
2. 补链语义档案
   - 描述任务层判断
3. LLM Wiki
   - 基于多篇单文档底稿做主题归纳

最终系统更接近“知识编译器”，而不是“摘要器”：

- 单文档层先忠于原文
- 主题层再做归纳整合
- 用户最终主要看到主题 Wiki，而不是中间层索引页

这更符合“脉络镜”当前的产品方向：

`不是做一个更会总结的阅读器，而是做一个更能支持知识结构整理与知识编译的工具。`
