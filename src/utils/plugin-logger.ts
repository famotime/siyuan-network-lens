type LoggerMethod = (...args: unknown[]) => void

export type PluginLogger = {
  log: LoggerMethod
  debug: LoggerMethod
  info: LoggerMethod
  warn: LoggerMethod
  error: LoggerMethod
}

type LoggerSink = {
  log?: LoggerMethod
  debug?: LoggerMethod
  info?: LoggerMethod
  warn?: LoggerMethod
  error?: LoggerMethod
}

export function createPluginLogger(
  isEnabled: () => boolean,
  sink: LoggerSink = console,
): PluginLogger {
  function callEnabled(method: keyof Omit<PluginLogger, 'error'>, args: unknown[]) {
    if (!isEnabled()) {
      return
    }
    sink[method]?.(...args)
  }

  return {
    log: (...args) => callEnabled('log', args),
    debug: (...args) => callEnabled('debug', args),
    info: (...args) => callEnabled('info', args),
    warn: (...args) => callEnabled('warn', args),
    error: (...args) => sink.error?.(...args),
  }
}
