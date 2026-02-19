import { useAudioPlayer } from '@simform_solutions/react-native-audio-waveform';
import { NativeModules } from 'react-native';

export type { IWaveformRef } from '@simform_solutions/react-native-audio-waveform';
export {
  FinishMode,
  PermissionStatus,
  PlayerState,
  RecorderState,
  Waveform,
  useAudioPermission,
  useAudioPlayer,
} from '@simform_solutions/react-native-audio-waveform';

export const hasRNWaveformNativeModule = NativeModules.AudioWaveform != null;

export function useExtractWaveformDataCallback():
  | ((args: {
      playerKey: string;
      path: string;
      noOfSamples?: number;
    }) => Promise<number[][]>)
  | null {
  const { extractWaveformData } = useAudioPlayer();
  return extractWaveformData;
}
