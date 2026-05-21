import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useShip } from '../contexts/ship';
import { useCurrentUserId } from './useCurrentUser';

const logger = createDevLogger('botSettingsAvailability', false);

export function useBotSettingsAvailability() {
  const currentUserId = useCurrentUserId();
  const { ship } = useShip();
  const cachedBotEnabled = db.hostingBotEnabled.useValue();
  const [isHostedUser, setIsHostedUser] = useState(getCurrentUserIsHosted);
  const [remoteBotEnabled, setRemoteBotEnabled] = useState<boolean | null>(
    null
  );
  const isMounted = useRef(true);
  const refreshCount = useRef(0);

  const refreshBotSettingsAvailability = useCallback(async () => {
    const refreshId = ++refreshCount.current;
    const nextIsHostedUser = getCurrentUserIsHosted();
    setIsHostedUser(nextIsHostedUser);

    if (!nextIsHostedUser) {
      setRemoteBotEnabled(false);
      return;
    }

    const shipId = await getTlawnShipId(ship ?? currentUserId);
    if (!isMounted.current || refreshId !== refreshCount.current) {
      return;
    }

    if (!shipId) {
      logger.trackError('Failed to refresh TlonBot availability', {
        reason: 'missingShipId',
      });
      setRemoteBotEnabled(false);
      return;
    }

    try {
      const botInfo = await api.getTlawnBotInfo(shipId);
      if (!isMounted.current || refreshId !== refreshCount.current) {
        return;
      }

      setRemoteBotEnabled(botInfo.enabled);
      db.hostingBotEnabled.setValue(botInfo.enabled);
    } catch (error) {
      logger.trackError('Failed to refresh TlonBot availability', {
        error,
      });
    }
  }, [currentUserId, ship]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    botEnabled: isHostedUser && (remoteBotEnabled ?? cachedBotEnabled),
    refreshBotSettingsAvailability,
  };
}

async function getTlawnShipId(fallbackShipId: string | null | undefined) {
  const hostedShipId = await db.hostedUserNodeId.getValue().catch(() => null);
  return normalizeShipId(hostedShipId ?? fallbackShipId);
}

function normalizeShipId(shipId: string | null | undefined) {
  return shipId ? desig(shipId) : '';
}

function getCurrentUserIsHosted() {
  try {
    return api.getCurrentUserIsHosted();
  } catch (error) {
    logger.trackError('Failed to determine hosted user status', { error });
    return false;
  }
}
