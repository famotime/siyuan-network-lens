import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

import FilterSelect from './FilterSelect.vue'

describe('FilterSelect', () => {
  afterEach(() => {
    delete (globalThis as any).siyuan
  })

  it('renders the selected option label and dropdown choices', async () => {
    const app = createSSRApp({
      render: () => h(FilterSelect, {
        modelValue: '7d',
        options: [
          { value: 'all', label: 'All time' },
          { value: '7d', label: 'Last 7 days' },
          { value: '30d', label: 'Last 30 days' },
        ],
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('Last 7 days')
    expect(html).toContain('All time')
    expect(html).toContain('Last 30 days')
    expect(html).toContain('filter-select__option-label')
  })

  it('wires truncation-aware titles through the option label span', async () => {
    const source = await readFile(new URL('./FilterSelect.vue', import.meta.url), 'utf8')

    expect(source).toContain("import { buildDropdownLayout, buildTruncationMap, resolveTruncatedTitle } from './dropdown-option-truncation'")
    expect(source).toContain('class="filter-select__option-label"')
    expect(source).toContain(':title="resolveTruncatedTitle(option.label, truncatedOptionValues[option.value])"')
    expect(source).toContain(':style="dropdownStyle"')
    expect(source).toContain('ref="dropdownRef"')
    expect(source).toContain('transform: `translateX(${dropdownOffsetX.value})`')
  })

  it('switches the default empty label to Chinese when the workspace locale is zh_CN', async () => {
    ;(globalThis as any).siyuan = {
      config: {
        lang: 'zh_CN',
      },
    }

    const app = createSSRApp({
      render: () => h(FilterSelect, {
        modelValue: '',
        options: [],
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('暂无可选项')
    expect(html).not.toContain('No options available')
  })
})
