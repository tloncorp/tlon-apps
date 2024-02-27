/**
 * Returns a hex string of given length.
 *
 * Poached from StackOverflow.
 *
 * @param len Length of hex string to return.
 */
export const createHexString = (len: number) => {
  const maxlen = 8;
  const min = Math.pow(16, Math.min(len, maxlen) - 1);
  const max = Math.pow(16, Math.min(len, maxlen)) - 1;
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  let r = n.toString(16);
  while (r.length < len) {
    r = r + createHexString(len - maxlen);
  }
  return r;
};

export const formatPhoneNumber = (phoneNumber: string) => {
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
  const match = cleanedPhoneNumber.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (!match) {
    return phoneNumber;
  }

  const intlCode = match[1] ? '+1 ' : '';
  return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('');
};

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
export const transformShipURL = (shipUrl: string) => {
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

    // Prepend protocol if missing, defaulting to HTTPS
    if (!/^https?:\/\//i.test(transformed)) {
      transformed = `https://${transformed}`;
    }

    // Remove any paths, keeping the domain and optional port
    transformed = transformed.replace(
      /^(https?:\/\/[\w-]+(\.[\w-]+)*(:\d+)?).*$/,
      '$1'
    );

    shipUrlToUse = transformed;
  }

  return shipUrlToUse;
};
