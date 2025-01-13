import { getConstants } from '../domain';

export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;

export const getShipFromCookie = (cookie: string) => {
  return cookie.match(SHIP_COOKIE_REGEX)![0].slice(0, -1);
};

export const getShipUrl = (shipId: string) => {
  const env = getConstants();
  return env.SHIP_URL_PATTERN.replace('{shipId}', shipId);
};
