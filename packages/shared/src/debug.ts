export function createDevLogger(tag: string, enabled: boolean) {
  return new Proxy(console, {
    get(target: Console, prop, receiver) {
      return (...args: unknown[]) => {
        if (enabled && process.env.NODE_ENV === 'development') {
          const val = Reflect.get(target, prop, receiver);
          val(`[${tag}]`, ...args);
        }
      };
    },
  });
}
