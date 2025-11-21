export function spyOn<T extends object, MethodName extends keyof T>(
  base: T,
  method: MethodName,
  fn: T[MethodName]
) {
  return new Proxy(base, {
    get(target, prop) {
      if (prop === method) {
        return fn;
      }
      return target[prop as keyof T];
    },
  });
}
