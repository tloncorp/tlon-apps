export function browserCardKey(url: string) {
  const parsed = new URL(url);
  return parsed.origin + parsed.pathname;
}
