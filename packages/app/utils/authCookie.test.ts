import type { ShipInfo } from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import { applyRefreshedAuthCookie } from './authCookie';

const stored: ShipInfo = {
  authType: 'hosted',
  ship: '~ravmel-ropdyl',
  shipUrl: 'https://ravmel-ropdyl.tlon.network',
  authCookie: 'urbauth-~ravmel-ropdyl=stale',
};

const refresh = {
  shipName: '~ravmel-ropdyl',
  shipUrl: 'https://ravmel-ropdyl.tlon.network',
  authCookie: 'urbauth-~ravmel-ropdyl=fresh',
};

describe('applyRefreshedAuthCookie', () => {
  it('replaces the cookie on the matching record', () => {
    expect(applyRefreshedAuthCookie(stored, refresh)).toEqual({
      ...stored,
      authCookie: 'urbauth-~ravmel-ropdyl=fresh',
    });
  });

  it('preserves the rest of the record', () => {
    const withExtras: ShipInfo = {
      ...stored,
      needsSplashSequence: true,
      splashSequenceMode: 'tlonbotRevival',
    };
    expect(applyRefreshedAuthCookie(withExtras, refresh)).toMatchObject({
      authType: 'hosted',
      needsSplashSequence: true,
      splashSequenceMode: 'tlonbotRevival',
    });
  });

  // A reauth that started before a logout must not resurrect the session.
  it('declines when there is no stored record', () => {
    expect(applyRefreshedAuthCookie(null, refresh)).toBeNull();
  });

  // ...nor overwrite the account that replaced it.
  it('declines when the stored record is a different ship', () => {
    const other: ShipInfo = {
      ...stored,
      ship: '~solfer-magfed',
      shipUrl: 'https://solfer-magfed.tlon.network',
      authCookie: 'urbauth-~solfer-magfed=theirs',
    };
    expect(applyRefreshedAuthCookie(other, refresh)).toBe(other);
  });

  // A url is not an identity: the same self-hosted endpoint can end up serving
  // a different ship, so the url matching is not enough on its own.
  it('declines when the url matches but the ship does not', () => {
    const rehomed: ShipInfo = {
      ...stored,
      ship: '~solfer-magfed',
      authCookie: 'urbauth-~solfer-magfed=theirs',
    };
    expect(applyRefreshedAuthCookie(rehomed, refresh)).toBe(rehomed);
  });

  it('declines when the ship matches but the url does not', () => {
    const moved: ShipInfo = { ...stored, shipUrl: 'https://elsewhere.test' };
    expect(applyRefreshedAuthCookie(moved, refresh)).toBe(moved);
  });

  // Callers detect a decline by reference (`next !== stored`) and use it to
  // gate the native cookie write as well, so returning a copy on the decline
  // path would silently let a rejected cookie reach the notification service.
  it('returns the record by reference when it declines', () => {
    const other: ShipInfo = { ...stored, ship: '~solfer-magfed' };
    expect(applyRefreshedAuthCookie(other, refresh)).toBe(other);
    expect(applyRefreshedAuthCookie(stored, refresh)).not.toBe(stored);
  });
});
