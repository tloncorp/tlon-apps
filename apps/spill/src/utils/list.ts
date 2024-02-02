export const filterEmpty = <T>(arr: (T | null | undefined)[]): T[] => {
  return arr.filter((i): i is T => typeof i !== 'undefined' && i !== null);
};
