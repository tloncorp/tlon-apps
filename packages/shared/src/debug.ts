const customLoggers = new Set<string>();

export function addCustomEnabledLoggers(loggers: string[]) {
  loggers.forEach((logger) => customLoggers.add(logger));
}

export function createDevLogger(tag: string, enabled: boolean) {
  return new Proxy(console, {
    get(target: Console, prop, receiver) {
      return (...args: unknown[]) => {
        if (
          (enabled || customLoggers.has(tag)) &&
          process.env.NODE_ENV !== 'production'
        ) {
          const val = Reflect.get(target, prop, receiver);
          val(`[${tag}]`, ...args);
        }
      };
    },
  });
}
