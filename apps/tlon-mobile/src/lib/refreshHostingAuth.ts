import { getHostingHeartBeat } from '@tloncorp/app/lib/hostingApi';
import {
  getHostingAuthExpired,
  getLastHostingAuthCheck,
  setHostingAuthExpired,
  setLastHostingAuthCheck,
} from '@tloncorp/app/utils/hosting';
import { createDevLogger } from '@tloncorp/shared/dist';

const logger = createDevLogger('refreshHostingAuth', false);

// Authentication for hosting uses a token that can last up to a year, but
// expires after 30 days of without use. We don't regularly interact with hosting after login,
// so we attempt to manually refresh the token regularly
export async function refreshHostingAuth() {
  logger.log(`checking hosting auth`);

  if (__DEV__) {
    logger.log('development mode, skipping');
  }

  const expired = await getHostingAuthExpired();
  const lastCheck = await getLastHostingAuthCheck();

  if (expired) {
    logger.log('hosting auth is already expired');
    return;
  }

  if (wasMoreThanDayAgo(lastCheck)) {
    logger.log('more than a day since last check, refreshing');
    try {
      const result = await getHostingHeartBeat();
      if (result === 'expired') {
        logger.crumb('hosting auth has newly expired');
        setHostingAuthExpired(true);
      }
    } catch (e) {
      logger.error('error checking hosting auth:', e);
    } finally {
      setLastHostingAuthCheck(Date.now());
    }
  }
}

function wasMoreThanDayAgo(timestamp: number): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > 24 * 60 * 60 * 1000;
}
