# Console Logging Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plugin-level console logging toggle in settings, default it to off, and keep `error` logs always enabled.

**Architecture:** Extend `PluginConfig` with a single boolean flag, expose it in the settings UI, and route existing AI logging through a shared logger helper that consults the flag at call time. Keep the AI service logger interface unchanged and inject the helper from feature entry points.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vite

---

### Task 1: Config defaults

**Files:**
- Modify: `src/types/config.ts`
- Test: `src/types/config.test.ts`

- [ ] Step 1: Write a failing config test for the new default and invalid-value fallback.
- [ ] Step 2: Run `npm test -- src/types/config.test.ts` and confirm the new assertions fail for the expected reason.
- [ ] Step 3: Add `enableConsoleLogging` to `PluginConfig`, `DEFAULT_CONFIG`, and `ensureConfigDefaults`.
- [ ] Step 4: Re-run `npm test -- src/types/config.test.ts` and confirm it passes.

### Task 2: Settings UI

**Files:**
- Modify: `src/components/SettingPanel.vue`
- Test: `src/components/SettingPanel.test.ts`

- [ ] Step 1: Write a failing setting panel test asserting the new debug section and toggle label render.
- [ ] Step 2: Run `npm test -- src/components/SettingPanel.test.ts` and confirm the new assertion fails.
- [ ] Step 3: Add the new settings group and checkbox bound to `config.enableConsoleLogging`.
- [ ] Step 4: Re-run `npm test -- src/components/SettingPanel.test.ts` and confirm it passes.

### Task 3: Shared logger helper

**Files:**
- Create: `src/utils/plugin-logger.ts`
- Test: `src/utils/plugin-logger.test.ts`

- [ ] Step 1: Write failing tests covering disabled `info`/`warn`/`log`/`debug`, enabled output, and always-on `error`.
- [ ] Step 2: Run `npm test -- src/utils/plugin-logger.test.ts` and confirm the new tests fail.
- [ ] Step 3: Implement the shared logger helper with runtime config lookup.
- [ ] Step 4: Re-run `npm test -- src/utils/plugin-logger.test.ts` and confirm it passes.

### Task 4: Wire AI entry points

**Files:**
- Modify: `src/components/use-setting-panel-ai.ts`
- Modify: `src/composables/use-analytics.ts`

- [ ] Step 1: Inject the shared logger when creating AI services in both entry points.
- [ ] Step 2: Run targeted tests for AI-related UI/state paths to catch integration regressions.

### Task 5: Verification

**Files:**
- Verify: `src/types/config.test.ts`
- Verify: `src/components/SettingPanel.test.ts`
- Verify: `src/utils/plugin-logger.test.ts`

- [ ] Step 1: Run `npm test -- src/types/config.test.ts src/components/SettingPanel.test.ts src/utils/plugin-logger.test.ts`.
- [ ] Step 2: Run `npm test`.
- [ ] Step 3: Run `npm run build`.
