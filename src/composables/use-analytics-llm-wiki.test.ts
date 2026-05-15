import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createLlmWikiController } from './use-analytics-llm-wiki'

function createConfig() {
  return computed(() => ({
    aiBaseUrl: 'https://api.example.com/v1',
    aiApiKey: 'sk-test',
    aiModel: 'gpt-test',
    aiMaxTokens: 2048,
    aiTemperature: 0.2,
    aiRequestTimeoutSeconds: 15,
    wikiPageSuffix: '-llm-wiki',
  }) as any)
}

describe('createLlmWikiController', () => {
  it('marks the page idle with an explanatory suggestion when dependencies are missing', async () => {
    const controller = createLlmWikiController({
      config: createConfig(),
    })
    const page = {
      documentId: 'wiki-page-1',
      title: '主题-AI-索引-llm-wiki',
    }

    controller.wikiPages.value = [page as any]

    const result = await controller.reviewPage(page as any)

    expect(result.maintenanceState?.status).toBe('idle')
    expect(result.maintenanceState?.suggestions).toEqual([
      {
        type: 'outdated-section',
        description: 'Missing dependencies: forwardProxy or getBlockKramdown not available',
      },
    ])
    expect(controller.wikiPages.value[0].maintenanceState?.status).toBe('idle')
  })

  it('reviews a wiki page, probes broken links, and stores the parsed suggestions', async () => {
    const forwardProxy = vi.fn(async () => ({
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  {
                    type: 'broken-link',
                    description: '链接 bad-link 已失效',
                    sectionHeading: '概述',
                  },
                ],
                revisedMarkdown: '# 修订后的 wiki',
              }),
            },
          },
        ],
      }),
    }))
    const getBlockKramdown = vi.fn(async (id: string) => {
      if (id === 'wiki-page-1') {
        return {
          id,
          kramdown: [
            '# 主题-AI-索引-llm-wiki',
            '',
            '[Good](siyuan://blocks/good-link)',
            '[Bad](siyuan://blocks/bad-link)',
          ].join('\n'),
        }
      }
      if (id === 'good-link') {
        return { id, kramdown: '# ok' }
      }
      throw new Error(`missing: ${id}`)
    })

    const controller = createLlmWikiController({
      config: createConfig(),
      forwardProxy: forwardProxy as any,
      getBlockKramdown,
    })
    const page = {
      documentId: 'wiki-page-1',
      title: '主题-AI-索引-llm-wiki',
    }

    controller.wikiPages.value = [page as any]

    const result = await controller.reviewPage(page as any)
    const payload = JSON.parse(forwardProxy.mock.calls[0][2])

    expect(getBlockKramdown).toHaveBeenCalledWith('wiki-page-1')
    expect(getBlockKramdown).toHaveBeenCalledWith('good-link')
    expect(getBlockKramdown).toHaveBeenCalledWith('bad-link')
    expect(forwardProxy).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      'POST',
      expect.any(String),
      expect.any(Array),
      15000,
      'application/json',
    )
    expect(payload.model).toBe('gpt-test')
    expect(payload.messages[1].content).toContain('Confirmed broken link IDs: bad-link')
    expect(result.maintenanceState).toEqual({
      status: 'suggestions-ready',
      suggestions: [
        {
          type: 'broken-link',
          description: '链接 bad-link 已失效',
          sectionHeading: '概述',
        },
      ],
      currentMarkdown: [
        '# 主题-AI-索引-llm-wiki',
        '',
        '[Good](siyuan://blocks/good-link)',
        '[Bad](siyuan://blocks/bad-link)',
      ].join('\n'),
      diffPreview: '# 修订后的 wiki',
    })
    expect(controller.wikiPages.value[0].maintenanceState?.status).toBe('suggestions-ready')
  })

  it('falls back to an idle error state when the LLM API reports an error', async () => {
    const controller = createLlmWikiController({
      config: createConfig(),
      getBlockKramdown: vi.fn(async (id: string) => ({ id, kramdown: '# current wiki' })),
      forwardProxy: vi.fn(async () => ({
        body: JSON.stringify({
          error: { message: 'bad gateway' },
        }),
      })) as any,
    })
    const page = {
      documentId: 'wiki-page-1',
      title: '主题-AI-索引-llm-wiki',
    }

    controller.wikiPages.value = [page as any]

    const result = await controller.reviewPage(page as any)

    expect(result.maintenanceState?.status).toBe('idle')
    expect(result.maintenanceState?.suggestions?.[0]).toEqual({
      type: 'outdated-section',
      description: 'LLM API error: bad gateway',
    })
  })

  it('applies maintenance with the block api argument order dataType -> data -> id', async () => {
    const updateBlock = vi.fn(async () => [])
    const controller = createLlmWikiController({
      config: createConfig(),
      updateBlock: updateBlock as any,
    })
    const page = {
      documentId: 'wiki-page-1',
      title: '主题-AI-索引-llm-wiki',
      maintenanceState: {
        status: 'suggestions-ready',
        suggestions: [{ type: 'outdated-section', description: '更新概述' }],
        currentMarkdown: '# 当前 wiki',
        diffPreview: '# 修订后的 wiki',
      },
    }

    await controller.applyMaintenance(page as any, '# 修订后的 wiki')

    expect(updateBlock).toHaveBeenCalledWith('markdown', '# 修订后的 wiki', 'wiki-page-1')
    expect(page.maintenanceState).toEqual({ status: 'idle' })
  })

  it('restores the suggestions-ready state when applying maintenance fails', async () => {
    const updateBlock = vi.fn(async () => {
      throw new Error('write failed')
    })
    const controller = createLlmWikiController({
      config: createConfig(),
      updateBlock: updateBlock as any,
    })
    const page = {
      documentId: 'wiki-page-1',
      title: '主题-AI-索引-llm-wiki',
      maintenanceState: {
        status: 'suggestions-ready',
        suggestions: [{ type: 'broken-link', description: '坏链' }],
        currentMarkdown: '# 当前 wiki',
        diffPreview: '# 修订后的 wiki',
      },
    }

    await controller.applyMaintenance(page as any, '# 修订后的 wiki')

    expect(page.maintenanceState).toEqual({
      status: 'suggestions-ready',
      suggestions: [{ type: 'broken-link', description: '坏链' }],
      currentMarkdown: '# 当前 wiki',
      diffPreview: '# 修订后的 wiki',
    })
  })

  it('applies only the selected section content when selected suggestions target a specific section', async () => {
    const updateBlock = vi.fn(async () => [])
    const controller = createLlmWikiController({
      config: createConfig(),
      updateBlock: updateBlock as any,
    })
    const page = {
      documentId: 'wiki-page-1',
      title: '主题-AI-索引-llm-wiki',
      maintenanceState: {
        status: 'suggestions-ready',
        suggestions: [{ type: 'outdated-section', description: '更新概述', sectionHeading: 'Topic overview' }],
        currentMarkdown: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI managed area',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### Topic overview',
          '旧概述',
          '',
          '<!-- network-lens-wiki-section:highlights -->',
          '### Highlights',
          '- 旧亮点 A',
        ].join('\n'),
        diffPreview: [
          '# 主题-AI-索引-llm-wiki',
          '',
          '## AI managed area',
          '',
          '<!-- network-lens-wiki-section:intro -->',
          '### Topic overview',
          '新概述',
          '',
          '<!-- network-lens-wiki-section:highlights -->',
          '### Highlights',
          '- 新亮点 A',
        ].join('\n'),
      },
    }

    await controller.applyMaintenance(page as any, page.maintenanceState.diffPreview, [
      { type: 'outdated-section', description: '更新概述', sectionHeading: 'Topic overview' },
    ])

    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      expect.stringContaining('### Topic overview\n新概述'),
      'wiki-page-1',
    )
    expect(updateBlock.mock.calls[0][1]).toContain('### Highlights\n- 旧亮点 A')
    expect(updateBlock.mock.calls[0][1]).not.toContain('### Highlights\n- 新亮点 A')
  })
})
