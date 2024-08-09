import {
  NetInfoState,
  NetInfoStateType,
} from '@react-native-community/netinfo';

type Fetch = (requestedInterface?: string) => Promise<NetInfoState>;

export const fetch: Fetch = async (_requestedInterface) => {
  return {
    type: NetInfoStateType.wifi,
    isConnected: true,
    isInternetReachable: true,
    details: {
      ssid: null,
      bssid: null,
      strength: null,
      ipAddress: null,
      subnet: null,
      frequency: null,
      linkSpeed: null,
      rxLinkSpeed: null,
      txLinkSpeed: null,
      isConnectionExpensive: false,
    },
  };
};
