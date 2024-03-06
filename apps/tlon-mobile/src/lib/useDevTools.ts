import { useEffect } from 'react';

import { useShip } from '../contexts/ship';
import { getShipFromCookie } from '../utils/ship';
import { getLandscapeAuthCookie } from './landscapeApi';

const DEV_SHIP_URL = 'http://localhost:3000';

export function useDevTools(config: { enabled: boolean; localCode: string }) {
  const { setShip, clearShip } = useShip();

  // For use with local development. If the env vars DEV_LOCAL and DEV_LOCAL_CODE are set,
  // will attempt to automatically authenticate you to the tlon-web dev server
  useEffect(() => {
    async function setupDevAuth() {
      let cookie = null;
      try {
        cookie = await getLandscapeAuthCookie(DEV_SHIP_URL, config.localCode);
      } catch (e) {
        console.error('Error getting development auth cookie:', e);
      }

      if (cookie) {
        const ship = getShipFromCookie(cookie);
        setShip({
          ship,
          shipUrl: DEV_SHIP_URL,
        });
        console.log(`Development auth configured for ${ship}`);
      } else {
        console.warn('Failed to set up development auth');
        clearShip();
      }
    }

    if (config.enabled) {
      if (!config.localCode) {
        console.warn('No code found, skipping development auth');
        return;
      }
      setupDevAuth();
    }
  }, []);
}
