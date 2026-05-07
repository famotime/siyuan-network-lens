# Wiki 增量生成 + 源文档卡片 + 冲突章节

日期：2026-05-07

## 背景

当前"生成预览"每次从零开始调用 AI 三步管线（模板诊断 → 页面规划 → 章节生成），对所有源文档做全量分析并输出完整 wiki 页面。随着源文档数量增长，全量生成的 token 消耗和等待时间不可接受。此外，用户缺乏对本次处理的原始资料的可见性和可操作性，也无法从总结中识别源文档间的观点冲突。

## 需求概要

1. **增量生成**：在"生成预览"按钮下方提供"增量生成"开关（默认开启），开启时仅将新增或变化的源文档和当前 wiki 页面输入 AI，AI 在现有总结基础上增量更新。
2. **源文档统计与卡片**：生成预览时展示本次处理的原始资料统计信息，在预览下方显示源文档卡片，提供加链接、加标签等处理建议。
3. **冲突内容章节**：在 LLM Wiki 总结框架中增加"冲突内容"章节（允许为空），AI 自动识别源文档间的矛盾观点，用数字上标标注各自来源文档 ID 链接。

## 设计

### 1. 增量生成机制

#### 1.1 UI 控件

在 `WikiMaintainPanel.vue` 的"生成预览"按钮下方增加一个 checkbox 开关，默认勾选，label 为 `t('wikiMaintain.incrementalGeneration')`。状态持久化到 `PluginConfig` 新增字段：

```typescript
wikiIncrementalEnabled: boolean // 默认 true
```

在 `DEFAULT_CONFIG` 和 `ensureConfigDefaults()` 中添加对应默认值和迁移逻辑。

#### 1.2 增量判定流程

**存储快照**：每次生成预览完成后，在 `WikiSnapshotRecord`（`aiWikiStore`）中新增字段：

```typescript
sourceDocumentTimestamps: Record<string, string>
// key = documentId, value = document.updated 时间戳
```

记录本次生成时每个源文档的 `updated` 时间戳（来自 `DocumentRecord.updated`，格式 `YYYY-MM-DDTHH:mm`）。

**对比判定**：再次生成时，读取上一次快照的 `sourceDocumentTimestamps`，与当前源文档的 `updated` 做对比：

| 条件 | deltaStatus |
|------|-------------|
| 当前存在，快照中不存在 | `new` |
| 两边都存在，`updated` 不同 | `changed` |
| 快照中存在，当前不存在 | `deleted` |
| `updated` 完全相同 | `unchanged` |

**Payload 构建**：`buildSingleThemeWikiPayload` 中，所有源文档仍包含在 payload 中（AI 需要完整上下文理解），但每个源文档增加 `deltaStatus` 标记：

```typescript
interface WikiSourceDocument {
  // ...existing fields...
  deltaStatus: 'new' | 'changed' | 'deleted' | 'unchanged'
}
```

当无缓存快照存在时（首次生成），自动切换为全量模式，所有文档标记为 `new`。

#### 1.3 AI 管线调整

三步管线基本结构不变，各步骤在增量模式下的行为调整：

**现有 wiki 页面读取**：增量模式下，AI 需要看到现有 wiki 页面内容作为参考基线。来源优先级：
1. 优先读取 `aiWikiStore` 中缓存的上一次预览结果（`WikiSnapshotRecord` 中的 rendered markdown）
2. 若缓存不存在，通过 `getFile()` 从思源文件系统读取已应用的 wiki 页面 markdown

读取到的现有页面内容作为 `existingWikiContent` 字段注入 payload。

**模板诊断（Step 1）**：增量模式下将现有 wiki 页面的模板类型和 section plan 作为参考输入附加到 payload 中，AI 可以选择保持不变或调整。

**页面规划（Step 2）**：携带现有 sectionOrder，AI 在此基础上决定是否需要增减章节（如新增 `conflict` 章节）。

**章节生成（Step 3）**：提示词中告知 AI 当前是增量更新模式，`existingWikiContent` 作为上下文传入。指令 AI：
- 保留现有内容中未被变化文档影响的部分
- 更新或补充受新增/变化文档影响的部分
- 移除已删除文档相关的引用和内容
- 输出完整的更新后章节（非片段）

#### 1.4 关键文件改动

| 文件 | 改动 |
|------|------|
| `src/types/config.ts` | `PluginConfig` 新增 `wikiIncrementalEnabled`，`DEFAULT_CONFIG` 添加默认值 |
| `src/analytics/wiki-store.ts` | `WikiSnapshotRecord` 新增 `sourceDocumentTimestamps` 字段 |
| `src/composables/use-analytics-wiki-actions.ts` | `prepareWikiPreview` 中实现增量判定逻辑，`buildSingleThemeWikiPayload` 添加 `deltaStatus` 标记 |
| `src/analytics/wiki-ai.ts` | 三步管线的提示词增加增量模式上下文注入 |
| `src/analytics/wiki-generation.ts` | payload 类型新增 `deltaStatus` 字段 |
| `src/components/WikiMaintainPanel.vue` | 新增增量生成开关 UI |

---

### 2. 源文档统计与文档卡片

#### 2.1 统计信息

在 `WikiMaintainPanel.vue` 预览区域下方新增"本次处理统计"区块，展示：

| 指标 | 条件 |
|------|------|
| 新增源文档数 | `deltaStatus === 'new'` |
| 变化源文档数 | `deltaStatus === 'changed'` |
| 无变化源文档数 | `deltaStatus === 'unchanged'` |
| 已移除源文档数 | `deltaStatus === 'deleted'` |
| 处理总耗时 | 从点击生成到预览完成的时间差 |

非增量模式（全量生成或无缓存快照）时，仅显示"源文档总数"和"处理总耗时"。

统计信息来源于 preview 结果中携带的 delta 元数据，需要在 `WikiPreviewResult` 接口中新增：

```typescript
interface WikiPreviewDeltaStats {
  newCount: number
  changedCount: number
  unchangedCount: number
  deletedCount: number
  processingTimeMs: number
}
```

#### 2.2 文档卡片

在统计区块下方，按 delta 状态分组（新增 → 变化 → 无变化 → 已移除）展示源文档卡片。

**每张卡片包含的基础信息**：
- 文档标题（可点击通过 `openSiYuanUrl` 跳转到思源文档）
- delta 状态标签（带颜色：新增=绿、变化=橙、无变化=灰、已移除=红）
- 与主题文档的关联类型标签（正链 / 反链 / 子文档）
- 文档最后更新时间

**处理建议**（复用现有机制）：

| 建议类型 | 实现方式 | 复用来源 |
|----------|----------|----------|
| 加主题链接 | 调用 `countThemeMatchesForDocument` 评估关联度，未建立链接时提供一键添加 `((themeDocId "title"))` 按钮 | `orphan-theme-links.ts` + `applyThemeLinkToOrphanDocument` |
| 加标签 | 调用 AI link suggestion 服务获取标签建议，提供一键添加按钮 | `orphan-document-tags.ts` + `applyTagToOrphanDocument` |
| 关联强度提醒 | 基于主题匹配得分，低分文档显示警告："该文档与当前主题关联较弱，建议检查是否应归入此主题" | `countThemeMatchesForDocument` 得分阈值 |
| 内容一致性提醒 | 对 `deltaStatus === 'changed'` 的文档提示"内容已变更，本次总结已更新" | delta 状态判断 |

**卡片样式**：复用 `SummaryDetailSection.vue` 中现有的列表项样式和建议按钮样式，保持视觉一致。

#### 2.3 关键文件改动

| 文件 | 改动 |
|------|------|
| `src/composables/use-analytics-wiki-actions.ts` | `prepareWikiPreview` 中计算 delta stats 和源文档元数据，附加到 preview 结果 |
| `src/components/WikiMaintainPanel.vue` | 新增统计区块和文档卡片 UI，引入建议交互 |
| `src/composables/use-analytics-interactions.ts` | 扩展现有建议控制器，支持从 wiki 源文档卡片触发建议 |
| `src/analytics/wiki-store.ts` | preview 结果中携带 delta 元数据 |
| `src/i18n/ui.ts` | 新增统计和卡片相关的 i18n key |

---

### 3. 冲突内容章节

#### 3.1 模板模型扩展

在 `WikiSectionType` 类型中新增 `'conflict'`。各模板类型的默认 `enabledModules` 中包含 `conflict`（AI 可根据实际源文档情况通过 `suppressedModules` 抑制）。

`conflict` 章节使用 `debate` 格式渲染，结构：

```markdown
## 冲突内容

- 观点A 描述 <sup>((docA "1"))</sup> <sup>((docB "2"))</sup>
- 观点B 描述 <sup>((docC "3"))</sup>
```

**允许为空**：当 AI 判断源文档间无明显矛盾时，返回空 blocks 数组，渲染时跳过该章节。

#### 3.2 AI 提示词设计

在 `wiki-ai.ts` 的 `generateThemeSection` system prompt 中，针对 `conflict` 章节类型增加专门指令：

```
When sectionType is "conflict":
- Identify genuine contradictions: opposing conclusions, mutually exclusive claims, or directly
  conflicting recommendations on the same topic across different source documents.
- Do NOT classify complementary perspectives, different angles, or progressive elaboration as conflicts.
- Each conflict entry MUST cite at least one sourceRef. Opposing sides of the same conflict MUST
  reference different source documents.
- Use the existing sourceRefs mechanism for citation (documentId + sequential number).
- If no genuine conflicts exist among the source documents, return an empty blocks array.
```

#### 3.3 渲染器处理

`renderThemeWikiDraft`（`wiki-renderer.ts`）中新增 `conflict` section 的处理逻辑：

- 当 blocks 数组为空时，不输出该章节的 markdown（不渲染空的 `## 冲突内容` 标题）
- 非空时按 `debate` 格式渲染，每个 block 的 `text` 后追加 `sourceRefs` 上标链接
- 复用现有 sourceRefs 渲染逻辑：`<sup>((docId "n"))</sup>`

#### 3.4 diff 预览

`buildWikiPreview`（`wiki-diff.ts`）中，`conflict` 章节的变化检测与其他章节一致：比较 managed area 中对应 section marker 之间的内容指纹。冲突内容变化时标记为 `affectedSections` 的一部分。

#### 3.5 关键文件改动

| 文件 | 改动 |
|------|------|
| `src/analytics/wiki-template-model.ts` | `WikiSectionType` 新增 `'conflict'`，模板默认启用 |
| `src/analytics/wiki-ai.ts` | `generateThemeSection` 提示词增加 conflict 专门指令 |
| `src/analytics/wiki-renderer.ts` | 渲染器增加 conflict section 处理（空 blocks 跳过） |
| `src/analytics/wiki-diff.ts` | diff 逻辑兼容 conflict section |
| `src/i18n/ui.ts` | 新增 conflict 章节标题的 i18n key |

---

## 三需求联动关系

增量生成、源文档卡片、冲突章节三者在实现上有依赖关系：

1. **增量生成** 为 **源文档卡片** 提供 delta 状态数据（`deltaStatus`）
2. **源文档卡片** 的统计信息依赖增量判定结果
3. **冲突章节** 独立于增量生成（全量模式也支持），但在增量模式下 AI 可以更高效地识别新增冲突

建议实现顺序：冲突章节 → 增量生成 → 源文档卡片。冲突章节改动最独立，增量生成是基础设施，源文档卡片依赖前两者。

## 涉及的关键文件总览

| 文件 | 涉及需求 |
|------|----------|
| `src/types/config.ts` | 增量生成配置 |
| `src/analytics/wiki-store.ts` | 增量快照存储 |
| `src/composables/use-analytics-wiki-actions.ts` | 增量判定 + payload 构建 + delta stats |
| `src/analytics/wiki-ai.ts` | 增量提示词 + 冲突章节提示词 |
| `src/analytics/wiki-generation.ts` | payload 类型扩展 |
| `src/analytics/wiki-template-model.ts` | 冲突章节类型 |
| `src/analytics/wiki-renderer.ts` | 冲突章节渲染 |
| `src/analytics/wiki-diff.ts` | 冲突章节 diff |
| `src/components/WikiMaintainPanel.vue` | UI 控件 + 统计 + 文档卡片 |
| `src/composables/use-analytics-interactions.ts` | 文档卡片建议交互 |
| `src/analytics/orphan-theme-links.ts` | 加主题链接（复用） |
| `src/analytics/orphan-document-tags.ts` | 加标签（复用） |
| `src/analytics/theme-documents.ts` | 主题匹配评分（复用） |
| `src/i18n/ui.ts` | 新增 i18n key |
