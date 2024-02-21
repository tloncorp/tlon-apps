import crashlytics from '@react-native-firebase/crashlytics';
import type { ReactNode } from 'react';
import { useContext, useEffect, useState } from 'react';
import { createContext } from 'react';
import { NativeModules } from 'react-native';

import { configureApi } from '../lib/api';
import storage from '../lib/storage';

const { UrbitModule } = NativeModules;

type ShipInfo = {
  ship: string | undefined;
  shipUrl: string | undefined;
};

type State = ShipInfo & {
  isLoading: boolean;
  isAuthenticated: boolean;
};

type ContextValue = State & {
  setShip: (shipInfo: ShipInfo, authCookie?: string) => void;
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

export const ShipProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [{ ship, shipUrl }, setShipInfo] = useState<ShipInfo>({
    ship: undefined,
    shipUrl: undefined,
  });

  const setShip = ({ ship, shipUrl }: ShipInfo, authCookie?: string) => {
    // Clear all saved ship info if either required field is empty
    if (!ship || !shipUrl) {
      // Remove from React Native storage
      storage.remove({ key: 'store' });

      // Clear context state
      setShipInfo({ ship: undefined, shipUrl: undefined });

      // Clear native storage
      UrbitModule.clearUrbit();
      return;
    }

    // Save to React Native stoage
    storage.save({ key: 'store', data: { ship, shipUrl } });

    // Save context state
    setShipInfo({ ship, shipUrl });

    // Configure API
    configureApi(ship, shipUrl);

    // Configure analytics
    crashlytics().setAttribute(
      'isHosted',
      shipUrl.includes('.tlon.network') ? 'true' : 'false'
    );

    // If cookie was passed in, use it, otherwise fetch from ship
    if (authCookie) {
      // Save to native storage
      UrbitModule.setUrbit(ship, shipUrl, authCookie);
    } else {
      // Run this in the background
      (async () => {
        // Fetch the root ship URL and parse headers
        const response = await fetch(shipUrl, {
          credentials: 'include',
        });
        const fetchedAuthCookie = response.headers.get('set-cookie');
        if (fetchedAuthCookie) {
          // Save to native storage
          UrbitModule.setUrbit(ship, shipUrl, fetchedAuthCookie);
        }
      })();
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const loadConnection = async () => {
      try {
        const shipInfo = (await storage.load({ key: 'store' })) as
          | ShipInfo
          | undefined;
        if (shipInfo) {
          setShip(shipInfo);
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
  }, []);

  return (
    <Context.Provider
      value={{
        isLoading,
        isAuthenticated: !!ship && !!shipUrl,
        ship,
        shipUrl,
        setShip,
        clearShip: () => setShip({ ship: undefined, shipUrl: undefined }),
      }}
    >
      {children}
    </Context.Provider>
  );
};
