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

export async function logDuration<T>(
  label: string,
  logger: Console,
  fn: () => Promise<T>
) {
  const start = Date.now();
  logger.log('start:time:' + label);
  const result = await fn();
  logger.log('end:time:' + label + '', `(${Date.now() - start}ms)`);
  return result;
}

export function logSyncDuration<T>(
  label: string,
  logger: Console,
  fn: () => T
) {
  const start = Date.now();
  logger.log('start:time:' + label);
  const result = fn();
  logger.log('end:time:' + label + '', `(${Date.now() - start}ms)`);
  return result;
}

// Attempts to slice off rarely significant digits for more legible logging.
export function shortPostId(postId: string) {
  return postId.slice(14, 27);
}
