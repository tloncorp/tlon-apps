import crashlytics from '@react-native-firebase/crashlytics';
import { configureApi } from '@tloncorp/shared/dist/api';
import { preSig } from '@urbit/aura';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { NativeModules } from 'react-native';

import storage from '../lib/storage';
import { transformShipURL } from '../utils/string';

const { UrbitModule } = NativeModules;

export type ShipInfo = {
  authType: 'self' | 'hosted';
  ship: string | undefined;
  shipUrl: string | undefined;
  authCookie: string | undefined;
};

type State = ShipInfo & {
  contactId: string | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type ContextValue = State & {
  setShip: (shipInfo: ShipInfo) => void;
  clearShip: () => void;
};

const Context = createContext({} as ContextValue);

export const useShip = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error('Must call `useShip` within an `ShipProvider` component.');
  }

  return context;
};

const emptyShip: ShipInfo = {
  authType: 'hosted',
  ship: undefined,
  shipUrl: undefined,
  authCookie: undefined,
};

export const ShipProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [shipInfo, setShipInfo] = useState(emptyShip);

  const setShip = useCallback(
    ({ ship, shipUrl, authCookie, authType }: ShipInfo) => {
      // Clear all saved ship info if either required field is empty
      if (!ship || !shipUrl) {
        // Remove from React Native storage
        clearShipInfo();

        // Clear context state
        setShipInfo(emptyShip);

        // Clear native storage
        UrbitModule.clearUrbit();
        return;
      }

      // The passed shipUrl should already be normalized, but defensively ensure it is
      const normalizedShipUrl = transformShipURL(shipUrl);
      const nextShipInfo = {
        ship,
        shipUrl: normalizedShipUrl,
        authCookie,
        authType,
      };

      // Save to React Native stoage
      saveShipInfo(nextShipInfo);

      // Save context state
      setShipInfo(nextShipInfo);

      // Configure API
      configureApi(ship, normalizedShipUrl);

      // Configure analytics
      crashlytics().setAttribute(
        'isHosted',
        normalizedShipUrl.includes('.tlon.network') ? 'true' : 'false'
      );

      // If cookie was passed in, use it, otherwise fetch from ship
      // TODO: This may not be necessary, as I *believe* auth cookie will always
      // be stored on successful login.
      if (authCookie) {
        // Save to native storage
        UrbitModule.setUrbit(ship, normalizedShipUrl, authCookie);
      } else {
        // Run this in the background
        (async () => {
          // Fetch the root ship URL and parse headers
          const response = await fetch(normalizedShipUrl, {
            credentials: 'include',
          });
          const fetchedAuthCookie = response.headers.get('set-cookie');
          if (fetchedAuthCookie) {
            setShipInfo({ ...nextShipInfo, authCookie: fetchedAuthCookie });
            saveShipInfo({ ...nextShipInfo, authCookie: fetchedAuthCookie });
            // Save to native storage
            UrbitModule.setUrbit(ship, normalizedShipUrl, fetchedAuthCookie);
          }
        })();
      }

      setIsLoading(false);
    },
    []
  );

  useEffect(() => {
    const loadConnection = async () => {
      try {
        const storedShipInfo = await loadShipInfo();
        if (storedShipInfo) {
          setShip(storedShipInfo);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'NotFoundError') {
          console.error('Error reading ship connection from storage', err);
        }
        setIsLoading(false);
      }
    };

    loadConnection();
  }, [setShip]);

  const clearShip = useCallback(() => {
    setShipInfo(emptyShip);
  }, []);

  return (
    <Context.Provider
      value={{
        isLoading,
        isAuthenticated: !!shipInfo.ship && !!shipInfo.shipUrl,
        contactId: shipInfo.ship ? preSig(shipInfo.ship) : undefined,
        setShip,
        clearShip,
        ...shipInfo,
      }}
    >
      {children}
    </Context.Provider>
  );
};

const shipInfoKey = 'store';

export const saveShipInfo = (shipInfo: ShipInfo) => {
  return storage.save({ key: shipInfoKey, data: shipInfo });
};

export const loadShipInfo = () => {
  return storage.load<ShipInfo | undefined>({ key: shipInfoKey });
};

export const clearShipInfo = () => {
  return storage.remove({ key: shipInfoKey });
};
