import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

export type OAuthUrlOpenResult =
  | { type: 'canceled' }
  | { type: 'completed'; url: string }
  | { type: 'opened' };

export async function openOAuthUrl(
  authUrl: string,
  redirectUrl: string
): Promise<OAuthUrlOpenResult> {
  if (Platform.OS === 'web') {
    await Linking.openURL(authUrl);
    return { type: 'opened' };
  }

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
  if (result.type === 'success') {
    return { type: 'completed', url: result.url };
  }
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { type: 'canceled' };
  }

  throw new Error(`Unable to open OAuth session: ${result.type}`);
}
