import { NetInfoState, fetch } from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';

interface DebugPlatformState {
  network: string;
  battery: string;
}

export const PlatformState = {
  getDebugInfo: getDebugPlatformState,
};

async function getDebugPlatformState(): Promise<DebugPlatformState | null> {
  const network = await getNetworkState();
  const battery = await getBatteryState();
  return {
    network,
    battery,
  };
}

async function getNetworkState(): Promise<string> {
  const netState = await fetch();
  return `${netState.isConnected ? 'connected' : 'disconnected'} ${toNetworkTypeDisplay(netState)}`;
}

async function getBatteryState() {
  const state = await Battery.getPowerStateAsync();
  const batteryLevel = Math.round(state.batteryLevel * 100);
  return `${batteryLevel}% ${state.lowPowerMode ? '(low power mode)' : ''}`;
}

export function toNetworkTypeDisplay(state: NetInfoState): string {
  const networkType = state.type;
  return networkType === 'cellular'
    ? `(cellular ${state.details.cellularGeneration})`
    : `(${networkType})`;
}
