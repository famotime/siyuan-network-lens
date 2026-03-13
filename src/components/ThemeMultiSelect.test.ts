import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import ThemeMultiSelect from './ThemeMultiSelect.vue'

describe('ThemeMultiSelect', () => {
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

    expect(html).toContain('已选 2 个主题')
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

    expect(html).toContain('未配置主题文档')
  })
})
