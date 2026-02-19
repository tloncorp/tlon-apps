import { NativeModules } from 'react-native';

export {
  FinishMode,
  PermissionStatus,
  PlayerState,
  RecorderState,
  useAudioPermission,
  Waveform,
} from '@simform_solutions/react-native-audio-waveform';

// TODO: re-exporting IWaveformRef breaks web build, not sure why
export type IWaveformRef = unknown;

export const hasRNWaveformNativeModule = NativeModules.AudioWaveform != null;

export function useExtractWaveformDataCallback():
  | ((args: {
      playerKey: string;
      path: string;
      noOfSamples?: number;
    }) => Promise<number[][]>)
  | null {
  return null;
}
