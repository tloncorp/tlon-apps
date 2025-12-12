export function fileFromPath(
  path: string,
  opts: { decodeURI?: boolean } = {}
): string | null {
  if (path.endsWith('/')) {
    return null;
  }
  let out = path.split('/').pop() ?? null;
  if (opts.decodeURI && out) {
    out = decodeURIComponent(out);
  }
  return out;
}
