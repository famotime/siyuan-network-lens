# LLM Wiki Multi-Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-template LLM Wiki pipeline with a multi-template, modular topic-page pipeline that consumes document indexes, auto-selects a page template, plans page sections, and renders section-driven wiki drafts.

**Architecture:** Keep the existing theme wiki lifecycle intact: build a topic-scoped input bundle, ask the LLM for template diagnosis and page planning, generate sections one by one, then render/apply a stable AI-managed region plus manual notes. Preserve the existing storage, diff, and writeback flow where possible, but remove the fixed `overview / keyDocuments / structureObservations / evidence / actions` page model from the generation pipeline.

**Tech Stack:** TypeScript, Vue 3, Vitest, SiYuan plugin API

---

## File Structure

### Create

- `src/analytics/wiki-template-model.ts`
  Defines wiki template ids, shared sections, optional module ids, page-plan types, and section draft types.
- `src/analytics/wiki-template-model.test.ts`
  Locks the template constants and type-shape expectations.
- `src/analytics/wiki-template-selection.ts`
  Contains pure helpers for section ordering, confidence fallback, and module suppression.
- `src/analytics/wiki-template-selection.test.ts`
  Covers fallback and section-order rules without involving network or UI code.

### Modify

- `src/analytics/wiki-page-model.ts`
  Keep page title, block attrs, and managed/manual heading helpers; stop treating fixed legacy content sections as the canonical wiki model.
- `src/analytics/wiki-page-model.test.ts`
  Update coverage so it validates the reduced page-shell responsibilities instead of legacy content headings.
- `src/analytics/wiki-generation.ts`
  Replace legacy summary payload generation with topic bundle building from document index profiles.
- `src/analytics/wiki-generation.test.ts`
  Cover bundle construction using `positioning / propositions / source blocks` instead of summary strings.
- `src/analytics/wiki-ai.ts`
  Add staged AI calls for template diagnosis, page planning, and per-section generation.
- `src/analytics/wiki-ai.test.ts`
  Cover new JSON schemas and prompt routing.
- `src/analytics/wiki-renderer.ts`
  Render dynamic section plans instead of the fixed legacy sections.
- `src/analytics/wiki-renderer.test.ts`
  Lock the new heading output, shared base sections, and manual notes preservation.
- `src/analytics/wiki-diff.ts`
  Compare dynamic sections by section id instead of the legacy fixed keys.
- `src/analytics/wiki-documents.ts`
  Continue applying rendered drafts, but work with dynamic section metadata and updated previews.
- `src/analytics/wiki-documents.test.ts`
  Update writeback expectations to the new section set.
- `src/composables/use-analytics-wiki.ts`
  Swap the old summary-based orchestration for index-first bundle generation plus staged AI calls.
- `src/components/WikiMaintainPanel.vue`
  Update preview UI to show template choice and dynamic affected sections without hardcoding the old section names.
- `src/components/WikiMaintainPanel.test.ts`
  Cover the new preview fields and remove assertions tied to `overview/actions`.
- `src/i18n/ui.ts`
  Add template labels, section labels, and new prompt text.

---

### Task 1: Introduce Template-Aware Wiki Model Types

**Files:**
- Create: `src/analytics/wiki-template-model.ts`
- Test: `src/analytics/wiki-template-model.test.ts`
- Modify: `src/analytics/wiki-page-model.ts`
- Modify: `src/analytics/wiki-page-model.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  WIKI_TEMPLATE_TYPES,
  WIKI_SHARED_SECTION_TYPES,
  WIKI_OPTIONAL_SECTION_TYPES,
} from './wiki-template-model'
import { WIKI_PAGE_HEADINGS } from './wiki-page-model'

describe('wiki template model', () => {
  it('defines the supported page templates and shared sections', () => {
    expect(WIKI_TEMPLATE_TYPES).toEqual([
      'tech_topic',
      'product_howto',
      'social_topic',
      'media_list',
    ])
    expect(WIKI_SHARED_SECTION_TYPES).toEqual(['intro', 'highlights', 'sources'])
    expect(WIKI_OPTIONAL_SECTION_TYPES).toContain('faq')
    expect(WIKI_OPTIONAL_SECTION_TYPES).toContain('open_questions')
  })

  it('keeps only shell headings in the page model', () => {
    expect(WIKI_PAGE_HEADINGS).toEqual({
      managedRoot: 'AI managed area',
      manualNotes: 'Manual notes',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analytics/wiki-template-model.test.ts src/analytics/wiki-page-model.test.ts`
Expected: FAIL because `wiki-template-model.ts` does not exist yet and `wiki-page-model.test.ts` still expects the legacy content headings.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/analytics/wiki-template-model.ts
export const WIKI_TEMPLATE_TYPES = [
  'tech_topic',
  'product_howto',
  'social_topic',
  'media_list',
] as const

export type WikiTemplateType = typeof WIKI_TEMPLATE_TYPES[number]

export const WIKI_SHARED_SECTION_TYPES = ['intro', 'highlights', 'sources'] as const
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
] as const

export type WikiSectionType =
  | typeof WIKI_SHARED_SECTION_TYPES[number]
  | typeof WIKI_OPTIONAL_SECTION_TYPES[number]

export type WikiSectionFormat = 'overview' | 'structured' | 'qa' | 'debate' | 'catalog'

export interface WikiTemplateDiagnosis {
  templateType: WikiTemplateType
  confidence: 'high' | 'medium' | 'low'
  reason: string
  enabledModules: WikiSectionType[]
  suppressedModules: WikiSectionType[]
  evidenceSummary: string
}

export interface WikiPagePlan {
  templateType: WikiTemplateType
  confidence: 'high' | 'medium' | 'low'
  coreSections: WikiSectionType[]
  optionalSections: WikiSectionType[]
  sectionOrder: WikiSectionType[]
  sectionGoals: Record<string, string>
  sectionFormats: Record<string, WikiSectionFormat>
}

export interface WikiSectionDraft {
  sectionType: WikiSectionType
  title: string
  format: WikiSectionFormat
  blocks: Array<{ text: string, sourceRefs: string[] }>
  sourceRefs: string[]
}
```

```ts
// src/analytics/wiki-page-model.ts
export const WIKI_PAGE_HEADINGS = {
  managedRoot: t('analytics.wikiPage.managedRootHeading'),
  manualNotes: t('wikiMaintain.manualNotes'),
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analytics/wiki-template-model.test.ts src/analytics/wiki-page-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-template-model.ts src/analytics/wiki-template-model.test.ts src/analytics/wiki-page-model.ts src/analytics/wiki-page-model.test.ts docs/superpowers/plans/2026-05-05-llm-wiki-multi-template.md
git commit -m "refactor: add wiki template model types"
```

### Task 2: Build Topic Bundles from Document Index Profiles

**Files:**
- Create: `src/analytics/wiki-template-selection.ts`
- Test: `src/analytics/wiki-template-selection.test.ts`
- Modify: `src/analytics/wiki-generation.ts`
- Modify: `src/analytics/wiki-generation.test.ts`
- Modify: `src/composables/use-analytics-wiki.ts`

- [ ] **Step 1: Write the failing tests**

```ts
expect(bundle.themes[0]).toEqual(
  expect.objectContaining({
    templateSignals: expect.objectContaining({
      propositionCount: 3,
      primaryBlockCount: 2,
    }),
    sourceDocuments: [
      expect.objectContaining({
        documentId: 'doc-core',
        positioning: '解释 AI 核心概念',
        propositions: [
          expect.objectContaining({ text: 'AI 系统依赖训练数据' }),
        ],
      }),
    ],
  }),
)
```

```ts
expect(resolveSectionOrder({
  templateType: 'product_howto',
  enabledModules: ['faq', 'basic_steps', 'use_cases'],
  confidence: 'low',
})).toEqual(['intro', 'highlights', 'use_cases', 'basic_steps', 'sources'])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analytics/wiki-generation.test.ts src/analytics/wiki-template-selection.test.ts`
Expected: FAIL because `buildWikiGenerationPayloads()` still emits summary fields and there is no template-selection helper yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/analytics/wiki-generation.ts
export interface WikiBundleDocumentItem {
  documentId: string
  title: string
  positioning: string
  propositions: PropositionItem[]
  keywords: string[]
  primarySourceBlocks: SourceBlockItem[]
  secondarySourceBlocks: SourceBlockItem[]
  updatedAt: string
}

export interface WikiThemeBundle {
  themeName: string
  pageTitle: string
  themeDocumentId: string
  themeDocumentTitle: string
  sourceDocuments: WikiBundleDocumentItem[]
  templateSignals: {
    propositionCount: number
    primaryBlockCount: number
    secondaryBlockCount: number
    keywordCount: number
  }
}

export function buildWikiThemeBundles(/* ... */): { themes: WikiThemeBundle[]; unclassifiedDocuments: WikiBundleDocumentItem[] } {
  // read DocumentIndexProfile instead of summaryShort/summaryMedium/evidenceSnippets
}
```

```ts
// src/analytics/wiki-template-selection.ts
import type { WikiSectionType, WikiTemplateType } from './wiki-template-model'

const SHARED: WikiSectionType[] = ['intro', 'highlights', 'sources']

export function resolveSectionOrder(params: {
  templateType: WikiTemplateType
  enabledModules: WikiSectionType[]
  confidence: 'high' | 'medium' | 'low'
}): WikiSectionType[] {
  const filtered = params.confidence === 'low'
    ? params.enabledModules.filter(section => !['faq', 'controversies', 'open_questions'].includes(section))
    : params.enabledModules

  return [...SHARED.slice(0, 2), ...filtered.filter(section => section !== 'sources'), 'sources']
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analytics/wiki-generation.test.ts src/analytics/wiki-template-selection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-generation.ts src/analytics/wiki-generation.test.ts src/analytics/wiki-template-selection.ts src/analytics/wiki-template-selection.test.ts src/composables/use-analytics-wiki.ts docs/superpowers/plans/2026-05-05-llm-wiki-multi-template.md
git commit -m "refactor: build wiki bundles from document indexes"
```

### Task 3: Add Staged AI Calls for Diagnosis, Page Plan, and Section Drafts

**Files:**
- Modify: `src/analytics/wiki-ai.ts`
- Modify: `src/analytics/wiki-ai.test.ts`
- Modify: `src/i18n/ui.ts`

- [ ] **Step 1: Write the failing tests**

```ts
const diagnosis = await service.diagnoseThemeTemplate({ config, payload })
expect(diagnosis).toEqual({
  templateType: 'tech_topic',
  confidence: 'high',
  reason: '多数命题聚焦概念和机制',
  enabledModules: ['core_principles', 'use_cases'],
  suppressedModules: ['faq'],
  evidenceSummary: '3 条命题来自 2 个核心证据块',
})

const pagePlan = await service.planThemePage({ config, payload, diagnosis })
expect(pagePlan.sectionOrder).toEqual(['intro', 'highlights', 'core_principles', 'use_cases', 'sources'])

const section = await service.generateThemeSection({
  config,
  payload,
  diagnosis,
  pagePlan,
  sectionType: 'core_principles',
})
expect(section.format).toBe('structured')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analytics/wiki-ai.test.ts`
Expected: FAIL because `createAiWikiService()` only exposes `generateThemeSections()`.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface AiWikiService {
  diagnoseThemeTemplate: (params: { config: AiConfig; payload: WikiThemeBundle }) => Promise<WikiTemplateDiagnosis>
  planThemePage: (params: { config: AiConfig; payload: WikiThemeBundle; diagnosis: WikiTemplateDiagnosis }) => Promise<WikiPagePlan>
  generateThemeSection: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    diagnosis: WikiTemplateDiagnosis
    pagePlan: WikiPagePlan
    sectionType: WikiSectionType
  }) => Promise<WikiSectionDraft>
}

const TEMPLATE_DIAGNOSIS_PROMPT = 'Choose one wiki template and enabled modules. Return JSON only.'
const PAGE_PLAN_PROMPT = 'Build a page plan with shared base sections and supported optional modules. Return JSON only.'
const SECTION_SYNTHESIS_PROMPT = 'Generate one section only. Stay faithful to propositions and evidence blocks. Return JSON only.'
```

```ts
// src/i18n/ui.ts
analytics: {
  wiki: {
    templateDiagnosisPrompt: {
      en_US: 'Choose the best wiki template and enabled modules for this topic bundle.',
      zh_CN: '请为当前主题 bundle 选择最合适的 Wiki 模板，并给出应启用的章节模块。',
    },
    pagePlanPrompt: {
      en_US: 'Build the page plan using the shared base and enabled modules only.',
      zh_CN: '请基于共同底座和已启用模块生成页面计划，不要额外添加无证据章节。',
    },
    sectionSynthesisPrompt: {
      en_US: 'Generate only the requested section in JSON and keep every claim grounded.',
      zh_CN: '请仅生成指定章节的 JSON，并确保每个关键结论都能回到输入证据。',
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analytics/wiki-ai.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-ai.ts src/analytics/wiki-ai.test.ts src/i18n/ui.ts docs/superpowers/plans/2026-05-05-llm-wiki-multi-template.md
git commit -m "feat: add staged ai wiki generation"
```

### Task 4: Switch Rendering, Preview, and Apply Flow to Dynamic Sections

**Files:**
- Modify: `src/analytics/wiki-renderer.ts`
- Modify: `src/analytics/wiki-renderer.test.ts`
- Modify: `src/analytics/wiki-diff.ts`
- Modify: `src/analytics/wiki-documents.ts`
- Modify: `src/analytics/wiki-documents.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
expect(rendered.sectionMetadata.map(item => item.key)).toEqual([
  'meta',
  'intro',
  'highlights',
  'core_principles',
  'sources',
])
expect(rendered.managedMarkdown).toContain('### Topic intro')
expect(rendered.managedMarkdown).toContain('### Key information')
expect(rendered.managedMarkdown).toContain('### Core principles')
expect(rendered.managedMarkdown).toContain('### Source index')
```

```ts
expect(preview.affectedSections).toEqual(['highlights', 'core_principles'])
expect(result.themePages[0].result).toBe('updated')
expect(kernel.api.updateBlock).toHaveBeenCalledWith('markdown', themeDraft.managedMarkdown, 'wiki-theme-ai::managed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analytics/wiki-renderer.test.ts src/analytics/wiki-documents.test.ts`
Expected: FAIL because the renderer and diff logic still assume `overview / keyDocuments / structureObservations / evidence / actions`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/analytics/wiki-renderer.ts
export function renderThemeWikiDraft(params: {
  pageTitle: string
  pairedThemeTitle: string
  generatedAt: string
  model: string
  sourceDocumentCount: number
  diagnosis: WikiTemplateDiagnosis
  pagePlan: WikiPagePlan
  sections: WikiSectionDraft[]
}): RenderedWikiDraft {
  const renderedSections = params.pagePlan.sectionOrder.map((sectionType) => {
    const section = params.sections.find(item => item.sectionType === sectionType)
    return {
      key: sectionType,
      heading: resolveWikiSectionHeading(sectionType),
      markdown: section ? renderSectionBlocks(section) : t('wikiMaintain.noContentYet'),
    }
  })

  const metaLines = [
    t('wikiMaintain.pairedTopicPageLine', { value: params.pairedThemeTitle }),
    t('wikiMaintain.generatedAtLine', { value: params.generatedAt }),
    t('wikiMaintain.sourceDocsLine', { value: params.sourceDocumentCount }),
    t('wikiMaintain.modelLine', { value: params.model }),
    t('wikiMaintain.templateLine', { value: params.diagnosis.templateType }),
  ]
  // join meta + renderedSections into the same managed root shell
}
```

```ts
// src/analytics/wiki-diff.ts
function parseManagedSectionMap(markdown: string): Map<string, string> {
  const sectionMap = new Map<string, string>()
  const sectionPattern = /^###\s+(.+)$/gm
  for (const match of markdown.matchAll(sectionPattern)) {
    const heading = match[1].trim()
    sectionMap.set(resolveSectionKey(heading), extractSectionBody(markdown, match.index ?? 0))
  }
  return sectionMap
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analytics/wiki-renderer.test.ts src/analytics/wiki-documents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/wiki-renderer.ts src/analytics/wiki-renderer.test.ts src/analytics/wiki-diff.ts src/analytics/wiki-documents.ts src/analytics/wiki-documents.test.ts docs/superpowers/plans/2026-05-05-llm-wiki-multi-template.md
git commit -m "refactor: render wiki drafts from dynamic sections"
```

### Task 5: Switch Preview Orchestration and Panel UI to the Multi-Template Flow

**Files:**
- Modify: `src/composables/use-analytics-wiki.ts`
- Modify: `src/components/WikiMaintainPanel.vue`
- Modify: `src/components/WikiMaintainPanel.test.ts`
- Modify: `src/i18n/ui.ts`

- [ ] **Step 1: Write the failing tests**

```ts
expect(html).toContain('Template: Tech topic')
expect(html).toContain('Confidence: High')
expect(html).toContain('Affected sections: highlights, core_principles')
expect(html).not.toContain('overview')
expect(html).not.toContain('actions')
```

```ts
expect(preview.themePages[0].draft.sectionMetadata.map(item => item.key)).toEqual([
  'meta',
  'intro',
  'highlights',
  'core_principles',
  'sources',
])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/WikiMaintainPanel.test.ts src/composables/use-app-wiki-panel.test.ts`
Expected: FAIL because the panel still renders legacy section labels and the composable still drives the one-call summary-based pipeline.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/composables/use-analytics-wiki.ts
const diagnosis = await aiWikiService.diagnoseThemeTemplate({ config, payload: themeBundle })
const pagePlan = await aiWikiService.planThemePage({ config, payload: themeBundle, diagnosis })
const sections = await Promise.all(
  pagePlan.sectionOrder
    .filter(sectionType => sectionType !== 'sources')
    .map(sectionType => aiWikiService.generateThemeSection({
      config,
      payload: themeBundle,
      diagnosis,
      pagePlan,
      sectionType,
    })),
)
```

```vue
<!-- src/components/WikiMaintainPanel.vue -->
<p>{{ t('wikiMaintain.template') }}: {{ templateLabelMap[page.diagnosis.templateType] }}</p>
<p>{{ t('wikiMaintain.confidence') }}: {{ confidenceLabelMap[page.diagnosis.confidence] }}</p>
<span>
  {{ t('wikiMaintain.affectedSections') }}:
  {{ page.preview.affectedSections.length ? page.preview.affectedSections.join(', ') : t('wikiMaintain.noChanges') }}
</span>
```

```ts
// src/i18n/ui.ts
wikiMaintain: {
  template: { en_US: 'Template', zh_CN: '模板' },
  confidence: { en_US: 'Confidence', zh_CN: '置信度' },
  templateTechTopic: { en_US: 'Tech topic', zh_CN: '技术专题' },
  templateProductHowto: { en_US: 'Product how-to', zh_CN: '软件产品使用方法' },
  templateSocialTopic: { en_US: 'Social topic', zh_CN: '社会话题' },
  templateMediaList: { en_US: 'Book / film list', zh_CN: '书单 / 影单' },
  confidenceHigh: { en_US: 'High', zh_CN: '高' },
  confidenceMedium: { en_US: 'Medium', zh_CN: '中' },
  confidenceLow: { en_US: 'Low', zh_CN: '低' },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/WikiMaintainPanel.test.ts src/composables/use-app-wiki-panel.test.ts src/composables/use-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-analytics-wiki.ts src/components/WikiMaintainPanel.vue src/components/WikiMaintainPanel.test.ts src/i18n/ui.ts docs/superpowers/plans/2026-05-05-llm-wiki-multi-template.md
git commit -m "feat: wire multi-template wiki preview flow"
```

### Task 6: Remove Legacy Wiki Section Assumptions and Run Full Verification

**Files:**
- Modify: `src/analytics/wiki-generation.ts`
- Modify: `src/analytics/wiki-ai.ts`
- Modify: `src/analytics/wiki-renderer.ts`
- Modify: `src/analytics/wiki-page-model.ts`
- Modify: `src/analytics/wiki-documents.ts`
- Modify: `src/i18n/ui.ts`
- Test: `src/analytics/wiki-page-model.test.ts`
- Test: `src/analytics/wiki-generation.test.ts`
- Test: `src/analytics/wiki-ai.test.ts`
- Test: `src/analytics/wiki-renderer.test.ts`
- Test: `src/analytics/wiki-documents.test.ts`
- Test: `src/components/WikiMaintainPanel.test.ts`

- [ ] **Step 1: Remove the old fixed-section exports and assertions**

```ts
// delete the legacy fixed content model
export const WIKI_LLM_OUTPUT_KEYS = [
  'overview',
  'keyDocuments',
  'structureObservations',
  'evidence',
  'actions',
] as const
```

```ts
// replace test expectations
expect(WIKI_PAGE_TYPES).toEqual(['theme', 'index', 'log'])
expect(WIKI_PAGE_HEADINGS).toEqual({
  managedRoot: 'AI managed area',
  manualNotes: 'Manual notes',
})
```

- [ ] **Step 2: Run the focused regression suite**

Run: `npm test -- src/analytics/wiki-page-model.test.ts src/analytics/wiki-generation.test.ts src/analytics/wiki-ai.test.ts src/analytics/wiki-renderer.test.ts src/analytics/wiki-documents.test.ts src/components/WikiMaintainPanel.test.ts`
Expected: PASS

- [ ] **Step 3: Run the broader analytics regression suite**

Run: `npm test -- src/composables/use-analytics.test.ts src/components/SettingPanel.test.ts src/types/config.test.ts`
Expected: PASS and confirm the wiki changes did not break settings, analytics state, or config normalization.

- [ ] **Step 4: Run full project verification**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Run production build**

Run: `npm run build`
Expected: PASS and `package.zip` may update as part of the normal build output.

- [ ] **Step 6: Commit**

```bash
git add src/analytics/wiki-page-model.ts src/analytics/wiki-generation.ts src/analytics/wiki-ai.ts src/analytics/wiki-renderer.ts src/analytics/wiki-documents.ts src/i18n/ui.ts src/analytics/wiki-page-model.test.ts src/analytics/wiki-generation.test.ts src/analytics/wiki-ai.test.ts src/analytics/wiki-renderer.test.ts src/analytics/wiki-documents.test.ts src/components/WikiMaintainPanel.test.ts docs/superpowers/plans/2026-05-05-llm-wiki-multi-template.md
git commit -m "refactor: remove legacy single-template wiki sections"
```

## Self-Review

### Spec coverage

- Multi-template page model: covered by Task 1 and Task 5.
- Template auto-selection and low-confidence fallback: covered by Task 2 and Task 3.
- Index-first bundle building: covered by Task 2 and Task 5.
- Staged AI prompts: covered by Task 3.
- Page plan + per-section generation: covered by Task 3 and Task 4.
- Dynamic renderer, diff, and writeback: covered by Task 4.
- UI preview updates: covered by Task 5.
- Regression and removal of legacy assumptions: covered by Task 6.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” shortcuts remain.
- Every code-changing step includes a concrete code block.
- Every verification step includes an exact command and expected result.

### Type consistency

- Shared types use `WikiTemplateType`, `WikiSectionType`, `WikiSectionFormat`, `WikiTemplateDiagnosis`, `WikiPagePlan`, and `WikiSectionDraft` consistently.
- The plan uses `templateType / confidence / enabledModules / suppressedModules / sectionOrder / sectionFormats` consistently across tasks.
