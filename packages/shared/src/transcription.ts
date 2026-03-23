import { getLocales } from 'expo-localization';
import {
  AudioEncodingAndroid,
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';
import { memoize } from 'lodash';
import { Platform } from 'react-native';

import { alreadyPromptedLocaleDownloads } from './db/keyValue';
import { getMd5 } from './md5';

function getDefaultLocaleCode() {
  // `getLocales` is guaranteed to have at least 1 element
  return getLocales()[0].languageTag;
}

async function transcribeAudioFile(
  audioFileUri: string,
  {
    locale = getDefaultLocaleCode(),
  }: {
    locale?: string;
  } = {}
): Promise<string | null> {
  const cleanups: Array<() => void> = [];
  return new Promise<string | null>((resolve, reject) => {
    const accumulatedTranscript: string[] = [];

    cleanups.push(
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        if (!event.isFinal) {
          return;
        }
        if (event.results.length === 0) {
          reject(new Error('No transcription results received'));
          return;
        }
        // assumes the best result is the first one (since we set maxAlternatives to 1)
        accumulatedTranscript.push(event.results[0].transcript);
      }).remove,

      ExpoSpeechRecognitionModule.addListener('end', () => {
        resolve(accumulatedTranscript.join(' '));
      }).remove,

      ExpoSpeechRecognitionModule.addListener('nomatch', () => {
        resolve(null);
      }).remove,

      ExpoSpeechRecognitionModule.addListener('error', (error) => {
        switch (error.error) {
          case 'no-speech':
          // fallthrough
          case 'speech-timeout':
            resolve(null);
            break;

          default:
            reject(error);
            break;
        }
      }).remove
    );

    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: false,
      requiresOnDeviceRecognition: true,
      maxAlternatives: 1,
      addsPunctuation: true,
      audioSource: {
        uri: audioFileUri,
        ...(Platform.OS === 'android'
          ? {
              audioChannels: 1,
              audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT,
              sampleRate: 44100, // matches AudioRecorder settings
            }
          : {}),
      },
    });
  }).finally(() => {
    cleanups.forEach((cleanup) => cleanup());
  });
}

function isFileTranscriptionSupported(): boolean {
  if (!['android', 'ios'].includes(Platform.OS)) {
    return false;
  }

  if (Platform.OS === 'android') {
    if (Platform.Version < 33) {
      // transcription may be available, but file transcription is not
      // supported before Android 13
      return false;
    }
  }

  return ExpoSpeechRecognitionModule.isRecognitionAvailable();
}

export async function requestTranscriptionPermissionsIfNeeded(): Promise<{
  status: 'granted' | 'not-granted' | 'unavailable';
}> {
  if (!isFileTranscriptionSupported()) {
    return { status: 'unavailable' };
  }
  let permissions = await ExpoSpeechRecognitionModule.getPermissionsAsync();
  if (permissions.granted) {
    return { status: 'granted' };
  }
  if (!permissions.canAskAgain) {
    return { status: 'not-granted' };
  }
  permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return {
    status: permissions.granted ? 'granted' : 'not-granted',
  };
}

export const transcribeAudioFileWithGlobalCache = memoize(
  transcribeAudioFile,
  (uri) => getMd5(uri) ?? uri
);

async function isLocaleReady(locale: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const locales = await ExpoSpeechRecognitionModule.getSupportedLocales({});
  return locales.installedLocales.includes(locale);
}

async function requestDownloadLocaleIfNeeded(opts: {
  locale: string;
  /** when true, if the locale isn't available, we'll skip asking user to
   * download locale and just return `denied` */
  autoDenyDownload?: boolean;
}) {
  if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
    return;
  }
  if (await isLocaleReady(opts.locale)) {
    return;
  }
  const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
  if (!locales.includes(opts.locale)) {
    return;
  }
  if (opts.autoDenyDownload) {
    return;
  }
  try {
    await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: opts.locale,
    });
  } catch {
    // if user cancels the initial dialog, the library surprisingly throws an error.
    // we don't want to raise in this case.
    return;
  }
}

/**
 * Perform setup to ensure transcription is ready. This might pop dialogs, so
 * it should be called at most once per action.
 */
export async function setupTranscriptionIfNeeded(): Promise<
  | { canTranscribe: false; status: 'failed-permissions' }
  | {
      canTranscribe: false;
      status: 'missing-locale';
    }
  | { canTranscribe: true; status: 'ready' }
> {
  const deviceLocale = getDefaultLocaleCode();

  const permissions = await requestTranscriptionPermissionsIfNeeded();
  if (permissions.status !== 'granted') {
    return { canTranscribe: false, status: 'failed-permissions' };
  }

  const alreadyPrompted = await (async () => {
    const alreadyPromptedLocales =
      await alreadyPromptedLocaleDownloads.getValue();
    if (alreadyPromptedLocales.has(deviceLocale)) {
      // already asked, don't ask again
      return true;
    }
    // mark as prompted, then ask
    alreadyPromptedLocales.add(deviceLocale);
    await alreadyPromptedLocaleDownloads.setValue(alreadyPromptedLocales);
    return false;
  })();

  void requestDownloadLocaleIfNeeded({
    locale: deviceLocale,
    autoDenyDownload: alreadyPrompted,
  }).catch((err) => {
    console.error('Error requesting locale download', err);
  });

  const missingLocale = !(await isLocaleReady(deviceLocale));

  if (missingLocale) {
    return {
      canTranscribe: false,
      status: 'missing-locale',
    };
  }

  return {
    canTranscribe: true,
    status: 'ready',
  };
}
