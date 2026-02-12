export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Creates a deferred promise, which allows you to resolve or reject it
 * externally.
 *
 * ```ts
 * const deferred = createDeferred<number>();
 * deferred.promise.then(value => console.log(value)); // Logs "42" after 1 second
 * setTimeout(() => deferred.resolve(42), 1000);
 * ```
 */
export function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}
