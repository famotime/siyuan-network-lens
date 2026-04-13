import { describe, expect, it, vi } from 'vitest'

import { createPluginLogger } from './plugin-logger'

describe('createPluginLogger', () => {
  it('suppresses non-error logs when console logging is disabled', () => {
    const sink = {
      log: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const logger = createPluginLogger(() => false, sink)

    logger.log('plain')
    logger.debug('debug')
    logger.info('info')
    logger.warn('warn')
    logger.error('error')

    expect(sink.log).not.toHaveBeenCalled()
    expect(sink.debug).not.toHaveBeenCalled()
    expect(sink.info).not.toHaveBeenCalled()
    expect(sink.warn).not.toHaveBeenCalled()
    expect(sink.error).toHaveBeenCalledWith('error')
  })

  it('prints all configured levels when console logging is enabled', () => {
    const sink = {
      log: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const logger = createPluginLogger(() => true, sink)

    logger.log('plain', 1)
    logger.debug('debug', 2)
    logger.info('info', 3)
    logger.warn('warn', 4)
    logger.error('error', 5)

    expect(sink.log).toHaveBeenCalledWith('plain', 1)
    expect(sink.debug).toHaveBeenCalledWith('debug', 2)
    expect(sink.info).toHaveBeenCalledWith('info', 3)
    expect(sink.warn).toHaveBeenCalledWith('warn', 4)
    expect(sink.error).toHaveBeenCalledWith('error', 5)
  })

  it('reads the latest toggle value at call time', () => {
    const sink = {
      log: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    let enabled = false
    const logger = createPluginLogger(() => enabled, sink)

    logger.info('hidden')
    enabled = true
    logger.info('visible')

    expect(sink.info).toHaveBeenCalledTimes(1)
    expect(sink.info).toHaveBeenCalledWith('visible')
  })
})
