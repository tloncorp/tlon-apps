export function filenameFromPath(
  path: string,
  opts: { decodeURI?: boolean } = {}
): string | null {
  if (path.endsWith('/')) {
    return null;
  }

  let filename = path.split('/').pop() ?? null;
  if (opts.decodeURI && filename) {
    try {
      filename = decodeURIComponent(filename);
    } catch (_err) {
      return filename;
    }
  }

  return filename;
}

