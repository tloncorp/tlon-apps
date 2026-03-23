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

enum DownloadLocaleResult {
  denied, // locale is necessary, but user denied permission to download locale
  unavailable, // locale is necessary, but not available for download (probably can't transcribe)
  notNeeded, // can transcribe without downloading
  downloaded, // finished download of locale
  openedDialog, // user was presented with dialog to download locale and we don't have access to the result
}

function willFailTranscription(localeResult: DownloadLocaleResult) {
  switch (localeResult) {
    case DownloadLocaleResult.denied:
    case DownloadLocaleResult.unavailable:
      return true;
    case DownloadLocaleResult.notNeeded:
    case DownloadLocaleResult.downloaded:
    case DownloadLocaleResult.openedDialog:
      return false;
  }
}

async function requestDownloadLocaleIfNeeded(opts: {
  locale: string;
  /** when true, if the locale isn't available, we'll skip asking user to
   * download locale and just return `denied` */
  autoDenyDownload?: boolean;
}): Promise<{
  result: DownloadLocaleResult;
}> {
  if (Platform.OS !== 'android') {
    return { result: DownloadLocaleResult.notNeeded };
  }
  if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
    return { result: DownloadLocaleResult.unavailable };
  }
  const { locales, installedLocales } =
    await ExpoSpeechRecognitionModule.getSupportedLocales({});
  if (installedLocales.includes(opts.locale)) {
    return { result: DownloadLocaleResult.notNeeded };
  }
  if (!locales.includes(opts.locale)) {
    return { result: DownloadLocaleResult.unavailable };
  }
  if (opts.autoDenyDownload) {
    return { result: DownloadLocaleResult.denied };
  }
  try {
    const result =
      await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
        locale: opts.locale,
      });
    switch (result.status) {
      case 'download_success':
        return { result: DownloadLocaleResult.downloaded };
      case 'opened_dialog':
        return { result: DownloadLocaleResult.openedDialog };
      case 'download_canceled':
        return { result: DownloadLocaleResult.denied };
    }
  } catch {
    // if user cancels the initial dialog, the library surprisingly throws an error.
    // convert to a `deny`.
    return { result: DownloadLocaleResult.denied };
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
      result: DownloadLocaleResult;
    }
  | { canTranscribe: true; status: 'ready'; result: DownloadLocaleResult }
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

  const localeSetup = await requestDownloadLocaleIfNeeded({
    locale: deviceLocale,
    autoDenyDownload: alreadyPrompted,
  });

  if (willFailTranscription(localeSetup.result)) {
    return {
      canTranscribe: false,
      status: 'missing-locale',
      result: localeSetup.result,
    };
  }

  return {
    canTranscribe: true,
    status: 'ready',
    result: localeSetup.result,
  };
}
