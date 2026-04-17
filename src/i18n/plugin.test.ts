import { describe, expect, it } from 'vitest'

import { pickPluginText } from './plugin'

describe('plugin i18n helper', () => {
  it('uses the shared default plugin copy', () => {
    expect(pickPluginText('pluginEyebrow')).toBeTypeOf('string')
    expect(pickPluginText('pluginTitle')).toBeTypeOf('string')
    expect(pickPluginText('pluginTagline')).toBeTypeOf('string')
    expect(pickPluginText('pluginIconAlt')).toBeTypeOf('string')
    expect(pickPluginText('settingsTitle')).toBeTypeOf('string')
  })
})
