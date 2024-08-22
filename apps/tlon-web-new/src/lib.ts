/**
 * min =< ret < max
 */
export function randInt(min: number, max: number) {
  const range = max - min;
  const rand = Math.random() * range;
  return Math.floor(Math.random() * range) + min;
}

export async function asyncForEach<T>(
  array: Array<T>,
  callback: (element: T, idx?: number, ary?: Array<T>) => Promise<void>
) {
  await Promise.all(array.map((e, i) => callback(e, i, array)));
}
