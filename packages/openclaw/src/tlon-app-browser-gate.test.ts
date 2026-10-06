import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import { OWNER_ONLY_BLOCK_REASON_MAX_CHARS } from './owner-only-tools.js';
import {
  TLON_APP_BROWSER_BLOCK_REASON,
  configuredTlonShipHosts,
  isTlonWebAppUrl,
  resolveTlonAppBrowserBlock,
  tlonShipOrigins,
} from './tlon-app-browser-gate.js';

const SHIP = 'https://sampel-palnet.tlon.network';
const SHIP_HOSTS = tlonShipOrigins([
  { url: 'http://localhost:8080', ship: '~sampel-palnet', ownerShip: '~zod' },
]);
const APP_URL = `${SHIP}/apps/groups`;
const SESSION_ID = 'sess_abc';

describe('isTlonWebAppUrl', () => {
  it.each([
    `${SHIP}/apps/groups`,
    `${SHIP}/apps/groups/dm/~zod`,
    'https://ship.example.com/apps/groups/',
    'https://ship.example.com/apps/landscape/',
    'https://x.example/~/login?redirect=/',
    `${SHIP}/`,
    `${SHIP}/apps/anything`,
    `${SHIP}/~/scry/x`,
    `${SHIP}/notes`,
    `${SHIP}/notes/some/ui/route`,
    'https://zod.tlon.network/notes',
    'http://localhost:8080/',
    `${SHIP}/%61pps/groups`,
    'https://ship.example.com/%61pps/groups',
    `${SHIP}/notes//pub/~zod/book/3`,
    'https://ship.example.com/~/login/',
    'https://zod.tlon.network./notes',
    'https://zod.tlon.network%2e/notes',
    'https://zod.tlon.network./',
    'http://localhost.:8080/',
    'https://unknown.example./apps/groups',
    'https://ship.example.com/%7E/login',
    `${SHIP}/apps/groups/%E0%A4%A`,
  ])('treats %s as the Tlon app', (url) => {
    expect(isTlonWebAppUrl(url, SHIP_HOSTS)).toBe(true);
  });

  it.each([
    `${SHIP}/expose/chat/~sampel-palnet/general/msg/170141184507`,
    `${SHIP}/profile`,
    `${SHIP}/lure/0vabc`,
    `${SHIP}/notes/pub/~zod/book/3`,
    `${SHIP}/notes/share/~zod/book`,
    'http://localhost:9090/report',
    'http://localhost:9090/',
    'https://unknown.example/',
    'https://unknown.example/notes/x',
    'https://storage.tlon.network/~zod/file.png',
    'https://browser-session.tlon.network/s/x.y',
    'https://tlon.io/',
    'https://join.tlon.io/0vabc',
    'https://example.com/apps/groupsx',
    'https://example.com/my/apps/groups',
    'https://example.com/~/login-help',
    'https://example.com/~/login/extra',
    `${SHIP}/notes/%70ub/~zod/book/3`,
    'https://zod.tlon.network./notes/pub/~zod/book/3',
    `${SHIP}/notes/%73hare/~zod/book`,
    'https://example.com/%E0%A4%A/apps',
    'not a url',
    'javascript:alert(1)',
  ])('allows %s', (url) => {
    expect(isTlonWebAppUrl(url, SHIP_HOSTS)).toBe(false);
  });
});

const blocked = { blocked: true, reason: TLON_APP_BROWSER_BLOCK_REASON };

describe('resolveTlonAppBrowserBlock', () => {
  it.each([
    ['browser_browser_navigate', { session_id: SESSION_ID, url: APP_URL }],
    ['browser_navigate', { session_id: SESSION_ID, url: APP_URL }],
    ['browser_browser_scrape', { url: APP_URL }],
    ['browser_browser_screenshot', { url: APP_URL }],
    ['browser_browser_pdf', { url: APP_URL }],
    ['browser_browser_session_options', { url: APP_URL, goal: 'interact' }],
  ])('blocks %s with a Tlon app url', (name, args) => {
    expect(
      resolveTlonAppBrowserBlock({ name, arguments: args }, SHIP_HOSTS)
    ).toEqual(blocked);
  });

  it('blocks a batch navigate step to the Tlon app', () => {
    const params = {
      name: 'browser_browser_batch',
      arguments: {
        session_id: SESSION_ID,
        steps: [
          { tool: 'browser_navigate', arguments: { url: 'https://a.example' } },
          { tool: 'browser_navigate', arguments: { url: APP_URL } },
        ],
      },
    };
    expect(resolveTlonAppBrowserBlock(params, SHIP_HOSTS)).toEqual(blocked);
  });

  it('blocks JSON-string arguments', () => {
    const params = {
      name: 'browser_browser_navigate',
      arguments: JSON.stringify({ session_id: SESSION_ID, url: APP_URL }),
    };
    expect(resolveTlonAppBrowserBlock(params, SHIP_HOSTS)).toEqual(blocked);
  });

  it('does not block public pages on a known ship', () => {
    const params = {
      name: 'browser_browser_navigate',
      arguments: {
        session_id: SESSION_ID,
        url: `${SHIP}/notes/pub/~zod/book/3`,
      },
    };
    expect(resolveTlonAppBrowserBlock(params, SHIP_HOSTS)).toEqual({
      blocked: false,
    });
  });

  it.each([
    ['docs_browser_lookup', { url: APP_URL }],
    ['gmail_search_messages', { url: APP_URL }],
    ['browser_browser_wait_for', { session_id: SESSION_ID, url: APP_URL }],
    [
      'browser_browser_batch',
      {
        session_id: SESSION_ID,
        steps: [
          { tool: 'browser_navigate', arguments: { url: 'https://a.example' } },
          { tool: 'browser_wait_for', arguments: { url: APP_URL } },
        ],
      },
    ],
    [
      'browser_browser_act',
      { session_id: SESSION_ID, action: 'click', target: '@e1' },
    ],
    [
      'browser_browser_run',
      { session_id: SESSION_ID, task: 'open my Tlon groups and pin a post' },
    ],
    ['browser_browser_session_create', {}],
  ])('does not block %s', (name, args) => {
    expect(
      resolveTlonAppBrowserBlock({ name, arguments: args }, SHIP_HOSTS)
    ).toEqual({ blocked: false });
  });

  it.each([
    undefined,
    null,
    'garbage',
    42,
    {},
    { name: 7, arguments: { url: APP_URL } },
    { name: 'browser_browser_navigate' },
    { name: 'browser_browser_navigate', arguments: '{not json' },
    { name: 'browser_browser_navigate', arguments: { url: 42 } },
    { name: 'browser_browser_batch', arguments: { steps: 'nope' } },
  ])('does not block missing or garbage params %#', (params) => {
    expect(resolveTlonAppBrowserBlock(params, SHIP_HOSTS)).toEqual({
      blocked: false,
    });
  });
});

describe('TLON_APP_BROWSER_BLOCK_REASON', () => {
  it('is one line within the owner-notice cap and names the Tlon tools', () => {
    expect(TLON_APP_BROWSER_BLOCK_REASON).not.toContain('\n');
    expect(TLON_APP_BROWSER_BLOCK_REASON.length).toBeLessThanOrEqual(
      OWNER_ONLY_BLOCK_REASON_MAX_CHARS
    );
    expect(TLON_APP_BROWSER_BLOCK_REASON).toContain('tlon and message tools');
  });
});

describe('tlonShipOrigins', () => {
  it('strips ~, lowercases, and keeps a non-default port', () => {
    expect([
      ...tlonShipOrigins([
        {
          url: 'HTTP://LocalHost.:8080/apps/groups',
          ship: ' ~Sampel-Palnet ',
          ownerShip: 'zod',
        },
      ]),
    ]).toEqual([
      'localhost:8080',
      'sampel-palnet.tlon.network',
      'zod.tlon.network',
    ]);
  });

  it('drops the default port', () => {
    expect([
      ...tlonShipOrigins([
        { url: 'https://ship.example.com:443', ship: null, ownerShip: null },
      ]),
    ]).toEqual(['ship.example.com']);
  });

  it('tolerates missing and invalid inputs', () => {
    expect(tlonShipOrigins([]).size).toBe(0);
    expect(
      tlonShipOrigins([{ url: 'not a url', ship: null, ownerShip: '' }]).size
    ).toBe(0);
  });
});

describe('configuredTlonShipHosts', () => {
  it('covers named accounts when there is no root account', () => {
    const cfg = {
      channels: {
        tlon: {
          accounts: {
            primary: { url: 'https://primary.example', ship: '~nec' },
            second: { ship: '~bud', ownerShip: '~wes' },
          },
        },
      },
    } as OpenClawConfig;
    expect([...configuredTlonShipHosts(cfg)].sort()).toEqual([
      'bud.tlon.network',
      'nec.tlon.network',
      'primary.example',
      'wes.tlon.network',
    ]);
    expect(
      isTlonWebAppUrl(
        'https://wes.tlon.network/notes',
        configuredTlonShipHosts(cfg)
      )
    ).toBe(true);
  });

  it('keeps the root account alongside named ones', () => {
    const cfg = {
      channels: {
        tlon: {
          ship: '~zod',
          url: 'http://localhost:8080',
          accounts: { primary: { ship: '~nec' } },
        },
      },
    } as OpenClawConfig;
    expect([...configuredTlonShipHosts(cfg)].sort()).toEqual([
      'localhost:8080',
      'nec.tlon.network',
      'zod.tlon.network',
    ]);
  });

  it('is empty when Tlon is not configured', () => {
    expect(configuredTlonShipHosts({} as OpenClawConfig).size).toBe(0);
  });
});
