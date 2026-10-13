const DEFAULT_MEMEX_BASE_URL = 'https://memex.tlon.network';

export function getMemexBaseUrl(): string {
  try {
    // Vite substitutes this exact expression; browsers do not need process.
    return (
      process.env.TLON_MEMEX_URL?.trim() || DEFAULT_MEMEX_BASE_URL
    ).replace(/\/+$/, '');
  } catch {
    return DEFAULT_MEMEX_BASE_URL;
  }
}
