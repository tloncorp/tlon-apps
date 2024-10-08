import { configureApi } from '@tloncorp/shared/dist/api';
import { getLandscapeAuthCookie } from '@tloncorp/shared/dist/api';
import { useCallback, useEffect, useState } from 'react';

import { useShip } from '../contexts/ship';
import { useSignupContext } from '../contexts/signup';
import * as hostingApi from '../lib/hostingApi';
import { trackError, trackOnboardingAction } from '../utils/posthog';
import { getShipFromCookie, getShipUrl } from '../utils/ship';

// import { useOnboardingContext } from '../../lib/OnboardingContext';

export enum NodeBootPhase {
  IDLE = 'idle',
  RESERVING = 'reserving',
  BOOTING = 'booting',
  AUTHENTICATING = 'authenticating',
  CHECKING_FOR_INVITE = 'checking-for-invite',
  CLAIMING_INVITE = 'claiming-invite',
  READY = 'ready',
  ERROR = 'error',
}

export const useShipBoot = (userId: string) => {
  const [status, setStatus] = useState<NodeBootPhase>(NodeBootPhase.IDLE);
  const [error, setError] = useState<string | null>(null);
  const signupContext = useSignupContext();
  const { setShip } = useShip();

  const startShip = useCallback(
    async (shipIds: string[]) => {
      // setStatus(NodeBootPhase.LOADING);
      try {
        const shipsWithStatus = await hostingApi.getShipsWithStatus(shipIds);
        if (!shipsWithStatus) {
          setStatus(NodeBootPhase.BOOTING);
          return;
        }

        const { status: shipStatus, shipId } = shipsWithStatus;

        if (shipStatus !== 'Ready') {
          setStatus(NodeBootPhase.BOOTING);
          return;
        }

        const { code: accessCode } = await hostingApi.getShipAccessCode(shipId);
        const shipUrl = getShipUrl(shipId);
        const authCookie = await getLandscapeAuthCookie(shipUrl, accessCode);
        if (!authCookie) {
          throw new Error("Couldn't log you into your ship.");
        }

        const ship = getShipFromCookie(authCookie);
        configureApi(ship, shipUrl);

        setShip({
          ship,
          shipUrl,
          authCookie,
        });

        setStatus(NodeBootPhase.READY);
      } catch (err) {
        console.error('Error starting ship:', err);
        if (err instanceof Error) {
          trackError(err);
          setError(err.message);
        }
        setStatus(NodeBootPhase.ERROR);
      }
    },
    [getLandscapeAuthCookie, hostingApi, setShip]
  );

  const reserveShip = useCallback(
    async (skipShipId?: string) => {
      setStatus(NodeBootPhase.RESERVING);
      try {
        const user = await hostingApi.getHostingUser(userId);
        const shipIds = user.ships ?? [];

        if (shipIds.length === 0) {
          const ships = await hostingApi.getReservableShips(userId);
          const ship = ships.find(
            ({ id, readyForDistribution }) =>
              id !== skipShipId && readyForDistribution
          );
          if (!ship) {
            throw new Error('No available ships found.');
          }

          const { reservedBy } = await hostingApi.reserveShip(userId, ship.id);
          if (reservedBy !== userId) {
            return reserveShip(ship.id);
          }

          await hostingApi.allocateReservedShip(userId);
          shipIds.push(ship.id);
          trackOnboardingAction({
            actionName: 'Urbit ID Selected',
            ship: ship.id,
          });
        }

        await startShip(shipIds);
      } catch (err) {
        console.error('Error reserving ship:', err);
        if (err instanceof Error) {
          trackError(err);
          setError(err.message);
        }
        setStatus(NodeBootPhase.ERROR);
      }
    },
    [userId, hostingApi, startShip]
  );

  const bootShip = useCallback(() => {
    reserveShip();
  }, [reserveShip]);

  useEffect(() => {
    if (status === NodeBootPhase.BOOTING) {
      const timer = setInterval(() => {
        reserveShip();
      }, 5000);

      return () => clearInterval(timer);
    }
  }, [status, reserveShip]);

  return {
    status,
    error,
    bootShip,
  };
};

export function useSignupBootStatus() {
  const signupContext = useSignupContext();
}

async function reserveShip(
  hostingUserId: string,
  skipShipIds: string[] = []
): Promise<boolean> {
  try {
    const user = await hostingApi.getHostingUser(hostingUserId);
    const shipIds = user.ships ?? [];

    if (shipIds.length === 0) {
      const ships = await hostingApi.getReservableShips(hostingUserId);
      const ship = ships.find(
        ({ id, readyForDistribution }) =>
          !skipShipIds.includes(id) && readyForDistribution
      );
      if (!ship) {
        throw new Error('No available ships found.');
      }

      const { reservedBy } = await hostingApi.reserveShip(
        hostingUserId,
        ship.id
      );
      if (reservedBy !== hostingUserId) {
        return reserveShip(hostingUserId, [ship.id]);
      }

      await hostingApi.allocateReservedShip(hostingUserId);
      shipIds.push(ship.id);
      trackOnboardingAction({
        actionName: 'Urbit ID Selected',
        ship: ship.id,
      });
    }

    return true;
    // await startShip(shipIds);
  } catch (err) {
    console.error('Error reserving ship:', err);
    if (err instanceof Error) {
      trackError(err);
      // setError(err.message);
    }
    // setStatus(NodeBootPhase.ERROR);
    return false;
  }
}

async function checkShipStatus(shipIds: string[]): Promise<NodeBootPhase> {
  try {
    const shipsWithStatus = await hostingApi.getShipsWithStatus(shipIds);
    if (!shipsWithStatus) {
      return NodeBootPhase.BOOTING;
    }

    const { status: shipStatus, shipId } = shipsWithStatus;

    if (shipStatus !== 'Ready') {
      return NodeBootPhase.BOOTING;
    }

    const { code: accessCode } = await hostingApi.getShipAccessCode(shipId);
    const shipUrl = getShipUrl(shipId);
    const authCookie = await getLandscapeAuthCookie(shipUrl, accessCode);
    if (!authCookie) {
      throw new Error("Couldn't log you into your ship.");
    }

    const ship = getShipFromCookie(authCookie);
    configureApi(ship, shipUrl);

    // setShip({
    //   ship,
    //   shipUrl,
    //   authCookie,
    // });

    // setStatus(NodeBootPhase.READY);
    return NodeBootPhase.READY;
  } catch (err) {
    console.error('Error starting ship:', err);
    if (err instanceof Error) {
      trackError(err);
      // setError(err.message);
    }
    // setStatus(NodeBootPhase.ERROR);
    return NodeBootPhase.ERROR;
  }
}

async function getAuthenticationDetails(
  nodeId: string
): Promise<{ nodeId: string; nodeUrl: string; authCookie: string }> {
  const { code: accessCode } = await hostingApi.getShipAccessCode(nodeId);
  const nodeUrl = getShipUrl(nodeId);
  const authCookie = await getLandscapeAuthCookie(nodeUrl, accessCode);
  if (!authCookie) {
    throw new Error("Couldn't log you into your ship.");
  }

  // TODO: shouldn't this be the same?
  const ship = getShipFromCookie(authCookie);

  return {
    nodeId,
    nodeUrl,
    authCookie,
  };
}
