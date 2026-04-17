# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SiYuan note-taking plugin ("脉络镜 / Network lens") that performs document-level reference network analysis. Not a graph renderer — it analyzes structural relationships between documents to surface rankings, communities, bridges, orphans, dormant docs, propagation nodes, trends, and actionable suggestions.

## Commands

```bash
npm install --legacy-peer-deps   # Install dependencies (legacy flag required)
npm test                          # Run Vitest tests
npm run build                     # Production build (updates package.zip in root)
npm run dev                       # Watch mode with hot reload to local SiYuan workspace
```

`npm run build` updates the root `package.zip` — this is expected and should be committed with code changes. Before committing, always run `npm test && npm run build`.

## Architecture

**Plugin lifecycle:** `src/index.ts` (SiYuan Plugin class) → creates dock panel → `src/main.ts` mounts Vue app → `src/App.vue` (main UI, ~2000 lines).

**Core analytics pipeline** (`src/analytics/`):
- `siyuan-data.ts` — Fetches documents and references from SiYuan DB via SQL. Two collection paths: `refs` table (`type='ref_id'`) and markdown fallback parsing.
- `internal-links.ts` — Markdown fallback: extracts `siyuan://blocks/<id>` URLs and `((block-id "title"))` block references.
- `analysis.ts` — Core graph algorithms: ranking, community detection, bridge identification, orphan/dormant classification, propagation node scoring, trend computation.
- `summary-details.ts` — Generates detail lists for summary card click-through.
- `panel-collapse.ts` — Collapsible panel state management.

**API layer:** `src/api.ts` wraps SiYuan kernel API calls.

**UI components:** `src/components/SiyuanTheme/` — SiYuan-styled Vue components (SyButton, SyCheckbox, SyIcon, SyInput, SySelect, SyTextarea).

**i18n:** `src/i18n/ui.ts` (shared UI copy) and `src/i18n/plugin.ts` (plugin metadata fallback copy).

## Critical Domain Semantics

These definitions are stable and must not be changed without explicit confirmation:

- **Orphan documents** = no valid document-level in/out links within the current window
- **Dormant documents** = currently inactive for N days but may have historical connections
- **Bridge documents** = connect otherwise separate communities
- **Propagation nodes** = appear frequently in shortest paths between focal documents (heuristic, not strict betweenness centrality)
- Graph analysis treats edges as undirected; self-references (source doc = target doc) are excluded

## Key Files

| File | Purpose |
|------|---------|
| `src/App.vue` | Main UI: filters, summary cards, analysis panels, detail views |
| `src/analytics/analysis.ts` | Core graph analysis algorithms (~1085 lines) |
| `src/analytics/siyuan-data.ts` | DB queries and data fetching |
| `src/analytics/internal-links.ts` | Markdown link/reference fallback parsing |
| `src/analytics/summary-details.ts` | Summary card detail generation |
| `src/analytics/*.test.ts` | Test files — read these before modifying analytics |

## Testing

Tests live alongside source in `src/analytics/*.test.ts`. Key coverage: graph analysis results, trend computation, markdown fallback extraction, summary card details, panel state toggling. When adding or fixing behavior, write tests first.

## Development Notes

- **Do not modify** `plugin-sample-vite-vue/` — it's a template, not part of the plugin.
- `reference_docs/` contains SiYuan API documentation for reference.
- Path aliases: `@/*` → `src/*`
- Dev mode outputs to `$VITE_SIYUAN_WORKSPACE_PATH/data/plugins/siyuan-network-lens` (configured in `.env`).

## Troubleshooting

**Unrecognized document links:** Check `internal-links.ts` pattern support → `siyuan-data.ts` SQL coverage → block ID resolution → filter/time-window exclusion.

**Incorrect orphan classification:** Verify historical in/out links in `ReferenceRecord` → check if it should be dormant instead → confirm self-references aren't being counted.

**UI summary/detail mismatch:** Check `App.vue` `summaryCards` → `summary-details.ts` generation rules → `selectedSummaryCardKey` state.
