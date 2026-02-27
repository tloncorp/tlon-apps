import { NativeModules, View } from 'react-native';

export {
  FinishMode,
  PermissionStatus,
  PlayerState,
  RecorderState,
  useAudioPermission,
} from '@simform_solutions/react-native-audio-waveform';

// TODO: re-exporting IWaveformRef breaks web build, not sure why
export type IWaveformRef = unknown;

export const hasRNWaveformNativeModule = NativeModules.AudioWaveform != null;

// for web, export a dummy component since the native module is not available
// (even though the Waveform component is JS, it automatically calls into the
// native module in a way that crashes the web app)
export const Waveform = View;

export function useExtractWaveformDataCallback():
  | ((args: {
      playerKey: string;
      path: string;
      noOfSamples?: number;
    }) => Promise<number[][]>)
  | null {
  return null;
}
