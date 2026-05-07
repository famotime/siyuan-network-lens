# Wiki Incremental Generation + Source Doc Cards + Conflict Section

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add incremental wiki generation (timestamp-based diff), source document processing stats and actionable cards, and a conflict content section to the LLM Wiki pipeline.

**Architecture:** Three independent feature groups layered on the existing wiki pipeline. Conflict section extends the template model and renderer. Incremental generation adds timestamp comparison against cached snapshots and injects delta metadata into payloads. Source doc cards display delta stats and reuse orphan suggestion mechanisms.

**Tech Stack:** TypeScript, Vue 3 (Composition API), Vitest, SiYuan Plugin SDK

---

## File Structure

### Files to modify

| File | Responsibility |
|------|---------------|
| `src/analytics/wiki-template-model.ts` | Add `'conflict'` to `WIKI_OPTIONAL_SECTION_TYPES` |
| `src/analytics/wiki-ai.ts` | Conflict-specific prompt for `generateThemeSection`; incremental mode context injection |
| `src/analytics/wiki-renderer.ts` | Skip rendering sections with empty blocks (conflict) |
| `src/analytics/wiki-diff.ts` | Update `WikiPagePreviewResult` to carry delta stats |
| `src/analytics/wiki-store.ts` | Add `sourceDocumentTimestamps` to `WikiPageSnapshotRecord` |
| `src/analytics/wiki-generation.ts` | Add `deltaStatus` to `WikiBundleDocumentItem` |
| `src/composables/use-analytics-wiki.ts` | Add `WikiPreviewDeltaStats`, `WikiPreviewSourceDocMeta` to state types |
| `src/composables/use-analytics-wiki-actions.ts` | Incremental diff logic, timestamp storage, `existingWikiContent` injection |
| `src/components/WikiMaintainPanel.vue` | Incremental toggle, delta stats grid, source doc cards |
| `src/types/config.ts` | Add `wikiIncrementalEnabled` |
| `src/i18n/ui.ts` | New i18n keys for all three features |
| `src/composables/use-analytics-interactions.ts` | Wiki source doc suggestion controller |

### Test files

| File | Tests |
|------|-------|
| `src/analytics/wiki-template-model.test.ts` | Update type assertion and constant expectations for `'conflict'` |
| `src/analytics/wiki-renderer.test.ts` | Conflict section: empty blocks skipped, non-empty rendered with debate format |
| `src/analytics/wiki-ai.test.ts` | Conflict prompt injected for conflict sectionType |
| `src/analytics/wiki-diff.test.ts` | Delta stats in preview result |
| `src/analytics/wiki-store.test.ts` | `sourceDocumentTimestamps` round-trip |

---

### Task 1: Add `conflict` to wiki template model

**Files:**
- Modify: `src/analytics/wiki-template-model.ts:12-30`
- Test: `src/analytics/wiki-template-model.test.ts`

- [ ] **Step 1: Write the failing test**

Update the constant expectation in `src/analytics/wiki-template-model.test.ts`:

```typescript
// In the 'exposes stable template and section type constants' test:
expect(WIKI_OPTIONAL_SECTION_TYPES).toEqual([
  'core_principles',
  'method_path',
  'use_cases',
  'basic_steps',
  'advanced_usage',
  'faq',
  'troubleshooting',
  'viewpoints',
  'controversies',
  'open_questions',
  'cases',
  'impacts',
  'work_map',
  'representative_works',
  'reading_order',
  'comparison',
  'misunderstandings',
  'conflict',
])

expect(WIKI_SECTION_TYPES).toEqual([
  'intro',
  'highlights',
  'sources',
  'core_principles',
  'method_path',
  'use_cases',
  'basic_steps',
  'advanced_usage',
  'faq',
  'troubleshooting',
  'viewpoints',
  'controversies',
  'open_questions',
  'cases',
  'impacts',
  'work_map',
  'representative_works',
  'reading_order',
  'comparison',
  'misunderstandings',
  'conflict',
])
```

Also update the `WikiOptionalSectionType` type assertion to include `'conflict'`:

```typescript
expectTypeOf<WikiOptionalSectionType>().toEqualTypeOf<
  | 'core_principles'
  | 'method_path'
  | 'use_cases'
  | 'basic_steps'
  | 'advanced_usage'
  | 'faq'
  | 'troubleshooting'
  | 'viewpoints'
  | 'controversies'
  | 'open_questions'
  | 'cases'
  | 'impacts'
  | 'work_map'
  | 'representative_works'
  | 'reading_order'
  | 'comparison'
  | 'misunderstandings'
  | 'conflict'
>()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analytics/wiki-template-model.test.ts`
Expected: FAIL — `WIKI_OPTIONAL_SECTION_TYPES` does not include `'conflict'`

- [ ] **Step 3: Implement**

In `src/analytics/wiki-template-model.ts`, add `'conflict'` to `WIKI_OPTIONAL_SECTION_TYPES`:

```typescript
export const WIKI_OPTIONAL_SECTION_TYPES = [
  'core_principles',
  'method_path',
  'use_cases',
  'basic_steps',
  'advanced_usage',
  'faq',
  'troubleshooting',
  'viewpoints',
  'controversies',
  'open_questions',
  'cases',
  'impacts',
  'work_map',
  'representative_works',
  'reading_order',
  'comparison',
  'misunderstandings',
  'conflict',
] as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/analytics/wiki-template-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-template-model.ts src/analytics/wiki-template-model.test.ts
git commit -m "feat: 冲突章节类型添加到 wiki 模板模型"
```

---

### Task 2: Add i18n keys for all three features

**Files:**
- Modify: `src/i18n/ui.ts`

- [ ] **Step 1: Implement**

In `src/i18n/ui.ts`, add the following keys inside the `wikiMaintain` section (after the existing keys around line 1318):

```typescript
incrementalGeneration: {
  en_US: 'Incremental generation',
  zh_CN: '增量生成',
},
deltaStatsTitle: {
  en_US: 'Processing statistics',
  zh_CN: '本次处理统计',
},
deltaNewCount: {
  en_US: 'New documents',
  zh_CN: '新增文档',
},
deltaChangedCount: {
  en_US: 'Changed documents',
  zh_CN: '变化文档',
},
deltaUnchangedCount: {
  en_US: 'Unchanged documents',
  zh_CN: '无变化文档',
},
deltaDeletedCount: {
  en_US: 'Removed documents',
  zh_CN: '已移除文档',
},
processingTime: {
  en_US: 'Processing time',
  zh_CN: '处理耗时',
},
sourceDocTotalCount: {
  en_US: 'Total source documents',
  zh_CN: '源文档总数',
},
sourceDocCardsTitle: {
  en_US: 'Source documents',
  zh_CN: '原始资料文档',
},
deltaStatusNew: {
  en_US: 'New',
  zh_CN: '新增',
},
deltaStatusChanged: {
  en_US: 'Changed',
  zh_CN: '变化',
},
deltaStatusUnchanged: {
  en_US: 'Unchanged',
  zh_CN: '无变化',
},
deltaStatusDeleted: {
  en_US: 'Removed',
  zh_CN: '已移除',
},
linkTypeOutbound: {
  en_US: 'Forward link',
  zh_CN: '正链',
},
linkTypeInbound: {
  en_US: 'Backlink',
  zh_CN: '反链',
},
linkTypeChild: {
  en_US: 'Child doc',
  zh_CN: '子文档',
},
addThemeLink: {
  en_US: 'Add theme link',
  zh_CN: '加主题链接',
},
addTag: {
  en_US: 'Add tag',
  zh_CN: '加标签',
},
weakAssociationWarning: {
  en_US: 'Weak association with current theme',
  zh_CN: '与当前主题关联较弱',
},
contentChangedNotice: {
  en_US: 'Content changed, summary updated',
  zh_CN: '内容已变更，本次总结已更新',
},
conflictSectionTitle: {
  en_US: 'Conflicting viewpoints',
  zh_CN: '冲突内容',
},
```

Also add keys inside the `analytics.wiki` section for the AI prompt:

```typescript
conflictSectionPrompt: {
  en_US: [
    'When sectionType is "conflict":',
    '- Identify genuine contradictions: opposing conclusions, mutually exclusive claims, or directly conflicting recommendations on the same topic across different source documents.',
    '- Do NOT classify complementary perspectives, different angles, or progressive elaboration as conflicts.',
    '- Each conflict entry MUST cite at least one sourceRef. Opposing sides of the same conflict MUST reference different source documents.',
    '- Use the existing sourceRefs mechanism for citation (documentId + sequential number).',
    '- If no genuine conflicts exist among the source documents, return an empty blocks array.',
  ].join(' '),
  zh_CN: [
    '当 sectionType 为 "conflict" 时：',
    '- 识别真正的矛盾：同一主题下不同源文档中的对立结论、互斥主张或直接冲突的建议。',
    '- 不要将互补视角、不同角度或递进阐述误判为冲突。',
    '- 每个冲突条目必须引用至少一个 sourceRef。同一冲突的对立双方必须引用不同的源文档。',
    '- 使用现有 sourceRefs 机制进行引用（documentId + 序号）。',
    '- 如果源文档间不存在真正的冲突，返回空的 blocks 数组。',
  ].join(' '),
},
incrementalModePrompt: {
  en_US: 'You are in incremental update mode. The existing wiki page content is provided as context. Preserve parts unaffected by changed documents. Update or supplement parts affected by new/changed documents. Remove references to deleted documents. Output complete updated sections (not fragments).',
  zh_CN: '你正处于增量更新模式。现有 wiki 页面内容作为上下文提供。保留未受变化文档影响的部分。更新或补充受新增/变化文档影响的部分。移除已删除文档相关的引用和内容。输出完整的更新后章节（非片段）。',
},
```

- [ ] **Step 2: Commit**

```bash
git add src/i18n/ui.ts
git commit -m "feat: 增量生成、源文档卡片、冲突章节 i18n key"
```

---

### Task 3: Renderer skips empty conflict sections

**Files:**
- Modify: `src/analytics/wiki-renderer.ts:146-179`
- Test: `src/analytics/wiki-renderer.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new test in `src/analytics/wiki-renderer.test.ts`:

```typescript
it('skips rendering a conflict section when blocks are empty', () => {
  const conflictPagePlan: WikiPagePlan = {
    ...pagePlan,
    sectionOrder: ['intro', 'conflict', 'sources'],
    optionalSections: ['conflict'],
  }

  const conflictSections: WikiSectionDraft[] = [
    {
      sectionType: 'intro',
      title: '主题概览',
      format: 'overview',
      blocks: [{ text: '概览内容。', sourceRefs: ['doc-1'] }],
      sourceRefs: ['doc-1'],
    },
    {
      sectionType: 'conflict',
      title: '冲突内容',
      format: 'debate',
      blocks: [],
      sourceRefs: [],
    },
    {
      sectionType: 'sources',
      title: '来源与证据',
      format: 'catalog',
      blocks: [],
      sourceRefs: [],
    },
  ]

  const rendered = renderThemeWikiDraft({
    pageTitle: 'test-llm-wiki',
    pairedThemeDocumentId: 'theme-1',
    pairedThemeTitle: 'Test Theme',
    generatedAt: '2026-05-07T12:00:00.000Z',
    model: 'test-model',
    sourceDocumentCount: 1,
    diagnosis,
    pagePlan: conflictPagePlan,
    sections: conflictSections,
  })

  // Section marker exists (for diff tracking) but no heading/content rendered
  expect(rendered.managedMarkdown).toContain('<!-- network-lens-wiki-section:conflict -->')
  expect(rendered.managedMarkdown).not.toContain('### 冲突内容')
  expect(rendered.managedMarkdown).not.toContain('暂无内容')
  expect(rendered.sectionMetadata.find(s => s.key === 'conflict')?.markdown).toBe('')
})

it('renders a conflict section with debate format when blocks are non-empty', () => {
  const conflictPagePlan: WikiPagePlan = {
    ...pagePlan,
    sectionOrder: ['intro', 'conflict', 'sources'],
    optionalSections: ['conflict'],
  }

  const conflictSections: WikiSectionDraft[] = [
    {
      sectionType: 'intro',
      title: '主题概览',
      format: 'overview',
      blocks: [{ text: '概览内容。', sourceRefs: ['doc-1'] }],
      sourceRefs: ['doc-1'],
    },
    {
      sectionType: 'conflict',
      title: '冲突内容',
      format: 'debate',
      blocks: [
        { text: '观点A：应采用 X 方案。', sourceRefs: ['doc-1'] },
        { text: '观点B：应采用 Y 方案。', sourceRefs: ['doc-2'] },
      ],
      sourceRefs: ['doc-1', 'doc-2'],
    },
    {
      sectionType: 'sources',
      title: '来源与证据',
      format: 'catalog',
      blocks: [],
      sourceRefs: [],
    },
  ]

  const rendered = renderThemeWikiDraft({
    pageTitle: 'test-llm-wiki',
    pairedThemeDocumentId: 'theme-1',
    pairedThemeTitle: 'Test Theme',
    generatedAt: '2026-05-07T12:00:00.000Z',
    model: 'test-model',
    sourceDocumentCount: 2,
    diagnosis,
    pagePlan: conflictPagePlan,
    sections: conflictSections,
    sourceDocumentTitleMap: { 'doc-1': '文档一', 'doc-2': '文档二' },
  })

  expect(rendered.managedMarkdown).toContain('### 冲突内容')
  expect(rendered.managedMarkdown).toContain('- 观点A：应采用 X 方案。')
  expect(rendered.managedMarkdown).toContain('- 观点B：应采用 Y 方案。')
  expect(rendered.managedMarkdown).toContain('<sup>((doc-1 "1"))</sup>')
  expect(rendered.managedMarkdown).toContain('<sup>((doc-2 "2"))</sup>')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analytics/wiki-renderer.test.ts`
Expected: FAIL — empty conflict section still renders heading and placeholder

- [ ] **Step 3: Implement**

In `src/analytics/wiki-renderer.ts`, modify `normalizeSectionDraftBody` to return empty string for sections with empty blocks (only conflict sections will have empty blocks after Task 4):

```typescript
function normalizeSectionDraftBody(
  draft: WikiSectionDraft | undefined,
  sourceRefIndexMap: Map<string, number>,
): string {
  if (!draft || !draft.blocks.length) {
    return ''
  }
  // ...rest stays the same
```

This function already returns `''` for empty blocks. The issue is in `resolveRenderedSections` — when `body` is empty, it still gets `t('wikiMaintain.noContentYet')` as the markdown. We need to distinguish "intentionally empty" from "no section draft at all".

Modify `resolveRenderedSections` in `src/analytics/wiki-renderer.ts` to preserve empty body for sections that exist in the draft map but have empty blocks:

```typescript
function resolveRenderedSections(
  pagePlan: WikiPagePlan,
  sectionDrafts: WikiSectionDraft[],
  titleMap: Record<string, string>,
  sourceRefIndexMap: Map<string, number>,
): Array<{ key: string, heading: string, body: string }> {
  const sectionDraftMap = new Map(sectionDrafts.map(section => [section.sectionType, section]))

  return pagePlan.sectionOrder.map((sectionType) => {
    const draft = sectionDraftMap.get(sectionType)
    const isIntentionallyEmpty = draft && draft.blocks.length === 0

    return {
      key: sectionType,
      heading: sectionType === 'sources'
        ? t('analytics.wikiPage.sourcesHeading')
        : resolveSectionHeading(sectionType, draft),
      body: isIntentionallyEmpty
        ? ''
        : sectionType === 'sources'
          ? normalizeSourcesSectionBody(draft, titleMap)
          : normalizeSectionDraftBody(draft, sourceRefIndexMap),
    }
  })
}
```

Then in `renderThemeWikiDraft`, when mapping sections, skip the heading and placeholder for intentionally empty sections. Change the mapping logic:

```typescript
const renderedSections = resolveRenderedSections(params.pagePlan, params.sections, titleMap, sourceRefIndexMap)

const sections = [
  {
    key: 'meta',
    heading: t('analytics.wikiPage.metaHeading'),
    body: [
      t('wikiMaintain.pairedTopicPageLine', { value: `((${params.pairedThemeDocumentId} "${params.pairedThemeTitle}"))` }),
      t('wikiMaintain.generatedAtLine', { value: params.generatedAt }),
      t('wikiMaintain.sourceDocsLine', { value: params.sourceDocumentCount }),
      t('wikiMaintain.modelLine', { value: params.model }),
    ].join('\n'),
  },
  ...renderedSections,
].map(section => ({
  key: section.key,
  heading: section.heading,
  markdown: section.body === '' ? '' : (section.body || t('wikiMaintain.noContentYet')),
})) satisfies WikiRenderedSectionMeta[]
```

Then in the `managedMarkdown` construction, skip heading for empty sections:

```typescript
const managedMarkdown = [
  `# ${params.pageTitle}`,
  '',
  `## ${WIKI_PAGE_HEADINGS.managedRoot}`,
  '',
  ...sections.flatMap(section => {
    if (section.markdown === '') {
      return [buildSectionMarker(section.key)]
    }
    return [
      buildSectionMarker(section.key),
      `### ${section.heading}`,
      section.markdown,
      '',
    ]
  }),
].join('\n').trim()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/analytics/wiki-renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-renderer.ts src/analytics/wiki-renderer.test.ts
git commit -m "feat: 冲突章节空 blocks 时跳过渲染标题和占位符"
```

---

### Task 4: Conflict section AI prompt

**Files:**
- Modify: `src/analytics/wiki-ai.ts:135-173`
- Test: `src/analytics/wiki-ai.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/analytics/wiki-ai.test.ts`, add a test that verifies the conflict prompt is included when `sectionType` is `'conflict'`. Check the existing test patterns in that file first, then add:

```typescript
it('includes conflict-specific instructions when sectionType is conflict', async () => {
  let capturedMessages: Array<{ role: string, content: string }> = []

  const service = createAiWikiService({
    forwardProxy: async (_url, _method, body) => {
      const parsed = JSON.parse(body)
      capturedMessages = parsed.messages
      return {
        status: 200,
        body: JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                sectionType: 'conflict',
                title: '冲突内容',
                format: 'debate',
                blocks: [],
                sourceRefs: [],
              }),
            },
          }],
        }),
      } as any
    },
  })

  const config = createValidAiConfig()
  const payload = createMinimalPayload()

  await service.generateThemeSection({
    config,
    payload,
    diagnosis: createMinimalDiagnosis(),
    pagePlan: createMinimalPagePlan(['conflict']),
    sectionType: 'conflict',
  })

  const userMessage = capturedMessages.find(m => m.role === 'user')
  expect(userMessage?.content).toContain('conflict')
  // The conflict prompt from i18n should be present
  expect(userMessage?.content).toContain('genuine contradictions')
    || expect(userMessage?.content).toContain('真正的矛盾')
})
```

Note: Adapt helper functions (`createValidAiConfig`, `createMinimalPayload`, etc.) to match the existing test patterns in `wiki-ai.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analytics/wiki-ai.test.ts`
Expected: FAIL — user message does not contain conflict-specific instructions

- [ ] **Step 3: Implement**

In `src/analytics/wiki-ai.ts`, in the `generateThemeSection` method, add the conflict prompt to the system content when `sectionType === 'conflict'`:

```typescript
async generateThemeSection(params) {
  assertAiReady(params.config)

  const systemContentParts = [
    BASE_SYSTEM_PROMPT,
    'Generate exactly one wiki section draft.',
    'The JSON must include sectionType, title, format, blocks, and sourceRefs.',
    'Each block must include text and sourceRefs.',
    'For every block, populate sourceRefs with the documentId values from the provided source documents that best support that block content. Use documentId, never blockId.',
    'For the sources (catalog) section, each block sourceRefs must include all relevant source documentIds so the renderer can produce explicit reference entries.',
    'For the intro (overview) section, each block text must be a concise self-contained summary sentence. Do not include block IDs, document IDs, or technical identifiers in the visible text.',
  ]

  if (params.sectionType === 'conflict') {
    systemContentParts.push(t('analytics.wiki.conflictSectionPrompt'))
  }

  const response = await requestChatCompletion({
    config: params.config,
    forwardProxy: deps.forwardProxy,
    messages: [
      {
        role: 'system',
        content: systemContentParts.join(' '),
      },
      // ...user message stays the same
    ],
  })

  return normalizeSectionDraft(parseJsonFromContent(response), params.sectionType)
},
```

Also update `inferSectionFormat` to map `'conflict'` to `'debate'`:

```typescript
function inferSectionFormat(sectionType: WikiSectionType): WikiSectionFormat {
  if (sectionType === 'intro') {
    return 'overview'
  }
  if (sectionType === 'sources') {
    return 'catalog'
  }
  if (['faq', 'troubleshooting', 'misunderstandings', 'open_questions'].includes(sectionType)) {
    return 'qa'
  }
  if (['viewpoints', 'controversies', 'conflict'].includes(sectionType)) {
    return 'debate'
  }
  return 'structured'
}
```

Also update `normalizeDraftBlocks` to allow empty blocks for `'conflict'`:

```typescript
function normalizeDraftBlocks(value: unknown, sectionType: WikiSectionType, forceFallback = false): WikiSectionDraft['blocks'] {
  if (!forceFallback && Array.isArray(value)) {
    const blocks = value
      .filter((item): item is { text?: unknown, sourceRefs?: unknown } => Boolean(item) && typeof item === 'object')
      .map(item => ({
        text: normalizeString(item.text, ''),
        sourceRefs: normalizeStringList(item.sourceRefs),
      }))
      .filter(item => item.text.length > 0)

    if (blocks.length > 0 || sectionType === 'conflict') {
      return blocks
    }
  }

  return [{
    text: prefixFallback(defaultSectionFallback(sectionType)),
    sourceRefs: [],
  }]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/analytics/wiki-ai.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-ai.ts src/analytics/wiki-ai.test.ts
git commit -m "feat: 冲突章节 AI 提示词和 debate 格式推断"
```

---

### Task 5: Add `wikiIncrementalEnabled` to plugin config

**Files:**
- Modify: `src/types/config.ts`

- [ ] **Step 1: Implement**

In `src/types/config.ts`, add to `PluginConfig` interface (after `wikiContainerName`):

```typescript
wikiIncrementalEnabled?: boolean
```

Add to `DEFAULT_CONFIG` (after `wikiContainerName`):

```typescript
wikiIncrementalEnabled: true,
```

Add to `ensureConfigDefaults` (after the `wikiContainerName` normalization):

```typescript
if (typeof config.wikiIncrementalEnabled !== 'boolean') {
  config.wikiIncrementalEnabled = true
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/config.ts
git commit -m "feat: 增量生成配置项 wikiIncrementalEnabled"
```

---

### Task 6: Add `sourceDocumentTimestamps` to wiki store

**Files:**
- Modify: `src/analytics/wiki-store.ts`
- Test: `src/analytics/wiki-store.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test in `src/analytics/wiki-store.test.ts`:

```typescript
it('saves and reloads sourceDocumentTimestamps in the page record', async () => {
  const storage = createMemoryStorage()
  const store = createAiWikiStore(storage)

  await store.savePageRecord({
    pageType: 'theme',
    pageTitle: 'test-llm-wiki',
    themeDocumentId: 'theme-1',
    themeDocumentTitle: 'Test Theme',
    sourceDocumentIds: ['doc-1', 'doc-2'],
    sourceDocumentTimestamps: {
      'doc-1': '2026-05-07T10:00',
      'doc-2': '2026-05-06T15:30',
    },
    lastGeneratedAt: '2026-05-07T12:00:00.000Z',
  })

  const pageKey = buildWikiPageStorageKey({
    pageType: 'theme',
    pageTitle: 'test-llm-wiki',
    themeDocumentId: 'theme-1',
  })

  const record = await store.getPageRecord(pageKey)
  expect(record?.sourceDocumentTimestamps).toEqual({
    'doc-1': '2026-05-07T10:00',
    'doc-2': '2026-05-06T15:30',
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analytics/wiki-store.test.ts`
Expected: FAIL — `sourceDocumentTimestamps` is not part of `WikiPageSnapshotRecord`

- [ ] **Step 3: Implement**

In `src/analytics/wiki-store.ts`, add to `WikiPageSnapshotRecord`:

```typescript
export interface WikiPageSnapshotRecord {
  pageType: WikiPageType
  pageTitle: string
  pageId?: string
  themeDocumentId?: string
  themeDocumentTitle?: string
  sourceDocumentIds: string[]
  sourceDocumentTimestamps?: Record<string, string>
  pageFingerprint?: string
  managedFingerprint?: string
  lastGeneratedAt?: string
  lastPreview?: WikiPreviewRecord
  lastApply?: WikiApplyRecord
}
```

In `normalizePageRecord`, add the field:

```typescript
function normalizePageRecord(value: unknown): WikiPageSnapshotRecord {
  const record = isRecord(value) ? value : {}

  return {
    // ...existing fields...
    sourceDocumentTimestamps: normalizeTimestampMap(record.sourceDocumentTimestamps),
    // ...rest stays the same...
  }
}
```

Add the normalization helper:

```typescript
function normalizeTimestampMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const entries = Object.entries(value)
    .filter(([key, val]) => typeof key === 'string' && typeof val === 'string' && val.trim())
    .map(([key, val]) => [key.trim(), (val as string).trim()])

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/analytics/wiki-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-store.ts src/analytics/wiki-store.test.ts
git commit -m "feat: wiki-store 支持 sourceDocumentTimestamps 增量快照"
```

---

### Task 7: Add `deltaStatus` to wiki generation payload

**Files:**
- Modify: `src/analytics/wiki-generation.ts`

- [ ] **Step 1: Implement**

In `src/analytics/wiki-generation.ts`, add `deltaStatus` to `WikiBundleDocumentItem`:

```typescript
export type WikiDeltaStatus = 'new' | 'changed' | 'unchanged' | 'deleted'

export interface WikiBundleDocumentItem {
  documentId: string
  title: string
  positioning: string
  propositions: PropositionItem[]
  keywords: string[]
  primarySourceBlocks: SourceBlockItem[]
  secondarySourceBlocks: SourceBlockItem[]
  sourceUpdatedAt: string
  generatedAt: string
  deltaStatus?: WikiDeltaStatus
}
```

- [ ] **Step 2: Commit**

```bash
git add src/analytics/wiki-generation.ts
git commit -m "feat: WikiBundleDocumentItem 新增 deltaStatus 字段"
```

---

### Task 8: Add delta stats and source doc meta to wiki preview state

**Files:**
- Modify: `src/composables/use-analytics-wiki.ts`

- [ ] **Step 1: Implement**

Add new types in `src/composables/use-analytics-wiki.ts`:

```typescript
export interface WikiPreviewDeltaStats {
  isIncremental: boolean
  newCount: number
  changedCount: number
  unchangedCount: number
  deletedCount: number
  processingTimeMs: number
}

export type WikiSourceDocLinkType = 'outbound' | 'inbound' | 'child'

export interface WikiPreviewSourceDocMeta {
  documentId: string
  title: string
  deltaStatus: 'new' | 'changed' | 'unchanged' | 'deleted'
  linkType: WikiSourceDocLinkType
  updatedAt: string
  hasThemeLink?: boolean
  isWeakAssociation?: boolean
}
```

Add to `WikiPreviewState`:

```typescript
export interface WikiPreviewState {
  generatedAt: string
  scope: {
    summary: WikiPreviewSummary
    descriptionLines: string[]
  }
  themePages: WikiPreviewThemePageItem[]
  unclassifiedDocuments: Array<{ documentId: string, title: string }>
  excludedWikiDocuments: Array<{ documentId: string, title: string }>
  applyResult?: WikiApplyBatchResult
  deltaStats?: WikiPreviewDeltaStats
  sourceDocMetas?: WikiPreviewSourceDocMeta[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/composables/use-analytics-wiki.ts
git commit -m "feat: WikiPreviewState 新增 deltaStats 和 sourceDocMetas"
```

---

### Task 9: Implement incremental diff logic in wiki actions

**Files:**
- Modify: `src/composables/use-analytics-wiki-actions.ts`
- Modify: `src/analytics/wiki-ai.ts` (incremental prompt injection)

- [ ] **Step 1: Implement incremental timestamp diff**

In `src/composables/use-analytics-wiki-actions.ts`, add a helper function:

```typescript
function computeSourceDocumentDeltas(
  currentDocuments: Array<{ id: string, updated: string }>,
  previousTimestamps: Record<string, string> | undefined,
): Map<string, 'new' | 'changed' | 'unchanged' | 'deleted'> {
  const deltas = new Map<string, 'new' | 'changed' | 'unchanged' | 'deleted'>()

  if (!previousTimestamps) {
    for (const doc of currentDocuments) {
      deltas.set(doc.id, 'new')
    }
    return deltas
  }

  const currentIds = new Set(currentDocuments.map(d => d.id))
  const previousIds = new Set(Object.keys(previousTimestamps))

  for (const doc of currentDocuments) {
    if (!previousIds.has(doc.id)) {
      deltas.set(doc.id, 'new')
    } else if (previousTimestamps[doc.id] !== doc.updated) {
      deltas.set(doc.id, 'changed')
    } else {
      deltas.set(doc.id, 'unchanged')
    }
  }

  for (const previousId of previousIds) {
    if (!currentIds.has(previousId)) {
      deltas.set(previousId, 'deleted')
    }
  }

  return deltas
}
```

- [ ] **Step 2: Integrate into `prepareWikiPreview`**

In `prepareWikiPreview`, after resolving `sourceDocuments` and before building the payload, add incremental logic:

```typescript
// After sourceProfileMap is built:
const isIncremental = params.config.wikiIncrementalEnabled !== false
const pageKey = buildWikiPageStorageKey({
  pageType: 'theme',
  pageTitle: buildThemeWikiPageTitle(themeDocument.title, params.appliedConfig.value.wikiPageSuffix ?? ''),
  themeDocumentId: themeDocument.documentId,
})
const storedRecord = await params.aiWikiStore.getPageRecord(pageKey)

const deltaMap = isIncremental
  ? computeSourceDocumentDeltas(
      sourceDocuments.map(d => ({ id: d.id, updated: d.updated })),
      storedRecord?.sourceDocumentTimestamps,
    )
  : new Map(sourceDocuments.map(d => [d.id, 'new' as const]))

const sourceDocumentTimestamps: Record<string, string> = {}
for (const doc of sourceDocuments) {
  sourceDocumentTimestamps[doc.id] = doc.updated
}
```

- [ ] **Step 3: Read existing wiki content for incremental mode**

After the `deltaMap` computation, read existing wiki content when incremental:

```typescript
let existingWikiContent: string | undefined

if (isIncremental && storedRecord) {
  const existingPage = await resolveExistingWikiPage({
    notebook: themeDocument.box,
    pageHPath: buildSiblingDocumentPath(
      themeDocument.hpath,
      buildThemeWikiPageTitle(themeDocument.title, params.appliedConfig.value.wikiPageSuffix ?? ''),
      params.appliedConfig.value.wikiContainerName ?? 'LLM Wiki',
    ),
    storedRecord,
    getIDsByHPath: params.getIDsByHPath,
    getBlockKramdown: params.getBlockKramdown,
  })
  existingWikiContent = existingPage?.managedMarkdown
}
```

- [ ] **Step 4: Add incremental mode context to AI pipeline calls**

Pass `existingWikiContent` to the AI service calls. In `src/analytics/wiki-ai.ts`, update the `AiWikiService` interface:

```typescript
export interface AiWikiService {
  diagnoseThemeTemplate: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    existingWikiContent?: string
  }) => Promise<WikiTemplateDiagnosis>
  planThemePage: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    diagnosis: WikiTemplateDiagnosis
    existingWikiContent?: string
  }) => Promise<WikiPagePlan>
  generateThemeSection: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    diagnosis: WikiTemplateDiagnosis
    pagePlan: WikiPagePlan
    sectionType: WikiSectionType
    existingWikiContent?: string
  }) => Promise<WikiSectionDraft>
}
```

In each method, when `params.existingWikiContent` is provided, append to the user message:

```typescript
// In diagnoseThemeTemplate, planThemePage, and generateThemeSection:
const userContentParts = [
  // ...existing prompt parts...
]

if (params.existingWikiContent) {
  userContentParts.push(t('analytics.wiki.incrementalModePrompt'))
  userContentParts.push(`Existing wiki page content:\n${params.existingWikiContent}`)
}

userContentParts.push(JSON.stringify(/* ...existing payload... */))
```

- [ ] **Step 5: Inject `deltaStatus` into payload**

In `buildSingleThemeWikiPayload`, accept the `deltaMap` and apply `deltaStatus` to each bundle document:

```typescript
function buildSingleThemeWikiPayload(params: {
  // ...existing params...
  deltaMap?: Map<string, 'new' | 'changed' | 'unchanged' | 'deleted'>
}): WikiThemeBundle {
  // In the bundleDocuments mapping, add:
  deltaStatus: params.deltaMap?.get(document.id) ?? 'new',
}
```

- [ ] **Step 6: Store timestamps and build delta stats in preview result**

After the AI pipeline completes, update the snapshot record and build delta stats:

```typescript
// In the nextRecord construction:
const nextRecord: WikiPageSnapshotRecord = {
  // ...existing fields...
  sourceDocumentTimestamps,
}

// Build delta stats:
const deltaStats: WikiPreviewDeltaStats = {
  isIncremental: isIncremental && Boolean(storedRecord?.sourceDocumentTimestamps),
  newCount: [...deltaMap.values()].filter(s => s === 'new').length,
  changedCount: [...deltaMap.values()].filter(s => s === 'changed').length,
  unchangedCount: [...deltaMap.values()].filter(s => s === 'unchanged').length,
  deletedCount: [...deltaMap.values()].filter(s => s === 'deleted').length,
  processingTimeMs: Date.now() - new Date(generatedAt).getTime(),
}

// Build source doc metas (requires link type info from the request):
const sourceDocMetas: WikiPreviewSourceDocMeta[] = sourceDocuments.map(doc => ({
  documentId: doc.id,
  title: doc.title || doc.hpath || doc.id,
  deltaStatus: deltaMap.get(doc.id) ?? 'new',
  linkType: request?.sourceDocumentLinkTypes?.get(doc.id) ?? 'outbound',
  updatedAt: doc.updated,
  hasThemeLink: false, // enriched in Task 13
  isWeakAssociation: false, // enriched in Task 13
}))
```

Add `deltaStats` and `sourceDocMetas` to the `wikiPreview.value` assignment.

- [ ] **Step 7: Commit**

```bash
git add src/composables/use-analytics-wiki-actions.ts src/analytics/wiki-ai.ts
git commit -m "feat: 增量生成核心逻辑——时间戳对比、delta 标记、现有内容注入"
```

---

### Task 10: Add incremental toggle UI to WikiMaintainPanel

**Files:**
- Modify: `src/components/WikiMaintainPanel.vue`

- [ ] **Step 1: Implement**

In `WikiMaintainPanel.vue`, add the incremental toggle after the existing `allowOverwriteConflicts` toggle:

```html
<label class="wiki-panel__toggle">
  <input v-model="incrementalEnabled" type="checkbox" class="b3-switch">
  <span>{{ t('wikiMaintain.incrementalGeneration') }}</span>
</label>
```

Add to props:

```typescript
const props = defineProps<{
  // ...existing props...
  incrementalEnabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:incrementalEnabled', value: boolean): void
}>()
```

Add local ref synced with prop:

```typescript
const incrementalEnabled = computed({
  get: () => props.incrementalEnabled ?? true,
  set: (value: boolean) => emit('update:incrementalEnabled', value),
})
```

- [ ] **Step 2: Wire up in parent component**

In `App.vue` (or wherever `WikiMaintainPanel` is used), pass `incrementalEnabled` from config and handle the update to persist it via `saveData`.

- [ ] **Step 3: Commit**

```bash
git add src/components/WikiMaintainPanel.vue
git commit -m "feat: 增量生成开关 UI"
```

---

### Task 11: Delta stats grid in WikiMaintainPanel

**Files:**
- Modify: `src/components/WikiMaintainPanel.vue`

- [ ] **Step 1: Implement**

After the existing scope grid (line ~72), add a delta stats section:

```html
<div v-if="preview?.deltaStats" class="wiki-panel__delta-stats">
  <h4>{{ t('wikiMaintain.deltaStatsTitle') }}</h4>
  <div class="wiki-panel__scope-grid">
    <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
      <span>{{ t('wikiMaintain.deltaNewCount') }}</span>
      <strong class="wiki-panel__stat--new">{{ preview.deltaStats.newCount }}</strong>
    </div>
    <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
      <span>{{ t('wikiMaintain.deltaChangedCount') }}</span>
      <strong class="wiki-panel__stat--changed">{{ preview.deltaStats.changedCount }}</strong>
    </div>
    <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
      <span>{{ t('wikiMaintain.deltaUnchangedCount') }}</span>
      <strong>{{ preview.deltaStats.unchangedCount }}</strong>
    </div>
    <div v-if="preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
      <span>{{ t('wikiMaintain.deltaDeletedCount') }}</span>
      <strong class="wiki-panel__stat--deleted">{{ preview.deltaStats.deletedCount }}</strong>
    </div>
    <div v-if="!preview.deltaStats.isIncremental" class="wiki-panel__scope-card">
      <span>{{ t('wikiMaintain.sourceDocTotalCount') }}</span>
      <strong>{{ preview.scope.summary.sourceDocumentCount }}</strong>
    </div>
    <div class="wiki-panel__scope-card">
      <span>{{ t('wikiMaintain.processingTime') }}</span>
      <strong>{{ formatProcessingTime(preview.deltaStats.processingTimeMs) }}</strong>
    </div>
  </div>
</div>
```

Add the formatting helper and styles:

```typescript
function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
```

```css
.wiki-panel__delta-stats {
  display: grid;
  gap: 10px;
}

.wiki-panel__delta-stats h4 {
  margin: 0;
  font-size: 14px;
}

.wiki-panel__stat--new {
  color: var(--b3-theme-success, #4caf50);
}

.wiki-panel__stat--changed {
  color: var(--b3-theme-warning, #ff9800);
}

.wiki-panel__stat--deleted {
  color: var(--b3-theme-error, #f44336);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WikiMaintainPanel.vue
git commit -m "feat: 增量生成统计信息展示"
```

---

### Task 12: Source document cards in WikiMaintainPanel

**Files:**
- Modify: `src/components/WikiMaintainPanel.vue`
- Modify: `src/composables/use-analytics-wiki-actions.ts` (pass link type info)

- [ ] **Step 1: Implement source doc cards UI**

After the delta stats section, add source document cards:

```html
<div v-if="preview?.sourceDocMetas?.length" class="wiki-panel__source-cards">
  <h4>{{ t('wikiMaintain.sourceDocCardsTitle') }}</h4>
  <div class="wiki-panel__source-card-list">
    <article
      v-for="meta in sortedSourceDocMetas"
      :key="meta.documentId"
      class="wiki-panel__source-card"
      :data-delta="meta.deltaStatus"
    >
      <div class="wiki-panel__source-card-head">
        <a
          class="wiki-panel__source-card-title"
          href="#"
          @click.prevent="openSourceDocument(meta.documentId)"
        >
          {{ meta.title }}
        </a>
        <div class="wiki-panel__source-card-tags">
          <span class="wiki-panel__delta-tag" :data-status="meta.deltaStatus">
            {{ deltaStatusLabel(meta.deltaStatus) }}
          </span>
          <span class="wiki-panel__link-type-tag">
            {{ linkTypeLabel(meta.linkType) }}
          </span>
        </div>
      </div>
      <p class="wiki-panel__source-card-updated">
        {{ meta.updatedAt }}
      </p>
      <div class="wiki-panel__source-card-suggestions">
        <button
          v-if="!meta.hasThemeLink"
          class="ghost-button ghost-button--sm"
          type="button"
          @click="handleAddThemeLink(meta.documentId)"
        >
          {{ t('wikiMaintain.addThemeLink') }}
        </button>
        <button
          class="ghost-button ghost-button--sm"
          type="button"
          @click="handleAddTag(meta.documentId)"
        >
          {{ t('wikiMaintain.addTag') }}
        </button>
        <span v-if="meta.isWeakAssociation" class="wiki-panel__weak-warning">
          {{ t('wikiMaintain.weakAssociationWarning') }}
        </span>
        <span v-if="meta.deltaStatus === 'changed'" class="wiki-panel__changed-notice">
          {{ t('wikiMaintain.contentChangedNotice') }}
        </span>
      </div>
    </article>
  </div>
</div>
```

- [ ] **Step 2: Add computed for sorted metas**

```typescript
const sortedSourceDocMetas = computed(() => {
  if (!props.preview?.sourceDocMetas) return []

  const order = { new: 0, changed: 1, unchanged: 2, deleted: 3 }
  return [...props.preview.sourceDocMetas].sort((a, b) => order[a.deltaStatus] - order[b.deltaStatus])
})
```

- [ ] **Step 3: Add label resolvers**

```typescript
function deltaStatusLabel(status: string): string {
  switch (status) {
    case 'new': return t('wikiMaintain.deltaStatusNew')
    case 'changed': return t('wikiMaintain.deltaStatusChanged')
    case 'unchanged': return t('wikiMaintain.deltaStatusUnchanged')
    case 'deleted': return t('wikiMaintain.deltaStatusDeleted')
    default: return status
  }
}

function linkTypeLabel(linkType: string): string {
  switch (linkType) {
    case 'outbound': return t('wikiMaintain.linkTypeOutbound')
    case 'inbound': return t('wikiMaintain.linkTypeInbound')
    case 'child': return t('wikiMaintain.linkTypeChild')
    default: return linkType
  }
}
```

- [ ] **Step 4: Add styles for source cards**

```css
.wiki-panel__source-cards {
  display: grid;
  gap: 10px;
}

.wiki-panel__source-cards h4 {
  margin: 0;
  font-size: 14px;
}

.wiki-panel__source-card-list {
  display: grid;
  gap: 8px;
}

.wiki-panel__source-card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-on-background) 8%, transparent);
  background: color-mix(in srgb, var(--b3-theme-surface) 86%, var(--b3-theme-background));
}

.wiki-panel__source-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.wiki-panel__source-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  text-decoration: none;
}

.wiki-panel__source-card-title:hover {
  text-decoration: underline;
}

.wiki-panel__source-card-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.wiki-panel__delta-tag,
.wiki-panel__link-type-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
}

.wiki-panel__delta-tag[data-status='new'] {
  background: color-mix(in srgb, var(--b3-theme-success, #4caf50) 14%, transparent);
  color: var(--b3-theme-success, #4caf50);
}

.wiki-panel__delta-tag[data-status='changed'] {
  background: color-mix(in srgb, var(--b3-theme-warning, #ff9800) 14%, transparent);
  color: var(--b3-theme-warning, #ff9800);
}

.wiki-panel__delta-tag[data-status='unchanged'] {
  background: color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);
  color: color-mix(in srgb, var(--b3-theme-on-background) 60%, transparent);
}

.wiki-panel__delta-tag[data-status='deleted'] {
  background: color-mix(in srgb, var(--b3-theme-error, #f44336) 14%, transparent);
  color: var(--b3-theme-error, #f44336);
}

.wiki-panel__link-type-tag {
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  color: var(--b3-theme-primary);
}

.wiki-panel__source-card-updated {
  margin: 4px 0 0;
  font-size: 11px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 45%, transparent);
}

.wiki-panel__source-card-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}

.ghost-button--sm {
  font-size: 11px;
  padding: 3px 8px;
  min-width: auto;
}

.wiki-panel__weak-warning {
  font-size: 11px;
  color: var(--b3-theme-warning, #ff9800);
}

.wiki-panel__changed-notice {
  font-size: 11px;
  color: var(--b3-theme-primary);
}
```

- [ ] **Step 5: Add prop for opening source documents**

Add to props:

```typescript
openSourceDocument: (documentId: string) => void
```

- [ ] **Step 6: Commit**

```bash
git add src/components/WikiMaintainPanel.vue
git commit -m "feat: 源文档卡片 UI——状态标签、关联类型、处理建议"
```

---

### Task 13: Wire up source doc suggestion actions

**Files:**
- Modify: `src/composables/use-analytics-wiki-actions.ts` (pass link type info to preview)
- Modify: `src/components/WikiMaintainPanel.vue` (emit suggestion events)
- Modify: parent component that wires WikiMaintainPanel

- [ ] **Step 1: Enrich sourceDocMetas with link type and theme link status**

In `src/composables/use-analytics-wiki-actions.ts`, when building `sourceDocMetas`, include the link type from the request and check if each doc already has a theme link:

```typescript
// The request needs to carry link type info. Update WikiPreviewRequest:
// In use-analytics-wiki.ts:
export interface WikiPreviewRequest {
  sourceDocumentIds?: string[]
  sourceDocumentLinkTypes?: Map<string, 'outbound' | 'inbound' | 'child'>
  scopeDescriptionLine?: string
  themeDocumentId?: string
}
```

In `prepareWikiPreview`, when building `sourceDocMetas`:

```typescript
const sourceDocMetas: WikiPreviewSourceDocMeta[] = sourceDocuments.map(doc => ({
  documentId: doc.id,
  title: doc.title || doc.hpath || doc.id,
  deltaStatus: deltaMap.get(doc.id) ?? 'new',
  linkType: request?.sourceDocumentLinkTypes?.get(doc.id) ?? 'outbound',
  updatedAt: doc.updated,
}))
```

- [ ] **Step 2: Add suggestion event handlers to WikiMaintainPanel**

Add emits for suggestion actions:

```typescript
const emit = defineEmits<{
  (e: 'update:incrementalEnabled', value: boolean): void
  (e: 'addThemeLink', documentId: string): void
  (e: 'addTag', documentId: string): void
}>()

function handleAddThemeLink(documentId: string) {
  emit('addThemeLink', documentId)
}

function handleAddTag(documentId: string) {
  emit('addTag', documentId)
}
```

- [ ] **Step 3: Wire suggestion handlers in parent**

In the parent component that uses `WikiMaintainPanel`, handle these events by calling the existing interaction controllers (`toggleOrphanThemeSuggestion` for theme links, `toggleOrphanAiTagSuggestion` for tags).

- [ ] **Step 4: Commit**

```bash
git add src/composables/use-analytics-wiki-actions.ts src/composables/use-analytics-wiki.ts src/components/WikiMaintainPanel.vue
git commit -m "feat: 源文档卡片建议交互——加主题链接和加标签"
```

---

### Task 14: Run full test suite and fix regressions

- [ ] **Step 1: Run all wiki-related tests**

Run: `npx vitest run src/analytics/wiki-`
Expected: All tests pass

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run linter**

Run: `npx eslint .`
Expected: No errors

- [ ] **Step 4: Fix any failures**

- [ ] **Step 5: Commit fixes if any**

```bash
git add -A
git commit -m "fix: 增量生成和冲突章节测试回归修复"
```
