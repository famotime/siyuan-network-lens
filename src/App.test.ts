import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('App trend detail layout', () => {
  it('uses section cards and default document title styling in trend detail', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('trend-section-card')
    expect(source).toContain('trend-record')
    expect(source).toContain('trend-record__meta')
    expect(source).not.toContain('variant="compact"')
  })

  it('exposes drag sorting and a reset order button for summary cards', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('重置排序')
    expect(source).toContain('draggable="true"')
    expect(source).toContain('@dragstart=')
    expect(source).toContain('@drop.prevent=')
  })

  it('renders a toggle control for switching the read card between unread and read', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('summary-card__toggle')
    expect(source).toContain('toggleReadCardMode')
    expect(source).toContain('isReadCard(card.key)')
  })

  it('uses an adaptive summary grid and a compact read-card toggle button', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));')
    expect(source).toContain('width: 20px;')
    expect(source).toContain('height: 20px;')
    expect(source).toContain('width: 10px;')
    expect(source).toContain('height: 10px;')
  })

  it('renders trend stat cards in a compact summary-like layout', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('trend-stats__card')
    expect(source).toContain('trend-stats__label')
    expect(source).toContain('trend-stats__value')
    expect(source).toContain('grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));')
    expect(source).toContain('padding: 10px 12px;')
  })

  it('renders the plugin icon in the hero area and keeps top action labels on one line', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('class="hero__icon"')
    expect(source).toContain('alt="脉络镜插件图标"')
    expect(source).toContain('white-space: nowrap;')
    expect(source).toContain(`.hero__intro {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;`)
    expect(source).not.toContain('radial-gradient(circle at 30% 30%')
    expect(source).not.toContain('border: 1px solid color-mix(in srgb, var(--accent-cool) 18%, var(--panel-border));')
  })
})
