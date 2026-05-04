# LLM Wiki Topic Page Design

## Summary

This spec defines how `LLM-Wiki` should generate user-facing topic knowledge pages from document-index bundles.

Confirmed constraints:

- Document index is a backend intermediate layer, not a user-facing product.
- LLM Wiki always consumes document indexes, never raw full documents.
- If indexes are missing, generate indexes first, then generate the wiki page.
- The final page is a `knowledge topic page`, not a structural analysis report and not a universal question-driven page.

## Scope

In scope:

- topic page model
- template system
- template auto-selection
- modular section enabling
- multi-stage generation flow
- citation model
- prompt requirements and anti-drift constraints

Out of scope:

- single-document wiki pages
- direct full-text ingestion during wiki generation
- vector embedding usage
- fully automatic writeback without review
- fully unconstrained page generation without templates

## Decisions

### 1. Page Type

Only `topic knowledge pages` are supported in V1.

If generation is triggered from a core document, the system should first map that document to its topic and refresh the corresponding topic wiki page.

### 2. Base Model

Use:

- a shared medium-weight base
- automatic main-template selection
- modular section enabling

Shared base sections:

1. Topic intro
2. Key information / highlights
3. Source index

### 3. Main Templates

V1 supports four templates:

- `tech_topic`
- `product_howto`
- `social_topic`
- `media_list`

### 4. Modular Sections

Sections such as the following are conditional modules, not fixed defaults:

- FAQ
- controversies
- open questions
- use cases
- method / implementation path
- comparison and choice
- troubleshooting
- representative works

### 5. Citation Strategy

Use `hybrid citations`:

- default to paragraph- or point-level citations
- use sentence-level citations for risky, dense, or potentially misleading claims

Use document links for broader synthesized passages and block links for precise claims, definitions, methods, disagreements, and edge cases.

## Template Definitions

### tech_topic

Typical for:

- concepts
- principles
- architectures
- methods
- protocols

Frequent modules:

- core principles
- implementation or method path
- use cases
- common misunderstandings

Conditional modules:

- comparison and choice
- open questions
- controversies

### product_howto

Typical for:

- software usage
- workflows
- configuration guides
- onboarding tutorials
- troubleshooting knowledge

Frequent modules:

- use cases
- basic steps
- advanced usage

Conditional modules:

- FAQ
- troubleshooting
- comparison and choice
- open questions

### social_topic

Typical for:

- public issues
- social phenomena
- policy discussions
- value conflicts
- event-centered topics

Frequent modules:

- main viewpoints or interpretive paths
- controversies
- representative cases

Conditional modules:

- impacts and consequences
- open questions
- FAQ

### media_list

Typical for:

- book / film / work lists
- topic-oriented reading or viewing paths
- author or work-cluster guides

Frequent modules:

- work map
- representative works
- reading / viewing order suggestions
- audience and use scenarios

Conditional modules:

- comparison and choice
- open questions
- controversies

## Template Auto-Selection

### Flow

Use a 3-step decision flow:

1. diagnose the topic bundle
2. choose one main template
3. decide which modules to enable or suppress

Template selection must be separated from content generation.

### Signals

Use four signal groups:

- proposition signals
- evidence-block signals
- source-distribution signals
- structure signals from core source documents

Examples:

- definitions / mechanisms / principles / architecture -> `tech_topic`
- steps / settings / errors / fixes -> `product_howto`
- viewpoints / disputes / impacts / positions -> `social_topic`
- works / authors / styles / recommendations / order -> `media_list`

### Confidence and Fallback

Confidence levels:

- high
- medium
- low

Fallback rule:

- low confidence still requires automatic template selection
- but the page must fall back to `shared base + a few high-certainty modules`
- avoid enabling speculative modules such as FAQ, controversies, or open questions unless strongly supported

Primary principle:

`When confidence is low, prefer a plain but correct page over a strongly themed but wrong page.`

## Topic Bundle

Each topic page is generated from a topic bundle, not a flat document list.

Bundle layers:

1. source map
2. proposition layer
3. evidence layer

### Source Map

Per document:

- title
- positioning
- path / tags / updated time
- topic weight or source priority

### Proposition Layer

Per document:

- propositions

### Evidence Layer

Per document:

- primarySourceBlocks
- secondarySourceBlocks

The bundle must exclude:

- link-repair semantic data
- raw full document text
- embeddings

## Generation Flow

Use a 6-stage flow:

1. build topic bundle locally
2. run template diagnosis
3. build page plan
4. generate sections one by one
5. aggregate open questions and source index
6. render markdown and bind citations locally

### Stage 1: Bundle Build

Local logic responsibilities:

- resolve topic scope
- ensure index freshness
- rebuild missing or legacy indexes first
- assemble the bundle

### Stage 2: Template Diagnosis

Model outputs only:

- templateType
- confidence
- reason
- enabledModules
- suppressedModules
- evidenceSummary

No body content should be generated in this step.

### Stage 3: Page Plan

Build a `pagePlan` after template diagnosis.

Recommended fields:

- templateType
- confidence
- coreSections
- optionalSections
- sectionOrder
- sectionGoals
- sectionFormats

### Stage 4: Section Generation

Generate one section at a time.

Recommended section formats:

- overview
- structured
- qa
- debate
- catalog

Question-driven writing is only one section mode, not the default whole-page mode.

### Stage 5: Open Questions and Source Aggregation

Aggregate page-level unresolved issues and source references.

Open questions should only appear when the current material contains genuine disputes or evidence gaps.

### Stage 6: Local Rendering

Renderer responsibilities:

- produce stable markdown structure
- insert citation markers
- build per-section citation notes
- build final source index

## Data Shape

Recommended core structures:

```ts
type WikiTemplateType =
  | 'tech_topic'
  | 'product_howto'
  | 'social_topic'
  | 'media_list'

type WikiSectionFormat =
  | 'overview'
  | 'structured'
  | 'qa'
  | 'debate'
  | 'catalog'

interface WikiTemplateDiagnosis {
  templateType: WikiTemplateType
  confidence: 'high' | 'medium' | 'low'
  reason: string
  enabledModules: string[]
  suppressedModules: string[]
  evidenceSummary: string
}

interface WikiPagePlan {
  templateType: WikiTemplateType
  confidence: 'high' | 'medium' | 'low'
  coreSections: string[]
  optionalSections: string[]
  sectionOrder: string[]
  sectionGoals: Record<string, string>
  sectionFormats: Record<string, WikiSectionFormat>
}
```

## Prompt Requirements

### Template Diagnosis Prompt

Must enforce:

- do not overreact to local keywords
- choose the most fitting single template
- suppress unsupported modules instead of forcing completeness
- wrong template selection is worse than conservative template selection

### Page Plan Prompt

Must enforce:

- shared base sections must remain
- extra modules require current-source support
- question-style sections are optional, not mandatory

### Section Synthesis Prompt

Must enforce:

- generate content according to section type
- every meaningful claim must map back to propositions or evidence blocks
- no evaluative filler language
- no unsupported abstraction or extrapolation
- if evidence is insufficient, shrink the conclusion or suppress the section

### Open Questions Prompt

Must enforce:

- only surface unresolved questions that matter for understanding the topic
- explain why the current evidence is insufficient
- optionally suggest what additional evidence would help
- attach source refs showing the gap or disagreement is real

### General System Constraints

- The model is compiling a traceable topic knowledge page, not writing a promotional overview.
- The model may only use provided propositions and evidence blocks.
- If evidence is insufficient, it must narrow the conclusion instead of filling gaps.
- Output must be strict JSON, not markdown.

## Failure Handling

- Too few usable sources: do not generate a formal wiki page; generate only a lightweight draft or insufficient-data notice.
- Low template confidence: fall back to shared base plus a few high-certainty modules.
- Section evidence too weak: suppress that section instead of filling gaps.
- Invalid source refs: drop that statement or degrade to document-level citation; never leave dangling citation markers.
- Legacy index schema: delete and rebuild instead of migrating.

## Testing Focus

- correct template recognition
- conservative fallback on low confidence
- index-first workflow when indexes are missing
- page-plan compliance with template and module rules
- FAQ / controversies / open questions enabled only when well-supported
- section synthesis grounded in propositions and evidence blocks
- question-style writing limited to appropriate modules
- hybrid citation rendering correctness
- correct use of doc links vs block links

## Knowledge Base Growth Guidance

The long-term topic knowledge base should expand by improving coverage and structure, not only by producing more wiki pages.

Recommended directions:

- use open questions as the primary signal for what new material to collect next
- fill missing layers of knowledge such as methods, conditions, failures, and examples
- split oversized topic pages into subtopics when one page can no longer hold a coherent scope
- identify persistent unresolved questions as long-term curation targets
- add comparison pages only after topic pages become stable enough

## Main Risk

The primary failure to optimize against is not “boring writing” but `drift from source meaning` or `wrong page structure caused by wrong template selection`.

Design and prompts should consistently prefer:

- grounded claims over fluent claims
- narrower conclusions over unsupported completeness
- conservative module enabling over overfitted structure

## Deliverable Reference

Primary Chinese design doc:

- `docs/LLM-Wiki主题知识页生成方案.md`
