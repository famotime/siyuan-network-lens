# LLM Wiki Chat Mention Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the LLM Wiki chat `@` mention popup so it filters wiki pages by title as the user types, stays usable in short dialog heights, and shows at most three visible rows with a `...` overflow hint.

**Architecture:** Keep mention parsing and filtering in `use-wiki-chat-session.ts` as the single source of truth, and make `WikiChatDialog.vue` a thin view layer that renders a floating popup anchored to the input area. Extend tests in the composable and component to lock the filtering, layout, and overflow behavior before implementation.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vite, SiYuan theme variables

---

### Task 1: Move mention parsing into the session composable

**Files:**
- Modify: `src/composables/use-wiki-chat-session.ts`
- Test: `src/composables/use-wiki-chat-session.test.ts`

- [ ] **Step 1: Write the failing tests for mention parsing and title-only filtering**

Append the following block to `src/composables/use-wiki-chat-session.test.ts`:

```ts
describe('mention filtering', () => {
  function createMentionSession() {
    return createWikiChatSession({
      scope: ref({ mode: 'topic' } as WikiChatScope),
      wikiPages: ref([
        makePage('doc-1', '机器学习-llm-wiki'),
        makePage('doc-2', '深度学习-llm-wiki'),
        makePage('doc-3', '机器翻译-llm-wiki'),
        { ...makePage('doc-4', '强化学习-llm-wiki'), summary: '机器' },
      ]),
      forwardProxy: vi.fn(),
      getBlockKramdown: vi.fn(),
      config: ref({
        aiBaseUrl: 'http://localhost',
        aiApiKey: 'key',
        aiModel: 'model',
        aiRequestTimeoutSeconds: 60,
        aiMaxTokens: 4096,
        aiTemperature: 0.7,
        aiMaxContextMessages: 1,
      }),
    })
  }

  it('shows all wiki pages when the user only typed @', () => {
    const session = createMentionSession()

    session.inputText.value = '@'
    session.syncMentionState(1)

    expect(session.mentionPopupVisible.value).toBe(true)
    expect(session.mentionFilter.value).toBe('')
    expect(session.filteredPages.value.map(page => page.title)).toEqual([
      '机器学习-llm-wiki',
      '深度学习-llm-wiki',
      '机器翻译-llm-wiki',
      '强化学习-llm-wiki',
    ])
  })

  it('filters by title substring only and ignores summary matches', () => {
    const session = createMentionSession()

    session.inputText.value = '@机器'
    session.syncMentionState(3)

    expect(session.mentionPopupVisible.value).toBe(true)
    expect(session.mentionFilter.value).toBe('机器')
    expect(session.filteredPages.value.map(page => page.title)).toEqual([
      '机器学习-llm-wiki',
      '机器翻译-llm-wiki',
    ])
  })

  it('matches titles case-insensitively', () => {
    const session = createMentionSession()

    session.inputText.value = '@LLM'
    session.syncMentionState(4)

    expect(session.filteredPages.value).toHaveLength(4)
  })

  it('hides the popup when the mention has no title matches', () => {
    const session = createMentionSession()

    session.inputText.value = '@不存在'
    session.syncMentionState(4)

    expect(session.mentionFilter.value).toBe('不存在')
    expect(session.filteredPages.value).toEqual([])
    expect(session.mentionPopupVisible.value).toBe(false)
  })

  it('hides the popup and clears the filter when the cursor is not in an active mention', () => {
    const session = createMentionSession()

    session.inputText.value = '普通问题'
    session.syncMentionState(session.inputText.value.length)

    expect(session.mentionPopupVisible.value).toBe(false)
    expect(session.mentionFilter.value).toBe('')
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: FAIL because `syncMentionState` is not exported and the popup visibility rules do not match the new behavior.

- [ ] **Step 3: Add a composable method that owns mention parsing and popup visibility**

Update `src/composables/use-wiki-chat-session.ts` with these concrete changes:

1. Extend `WikiChatSessionController` to expose `syncMentionState: (cursorPos: number) => void`.
2. Replace the internal `checkMention` helper with an exported controller method named `syncMentionState`.
3. Keep filtering title-only, but remove the current `.slice(0, 8)` truncation so the component can decide the visible rows and overflow hint.
4. Make popup visibility depend on active mention state and filtered results.

Use this implementation inside the composable:

```ts
  const filteredPages = computed(() => {
    const filter = mentionFilter.value.toLowerCase()
    return wikiPages.value.filter(page => page.title.toLowerCase().includes(filter))
  })

  function syncMentionState(cursorPos: number) {
    const beforeCursor = inputText.value.slice(0, cursorPos)
    const atMatch = beforeCursor.match(/@([^@\s]*)$/)

    if (!atMatch) {
      mentionFilter.value = ''
      mentionPopupVisible.value = false
      return
    }

    mentionFilter.value = atMatch[1]
    mentionPopupVisible.value = filteredPages.value.length > 0
  }
```

5. In `switchSource(page)`, keep the current replacement behavior and add `mentionFilter.value = ''` after hiding the popup.
6. In `resetSession()`, keep clearing `mentionFilter` and `mentionPopupVisible`.
7. Return `syncMentionState` from the controller object.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/use-wiki-chat-session.ts src/composables/use-wiki-chat-session.test.ts
git commit -m "feat: 同步 llm wiki 对话 @ 提及筛选状态"
```

---

### Task 2: Render the mention popup as a floating input-anchored overlay

**Files:**
- Modify: `src/components/WikiChatDialog.vue`
- Test: `src/components/WikiChatDialog.test.ts`

- [ ] **Step 1: Write the failing component assertions for the floating popup**

Replace the contents of `src/components/WikiChatDialog.test.ts` with:

```ts
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('WikiChatDialog', () => {
  it('renders assistant replies through the shared markdown renderer', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain("import { renderSimpleMarkdown } from '@/utils/markdown'")
    expect(source).toContain('v-html="renderSimpleMarkdown(msg.content)"')
  })

  it('routes input events through the shared mention sync method', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain('syncMentionState(cursorPos)')
    expect(source).not.toContain("mentionPopupVisible.value = true")
    expect(source).not.toContain("mentionPopupVisible.value = false")
  })

  it('limits the popup to three visible items and shows an overflow hint', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain('const MAX_VISIBLE_MENTION_ITEMS = 3')
    expect(source).toContain('const visibleMentionPages = computed(() => filteredPages.value.slice(0, MAX_VISIBLE_MENTION_ITEMS))')
    expect(source).toContain('const hasMoreMentions = computed(() => filteredPages.value.length > MAX_VISIBLE_MENTION_ITEMS)')
    expect(source).toContain('v-for="(page, index) in visibleMentionPages"')
    expect(source).toContain('v-if="hasMoreMentions"')
    expect(source).toContain('wiki-chat-dialog__mention-overflow')
  })

  it('anchors the mention popup above the input area as an absolutely positioned overlay', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain('class="wiki-chat-dialog__input-shell"')
    expect(source).toContain('.wiki-chat-dialog__input-shell {')
    expect(source).toContain('position: relative;')
    expect(source).toContain('.wiki-chat-dialog__mention-popup {')
    expect(source).toContain('position: absolute;')
    expect(source).toContain('bottom: calc(100% + 8px);')
    expect(source).toContain('max-height: 148px;')
    expect(source).toContain('overflow-y: auto;')
  })

  it('keeps the improved assistant contrast tokens', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain('color-mix(in srgb, var(--b3-theme-on-background) 94%, white 6%)')
    expect(source).toContain('color-mix(in srgb, var(--b3-theme-on-background) 72%, transparent)')
    expect(source).toContain('color-mix(in srgb, var(--b3-theme-surface-light) 88%, var(--b3-theme-background))')
  })
})
```

- [ ] **Step 2: Run the focused component test to verify it fails**

Run: `npx vitest run src/components/WikiChatDialog.test.ts`
Expected: FAIL because the component still toggles popup visibility locally and renders the popup in normal layout flow.

- [ ] **Step 3: Refactor the dialog to render the popup above the input area**

Update `src/components/WikiChatDialog.vue` with these concrete edits:

1. Change the Vue import to include `computed`:

```ts
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
```

2. Pull `mentionFilter` out of the composable destructure only if needed for debugging; otherwise keep destructuring minimal but add `syncMentionState`:

```ts
const {
  session,
  inputText,
  mentionPopupVisible,
  filteredPages,
  sendMessage,
  switchSource,
  buildSaveMarkdown,
  syncMentionState,
} = createWikiChatSession({
```

3. Add view-only constants and computed state after `mentionSelectedIndex`:

```ts
const MAX_VISIBLE_MENTION_ITEMS = 3
const visibleMentionPages = computed(() => filteredPages.value.slice(0, MAX_VISIBLE_MENTION_ITEMS))
const hasMoreMentions = computed(() => filteredPages.value.length > MAX_VISIBLE_MENTION_ITEMS)
```

4. Replace `handleInput()` with:

```ts
function handleInput() {
  const textarea = inputRef.value
  if (!textarea) return
  const cursorPos = textarea.selectionStart ?? inputText.value.length
  syncMentionState(cursorPos)
}
```

5. In `handleKeydown`, switch all mention navigation to `visibleMentionPages.value`:

```ts
  if (mentionPopupVisible.value && visibleMentionPages.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionSelectedIndex.value = Math.min(visibleMentionPages.value.length - 1, mentionSelectedIndex.value + 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionSelectedIndex.value = Math.max(0, mentionSelectedIndex.value - 1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const page = visibleMentionPages.value[mentionSelectedIndex.value]
      if (page) {
        selectMention(page)
      }
      return
    }
  }
```

6. Replace the current standalone mention popup block and input area block with an input shell wrapper:

```vue
    <div class="wiki-chat-dialog__input-shell">
      <div
        v-if="mentionPopupVisible && visibleMentionPages.length > 0"
        class="wiki-chat-dialog__mention-popup"
      >
        <div class="wiki-chat-dialog__mention-header">
          {{ t('llmWiki.chat.mentionPlaceholder') }}
        </div>
        <div class="wiki-chat-dialog__mention-list">
          <div
            v-for="(page, index) in visibleMentionPages"
            :key="page.documentId"
            class="wiki-chat-dialog__mention-item"
            :class="{ 'wiki-chat-dialog__mention-item--active': index === mentionSelectedIndex }"
            @mousedown.prevent="selectMention(page)"
          >
            <svg class="wiki-chat-dialog__inline-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <span class="wiki-chat-dialog__mention-title">{{ page.title }}</span>
          </div>
        </div>
        <div
          v-if="hasMoreMentions"
          class="wiki-chat-dialog__mention-overflow"
        >
          ...
        </div>
      </div>

      <div class="wiki-chat-dialog__input-area">
        <textarea
          ref="inputRef"
          v-model="inputText"
          :placeholder="t('llmWiki.chat.inputWithMentionHint')"
          :disabled="session.isLoading"
          rows="1"
          @input="handleInput"
          @keydown="handleKeydown"
        />
        <button
          class="wiki-chat-dialog__send-btn"
          :disabled="session.isLoading || !inputText.trim()"
          @click="sendMessage"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
```

7. Add and update the CSS blocks below:

```css
.wiki-chat-dialog__input-shell {
  position: relative;
}

.wiki-chat-dialog__mention-popup {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: calc(100% + 8px);
  background: color-mix(in srgb, var(--b3-theme-surface) 92%, var(--b3-theme-background));
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  box-shadow: 0 16px 28px color-mix(in srgb, var(--b3-theme-background) 28%, transparent);
  overflow: hidden;
  font-size: 12px;
  z-index: 2;
}

.wiki-chat-dialog__mention-list {
  max-height: 148px;
  overflow-y: auto;
}

.wiki-chat-dialog__mention-header {
  padding: 6px 12px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 70%, transparent);
  font-size: 11px;
  border-bottom: 1px solid var(--b3-border-color);
  background: color-mix(in srgb, var(--b3-theme-background) 76%, var(--b3-theme-surface));
}

.wiki-chat-dialog__mention-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wiki-chat-dialog__mention-item:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
}

.wiki-chat-dialog__mention-item--active {
  background: color-mix(in srgb, var(--b3-theme-primary) 14%, var(--b3-theme-background));
}

.wiki-chat-dialog__mention-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wiki-chat-dialog__mention-overflow {
  padding: 4px 12px 8px;
  border-top: 1px solid color-mix(in srgb, var(--b3-border-color) 72%, transparent);
  color: color-mix(in srgb, var(--b3-theme-on-background) 64%, transparent);
  text-align: center;
  letter-spacing: 0.08em;
}
```

8. Remove the old flow-layout mention popup CSS block so only the overlay version remains.

- [ ] **Step 4: Run the focused component test to verify it passes**

Run: `npx vitest run src/components/WikiChatDialog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WikiChatDialog.vue src/components/WikiChatDialog.test.ts
git commit -m "feat: 调整 llm wiki 对话提及浮层布局与显示"
```

---

### Task 3: Verify the end-to-end mention behavior and package output

**Files:**
- Modify: `package.zip` (build artifact)

- [ ] **Step 1: Run the two focused test files together**

Run: `npx vitest run src/composables/use-wiki-chat-session.test.ts src/components/WikiChatDialog.test.ts`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: PASS and `package.zip` updated

- [ ] **Step 4: Commit the verified implementation**

```bash
git add src/composables/use-wiki-chat-session.ts src/composables/use-wiki-chat-session.test.ts src/components/WikiChatDialog.vue src/components/WikiChatDialog.test.ts package.zip
git commit -m "fix: 修复 llm wiki 对话 @ 提及弹窗筛选与遮挡"
```
