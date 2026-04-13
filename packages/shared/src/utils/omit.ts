/**
 * Acts like Lodash's `omit` but with stricter typing.
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[] | Set<K>
): Omit<T, K> {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  const result = {} as Omit<T, K>;
  for (const key of Object.keys(obj)) {
    if (!keySet.has(key as K)) {
      result[key] = obj[key];
    }
  }
  return result;
}
