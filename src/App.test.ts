import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('App trend detail layout', () => {
  it('delegates summary cards and detail panels to dedicated child components', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain("import SummaryCardsGrid from '@/components/SummaryCardsGrid.vue'")
    expect(source).toContain("import SummaryDetailSection from '@/components/SummaryDetailSection.vue'")
    expect(source).toContain('<SummaryCardsGrid')
    expect(source).toContain('<SummaryDetailSection')
    expect(source).not.toContain('draggable="true"')
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

  it('keeps filter layout and summary visibility selection in App composition', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('filter-panel__row--meta')
    expect(source).toContain('filter-panel__row--focus')
    expect(source).toContain('visibleSummaryCards')
    expect(source).toContain('watch(visibleSummaryCards')
    expect(source).toContain("if (card.key === 'documents')")
    expect(source).toContain('props.config.showDocuments')
    expect(source).toContain("if (card.key === 'read')")
    expect(source).toContain('props.config.showRead')
    expect(source).toContain("if (card.key === 'references')")
    expect(source).toContain('props.config.showReferences')
    expect(source).toContain("if (card.key === 'orphans')")
    expect(source).toContain('props.config.showOrphans')
    expect(source).toContain("if (card.key === 'dormant')")
    expect(source).toContain('props.config.showDormant')
    expect(source).toContain("if (card.key === 'bridges')")
    expect(source).toContain('props.config.showBridges')
    expect(source).not.toContain('showOrphanBridge')
  })
})
