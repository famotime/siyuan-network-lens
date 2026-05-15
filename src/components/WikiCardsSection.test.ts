import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import WikiCardsSection from './WikiCardsSection.vue'

describe('WikiCardsSection', () => {
  it('renders embedded detail container markup for consistent horizontal spacing', async () => {
    const app = createSSRApp({
      render: () => h(WikiCardsSection, {
        pages: [
          {
            documentId: 'wiki-ai',
            title: '主题-AI-索引-llm-wiki',
            inboundReferences: 3,
            outboundReferences: 2,
            childDocumentCount: 1,
            createdAt: '20260301090000',
            updatedAt: '20260311120000',
            themeDocumentTitle: '主题-AI-索引',
            maintenanceState: null,
          },
        ],
        openDocument: vi.fn(),
        formatTimestamp: (timestamp?: string) => timestamp ?? '',
        onOpenChat: vi.fn(),
        onMaintain: vi.fn(),
      }),
    })

    const html = await renderToString(app)

    expect(html).toContain('wiki-cards-section--embedded')
  })
})
