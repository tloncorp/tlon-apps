import type { TlawnOAuthProvider } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  type McpProviderRow,
  buildProviderRows,
} from '../../../../lib/mcpProviders';
import {
  FIRST_RUN_FALLBACK_CATALOG,
  attemptAfterCheck,
  attemptAfterRefusedStart,
  catalogOffersFeatured,
  featuredRowState,
  hasConnectedService,
  selectFeaturedServices,
  shouldAnnounceConnectionEvent,
} from './firstRunServices';

const provider = (id: string, scopes: string): TlawnOAuthProvider => ({
  id,
  displayName: id,
  kind: 'standard',
  scopes,
  suggestedUpstream: { mode: 'proxy', name: id, url: 'https://example.com' },
  template: id,
});

const row = (
  id: string,
  status: McpProviderRow['status'] = 'not-connected'
): McpProviderRow => ({ id, displayName: id, status });

const LIVE_CATALOG = [
  provider('github', 'read:user user:email repo'),
  provider(
    'google-gmail',
    'openid email profile https://www.googleapis.com/auth/gmail.send'
  ),
  provider('notion', 'default'),
  provider(
    'google-calendar',
    'openid email profile https://www.googleapis.com/auth/calendar'
  ),
];
const LIVE_ROWS = LIVE_CATALOG.map((entry) => row(entry.id));

describe('featured services', () => {
  it('features Calendar, Send Gmail and Notion in that order', () => {
    expect(
      selectFeaturedServices(LIVE_CATALOG, LIVE_ROWS).map((s) => s.row.id)
    ).toEqual(['google-calendar', 'google-gmail', 'notion']);
  });

  it('reads an empty scope list the same as "default"', () => {
    const catalog = [provider('notion', '')];
    expect(catalogOffersFeatured(catalog, 'notion')).toBe(true);
    expect(catalogOffersFeatured([provider('notion', 'pages')], 'notion')).toBe(
      false
    );
  });

  it('only offers services screen 3 features', () => {
    expect(catalogOffersFeatured([provider('github', 'repo')], 'github')).toBe(
      false
    );
    expect(catalogOffersFeatured([], 'notion')).toBe(false);
  });

  it('accepts the same scopes in any order', () => {
    const catalog = [
      provider(
        'google-calendar',
        'https://www.googleapis.com/auth/calendar profile email openid'
      ),
    ];
    expect(
      selectFeaturedServices(catalog, [row('google-calendar')]).map(
        (s) => s.row.id
      )
    ).toEqual(['google-calendar']);
  });

  it('drops a service whose live scopes no longer match its copy', () => {
    const catalog = LIVE_CATALOG.map((entry) =>
      entry.id === 'google-gmail'
        ? provider(
            'google-gmail',
            'openid email profile https://www.googleapis.com/auth/gmail.modify'
          )
        : entry
    );
    expect(
      selectFeaturedServices(catalog, LIVE_ROWS).map((s) => s.row.id)
    ).toEqual(['google-calendar', 'notion']);
  });

  it('never invents a service the catalog does not offer', () => {
    const catalog = LIVE_CATALOG.filter((entry) => entry.id !== 'notion');
    const rows = catalog.map((entry) => row(entry.id));
    expect(selectFeaturedServices(catalog, rows).map((s) => s.row.id)).toEqual([
      'google-calendar',
      'google-gmail',
    ]);
    expect(selectFeaturedServices([], [])).toEqual([]);
  });

  it('leaves out a service the app hides', () => {
    // buildProviderRows drops hidden providers, so there is no row for them.
    const rows = LIVE_ROWS.filter((entry) => entry.id !== 'google-gmail');
    expect(
      selectFeaturedServices(LIVE_CATALOG, rows).map((s) => s.row.id)
    ).toEqual(['google-calendar', 'notion']);
  });
});

describe('the built-in list', () => {
  it('features every featured service, so screen 3 is never empty', () => {
    const rows = buildProviderRows(FIRST_RUN_FALLBACK_CATALOG, []);
    expect(
      selectFeaturedServices(FIRST_RUN_FALLBACK_CATALOG, rows).map(
        (s) => s.row.id
      )
    ).toEqual(['google-calendar', 'google-gmail', 'notion']);
  });

  it('gives each row a name and a logo to show before the catalog loads', () => {
    for (const entry of FIRST_RUN_FALLBACK_CATALOG) {
      expect(entry.displayName).not.toBe('');
      expect(entry.logoUrl).toMatch(/^https:\/\//);
    }
  });
});

describe('a featured row after connecting', () => {
  it('says connected only from a verified grant', () => {
    expect(featuredRowState(row('notion', 'connected'), 'checking')).toBe(
      'connected'
    );
    expect(featuredRowState(row('notion'), undefined)).toBe('idle');
    expect(featuredRowState(row('notion', 'expired'), undefined)).toBe('idle');
  });

  it('keeps checking when the provider finished but no grant shows yet', () => {
    expect(attemptAfterCheck(false, 'completed')).toBe('checking');
    expect(attemptAfterCheck(false, 'returned')).toBe('checking');
  });

  it('clears the attempt once the check finds the grant', () => {
    expect(attemptAfterCheck(true, 'completed')).toBeUndefined();
    expect(attemptAfterCheck(true, 'returned')).toBeUndefined();
  });

  it('offers Try again after a cancelled or failed sign-in', () => {
    expect(attemptAfterCheck(false, 'canceled')).toBe('cancelled');
    expect(attemptAfterCheck(false, 'failed')).toBe('failed');
  });

  it('undoes Connecting when the hook refuses to start a sign-in', () => {
    // A disconnect still running from the full list: back to Connect.
    expect(attemptAfterRefusedStart('busy')).toEqual({ attempt: undefined });
    // No signed-in user: say it couldn't connect, with Try again.
    expect(attemptAfterRefusedStart('unavailable')).toEqual({
      attempt: 'failed',
    });
    // Started sign-ins report through events; leave the row alone.
    expect(attemptAfterRefusedStart('started')).toBeNull();
  });

  it('announces every event while the full services list is open', () => {
    const open = { allServicesOpen: true, featuredIds: ['notion'] };
    expect(
      shouldAnnounceConnectionEvent(
        { type: 'disconnect-failed', providerId: 'notion' },
        open
      )
    ).toBe(true);
    expect(shouldAnnounceConnectionEvent({ type: 'load-failed' }, open)).toBe(
      true
    );
  });

  it('leaves featured services to their rows on screen 3', () => {
    const screen3 = { allServicesOpen: false, featuredIds: ['notion'] };
    expect(
      shouldAnnounceConnectionEvent(
        { type: 'start-failed', providerId: 'Notion' },
        screen3
      )
    ).toBe(false);
    expect(
      shouldAnnounceConnectionEvent({ type: 'load-failed' }, screen3)
    ).toBe(false);
    // A service screen 3 doesn't show, finishing after the list was closed.
    expect(
      shouldAnnounceConnectionEvent(
        { type: 'canceled', providerId: 'linear' },
        screen3
      )
    ).toBe(true);
  });

  it('offers Try again when Check again still finds no grant', () => {
    // Someone left the provider's page without finishing; checking again
    // must not leave the row stuck on "Check again".
    expect(attemptAfterCheck(false, 'rechecked')).toBe('cancelled');
    expect(attemptAfterCheck(true, 'rechecked')).toBeUndefined();
  });

  it('counts any connected service for the Continue label', () => {
    expect(hasConnectedService(LIVE_ROWS)).toBe(false);
    expect(
      hasConnectedService([...LIVE_ROWS, row('linear', 'connected')])
    ).toBe(true);
  });
});
