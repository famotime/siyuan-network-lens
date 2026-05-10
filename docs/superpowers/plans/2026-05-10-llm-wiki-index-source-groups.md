# LLM Wiki Index Source Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `LLM-Wiki-索引` 页面按入链、出链、子文档三组展开每个主题页的源文档，并保证同一文档只按优先级展示一次且可点击跳转。

**Architecture:** 复用关联范围预览阶段已有的关系类型信息，把每个主题页的源文档标题与关系类型落到 wiki 快照记录中。索引页生成时只读取快照记录并分组渲染，避免在索引页阶段重新推断关系。

**Tech Stack:** TypeScript、Vue 3、Vitest、思源块链接 markdown

---

### Task 1: 定义源文档关系类型与持久化结构

**Files:**
- Create: `src/analytics/wiki-source-docs.ts`
- Modify: `src/analytics/wiki-store.ts`
- Test: `src/analytics/wiki-store.test.ts`

- [ ] **Step 1: 写失败测试，要求 wiki store 能保存 sourceDocumentEntries 与多关系类型**

```ts
await store.savePageRecord({
  pageType: 'theme',
  pageTitle: '主题-AI-索引-llm-wiki',
  themeDocumentId: 'theme-ai',
  sourceDocumentIds: ['doc-1'],
  sourceDocumentEntries: [
    { documentId: 'doc-1', title: 'Alpha', linkTypes: ['inbound', 'outbound'] },
  ],
})

expect(record?.sourceDocumentEntries).toEqual([
  { documentId: 'doc-1', title: 'Alpha', linkTypes: ['inbound', 'outbound'] },
])
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `npm test -- src/analytics/wiki-store.test.ts`
Expected: FAIL，提示 `sourceDocumentEntries` 未持久化或未规范化。

- [ ] **Step 3: 实现共用类型与 store 规范化逻辑**

```ts
export type WikiSourceDocLinkType = 'inbound' | 'outbound' | 'child'

export interface WikiSourceDocumentEntry {
  documentId: string
  title: string
  linkTypes: WikiSourceDocLinkType[]
}
```

- [ ] **Step 4: 重新运行测试确认通过**

Run: `npm test -- src/analytics/wiki-store.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/analytics/wiki-source-docs.ts src/analytics/wiki-store.ts src/analytics/wiki-store.test.ts
git commit -m "feat: 持久化 wiki 源文档关系分组"
```

### Task 2: 让关联范围请求保留多种关系类型

**Files:**
- Modify: `src/composables/use-app-wiki-panel.ts`
- Modify: `src/composables/use-analytics-wiki.ts`
- Modify: `src/composables/use-analytics-wiki-actions.ts`
- Test: `src/composables/use-app-wiki-panel.test.ts`

- [ ] **Step 1: 写失败测试，要求请求里同一文档能同时保留多种关系类型**

```ts
expect(controller.activeWikiPreviewRequest.value?.sourceDocumentLinkTypes).toEqual(new Map([
  ['doc-b', ['outbound', 'child']],
  ['doc-c', ['inbound', 'outbound']],
]))
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `npm test -- src/composables/use-app-wiki-panel.test.ts`
Expected: FAIL，提示 `Map` 中仍是单个关系类型而不是数组。

- [ ] **Step 3: 实现请求聚合与预览态透传**

```ts
function pushLinkType(map: Map<string, WikiSourceDocLinkType[]>, documentId: string, type: WikiSourceDocLinkType) {
  const next = map.get(documentId) ?? []
  next.push(type)
  map.set(documentId, normalizeWikiSourceDocLinkTypes(next))
}
```

- [ ] **Step 4: 重新运行测试确认通过**

Run: `npm test -- src/composables/use-app-wiki-panel.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/composables/use-app-wiki-panel.ts src/composables/use-app-wiki-panel.test.ts src/composables/use-analytics-wiki.ts src/composables/use-analytics-wiki-actions.ts
git commit -m "feat: 保留 wiki 源文档多重关系类型"
```

### Task 3: 索引页按入链、出链、子文档分组去重展开源文档

**Files:**
- Modify: `src/analytics/wiki-documents.ts`
- Modify: `src/i18n/ui.ts`
- Test: `src/analytics/wiki-documents.test.ts`

- [ ] **Step 1: 写失败测试，要求索引页输出三组分层源文档并按优先级去重**

```ts
expect(indexMarkdown).toContain('  - 入链：')
expect(indexMarkdown).toContain('    - ((doc-in "Alpha In"))')
expect(indexMarkdown).toContain('  - 出链：')
expect(indexMarkdown).not.toContain('    - ((doc-shared "Shared Doc"))\n  - 子文档：\n    - ((doc-shared "Shared Doc"))')
```

- [ ] **Step 2: 运行测试确认先失败**

Run: `npm test -- src/analytics/wiki-documents.test.ts`
Expected: FAIL，索引页尚未输出分组源文档。

- [ ] **Step 3: 实现索引页分组渲染**

```ts
for (const linkType of ['inbound', 'outbound', 'child'] as const) {
  const documents = entries.filter(entry => !seen.has(entry.documentId) && entry.linkTypes.includes(linkType))
  if (!documents.length) continue
  lines.push(`  - ${label}:`)
  lines.push(...documents.map(entry => `    - ${buildDocLinkMarkdown(entry.documentId, entry.title)}`))
  documents.forEach(entry => seen.add(entry.documentId))
}
```

- [ ] **Step 4: 重新运行测试确认通过**

Run: `npm test -- src/analytics/wiki-documents.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/analytics/wiki-documents.ts src/analytics/wiki-documents.test.ts src/i18n/ui.ts
git commit -m "feat: 索引页按关系分组展开 wiki 源文档"
```

### Task 4: 全量验证

**Files:**
- Verify: `src/analytics/wiki-store.test.ts`
- Verify: `src/composables/use-app-wiki-panel.test.ts`
- Verify: `src/analytics/wiki-documents.test.ts`
- Verify: `package.zip`

- [ ] **Step 1: 运行相关单测**

Run: `npm test -- src/analytics/wiki-store.test.ts src/composables/use-app-wiki-panel.test.ts src/analytics/wiki-documents.test.ts`
Expected: PASS

- [ ] **Step 2: 运行全量测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 运行构建**

Run: `npm run build`
Expected: PASS，并更新根目录 `package.zip`

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/plans/2026-05-10-llm-wiki-index-source-groups.md package.zip
git commit -m "docs: 补充 wiki 索引源文档分组实现计划"
```
