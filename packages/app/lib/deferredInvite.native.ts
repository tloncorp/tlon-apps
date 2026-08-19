import {
  inviteUrlFromDeferredPayload,
  parseInviteDeepLink,
} from '@tloncorp/shared/logic';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { INVITE_SERVICE_ENDPOINT } from './envVars';

export type DeferredInviteSource =
  | 'install_referrer'
  | 'clipboard'
  | 'ip_match';

export interface DeferredInvite {
  url: string;
  source: DeferredInviteSource;
  matchedAfterMs?: number;
}

// deferred install attribution, cascade steps 2–4: install referrer,
// clipboard, ip matcher. one shot per install — the caller gates on
// storage.deferredInviteChecked
export async function resolveDeferredInvite(): Promise<DeferredInvite | null> {
  const referrer = await installReferrerUrl();
  if (referrer) {
    return { url: referrer, source: 'install_referrer' };
  }

  const clipboard = await clipboardInviteUrl();
  if (clipboard) {
    return { url: clipboard, source: 'clipboard' };
  }

  return deferredMatchInvite();
}

async function installReferrerUrl() {
  if (Platform.OS !== 'android') {
    return null;
  }
  const referrer = await Application.getInstallReferrerAsync().catch(
    () => null
  );
  return referrer ? inviteUrlFromDeferredPayload(referrer) : null;
}

async function clipboardInviteUrl() {
  // hasUrlAsync is prompt-free; the ios paste prompt appears only on the
  // read, and only when a url is actually present — parity with the
  // branch sdk's pasteboard check today
  const hasUrl = await Clipboard.hasUrlAsync().catch(() => false);
  if (!hasUrl) {
    return null;
  }
  const url = await Clipboard.getUrlAsync().catch(() => null);
  if (!url) {
    return null;
  }
  // lures only: a copied dm- link must not clear the invite machine on a
  // fresh install (the cascade recovers invites, not navigation)
  return parseInviteDeepLink(url)?.type === 'lure' ? url : null;
}

async function deferredMatchInvite(): Promise<DeferredInvite | null> {
  if (!INVITE_SERVICE_ENDPOINT) {
    return null;
  }
  try {
    const response = await fetch(`${INVITE_SERVICE_ENDPOINT}/deferredMatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_class: deviceClass(),
        os_major: osMajor(),
      }),
    });
    if (!response.ok) {
      return null;
    }
    // the endpoint returns an empty 200 on no-match
    const text = await response.text();
    if (!text) {
      return null;
    }
    const match = JSON.parse(text) as {
      token?: string;
      matchedAfterMs?: number;
    };
    const url = match.token ? inviteUrlFromDeferredPayload(match.token) : null;
    return url
      ? { url, source: 'ip_match', matchedAfterMs: match.matchedAfterMs }
      : null;
  } catch {
    return null;
  }
}

// mirror the classes the invite page derives from the user agent — the
// matcher filters candidates by equality on these
function deviceClass() {
  if (Platform.OS === 'ios') {
    return Platform.isPad ? 'ipad' : 'iphone';
  }
  return Device.deviceType === Device.DeviceType.TABLET
    ? 'android_tablet'
    : 'android_phone';
}

function osMajor() {
  const version =
    Platform.OS === 'ios' ? String(Platform.Version) : (Device.osVersion ?? '');
  return version.split('.')[0] || undefined;
}
