import { afterEach, describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import ThemeMultiSelect from './ThemeMultiSelect.vue'

describe('ThemeMultiSelect', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('renders checkbox options and selected summary', async () => {
    const app = createSSRApp({
      render: () => h(ThemeMultiSelect, {
        modelValue: ['AI', '机器学习'],
        options: [
          { value: 'AI', label: 'AI', documentId: 'doc-ai' },
          { value: '机器学习', label: '机器学习', documentId: 'doc-ml' },
        ],
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('2 themes selected')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('AI')
    expect(html).toContain('机器学习')
  })

  it('renders empty state when no options are available', async () => {
    const app = createSSRApp({
      render: () => h(ThemeMultiSelect, {
        modelValue: [],
        options: [],
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('No topic docs configured')
  })

  it('renders a custom summary label for tag filters', async () => {
    const app = createSSRApp({
      render: () => h(ThemeMultiSelect, {
        modelValue: ['AI', 'note'],
        options: [
          { value: 'AI', label: 'AI' },
          { value: 'note', label: 'note' },
        ],
        allLabel: '全部标签',
        emptyLabel: '暂无标签',
        selectionUnit: 'tags',
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('2 tags selected')
  })

  it('switches default helper copy to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const app = createSSRApp({
      render: () => h(ThemeMultiSelect, {
        modelValue: [],
        options: [],
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('暂无主题文档配置')
    expect(html).not.toContain('No topic docs configured')
  })
})
