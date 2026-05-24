# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SiYuan note-taking plugin ("脉络镜 / Network lens") that performs document-level reference network analysis. Not a graph renderer — it analyzes structural relationships between documents to surface rankings, communities, bridges, orphans, dormant docs, propagation nodes, trends, and actionable suggestions.

## Development Commands

```bash
pnpm install              # Install dependencies (CI uses pnpm 8)
pnpm test                 # Run all tests (vitest run)
pnpm test -- path/to.test.ts   # Run a single test file
pnpm build                # Production build → ./dist + package.zip
pnpm dev                  # Watch mode (builds to SiYuan workspace if VITE_SIYUAN_WORKSPACE_PATH is set in .env)
npx eslint .              # Lint (no dedicated script; uses @antfu/eslint-config flat config)
```

- `pnpm build` produces `package.zip` in the project root — this is the artifact used for releases.
- CI (`.github/workflows/release.yml`) triggers on `v*` tags: pnpm install → pnpm build → upload `package.zip` as GitHub Release.
- Release versioning: `pnpm release` (auto-detect bump) or `pnpm release:patch|minor|major`. Updates `plugin.json` + `package.json` versions, commits, and tags.
- Path alias: `@/` maps to `src/`; `@/libs/` maps to `src/libs/` (configured in both `tsconfig.json` and `vite.config.ts`).

## Architecture

**Plugin lifecycle:** `src/index.ts` (SiYuan Plugin class, extends `Plugin` from SDK) → creates dock panel via `src/plugin-dock.ts` → `src/main.ts` mounts Vue app → `src/App.vue` (main UI, ~1500 lines).

**Composable layer** (`src/composables/`):
- `use-analytics.ts` — Central state container (~1200 lines). Composes snapshot fetching, filter state, analysis results, and UI linkage. Split into:
  - `use-analytics-derived.ts` — Pure derived selectors (tag options, path candidates, orphan suggestions, detail counts).
  - `use-analytics-interactions.ts` — Interaction side-effect controllers (link sync, orphan suggestion write/undo).
  - `use-analytics-ai.ts` — AI controller.
  - `use-analytics-wiki.ts` — Wiki scope, preview, and rendering.
  - `use-analytics-wiki-actions.ts` — Wiki action dispatchers (generate, maintain, diff apply).
  - `use-analytics-llm-wiki.ts` — LLM Wiki lifecycle orchestration (generate, preview, publish).
  - `use-analytics-llm-wiki-chat.ts` — LLM Wiki chat session state.
  - `use-analytics-selection-sync.ts` — Cross-panel selection synchronization.
  - `use-analytics-document-index.ts` — Document index source block management.

**Core analytics pipeline** (`src/analytics/`):
- `siyuan-data.ts` — Fetches documents and references from SiYuan DB via SQL. Two collection paths: `refs` table (`type='ref_id'`) and markdown fallback parsing.
- `internal-links.ts` — Markdown fallback: extracts `siyuan://blocks/<id>` URLs and `((block-id "title"))` block references.
- `analysis.ts` — Core graph algorithms: ranking, community detection, bridge identification, orphan/dormant classification, propagation node scoring, trend computation.
- `analysis-context.ts` — Extracted helpers for normalization, filtering, adjacency building.
- `summary-details.ts` — Re-export barrel; actual logic in `summary-cards.ts`, `summary-detail-sections.ts`, `summary-card-config.ts`.
- `theme-documents.ts` — Theme document identification and filtering options.
- `orphan-theme-links.ts` — Orphan document repair suggestions (insert/undo theme links).
- `read-status.ts` — Read/unread document classification (by tag, title prefix, or title suffix).

**AI subsystem** (`src/analytics/`):
- `ai-inbox.ts` — AI inbox aggregation (collects pending AI tasks across modules).
- `ai-prompts.ts` — Prompt construction helpers for LLM requests.
- `ai-link-suggestions.ts` — AI-generated link repair suggestions.
- `ai-link-repair-store.ts` — Persistent store for AI link repair state (applied/undone).
- `ai-document-summary.ts` — AI document summarization.
- `ai-index-store.ts` — AI-generated document index store.
- `llm-prompt-types.ts` — Shared prompt type definitions.
- `llm-wiki-prompts.ts` — LLM Wiki-specific prompt templates.
- `llm-wiki-chat-service.ts` — Chat session service for LLM Wiki conversations.
- `llm-wiki-maintain-service.ts` — Wiki maintenance service (diff generation, apply).

**LLM Wiki pipeline** (`src/analytics/wiki-*.ts`):
- `wiki-scope.ts` — Wiki scope calculation (which documents to include).
- `wiki-documents.ts` — Wiki document discovery and filtering.
- `wiki-source-docs.ts` — Source document resolution for wiki generation.
- `wiki-template-model.ts` — Wiki template data model.
- `wiki-template-selection.ts` — Template selection logic.
- `wiki-page-model.ts` — Wiki page data model.
- `wiki-generation.ts` — Wiki content generation orchestration.
- `wiki-ai.ts` — Wiki-specific AI interaction layer.
- `wiki-store.ts` — Wiki state persistence.
- `wiki-preview-store.ts` — Wiki preview state management.
- `wiki-diff.ts` — Wiki diff computation (current vs. generated).
- `wiki-renderer.ts` — Wiki markdown rendering.
- `wiki-index.ts` — Wiki index page management.

**API layer:** `src/api.ts` wraps SiYuan kernel HTTP API calls. The `sql()` function is the primary interface for the analytics pipeline. `getFile()` uses raw `fetch()` with special response parsing via `src/file-api-response.ts`.

**UI components:** `src/components/SiyuanTheme/` — SiYuan-styled Vue primitives (SyButton, SyCheckbox, SyIcon, SyInput, SySelect, SyTextarea).

**Feature components** (`src/components/`):
- `SummaryCardsGrid.vue` — Summary card grid layout.
- `SummaryDetailSection.vue` — Summary detail panel.
- `RankingPanel.vue` — Document ranking display.
- `OrphanDetailPanel.vue` / `DormantDetailPanel.vue` — Orphan/dormant detail views.
- `FilterSelect.vue` / `ThemeMultiSelect.vue` — Filter controls.
- `SettingPanel.vue` — Plugin settings (with data, AI, secret field, sections sub-modules).
- `AIInboxPanel.vue` — AI inbox display.
- `WikiCardsSection.vue` / `WikiMaintainPanel.vue` / `WikiMaintainDiffDialog.vue` — Wiki management UI.
- `WikiChatDialog.vue` — LLM Wiki chat interface.

**Plugin subsystem** (`src/plugin/`):
- `wiki-command-provider.ts` — Registers SiYuan commands for wiki operations.
- `alpha-feature-config.ts` — Alpha/feature-flag configuration.

**i18n:** `src/i18n/ui.ts` — Bilingual text map (en_US / zh_CN) with `t(key, params?)` function. Keys are dot-separated (e.g., `t('panel.orphan.title')`). Supports named interpolation: `t('msg.count', { n: 5 })`. Auto-detects locale from `window.siyuan.languages`. Plugin-level text in `src/i18n/plugin.ts`. SiYuan manifest-level strings in `en_US.json` / `zh_CN.json`.

## Critical Domain Semantics

These definitions are stable and must not be changed without explicit confirmation:

- **Orphan documents** = no valid document-level in/out links within the current window
- **Dormant documents** = currently inactive for N days but may have historical connections
- **Bridge documents** = connect otherwise separate communities
- **Propagation nodes** = appear frequently in shortest paths between focal documents (heuristic, not strict betweenness centrality)
- Graph analysis treats edges as undirected; self-references (source doc = target doc) are excluded
- "Read" documents are determined by matching any of: read tag, title prefix, or title suffix (configured in settings)
- Theme document names = document title with configured prefix/suffix stripped

## Key Files

| File | Purpose |
|------|---------|
| `src/App.vue` | Main UI: filters, summary cards, analysis panels, detail views (~1500 lines) |
| `src/composables/use-analytics.ts` | Central state container — composes snapshot, filtering, analysis, and UI state (~1200 lines) |
| `src/analytics/analysis.ts` | Core graph analysis algorithms (~950 lines) |
| `src/analytics/siyuan-data.ts` | DB queries and data fetching |
| `src/analytics/internal-links.ts` | Markdown link/reference fallback parsing |
| `src/analytics/summary-details.ts` | Summary card detail generation (re-export barrel) |
| `src/analytics/llm-wiki-chat-service.ts` | LLM Wiki chat session service |
| `src/analytics/llm-wiki-maintain-service.ts` | Wiki maintenance (diff generation, apply) |
| `src/analytics/wiki-generation.ts` | Wiki content generation orchestration |
| `src/analytics/ai-inbox.ts` | AI inbox aggregation |
| `src/analytics/*.test.ts` | Test files — read these before modifying analytics |
| `src/types/config.ts` | `PluginConfig` interface, `DEFAULT_CONFIG`, and `ensureConfigDefaults()` with legacy migration |
| `src/types/ai-provider.ts` | AI provider preset types and configuration maps |

## Testing

Tests use Vitest (default config, no separate vitest config file) and are colocated with source files throughout `src/` (not just analytics). Naming convention: `*.test.ts` (no `.spec.ts`).

When adding or fixing behavior, write tests first. Tests import from `vitest` directly (`describe`, `expect`, `it`). Some tests mock `globalThis.siyuan` and clean it up in `afterEach`.

## Code Style

ESLint is configured with `@antfu/eslint-config` (see `eslint.config.mjs`):

- **Quotes:** Single quotes
- **Indent:** 2 spaces
- **Vue block order:** template → script → style
- **Vue attributes:** One attribute per line (multiline), max 1 per line
- **Comma-dangle:** Always multiline
- **TypeScript:** `strict: false` in tsconfig; `consistent-type-imports` is off
- **Arrow parens:** Always required
- Custom i18n validation plugin at `src/utils/eslint/i18n-validate-keys.mjs`

## Development Notes

- **Do not modify** `plugin-sample-vite-vue/` — it's a template, not part of the plugin.
- `reference_docs/` contains SiYuan API documentation for reference.
- Config is persisted as reactive Vue object via SiYuan's `loadData`/`saveData`, auto-saved on change.
- The AI/LLM Wiki features depend on external AI provider APIs (OpenAI-compatible endpoints). AI configuration is stored in `PluginConfig` (`aiProviderPreset`, `aiBaseUrl`, `aiApiKey`, `aiModel`).
- `src/types/` contains shared type definitions: `config.ts` (PluginConfig), `ai-provider.ts` (provider presets), `ai-defaults.ts` (default AI parameters).

## Troubleshooting

**Unrecognized document links:** Check `internal-links.ts` pattern support → `siyuan-data.ts` SQL coverage → block ID resolution → filter/time-window exclusion.

**Incorrect orphan classification:** Check if it should be dormant instead → verify current window has no valid in/out links → confirm self-references aren't counted → check if filter conditions (notebook, tags, theme, keyword) are excluding links → if orphan suggestion links were just undone, refresh analysis.

**Read/unread count mismatch:** Check `read-status.ts` hit rules → verify settings page tag/prefix/suffix config → check `summary-details.ts` read card detail construction matches card mode.

**UI summary/detail mismatch:** Check `App.vue` `summaryCards` → `summary-details.ts` generation rules → `selectedSummaryCardKey` and `readCardMode` state linkage.

**LLM Wiki generation issues:** Check `wiki-scope.ts` scope calculation → `wiki-template-selection.ts` template matching → `wiki-generation.ts` orchestration → `llm-wiki-prompts.ts` prompt construction → AI provider connectivity (`aiBaseUrl`, `aiApiKey`).

**AI inbox not showing suggestions:** Check `ai-inbox.ts` aggregation → individual module stores (`ai-link-repair-store.ts`, `ai-index-store.ts`) → `use-analytics-ai.ts` composable wiring → `aiEnabled` config flag.
