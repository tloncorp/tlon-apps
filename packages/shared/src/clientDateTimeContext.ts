import { getCalendars, getLocales } from 'expo-localization';

export type ClientDateTimeContext = {
  timezone: string;
  locale: string;
};

/**
 * Read the client, not the worker or bot host. Expo supplies the actual device
 * values on native and the browser values on web; Intl is a safe fallback for
 * partial environments and tests.
 */
export function getClientDateTimeContext(): ClientDateTimeContext {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  const timezone =
    getCalendars()[0]?.timeZone?.trim() || resolved.timeZone?.trim() || 'UTC';
  const locale =
    getLocales()[0]?.languageTag?.trim() || resolved.locale?.trim() || 'en-US';
  return { timezone, locale };
}
