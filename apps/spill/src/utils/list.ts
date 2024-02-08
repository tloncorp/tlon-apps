export const filterEmpty = <T>(arr: (T | null | undefined)[]): T[] => {
  return arr.filter((i): i is T => typeof i !== 'undefined' && i !== null);
};

export function hasValues<T extends {length: number}>(
  list: T | null | undefined,
): list is T {
  return !!(list && list.length > 0);
}
