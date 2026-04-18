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
    const normalizedSource = source.replace(/\r\n/g, '\n')

    expect(source).toContain('class="hero__icon"')
    expect(source).toContain(':alt="pluginIconAlt"')
    expect(source).toContain('{{ pluginEyebrow }}')
    expect(source).not.toContain('<p class="eyebrow">Network lens</p>')
    expect(source).toContain("import { pickOppositePluginText, pickPluginText } from '@/i18n/plugin'")
    expect(source).toContain("import { t } from '@/i18n/ui'")
    expect(source).toContain("{{ loading ? t('app.analyzing') : t('app.refreshAnalysis') }}")
    expect(source).toContain("{{ t('app.resetOrder') }}")
    expect(source).toContain("{{ t('app.filter.timeWindow') }}")
    expect(source).toContain("{{ t('app.filter.notebook') }}")
    expect(source).toContain("{{ t('app.filter.tags') }}")
    expect(source).toContain("{{ t('app.filter.topics') }}")
    expect(source).toContain("{{ t('app.filter.keyword') }}")
    expect(source).toContain("{{ wikiPanelPlacement === 'documents' ? t('app.wiki.hide') : t('app.wiki.maintain') }}")
    expect(source).not.toContain('uiText(')
    expect(source).toContain("const pluginTitle = computed(() => props.plugin.i18n?.pluginTitle ?? props.plugin.displayName ?? pickPluginText('pluginTitle'))")
    expect(source).toContain("const pluginEyebrow = computed(() => pickOppositePluginText('pluginEyebrow'))")
    expect(source).toContain("const pluginTagline = computed(() => props.plugin.i18n?.pluginTagline ?? pickPluginText('pluginTagline'))")
    expect(source).toContain("const pluginIconAlt = computed(() => props.plugin.i18n?.pluginIconAlt ?? pickPluginText('pluginIconAlt'))")
    expect(source).toContain('white-space: nowrap;')
    expect(normalizedSource).toContain(`.hero__intro {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;`)
    expect(source).not.toContain('radial-gradient(circle at 30% 30%')
    expect(source).not.toContain('border: 1px solid color-mix(in srgb, var(--accent-cool) 18%, var(--panel-border));')
  })

  it('keeps the hero title on the active locale while the eyebrow stays opposite-language and the tagline uses its own full-width row', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')
    const normalizedSource = source.replace(/\r\n/g, '\n')

    expect(source).toContain("import { pickOppositePluginText, pickPluginText } from '@/i18n/plugin'")
    expect(source).toContain("const pluginTitle = computed(() => props.plugin.i18n?.pluginTitle ?? props.plugin.displayName ?? pickPluginText('pluginTitle'))")
    expect(source).toContain("const pluginEyebrow = computed(() => pickOppositePluginText('pluginEyebrow'))")
    expect(source).toContain("const pluginTagline = computed(() => props.plugin.i18n?.pluginTagline ?? pickPluginText('pluginTagline'))")
    expect(source).toContain('<div class="hero__header">')
    expect(source).toContain('<p class="hero__tagline">')
    expect(source).not.toContain(`<div class="hero__copy-block">
          <p class="eyebrow">{{ pluginEyebrow }}</p>
          <h1>{{ pluginTitle }}</h1>
          <p class="hero-copy">
            {{ pluginTagline }}
          </p>`)
    expect(normalizedSource).toContain(`.hero__tagline {
  width: 100%;`)
  })

  it('keeps filter layout and summary visibility selection in App composition', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain('filter-panel__row--meta')
    expect(source).toContain('filter-panel__row--focus')
    expect(source).toContain('visibleSummaryCards')
    expect(source).toContain('watch(visibleSummaryCards')
    expect(source).toContain("from '@/analytics/summary-card-config'")
    expect(source).toContain("from '@/plugin/alpha-feature-config'")
    expect(source).toContain('isSummaryCardVisible')
    expect(source).toContain('isAlphaSummaryCardVisible')
    expect(source).toContain('isAlphaSettingVisible')
    expect(source).not.toContain("card.key === 'todaySuggestions'")
    expect(source).not.toContain("if (card.key === 'documents')")
    expect(source).not.toContain("if (card.key === 'read')")
    expect(source).not.toContain("if (card.key === 'references')")
    expect(source).not.toContain("if (card.key === 'orphans')")
    expect(source).not.toContain("if (card.key === 'dormant')")
    expect(source).not.toContain("if (card.key === 'bridges')")
    expect(source).not.toContain('showOrphanBridge')
  })

  it('removes the hero wiki entry and delegates wiki maintenance actions to summary detail components', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).not.toContain('toggleWikiMaintainPanel')
    expect(source).not.toContain('showWikiMaintainPanel')
    expect(source).toContain("import WikiMaintainPanel from '@/components/WikiMaintainPanel.vue'")
    expect(source).toContain('toggleDocumentWikiPanel')
    expect(source).toContain('toggleCoreDocumentWikiPanel')
    expect(source).toContain('detail-wiki-stack')
    expect(source).toContain('showWikiFeature')
  })

  it('shows an in-panel loading skeleton for the first analytics load', async () => {
    const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8')

    expect(source).toContain("v-else-if=\"loading && !report\"")
    expect(source).toContain('class="loading-panel panel"')
    expect(source).toContain('loading-panel__title')
    expect(source).toContain('loading-panel__chips')
    expect(source).toContain('loading-panel__cards')
    expect(source).toContain('loading-panel__detail')
    expect(source).toContain('loading-shimmer')
    expect(source).not.toContain('正在读取 blocks 与 refs 数据...')
  })
})
