import Urbit from '@uqbar/react-native-api';
import { create } from 'zustand';
import storage from '../lib/storage';
import { deSig, preSig } from '@urbit/api';
import _api from '../api';

export interface ShipConnection {
  ship: string;
  shipUrl: string;
  authCookie?: string;
}

interface Store {
  loading: boolean;
  ship: string;
  shipUrl: string;
  api: Urbit | null;
  authCookie: string;
  setLoading: (loading: boolean) => void;
  setShip: (ship: ShipConnection) => void;
  clearShip: () => void;
}

const INITIAL_SHIP_CONNECTION = {
  ship: '',
  shipUrl: '',
  authCookie: '',
  api: null,
};

const initApi = (ship: string, shipUrl: string) => {
  const deSigShip = deSig(ship);
  if (!deSigShip) {
    return;
  }

  window.ship = deSigShip;
  global.window.ship = deSigShip;

  const api = _api(deSigShip, shipUrl);
  global.api = api;
  window.api = api;
  return api;
};

const saveShipConnection = (shipConnection: ShipConnection) =>
  storage.save({ key: 'store', data: shipConnection });

export const readShipConnection = async () => {
  const shipConnection = await storage.load({ key: 'store' });
  return shipConnection ? (shipConnection as ShipConnection) : undefined;
};

const clearShipConnection = () => storage.remove({ key: 'store' });

const useStore = create<Store>((set) => ({
  ...INITIAL_SHIP_CONNECTION,
  loading: true,
  setLoading: (loading: boolean) => set({ loading }),
  setShip: ({ ship, shipUrl, authCookie }: ShipConnection) =>
    set((store) => {
      const shipConnection: ShipConnection = {
        ship: preSig(ship),
        shipUrl,
        authCookie,
      };

      saveShipConnection(shipConnection);
      return {
        ...store,
        ...shipConnection,
        api: initApi(ship, shipUrl),
      };
    }),
  clearShip: () =>
    set((store) => {
      clearShipConnection();
      return { ...store, ...INITIAL_SHIP_CONNECTION };
    }),
}));

export default useStore;
