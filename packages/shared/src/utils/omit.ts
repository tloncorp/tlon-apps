/**
 * Acts like Lodash's `omit` but with stricter typing.
 */
export function omit<T extends object, K extends Extract<keyof T, string>>(
  obj: T,
  keys: K[] | Set<K>
): Omit<T, K> {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  const result = {} as Omit<T, K>;
  for (const key of Object.keys(obj)) {
    if (!keySet.has(key as K)) {
      // Since `key` is not in `keySet`, which should implicitly define the
      // type `K`, we can safely make this type assertion:
      const k = key as keyof Omit<T, K>;

      result[k] = obj[k];
    }
  }
  return result;
}
