export const SHIP_COOKIE_REGEX = /(~)[a-z\-]+?(\=)/;
export const ACCESS_CODE_REGEX = /^((?:[a-z]{6}-){3}(?:[a-z]{6}))$/i;
export const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const SHIP_URL_REGEX = /^https?:\/\/([\w-]+\.)+[\w-]+(:\d+)?(?=\/?$)/;
export const IS_IOS = false;
export const IS_ANDROID = false;
export const TLON_APP_STORE_URL =
  'https://apps.apple.com/us/app/tlon-tlon-messenger/id6451392109?utm_source=webapp';
export const TLON_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=io.tlon.groups&utm_source=webapp';
export const SUPPORT_EMAIL = 'support@tlon.io';
// Where we send someone whose ship's %groups desk is too old to talk to: the
// user manual's update order (runtime, kernel, apps), including blocked app
// updates, `|bump` and `+vats`.
export const DESK_UPDATE_HELP_URL =
  'https://docs.urbit.org/user-manual/os/updates';
export const CHAT_REF_LIKE_MAX_WIDTH = 600;
export const MCP_OAUTH_COMPLETION_PATH = 'mcp-oauth/complete';

export * from './lib/envVars';
