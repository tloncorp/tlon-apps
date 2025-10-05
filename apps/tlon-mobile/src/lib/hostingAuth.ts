import NetInfo from '@react-native-community/netinfo';
import CookieManager from '@react-native-cookies/cookies';
import { createDevLogger } from '@tloncorp/shared';
import { getHostingHeartBeat } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { getConstants } from '@tloncorp/shared/domain';
import { Platform } from 'react-native';

const logger = createDevLogger('refreshHostingAuth', false);

// Authentication for hosting uses a token that can last up to a year, but
// expires after 30 days of without use. We don't regularly interact with hosting after login,
// so we attempt to manually refresh the token regularly
export async function refreshHostingAuth() {
  logger.log(`checking hosting auth`);

  if (__DEV__) {
    logger.log('development mode, skipping');
  }

  const expired = await db.hostingAuthExpired.getValue();
  const lastCheck = await db.hostingLastAuthCheck.getValue();

  if (expired) {
    logger.log('hosting auth is already expired');
    return;
  }

  if (wasMoreThanDayAgo(lastCheck)) {
    const isOnline = await deviceIsOnline();
    if (isOnline) {
      logger.log('online and more than a day since last check, refreshing');
      try {
        const result = await getHostingHeartBeat();
        if (result === 'expired') {
          logger.crumb('hosting auth has newly expired');
          logger.trackEvent('Hosting Auth Expired');
          db.hostingAuthExpired.setValue(true);
        } else {
          logger.trackEvent('Hosting Auth Still Valid');
        }
      } catch (e) {
        logger.error('error checking hosting auth:', e);
      } finally {
        db.hostingLastAuthCheck.setValue(Date.now());
      }
    }
  }
}

function wasMoreThanDayAgo(timestamp: number): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > 24 * 60 * 60 * 1000;
}

export async function clearHostingNativeCookie() {
  console.log(`clearing hosting native cookie`);
  try {
    await CookieManager.clearByName('http://tlon.network', 'SolarisSession');
    await CookieManager.clearByName('https://tlon.network', 'SolarisSession');
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
      errorMessage: e.message,
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
