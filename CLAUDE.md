## Project Overview

SiYuan note-taking plugin ("脉络镜 / Network lens") that performs document-level reference network analysis. Not a graph renderer — it analyzes structural relationships between documents to surface rankings, communities, bridges, orphans, dormant docs, propagation nodes, trends, and actionable suggestions.

## Architecture

**Plugin lifecycle:** `src/index.ts` (SiYuan Plugin class, extends `Plugin` from SDK) → creates dock panel via `src/plugin-dock.ts` → `src/main.ts` mounts Vue app → `src/App.vue` (main UI, ~1500 lines).

**Composable layer** (`src/composables/`):
- `use-analytics.ts` — Central state container (~1200 lines). Composes snapshot fetching, filter state, analysis results, and UI linkage. Split into:
  - `use-analytics-derived.ts` — Pure derived selectors (tag options, path candidates, orphan suggestions, detail counts).
  - `use-analytics-interactions.ts` — Interaction side-effect controllers (link sync, orphan suggestion write/undo).
  - `use-analytics-ai.ts` — AI controller.
  - `use-analytics-wiki.ts` — Wiki scope, preview, and rendering.

**Core analytics pipeline** (`src/analytics/`):
- `siyuan-data.ts` — Fetches documents and references from SiYuan DB via SQL. Two collection paths: `refs` table (`type='ref_id'`) and markdown fallback parsing.
- `internal-links.ts` — Markdown fallback: extracts `siyuan://blocks/<id>` URLs and `((block-id "title"))` block references.
- `analysis.ts` — Core graph algorithms: ranking, community detection, bridge identification, orphan/dormant classification, propagation node scoring, trend computation.
- `analysis-context.ts` — Extracted helpers for normalization, filtering, adjacency building.
- `summary-details.ts` — Re-export barrel; actual logic in `summary-cards.ts`, `summary-detail-sections.ts`, `summary-card-config.ts`.
- `theme-documents.ts` — Theme document identification and filtering options.
- `orphan-theme-links.ts` — Orphan document repair suggestions (insert/undo theme links).
- `read-status.ts` — Read/unread document classification (by tag, title prefix, or title suffix).

**API layer:** `src/api.ts` wraps SiYuan kernel HTTP API calls. The `sql()` function is the primary interface for the analytics pipeline. `getFile()` uses raw `fetch()` with special response parsing via `src/file-api-response.ts`.

**UI components:** `src/components/SiyuanTheme/` — SiYuan-styled Vue primitives (SyButton, SyCheckbox, SyIcon, SyInput, SySelect, SyTextarea).

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
| `src/analytics/*.test.ts` | Test files — read these before modifying analytics |
| `src/types/config.ts` | `PluginConfig` interface, `DEFAULT_CONFIG`, and `ensureConfigDefaults()` with legacy migration |

## Testing

Tests use Vitest and are colocated with source files throughout `src/` (not just analytics). Naming convention: `*.test.ts` (no `.spec.ts`). 

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

## Troubleshooting

**Unrecognized document links:** Check `internal-links.ts` pattern support → `siyuan-data.ts` SQL coverage → block ID resolution → filter/time-window exclusion.

**Incorrect orphan classification:** Check if it should be dormant instead → verify current window has no valid in/out links → confirm self-references aren't counted → check if filter conditions (notebook, tags, theme, keyword) are excluding links → if orphan suggestion links were just undone, refresh analysis.

**Read/unread count mismatch:** Check `read-status.ts` hit rules → verify settings page tag/prefix/suffix config → check `summary-details.ts` read card detail construction matches card mode.

**UI summary/detail mismatch:** Check `App.vue` `summaryCards` → `summary-details.ts` generation rules → `selectedSummaryCardKey` and `readCardMode` state linkage.
