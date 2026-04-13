# Today Suggestion History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the latest three "today suggestion" analysis snapshots and let the detail panel switch between the latest result and saved history entries.

**Architecture:** Add a dedicated history store for AI inbox snapshots, load it in the analytics state layer, and make the today-suggestion detail render either the current result or a selected history snapshot. Update the panel header UI to render three compact history buttons with tooltip metadata ahead of the reanalyze action.

**Tech Stack:** Vue 3, TypeScript, Vitest, SiYuan plugin storage API

---

### Task 1: Add a persistent history store

**Files:**
- Create: `src/analytics/today-suggestion-history-store.ts`
- Test: `src/analytics/today-suggestion-history-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('keeps the latest three valid history snapshots in newest-first order', async () => {
  const storage = createMemoryStorage()
  const store = createTodaySuggestionHistoryStore(storage)

  await store.saveEntry(buildEntry('2026-04-13T08:00:00.000Z'))
  await store.saveEntry(buildEntry('2026-04-13T09:00:00.000Z'))
  await store.saveEntry(buildEntry('2026-04-13T10:00:00.000Z'))
  await store.saveEntry(buildEntry('2026-04-13T11:00:00.000Z'))

  const snapshot = await store.loadSnapshot()

  expect(snapshot.entries.map(entry => entry.generatedAt)).toEqual([
    '2026-04-13T11:00:00.000Z',
    '2026-04-13T10:00:00.000Z',
    '2026-04-13T09:00:00.000Z',
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analytics/today-suggestion-history-store.test.ts`
Expected: FAIL because the store file and exports do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface TodaySuggestionHistoryEntry {
  id: string
  generatedAt: string
  timeRange: string
  filters: {
    notebook?: string
    tags?: string[]
    themeNames?: string[]
    keyword?: string
  }
  summaryCount: number
  result: AiInboxResult
}

export function createTodaySuggestionHistoryStore(storage: PluginStorageLike) {
  return {
    async loadSnapshot() {
      const data = await storage.loadData?.(TODAY_SUGGESTION_HISTORY_STORAGE_NAME)
      return normalizeSnapshot(data)
    },
    async saveEntry(entry: TodaySuggestionHistoryEntry) {
      const snapshot = normalizeSnapshot(await storage.loadData?.(TODAY_SUGGESTION_HISTORY_STORAGE_NAME))
      snapshot.entries = [entry, ...snapshot.entries]
        .filter(isValidEntry)
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
        .slice(0, 3)
      await storage.saveData?.(TODAY_SUGGESTION_HISTORY_STORAGE_NAME, snapshot)
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analytics/today-suggestion-history-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/today-suggestion-history-store.ts src/analytics/today-suggestion-history-store.test.ts
git commit -m "feat: persist today suggestion history"
```

### Task 2: Wire history into analytics state

**Files:**
- Modify: `src/composables/use-analytics-ai.ts`
- Modify: `src/composables/use-analytics.ts`
- Test: `src/composables/use-analytics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('stores the latest three today suggestion snapshots and shows selected history detail', async () => {
  const state = createAnalyticsStateForTest()

  await state.generateAiInbox()
  await state.generateAiInbox()
  await state.generateAiInbox()

  expect(state.aiInboxHistory.value).toHaveLength(3)

  state.selectAiInboxHistory(state.aiInboxHistory.value[1].id)

  expect(state.selectedSummaryDetail.value?.kind).toBe('aiInbox')
  expect(state.selectedSummaryDetail.value?.result?.generatedAt).toBe(state.aiInboxHistory.value[1].result.generatedAt)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/composables/use-analytics.test.ts`
Expected: FAIL because history state and selection APIs do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
const aiInboxHistory = ref<TodaySuggestionHistoryEntry[]>([])
const selectedAiInboxHistoryId = ref('')

const displayedAiInboxResult = computed(() => {
  const selectedHistory = aiInboxHistory.value.find(item => item.id === selectedAiInboxHistoryId.value)
  return selectedHistory?.result ?? aiInboxResult.value
})

async function loadAiInboxHistory() {
  aiInboxHistory.value = await todaySuggestionHistoryStore.loadEntries()
}

function selectAiInboxHistory(historyId: string) {
  selectedAiInboxHistoryId.value = selectedAiInboxHistoryId.value === historyId ? '' : historyId
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/composables/use-analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-analytics-ai.ts src/composables/use-analytics.ts src/composables/use-analytics.test.ts
git commit -m "feat: wire today suggestion history state"
```

### Task 3: Render history buttons in the detail header

**Files:**
- Modify: `src/components/SummaryDetailSection.vue`
- Test: `src/components/SummaryDetailSection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('renders history buttons before the reanalyze action with tooltip metadata', async () => {
  const html = await renderSummaryDetailSection({
    detail: buildTodaySuggestionDetail(),
    aiInboxHistory: [
      buildHistoryEntry('history-1', '2026-04-13T10:00:00.000Z'),
      buildHistoryEntry('history-2', '2026-04-13T09:00:00.000Z'),
      buildHistoryEntry('history-3', '2026-04-13T08:00:00.000Z'),
    ],
  })

  expect(html).toContain('>1<')
  expect(html).toContain('>2<')
  expect(html).toContain('>3<')
  expect(html.indexOf('history-button')).toBeLessThan(html.indexOf('重新分析'))
  expect(html).toContain('生成时间')
  expect(html).toContain('时间窗口')
  expect(html).toContain('建议数')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/SummaryDetailSection.test.ts`
Expected: FAIL because the header does not render history buttons yet.

- [ ] **Step 3: Write minimal implementation**

```vue
<div v-if="detail.kind === 'aiInbox' && aiInboxHistory.length" class="panel-header__history">
  <button
    v-for="(entry, index) in aiInboxHistory"
    :key="entry.id"
    class="history-button"
    :class="{ 'history-button--active': entry.id === selectedAiInboxHistoryId }"
    :title="buildAiInboxHistoryTooltip(entry)"
    type="button"
    @click="selectAiInboxHistory(entry.id)"
  >
    {{ index + 1 }}
  </button>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/SummaryDetailSection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SummaryDetailSection.vue src/components/SummaryDetailSection.test.ts
git commit -m "feat: add today suggestion history buttons"
```

### Task 4: Verify integrated behavior

**Files:**
- Modify: `src/composables/use-analytics.test.ts`
- Modify: `src/components/SummaryDetailSection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('keeps history after refresh and resets the selected history after a new successful analysis', async () => {
  const state = createAnalyticsStateForTest()

  await state.generateAiInbox()
  const historyId = state.aiInboxHistory.value[0].id
  state.selectAiInboxHistory(historyId)

  await state.refresh()
  expect(state.aiInboxHistory.value[0].id).toBe(historyId)

  await state.generateAiInbox()
  expect(state.selectedAiInboxHistoryId.value).toBe('')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/composables/use-analytics.test.ts src/components/SummaryDetailSection.test.ts`
Expected: FAIL because refresh and reanalyze behavior are not fully wired yet.

- [ ] **Step 3: Write minimal implementation**

```ts
function resetTransientAsyncState() {
  aiInboxError.value = ''
  aiConnectionMessage.value = ''
  aiInboxResult.value = null
}

async function persistAiInboxHistory(entry: TodaySuggestionHistoryEntry) {
  await todaySuggestionHistoryStore.saveEntry(entry)
  aiInboxHistory.value = await todaySuggestionHistoryStore.loadEntries()
  selectedAiInboxHistoryId.value = ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/composables/use-analytics.test.ts src/components/SummaryDetailSection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-analytics.test.ts src/components/SummaryDetailSection.test.ts
git commit -m "test: cover today suggestion history flows"
```

### Task 5: Final verification

**Files:**
- Modify: `package.zip`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/analytics/today-suggestion-history-store.test.ts src/composables/use-analytics.test.ts src/components/SummaryDetailSection.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS and `package.zip` updated

- [ ] **Step 4: Commit**

```bash
git add package.zip
git commit -m "build: refresh package zip"
```
