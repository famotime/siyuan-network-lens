# 主题路径与分析范围配置改造设计

## 目标

调整设置页中的主题文档配置方式，并新增统一的分析范围排除规则：

- 取消“主题笔记本”选项。
- “主题文档路径”改为支持输入多个包含笔记本的全路径，使用 `|` 分隔。
- 分析时，将任一配置路径下且命中主题名称前后缀规则的文档视为主题文档。
- 在设置页开头新增“分析范围”分组，支持配置多个包含笔记本的排除路径，以及名称前后缀规则。
- 命中排除路径且符合名称规则的文档不纳入分析。

## 约束

- 主题文档仍然是“配置驱动识别”，不是自动推断。
- 主题名称仍然来自文档标题去除配置前后缀后的结果。
- 排除规则应尽早生效，避免文档继续参与排行、社区、孤立、沉没、趋势、已读统计和详情联动。
- 若分析排除规则只填写路径、不填写名称前后缀，则该路径下全部文档都排除。
- 已有“已读目录”已经支持包含笔记本的全路径，这次路径语义要与其保持一致。
- LLM Wiki 相关写回位置不再依赖单独的主题笔记本配置，而是取主题文档路径中的第一个全路径作为目标笔记本和目录来源。

## 设计

### 配置

- `PluginConfig` 删除 `themeNotebookId`。
- `themeDocumentPath` 保留字段名，但其语义改为“多个包含笔记本的全路径，用 `|` 分隔”。
- 新增：
  - `analysisExcludedPaths?: string`
  - `analysisExcludedNamePrefixes?: string`
  - `analysisExcludedNameSuffixes?: string`
- `DEFAULT_CONFIG` 为上述新字段提供空字符串默认值。
- `ensureConfigDefaults` 负责把新字段归一化为空字符串。

### 兼容与迁移

- 读取旧配置时，如果存在旧的 `themeNotebookId + themeDocumentPath` 且新的 `themeDocumentPath` 还不是全路径格式，则自动迁移为单条全路径。
- 迁移时优先使用当前快照中的笔记本名称拼出 `/<notebookName><themeDocumentPath>`；若名称不可得，则退回 `/<themeNotebookId><themeDocumentPath>`。
- 迁移只用于兼容旧数据读取，不再在 UI 中暴露“主题笔记本”字段。

### 共享路径规则

- 抽出统一的 notebook-aware 路径规范化与前缀匹配工具。
- 路径规则支持以下输入格式：
  - 普通路径：`/专题`
  - 包含笔记本的全路径：`/知识库/专题`
- 规则匹配时同时考虑：
  - 文档自身的 `path`
  - 文档自身的 `hpath`
  - 带笔记本名前缀的 `path`
  - 带笔记本名前缀的 `hpath`
- 主题文档路径、分析排除路径继续使用同一套分隔与规范化逻辑，行为与“已读目录”保持一致。

### 主题文档识别

- `collectThemeDocuments` 改为支持多个主题全路径。
- 文档命中任一路径，且标题满足主题名称前缀/后缀规则时，记为主题文档。
- 若命中多个路径，仍按现有去重规则保留同一主题名的最优文档。
- LLM Wiki 页面标题仍按现有 `wikiPageSuffix` 排除，不作为主题文档。

### 分析范围排除

- 在分析入口新增排除规则判断。
- 文档满足以下条件时，从分析样本中排除：
  - 命中任一排除全路径；
  - 且标题满足排除名称前缀/后缀规则。
- 若前缀和后缀都为空，则只要命中路径即排除。
- 排除规则需要在以下链路统一生效：
  - `filterDocumentsByTimeRange`
  - `buildGraphAnalysisContext`
  - `buildTrendAnalysisContext`
  - `filteredDocuments`
  - `associationDocuments`
- 被排除文档以及与其相关的引用边都不参与后续分析结果。

### UI

- 设置页最前面新增“分析范围”分组。
- 分组内包含：
  - 排除路径输入框
  - 名称前缀输入框
  - 名称后缀输入框
- “主题文档”分组删除“主题笔记本”下拉框。
- “主题文档路径”输入框提示文案更新为“多个包含笔记本的全路径，用 `|` 分隔”。
- “分析范围”与“主题文档”字段说明都明确这是“包含笔记本的全路径”。

### LLM Wiki 写回位置

- 从 `themeDocumentPath` 中解析第一条有效全路径，拆分出目标笔记本和目录。
- 该目标用于：
  - 索引页路径
  - 日志页路径
  - 主题 wiki 页面路径
- 若第一条路径无法解析出有效笔记本与目录，则保持现有的安全失败行为，不执行写回。

## 影响范围

- `src/types/config.ts`
- `src/components/SettingPanel.vue`
- `src/components/setting-panel-data.ts`
- `src/analytics/theme-documents.ts`
- `src/analytics/read-status.ts` 或新的共享路径工具模块
- `src/analytics/analysis-context.ts`
- `src/composables/use-analytics.ts`
- `src/analytics/wiki-documents.ts`
- 相关测试文件

## 测试

- `src/types/config.test.ts`
  - 覆盖新字段默认值与归一化。
  - 覆盖旧主题配置向新全路径配置的兼容迁移。
- `src/components/SettingPanel.test.ts`
  - 覆盖“分析范围”分组渲染。
  - 覆盖主题笔记本字段已移除。
  - 覆盖新输入框提示文案。
- `src/analytics/theme-documents.test.ts`
  - 覆盖多全路径主题文档识别。
  - 覆盖跨笔记本路径匹配。
- `src/analytics/analysis.test.ts`
  - 覆盖排除路径规则会移除样本和引用边。
  - 覆盖空前后缀时路径下全部排除。
  - 覆盖配置前后缀时仅排除命名命中的文档。
- `src/composables/use-analytics.test.ts`
  - 覆盖排除规则会影响顶部统计与已读统计来源。
- `src/analytics/wiki-documents.test.ts`
  - 覆盖 Wiki 目标位置从主题路径首条全路径推导。
