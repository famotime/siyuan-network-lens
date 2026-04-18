# AI Default Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the plugin's default AI request parameters so new installs, empty configs, and provider preset resets use the requested values without overwriting existing saved user settings.

**Architecture:** Keep the current config normalization flow and provider snapshot behavior intact. Change only the shared AI default constants so all empty/default paths inherit the new values, then adjust regression tests that assert those defaults.

**Tech Stack:** TypeScript, Vue 3, Vitest

---

### Task 1: Lock Default Behavior with Tests

**Files:**
- Modify: `src/types/config.test.ts`
- Modify: `src/components/ai-provider-presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
expect(config.aiRequestTimeoutSeconds).toBe(60)
expect(config.aiMaxTokens).toBe(4096)
expect(config.aiTemperature).toBe(0.7)
expect(config.aiMaxContextMessages).toBe(1)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/types/config.test.ts src/components/ai-provider-presets.test.ts`
Expected: FAIL because the current defaults are still `30`, `10240`, and `7`.

- [ ] **Step 3: Write minimal implementation**

```ts
export const DEFAULT_AI_REQUEST_TIMEOUT_SECONDS = 60
export const DEFAULT_AI_MAX_TOKENS = 4096
export const DEFAULT_AI_TEMPERATURE = 0.7
export const DEFAULT_AI_MAX_CONTEXT_MESSAGES = 1
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/types/config.test.ts src/components/ai-provider-presets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/ai-defaults.ts src/types/config.test.ts src/components/ai-provider-presets.test.ts docs/superpowers/plans/2026-04-18-ai-default-parameters.md
git commit -m "chore: update default ai request parameters"
```

### Task 2: Verify Broader AI Defaults Consumers

**Files:**
- Modify: `src/types/ai-defaults.ts`
- Test: `src/analytics/ai-inbox.test.ts`

- [ ] **Step 1: Run existing regression coverage**

Run: `npm test -- src/analytics/ai-inbox.test.ts`
Expected: PASS and confirm request option fallback logic still matches the new shared defaults.

- [ ] **Step 2: Run full project verification**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS and `package.zip` may update as part of the normal build output.
