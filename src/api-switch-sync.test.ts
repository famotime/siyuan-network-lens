import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('siyuan', () => {
  return {
    Plugin: class Plugin {
      name = 'siyuan-network-lens'
      displayName = '脉络镜'
      addIcons() {}
      addCommand() {}
      addDock() {}
      loadData() { return Promise.resolve(null) }
      saveData() { return Promise.resolve() }
      removeData() { return Promise.resolve() }
      onDataChanged() {}
    },
    Dialog: class Dialog {},
  }
})

import ReferenceAnalyticsPlugin from './index'
import type { SharedConfig, SiyuanApiSwitch } from './types/api-switch'

describe('siyuan-api-switch integration', () => {
  let originalWindowApiSwitch: any

  beforeEach(() => {
    if (typeof (globalThis as any).window === 'undefined') {
      ;(globalThis as any).window = globalThis
    }
    if (typeof (globalThis as any).window.addEventListener !== 'function') {
      ;(globalThis as any).window.addEventListener = vi.fn()
    }
    originalWindowApiSwitch = (globalThis as any).window.siyuanApiSwitch
    delete (globalThis as any).window.siyuanApiSwitch
  })

  afterEach(() => {
    if (originalWindowApiSwitch !== undefined) {
      ;(globalThis as any).window.siyuanApiSwitch = originalWindowApiSwitch
    } else {
      delete (globalThis as any).window.siyuanApiSwitch
    }
  })

  it('registers with window.siyuanApiSwitch on onload when available', async () => {
    let registeredCallback: ((config: SharedConfig | null) => void) | null = null
    let registeredLocalConfig: any = null

    const mockApiSwitch: SiyuanApiSwitch = {
      version: '1.0.0',
      register: vi.fn((pluginId, displayName, callback, localConfig) => {
        registeredCallback = callback
        registeredLocalConfig = localConfig
      }),
      unregister: vi.fn(),
      getBoundConfig: vi.fn(() => null),
    }

    ;(window as any).siyuanApiSwitch = mockApiSwitch

    const plugin = new ReferenceAnalyticsPlugin()
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      aiEnabled: true,
      aiBaseUrl: 'https://local.api/v1',
      aiApiKey: 'local-key',
      aiModel: 'local-model',
      aiRequestTimeoutSeconds: 45,
    })
    vi.spyOn(plugin, 'saveData').mockImplementation(async () => {})

    await plugin.onload()

    expect(mockApiSwitch.register).toHaveBeenCalledWith(
      plugin.name,
      plugin.displayName,
      expect.any(Function),
      expect.objectContaining({
        baseUrl: 'https://local.api/v1',
        apiKey: 'local-key',
        model: 'local-model',
        requestTimeoutSeconds: 45,
      }),
    )

    expect(registeredCallback).not.toBeNull()
  })

  it('handles takeover sync(shared) and unbind sync(null) cleanly', async () => {
    let syncCallback: ((config: SharedConfig | null) => void) | null = null

    const mockApiSwitch: SiyuanApiSwitch = {
      version: '1.0.0',
      register: (_id, _name, callback) => {
        syncCallback = callback
      },
      unregister: vi.fn(),
      getBoundConfig: vi.fn(() => null),
    }
    ;(window as any).siyuanApiSwitch = mockApiSwitch

    const plugin = new ReferenceAnalyticsPlugin()
    const saveDataSpy = vi.spyOn(plugin, 'saveData').mockImplementation(async () => {})
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      aiEnabled: true,
      aiBaseUrl: 'https://local.api/v1',
      aiApiKey: 'local-key',
      aiModel: 'local-model',
    })

    await plugin.onload()
    const config = (plugin as any).config

    expect(config.isAiManaged).toBeFalsy()
    expect(config.aiBaseUrl).toBe('https://local.api/v1')

    // 触发接管 callback
    const sharedConfig: SharedConfig = {
      profileId: 'p-1',
      profileName: 'DeepSeek 专有',
      provider: 'siliconflow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'sk-managed-key',
      model: 'deepseek-ai/DeepSeek-V3',
      requestTimeoutSeconds: 60,
      maxTokens: 8192,
      temperature: 0.5,
    }

    syncCallback!(sharedConfig)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(config.isAiManaged).toBe(true)
    expect(config.aiManagedProfileName).toBe('DeepSeek 专有')
    expect(config.aiProviderPreset).toBe('siliconflow')
    expect(config.aiBaseUrl).toBe('https://api.siliconflow.cn/v1')
    expect(config.aiApiKey).toBe('sk-managed-key')
    expect(config.aiModel).toBe('deepseek-ai/DeepSeek-V3')
    expect(config.aiRequestTimeoutSeconds).toBe(60)

    // 模拟在接管状态下修改其他常规配置项
    config.showRanking = !config.showRanking
    await new Promise(resolve => setTimeout(resolve, 0))

    // 校验在接管状态下保存设置时，存入 settings.json 的仍是底层本地配置
    const lastSaved = saveDataSpy.mock.calls[saveDataSpy.mock.calls.length - 1]?.[1] as any
    expect(lastSaved).toBeDefined()
    expect(lastSaved.isAiManaged).toBe(false)
    expect(lastSaved.aiBaseUrl).toBe('https://local.api/v1')
    expect(lastSaved.aiApiKey).toBe('local-key')
    expect(lastSaved.aiModel).toBe('local-model')

    // 触发解绑 callback(null)
    syncCallback!(null)

    expect(config.isAiManaged).toBe(false)
    expect(config.aiManagedProfileName).toBeUndefined()
    expect(config.aiBaseUrl).toBe('https://local.api/v1')
    expect(config.aiApiKey).toBe('local-key')
    expect(config.aiModel).toBe('local-model')
  })

  it('supports custom and deepseek provider profiles without being overwritten by local preset defaults', async () => {
    let syncCallback: ((config: SharedConfig | null) => void) | null = null

    const mockApiSwitch: SiyuanApiSwitch = {
      version: '1.0.0',
      register: (_id, _name, callback) => {
        syncCallback = callback
      },
      unregister: vi.fn(),
      getBoundConfig: vi.fn(() => null),
    }
    ;(globalThis as any).window.siyuanApiSwitch = mockApiSwitch

    const plugin = new ReferenceAnalyticsPlugin()
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      aiEnabled: true,
      aiProviderPreset: 'custom',
      aiProviderConfigs: {
        custom: {
          aiBaseUrl: 'https://old-custom.api/v1',
          aiApiKey: 'old-key',
          aiModel: 'old-model',
        },
      },
      aiBaseUrl: 'https://old-custom.api/v1',
      aiApiKey: 'old-key',
      aiModel: 'old-model',
    })

    await plugin.onload()
    const config = (plugin as any).config

    // 模拟 API 旋钮选择“小米MIMO-新加坡” (provider: "custom")
    const mimoConfig: SharedConfig = {
      profileId: 'prof_repqzdwiu',
      profileName: '小米MIMO-新加坡',
      provider: 'custom',
      baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
      apiKey: 'tp-s7xhg2jvo2us4jplg7o9abdevxkzl7549f5l77fzutynw0tf',
      model: 'mimo-v2.5',
      requestTimeoutSeconds: 60,
    }

    syncCallback!(mimoConfig)

    // 运行 ensureConfigDefaults，模拟 SettingPanel 打开或配置校验
    const { ensureConfigDefaults } = await import('./types/config')
    ensureConfigDefaults(config)

    expect(config.isAiManaged).toBe(true)
    expect(config.aiManagedProfileName).toBe('小米MIMO-新加坡')
    expect(config.aiBaseUrl).toBe('https://token-plan-sgp.xiaomimimo.com/v1')
    expect(config.aiApiKey).toBe('tp-s7xhg2jvo2us4jplg7o9abdevxkzl7549f5l77fzutynw0tf')
    expect(config.aiModel).toBe('mimo-v2.5')
  })

  it('unregisters from siyuanApiSwitch on onunload', async () => {
    const unregisterFn = vi.fn()
    ;(window as any).siyuanApiSwitch = {
      version: '1.0.0',
      register: vi.fn(),
      unregister: unregisterFn,
      getBoundConfig: vi.fn(() => null),
    }

    const plugin = new ReferenceAnalyticsPlugin()
    await plugin.onload()
    plugin.onunload()

    expect(unregisterFn).toHaveBeenCalledWith(plugin.name)
  })

  it('updates configuration via onDataChanged without triggering redundant saveData', async () => {
    const plugin = new ReferenceAnalyticsPlugin()
    const saveSpy = vi.spyOn(plugin, 'saveData').mockResolvedValue(undefined as any)
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      showRanking: true,
      aiBaseUrl: 'https://initial.api/v1',
    })

    await plugin.onload()
    saveSpy.mockClear()

    // 模拟另一端更新了配置
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      showRanking: false,
      aiBaseUrl: 'https://initial.api/v1',
    })

    await plugin.onDataChanged()

    const config = (plugin as any).config
    expect(config.showRanking).toBe(false)
    // 自身不应回写产生网络乒乓
    expect(saveSpy).not.toHaveBeenCalled()
  })

  it('does not write to storage when API switch sync triggers with identical persisted config', async () => {
    let syncCallback: ((config: SharedConfig | null) => void) | null = null

    const mockApiSwitch: SiyuanApiSwitch = {
      version: '1.0.0',
      register: (_id, _name, callback) => {
        syncCallback = callback
      },
      unregister: vi.fn(),
      getBoundConfig: vi.fn(() => null),
    }
    ;(window as any).siyuanApiSwitch = mockApiSwitch

    const plugin = new ReferenceAnalyticsPlugin()
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      aiBaseUrl: 'https://local.api/v1',
      aiApiKey: 'local-key',
      aiModel: 'local-model',
    })
    const saveSpy = vi.spyOn(plugin, 'saveData').mockResolvedValue(undefined as any)

    await plugin.onload()
    saveSpy.mockClear()

    // 触发接管同步
    syncCallback!({
      profileId: 'shared_1',
      profileName: 'Shared Profile',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-shared',
      model: 'gpt-4o',
    })

    const { nextTick } = await import('vue')
    await nextTick()

    // 接管态下由于备份了本地配置且本地配置未变，落盘内容与加载时一致，不应调用 saveData
    expect(saveSpy).not.toHaveBeenCalled()
  })
})

