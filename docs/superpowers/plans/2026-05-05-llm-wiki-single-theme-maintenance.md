# LLM Wiki Single-Theme Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LLM Wiki 维护改为仅围绕当前主题文档生成单个 Wiki 页，并把预览顶部统计卡片替换为单页生成摘要。

**Architecture:** 预览链路不再走多主题 `buildWikiScope -> buildWikiGenerationPayloads` 归类流程，而是基于 `themeDocumentId` 直接构造单个主题 payload。新的预览摘要直接从单页 draft 和已有页面内容推导，界面只消费单页统计结果。写回层保持兼容，继续接收单个 `themePages` 数组项和旧版日志摘要字段。

**Tech Stack:** Vue 3, TypeScript, Vitest, SiYuan plugin APIs

---

### Task 1: 锁定单主题预览主链路

**Files:**
- Modify: `src/composables/use-analytics.test.ts`
- Modify: `src/composables/use-analytics.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('builds wiki preview only for the requested theme document and its deduplicated related documents', async () => {
  await (state as any).prepareWikiPreview({
    sourceDocumentIds: ['doc-theme-ai', 'doc-a', 'doc-b', 'doc-a'],
    themeDocumentId: 'doc-theme-ai',
    scopeDescriptionLine: '- 范围来源：主题《AI》关联范围',
  })

  expect((state as any).wikiPreview.value.themePages).toHaveLength(1)
  expect((state as any).wikiPreview.value.themePages[0].themeDocumentId).toBe('doc-theme-ai')
  expect((state as any).wikiPreview.value.scope.summary).toEqual(expect.objectContaining({
    sourceDocumentCount: 3,
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/composables/use-analytics.test.ts`
Expected: FAIL，因为当前实现仍会走多主题作用域或摘要结构不匹配。

- [ ] **Step 3: Write minimal implementation**

```ts
if (!request?.themeDocumentId) {
  throw new Error(t('analytics.controller.wikiThemeDocumentRequired'))
}

const themeDocument = themeDocuments.value.find(document => document.documentId === request.themeDocumentId)
if (!themeDocument) {
  throw new Error(t('analytics.controller.wikiThemeDocumentNotFound'))
}

const sourceDocuments = deduplicateById(resolveWikiScopeDocuments(...))
const payload = buildSingleThemeWikiPayload({
  themeDocument,
  sourceDocuments,
  ...
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/composables/use-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-analytics.test.ts src/composables/use-analytics.ts
git commit -m "feat: scope wiki preview to current theme"
```

### Task 2: 锁定新统计摘要辅助函数

**Files:**
- Modify: `src/composables/use-analytics-wiki.test.ts`
- Modify: `src/composables/use-analytics-wiki.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('counts generated sections, document refs, and manual note paragraphs for a theme wiki page', () => {
  expect(buildWikiPreviewSummary({
    sourceDocumentCount: 3,
    draft: {
      sectionMetadata: [
        { key: 'meta', heading: '页面头信息', markdown: '...' },
        { key: 'intro', heading: '主题概览', markdown: '说明 ((doc-a "1"))' },
        { key: 'sources', heading: '关系证据', markdown: '- ((doc-b "B")) - 证据' },
      ],
      managedMarkdown: '',
      fullMarkdown: '',
    },
    existingFullMarkdown: [
      '# 页',
      '',
      '## 人工备注',
      '',
      '第一段',
      '',
      '第二段',
    ].join('\n'),
  })).toEqual({
    sourceDocumentCount: 3,
    generatedSectionCount: 2,
    referenceCount: 2,
    manualNotesParagraphCount: 2,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/composables/use-analytics-wiki.test.ts`
Expected: FAIL，因为辅助函数尚不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildWikiPreviewSummary(...) {
  return {
    sourceDocumentCount,
    generatedSectionCount: countGeneratedSections(draft),
    referenceCount: countDocumentRefs(draft.managedMarkdown),
    manualNotesParagraphCount: countManualNotesParagraphs(existingFullMarkdown),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/composables/use-analytics-wiki.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-analytics-wiki.test.ts src/composables/use-analytics-wiki.ts
git commit -m "feat: add wiki preview summary metrics"
```

### Task 3: 更新面板卡片与 tooltip

**Files:**
- Modify: `src/components/WikiMaintainPanel.test.ts`
- Modify: `src/components/WikiMaintainPanel.vue`
- Modify: `src/i18n/ui.ts`

- [ ] **Step 1: Write the failing test**

```ts
expect(html).toContain('Source documents')
expect(html).toContain('Generated sections')
expect(html).toContain('Linked references')
expect(html).toContain('Manual notes')
expect(html).toContain('title="Deduplicated related documents included in this wiki run"')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/WikiMaintainPanel.test.ts`
Expected: FAIL，因为当前仍渲染旧卡片与旧文案。

- [ ] **Step 3: Write minimal implementation**

```vue
<div class="wiki-panel__scope-grid">
  <div class="wiki-panel__scope-card" :title="t('wikiMaintain.sourceDocumentsTooltip')">
    <span>{{ t('wikiMaintain.sourceDocuments') }}</span>
    <strong>{{ preview.scope.summary.sourceDocumentCount }}</strong>
  </div>
</div>
```

```css
.wiki-panel__scope-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/WikiMaintainPanel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WikiMaintainPanel.test.ts src/components/WikiMaintainPanel.vue src/i18n/ui.ts
git commit -m "feat: refresh wiki preview summary cards"
```

### Task 4: 全量验证受影响链路

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/composables/use-analytics.test.ts src/composables/use-analytics-wiki.test.ts src/components/WikiMaintainPanel.test.ts src/analytics/wiki-documents.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS，并更新 `package.zip`

- [ ] **Step 4: Commit verification-safe result**

```bash
git add package.zip
git commit -m "build: refresh package after wiki maintenance changes"
```
