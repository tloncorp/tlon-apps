import { NativeModules } from 'react-native';

export {
  FinishMode,
  IWaveformRef,
  PermissionStatus,
  PlayerState,
  RecorderState,
  Waveform,
  useAudioPermission,
} from '@simform_solutions/react-native-audio-waveform';

export const hasRNWaveformNativeModule = NativeModules.AudioWaveform != null;
