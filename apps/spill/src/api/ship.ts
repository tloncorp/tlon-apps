export const SHIP_COOKIE_REGEX = /(~)[a-z-]+?(=)/;
export const ACCESS_CODE_REGEX = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;
export const SHIP_URL_PATTERN = 'https://{shipId}.tlon.network';
export const TLON_SHIP_URL_REGEX = /([\w-]+)\./i;

export const getShipFromUrl = (shipUrl: string) => {
  const shipUrlMatch = shipUrl.match(TLON_SHIP_URL_REGEX);
  return shipUrlMatch?.[1] ?? null;
};

export const getShipFromCookie = (cookie: string) =>
  cookie.match(SHIP_COOKIE_REGEX)![0].slice(0, -1).replace('~', '');

export const getShipUrl = (shipId: string) =>
  SHIP_URL_PATTERN.replace('{shipId}', shipId);

/**
 * Returns a properly formatted ship url.
 * @param shipUrl Ship URL to format.
 * @returns Formatted ship URL.
 * @example
 * formatShipUrl('sampel-palnet.tlon.network');
 * // => 'https://sampel-palnet.tlon.network'
 * formatShipUrl('sampel-palnet.tlon.network/apps/groups');
 * // => 'https://sampel-palnet.tlon.network'
 * formatShipUrl('https://sampel-palnet.tlon.network');
 * // => 'https://sampel-palnet.tlon.network'
 * formatShipUrl('https://sampel-palnet.tlon.network/apps/groups');
 * // => 'https://sampel-palnet.tlon.network'
 * formatShipUrl('sampel-palnet.tlon.network:8443');
 * // => 'https://sampel-palnet.tlon.network:8443'
 */
export const normalizeShipUrl = (shipUrl: string) => {
  // this definition is duplicated here because importing it from src/constants will cause vitest to
  // attempt to import react-native libraries, which fill fail
  const SHIP_URL_REGEX = /^https?:\/\/([\w-]+\.)+[\w-]+(:\d+)?(?=\/?$)/;
  const shipUrlMatch = shipUrl.match(SHIP_URL_REGEX);

  let shipUrlToUse = shipUrl;

  if (!shipUrlMatch) {
    // If the URL doesn't match the regex, we'll try to transform it into a
    // valid URL. This is useful for when users enter a url like
    // "sampel-palnet.tlon.network" instead of "https://sampel-palnet.tlon.network",
    // or when they enter a URL with a path like "sampel-palnet.tlon.network/apps/groups"
    let transformed = shipUrl.trim();

    // Remove trailing slashes
    transformed = transformed.replace(/\/+$/, '');

    // Prepend protocol if missing, defaulting to HTTPS
    if (!/^https?:\/\//i.test(transformed)) {
      transformed = `https://${transformed}`;
    }

    // Remove any paths, keeping the domain and optional port
    transformed = transformed.replace(
      /^(https?:\/\/[\w-]+(\.[\w-]+)*(:\d+)?).*$/,
      '$1',
    );

    shipUrlToUse = transformed;
  }

  return shipUrlToUse;
};
