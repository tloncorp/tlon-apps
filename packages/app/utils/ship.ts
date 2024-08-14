import { SHIP_COOKIE_REGEX, SHIP_URL_PATTERN } from '../constants';

export const getShipFromCookie = (cookie: string) =>
  cookie.match(SHIP_COOKIE_REGEX)![0].slice(0, -1);

export const getShipUrl = (shipId: string) =>
  SHIP_URL_PATTERN.replace('{shipId}', shipId);
