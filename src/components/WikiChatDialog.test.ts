import { readFile } from 'node:fs/promises'
import { renderToString } from '@vue/server-renderer'
import { parse } from '@vue/compiler-sfc'
import { computed, createSSRApp, h, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lifecycleCallbacks = {
  mounted: [] as Array<() => void>,
  beforeUnmount: [] as Array<() => void>,
}

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (callback: () => void) => {
      lifecycleCallbacks.mounted.push(callback)
    },
    onBeforeUnmount: (callback: () => void) => {
      lifecycleCallbacks.beforeUnmount.push(callback)
    },
    useSSRContext: () => ({ modules: new Set<string>() }),
  }
})

const syncMentionStateMock = vi.fn()
const sendMessageMock = vi.fn()
const switchSourceMock = vi.fn()
const buildSaveMarkdownMock = vi.fn(() => '')

const sessionState = reactive({
  messages: [] as Array<{ id: string, role: string, content: string, timestamp: number, sourcePage?: { title: string } }>,
  isLoading: false,
  error: '',
  currentSourcePage: null as null | { title: string },
})

const inputTextRef = ref('')
const mentionPopupVisibleRef = ref(false)
const filteredPagesRef = ref<Array<{ documentId: string, title: string }>>([])

vi.mock('@/composables/use-wiki-chat-session', () => ({
  createWikiChatSession: vi.fn(() => ({
    session: ref(sessionState),
    inputText: inputTextRef,
    mentionPopupVisible: mentionPopupVisibleRef,
    mentionFilter: ref(''),
    filteredPages: computed(() => filteredPagesRef.value),
    sendMessage: sendMessageMock,
    switchSource: switchSourceMock,
    resetSession: vi.fn(),
    buildSaveMarkdown: buildSaveMarkdownMock,
    syncMentionState: syncMentionStateMock,
  })),
}))

vi.mock('@/utils/plugin-logger', () => ({
  createPluginLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() })),
}))

vi.mock('@/utils/markdown', () => ({
  renderSimpleMarkdown: vi.fn((content: string) => `<p>${content}</p>`),
}))

vi.mock('@/i18n/ui', () => ({
  t: vi.fn((key: string) => key),
}))

function createProps() {
  return {
    scope: {
      mode: 'topic' as const,
    },
    wikiPages: [],
    forwardProxy: vi.fn(),
    getBlockKramdown: vi.fn(),
    config: {
      aiBaseUrl: '',
      aiApiKey: '',
      aiModel: '',
      aiRequestTimeoutSeconds: 30,
      aiMaxTokens: 2048,
      aiTemperature: 0.7,
      aiMaxContextMessages: 8,
      enableConsoleLogging: false,
    },
  }
}

async function loadComponent() {
  const module = await import('./WikiChatDialog.vue')
  return module.default
}

async function createDialogBindings() {
  const component = await loadComponent()
  const bindings = component.setup?.(createProps(), {
    attrs: {},
    slots: {},
    emit: vi.fn(),
    expose: vi.fn(),
  })

  if (!bindings) {
    throw new Error('WikiChatDialog setup returned no bindings')
  }

  return bindings as Record<string, any>
}

beforeEach(() => {
  syncMentionStateMock.mockReset()
  sendMessageMock.mockReset()
  switchSourceMock.mockReset()
  buildSaveMarkdownMock.mockClear()

  sessionState.messages = []
  sessionState.isLoading = false
  sessionState.error = ''
  sessionState.currentSourcePage = null

  inputTextRef.value = ''
  mentionPopupVisibleRef.value = false
  filteredPagesRef.value = []

  lifecycleCallbacks.mounted = []
  lifecycleCallbacks.beforeUnmount = []

  vi.stubGlobal('window', {
    innerWidth: 1280,
    innerHeight: 720,
  })
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: {
      style: {
        userSelect: '',
      },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WikiChatDialog', () => {
  it('forwards textarea cursor position through handleInput', async () => {
    inputTextRef.value = '@机'

    const bindings = await createDialogBindings()
    bindings.inputRef.value = { selectionStart: 2 }

    bindings.handleInput()

    expect(syncMentionStateMock).toHaveBeenCalledTimes(1)
    expect(syncMentionStateMock).toHaveBeenCalledWith(2)
  })

  it('renders only the first three mention items and overflow marker through SSR template output', async () => {
    mentionPopupVisibleRef.value = true
    filteredPagesRef.value = [
      { documentId: 'doc-1', title: 'Alpha' },
      { documentId: 'doc-2', title: 'Beta' },
      { documentId: 'doc-3', title: 'Gamma' },
      { documentId: 'doc-4', title: 'Delta' },
    ]

    const component = await loadComponent()
    const app = createSSRApp({
      render: () => h(component, createProps()),
    })
    const html = await renderToString(app)

    expect(html).toContain('Alpha')
    expect(html).toContain('Beta')
    expect(html).toContain('Gamma')
    expect(html).not.toContain('Delta')
    expect(html).toContain('...')
  })

  it('keeps template bindings for mention input and limited popup rendering', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')
    const { descriptor } = parse(source)
    const templateContent = descriptor.template?.content ?? ''

    expect(templateContent).toContain('@input="handleInput"')
    expect(templateContent).toContain('v-for="(page, index) in visibleMentionPages"')
    expect(templateContent).toContain('v-if="hasMoreMentions"')
  })

  it('keeps the assistant markdown renderer and contrast tokens', async () => {
    const source = await readFile(new URL('./WikiChatDialog.vue', import.meta.url), 'utf8')

    expect(source).toContain("import { renderSimpleMarkdown } from '@/utils/markdown'")
    expect(source).toContain('v-html="renderSimpleMarkdown(msg.content)"')
    expect(source).toContain('color-mix(in srgb, var(--b3-theme-on-background) 94%, white 6%)')
    expect(source).toContain('color-mix(in srgb, var(--b3-theme-on-background) 72%, transparent)')
    expect(source).toContain('color-mix(in srgb, var(--b3-theme-surface-light) 88%, var(--b3-theme-background))')
  })
})
