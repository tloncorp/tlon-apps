import { IGNORE_COSMOS } from './lib/envVars';

export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;
export const ACCESS_CODE_REGEX = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;
export const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const SHIP_URL_REGEX = /^https?:\/\/([\w-]+\.)+[\w-]+(:\d+)?(?=\/?$)/;
export const IS_IOS = false;
export const IS_ANDROID = false;
export const COSMOS_ENABLED = (global as any).__DEV__ && !IGNORE_COSMOS;

export * from './lib/envVars';
