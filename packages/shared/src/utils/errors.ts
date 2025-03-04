export function nullIfError<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (_e) {
    return null;
  }
}
