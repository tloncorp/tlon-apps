import { NetInfoState, fetch } from '@react-native-community/netinfo';
import { createDevLogger } from '@tloncorp/shared';
import * as Battery from 'expo-battery';

import { triggerHaptic } from '../ui';

const perfLogger = createDevLogger('perf', false);

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

export async function hapticPerfSignal(
  func: () => Promise<any>,
  tag: string,
  threshold: number
): Promise<void> {
  const start = performance.now();
  await func();
  const duration = performance.now() - start;
  perfLogger.log(tag, duration);
  if (duration > threshold) {
    triggerHaptic('error');
  } else {
    triggerHaptic('success');
  }
}
