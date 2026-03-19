const LOCAL_URI_PREFIXES = ['file:', 'blob:', 'data:', 'content:'];

function isLocalMediaUri(uri: string | undefined): boolean {
  return !!uri && LOCAL_URI_PREFIXES.some((prefix) => uri.startsWith(prefix));
}

export function sanitizePostBlobForNetwork(blob?: string): string | undefined {
  if (!blob) {
    return blob;
  }

  let didSanitize = false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return blob;
  }

  if (!Array.isArray(parsed)) {
    return blob;
  }

  const sanitizedBlob = JSON.stringify(
    parsed.map((entry) => {
      if (
        entry &&
        typeof entry === 'object' &&
        'type' in entry &&
        entry.type === 'video' &&
        'posterUri' in entry &&
        typeof entry.posterUri === 'string' &&
        isLocalMediaUri(entry.posterUri)
      ) {
        didSanitize = true;
        const { posterUri: _ignoredPosterUri, ...rest } = entry;
        return rest;
      }
      return entry;
    })
  );

  return didSanitize ? sanitizedBlob : blob;
}
