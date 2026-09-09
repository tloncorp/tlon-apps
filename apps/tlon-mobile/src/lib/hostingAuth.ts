import NetInfo from '@react-native-community/netinfo';
import CookieManager from '@react-native-cookies/cookies';
import { getHostingHeartBeat } from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { getConstants } from '@tloncorp/shared/domain';
import { Platform } from 'react-native';

const logger = createDevLogger('refreshHostingAuth', false);

export type HostingAuthRefreshResult = 'expired' | 'ok' | 'unknown' | 'skipped';

// Hosting authentication expires after four months without use. Most of the
// authenticated app talks directly to the ship, so ping Hosting separately to
// keep the session alive and detect when it has actually expired.
export async function refreshHostingAuth(
  options: {
    force?: boolean;
    authType?: db.ShipInfo['authType'];
  } = {}
): Promise<HostingAuthRefreshResult> {
  logger.log(`checking hosting auth`);

  const authType = options.authType ?? (await db.shipInfo.getValue())?.authType;
  if (authType !== 'hosted') {
    logger.log('not a hosted session, skipping');
    return 'skipped';
  }

  const expired = await db.hostingAuthExpired.getValue();
  if (expired) {
    logger.trackEvent('Cannot refresh hosting auth, already expired');
    return 'expired';
  }

  if (__DEV__) {
    logger.log('development mode, skipping');
    return 'skipped';
  }

  const lastCheck = await db.hostingLastAuthCheck.getValue();
  if (!options.force && !wasMoreThanDayAgo(lastCheck)) {
    return 'skipped';
  }

  const isOnline = await deviceIsOnline();
  if (!isOnline) {
    return 'unknown';
  }

  logger.log('online and refreshing hosting auth');
  try {
    const result = await getHostingHeartBeat();
    if (result === 'expired') {
      logger.crumb('hosting auth has newly expired');
      logger.trackEvent('Hosting Auth Expired');
      await db.hostingAuthExpired.setValue(true);
    } else if (result === 'ok') {
      logger.trackEvent('Hosting Auth Still Valid');
    }
    return result;
  } catch (e) {
    logger.error('error checking hosting auth:', e);
    return 'unknown';
  } finally {
    await db.hostingLastAuthCheck.setValue(Date.now());
  }
}

function wasMoreThanDayAgo(timestamp: number): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > 24 * 60 * 60 * 1000;
}

export async function clearHostingNativeCookie() {
  console.log(`clearing hosting native cookie`);
  try {
    if (Platform.OS === 'android') {
      // `clearByName` isn't implemented on Android, so remove SolarisSession by
      // handing WebView's CookieManager a raw expired Set-Cookie via
      // `setFromResponse` — a past Expires / Max-Age=0 deletes the entry.
      const expired =
        'SolarisSession=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
      await CookieManager.setFromResponse('http://tlon.network', expired);
      await CookieManager.setFromResponse('https://tlon.network', expired);
    } else {
      await CookieManager.clearByName('http://tlon.network', 'SolarisSession');
      await CookieManager.clearByName('https://tlon.network', 'SolarisSession');
    }
    console.log('cleared hosting native cookie');
  } catch (e) {
    console.error('error clearing hosting native cookie:', e);
  }
}

async function deviceIsOnline(): Promise<boolean> {
  let isOnline = false;
  try {
    const netInfo = await NetInfo.fetch();
    isOnline = (netInfo.isConnected && netInfo.isInternetReachable) ?? false;
  } catch (e) {
    logger.trackEvent('Failed to check Network Status', {
      error: e,
    });
  }

  return isOnline;
}

export function selectRecaptchaPlatform():
  | 'ios'
  | 'android'
  | 'web'
  | 'ios_test'
  | 'android_test' {
  const env = getConstants();
  if (env.AUTOMATED_TEST) {
    return Platform.OS === 'android' ? 'android_test' : 'ios_test';
  }

  return Platform.OS === 'android' ? 'android' : 'ios';
}
