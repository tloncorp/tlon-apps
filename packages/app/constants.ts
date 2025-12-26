export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;
export const ACCESS_CODE_REGEX = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;
export const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const SHIP_URL_REGEX = /^https?:\/\/([\w-]+\.)+[\w-]+(:\d+)?(?=\/?$)/;
export const IS_IOS = false;
export const IS_ANDROID = false;
export const TLON_APP_STORE_URL =
  'https://apps.apple.com/app/tlon/id6451393130?utm_source=webapp';
export const TLON_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.tlon.app&utm_source=webapp';

export * from './lib/envVars';
