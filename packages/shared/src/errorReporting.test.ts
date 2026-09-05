import { describe, expect, it, vi } from 'vitest';

import {
  hostingFromHostname,
  populateScope,
  reduceUrls,
  scrubExtra,
  toSentryCapture,
  scrubBreadcrumb,
  scrubSentryEvent,
  SENTRY_CONTENT_KEYS,
  SENTRY_IGNORE_ERRORS,
  SENTRY_DENY_URLS_WEB,
} from './errorReporting';
import type { Hosting, SentryEventLike } from './errorReporting';

const HOSTING_CASES: Array<[string, Hosting]> = [
  ['tlon.network', 'tlon'],
  ['malmur-halmex.tlon.network', 'tlon'],
  ['a.b.tlon.network', 'tlon'],
  ['TLON.NETWORK.', 'tlon'],
  ['notlon.network', 'self'],
  ['tlon.network.evil.com', 'self'],
  ['togten.com', 'togten'],
  ['poster-findul.togten.com', 'togten'],
  ['sub.togten.com.', 'togten'],
  ['localhost', 'local'],
  ['foo.localhost', 'local'],
  ['127.0.0.1', 'local'],
  ['::1', 'local'],
  ['[::1]', 'local'],
  ['0.0.0.0', 'local'],
  ['printer.lan', 'local'],
  ['myhost.local', 'local'],
  ['10.0.0.5', 'local'],
  ['10.255.1.2', 'local'],
  ['172.16.0.1', 'local'],
  ['172.31.255.254', 'local'],
  ['192.168.1.213', 'local'],
  ['', 'local'],
  ['172.15.0.1', 'self'],
  ['172.32.0.1', 'self'],
  ['192.169.0.1', 'self'],
  ['sorwet.startram.io', 'self'],
  ['serverless-infra.vercel.app', 'self'],
  ['example.com', 'self'],
];

describe('hostingFromHostname', () => {
  it.each(HOSTING_CASES)('%j -> %s', (hostname, expected) => {
    expect(hostingFromHostname(hostname)).toBe(expected);
  });
});

describe('reduceUrls', () => {
  it('reduces tlon.network group urls to hosting and first segment', () => {
    expect(
      reduceUrls(
        'https://malmur-halmex.tlon.network/apps/groups/dm/~pinser-botter-malmur-halmex'
      )
    ).toBe('https://tlon/dm');
  });

  it('reduces non-hosted group urls to self and first segment', () => {
    expect(
      reduceUrls(
        'https://sorwet.startram.io/apps/groups/group/~x%2Fy/channel/chat%2F~x%2Fz'
      )
    ).toBe('https://self/group');
  });

  it('reduces local urls with ports, dropping the port', () => {
    expect(reduceUrls('http://192.168.1.213:8080/apps/groups/Home')).toBe(
      'https://local/Home'
    );
  });

  it('reduces bracketed ipv6 loopback urls', () => {
    expect(reduceUrls('http://[::1]:8080/apps/groups/Home')).toBe(
      'https://local/Home'
    );
  });

  it('drops the path of non-group urls', () => {
    expect(
      reduceUrls('https://serverless-infra.vercel.app/lure/~zod/abc123token')
    ).toBe('https://self/');
  });

  it('drops invite short-link tokens', () => {
    expect(reduceUrls('https://join.tlon.io/0v1.abc.secret')).toBe(
      'https://self/'
    );
    expect(reduceUrls('https://x.tlon.network/join/0vtoken')).toBe(
      'https://tlon/'
    );
  });

  it('emits an empty segment when there is none after the prefix', () => {
    expect(reduceUrls('https://bosser-hatber.tlon.network/apps/groups/')).toBe(
      'https://tlon/'
    );
  });

  it('drops query strings and surrounding text is unchanged', () => {
    expect(
      reduceUrls(
        'fetched https://a.tlon.network/apps/groups/invite/tok?x=1 done'
      )
    ).toBe('fetched https://tlon/invite done');
  });

  it('reduces every url when there are several in one string', () => {
    expect(
      reduceUrls(
        'a https://x.tlon.network/apps/groups/dm/~one b https://y.togten.com/apps/groups/group/~two c'
      )
    ).toBe('a https://tlon/dm b https://togten/group c');
  });

  it('leaves text without urls unchanged', () => {
    expect(reduceUrls('no urls here ~zod')).toBe('no urls here ~zod');
  });
});

describe('scrubExtra', () => {
  it('reduces urls in strings', () => {
    expect(scrubExtra('see https://a.tlon.network/apps/groups/dm/~x now')).toBe(
      'see https://tlon/dm now'
    );
  });

  it('leaves numbers, booleans, null and undefined unchanged', () => {
    expect(scrubExtra(42)).toBe(42);
    expect(scrubExtra(true)).toBe(true);
    expect(scrubExtra(null)).toBe(null);
    expect(scrubExtra(undefined)).toBe(undefined);
  });

  it('drops content keys, including at nested depth', () => {
    expect(
      scrubExtra({
        body: 'x',
        noun: 1,
        keep: 'y',
        nested: { text: 'z', story: [], ok: 1 },
      })
    ).toEqual({ keep: 'y', nested: { ok: 1 } });
  });

  it('drops parsed, entry and draft keys', () => {
    expect(
      scrubExtra({ parsed: { a: 1 }, entry: 'x', draft: 'y', keep: 'z' })
    ).toEqual({ keep: 'z' });
  });

  it('omits strings longer than 500 characters and keeps shorter ones', () => {
    const long = 'x'.repeat(600);
    const short = 'y'.repeat(100);
    expect(scrubExtra({ long, short })).toEqual({
      long: '[omitted 600 chars]',
      short,
    });
  });

  it('reduces urls inside nested strings and arrays', () => {
    expect(
      scrubExtra({
        note: 'go https://b.togten.com/apps/groups/group/~y',
        list: ['https://c.tlon.network/apps/groups/dm/~x', 3],
      })
    ).toEqual({
      note: 'go https://togten/group',
      list: ['https://tlon/dm', 3],
    });
  });

  it('truncates arrays and objects deeper than depth 4', () => {
    expect(scrubExtra({ a: { b: { c: { d: { e: { f: 'x' } } } } } })).toEqual({
      a: { b: { c: { d: { e: '[truncated]' } } } },
    });
    expect(scrubExtra({ a: { b: { c: { d: { e: [1, 2] } } } } })).toEqual({
      a: { b: { c: { d: { e: '[truncated]' } } } },
    });
    expect(scrubExtra({ x: 1 }, 5)).toBe('[truncated]');
    expect(scrubExtra([1], 5)).toBe('[truncated]');
  });

  it('stringifies Error instances', () => {
    expect(scrubExtra(new TypeError('boom'))).toBe('TypeError: boom');
    expect(scrubExtra({ err: new Error('bad') })).toEqual({
      err: 'Error: bad',
    });
  });

  it('stringifies non-plain objects', () => {
    class Custom {
      toString() {
        return 'custom-instance';
      }
    }
    expect(scrubExtra(new Custom())).toBe('custom-instance');
    expect(scrubExtra(new Map())).toBe('[object Map]');
  });
});

describe('toSentryCapture', () => {
  it('builds an exception capture keeping the same Error instance', () => {
    const error = new Error('connection lost');
    const capture = toSentryCapture('Channel Error', {
      logger: 'channel',
      errorTitle: 'Sync failed',
      errorObject: error,
      breadcrumbs: ['crumb'],
      message: 'extra message',
      errorMessage: 'connection lost',
      errorStack: 'at somewhere',
      jsContextId: 'abc123',
      buildInfo: 'build-1',
      logLevel: 'warning',
      body: 'sensitive body',
      customKey: 'custom-value',
    });

    expect(capture.kind).toBe('exception');
    if (capture.kind !== 'exception') {
      return;
    }
    expect(capture.error).toBe(error);
    expect(capture.level).toBe('warning');
    expect(capture.tags).toEqual({ logger: 'channel' });
    expect(capture.extra).not.toHaveProperty('errorObject');
    expect(capture.extra).not.toHaveProperty('breadcrumbs');
    expect(capture.extra).not.toHaveProperty('logger');
    expect(capture.extra).not.toHaveProperty('errorTitle');
    expect(capture.extra).not.toHaveProperty('body');
    expect(capture.extra).toHaveProperty('message', 'extra message');
    expect(capture.extra).not.toHaveProperty('errorMessage');
    expect(capture.extra).not.toHaveProperty('errorStack');
    expect(capture.extra).toHaveProperty('jsContextId', 'abc123');
    expect(capture.extra).toHaveProperty('buildInfo', 'build-1');
    expect(capture.extra).toHaveProperty('logLevel', 'warning');
    expect(capture.extra).toHaveProperty('customKey', 'custom-value');
  });

  it('builds a message capture using data.message', () => {
    const capture = toSentryCapture('Some Event', {
      logger: 'sync',
      errorTitle: 'Title',
      message: 'Something happened',
      logLevel: 'info',
    });

    expect(capture.kind).toBe('message');
    if (capture.kind !== 'message') {
      return;
    }
    expect(capture.message).toBe('Something happened');
    expect(capture.level).toBe('info');
    expect(capture.fingerprint).toEqual(['app_error', 'sync', 'Title']);
    expect(capture.tags).toEqual({ logger: 'sync' });
  });

  it('falls back to [logger] errorTitle when message is missing', () => {
    const capture = toSentryCapture('Event', {
      logger: 'sync',
      errorTitle: 'Title',
    });

    if (capture.kind !== 'message') {
      throw new Error('expected message capture');
    }
    expect(capture.message).toBe('[sync] Title');
    expect(capture.fingerprint).toEqual(['app_error', 'sync', 'Title']);
  });

  it('falls back to the debug-store logger and the event as title', () => {
    const capture = toSentryCapture('Fallback Event', {});

    if (capture.kind !== 'message') {
      throw new Error('expected message capture');
    }
    expect(capture.message).toBe('[debug-store] Fallback Event');
    expect(capture.fingerprint).toEqual([
      'app_error',
      'debug-store',
      'Fallback Event',
    ]);
    expect(capture.tags).toEqual({ logger: 'debug-store' });
    expect(capture.level).toBe('error');
  });

  it('keeps errorMessage and errorStack in extra for message captures', () => {
    const capture = toSentryCapture('Event', {
      logger: 'sync',
      errorTitle: 'Title',
      errorMessage: 'connection lost',
      errorStack: 'at somewhere',
    });

    if (capture.kind !== 'message') {
      throw new Error('expected message capture');
    }
    expect(capture.extra).toHaveProperty('errorMessage', 'connection lost');
    expect(capture.extra).toHaveProperty('errorStack', 'at somewhere');
  });

  it('reduces urls in the fingerprint', () => {
    const capture = toSentryCapture('Event', {
      logger: 'urbit',
      errorTitle: 'fetch https://a.tlon.network/apps/groups/x failed',
    });

    if (capture.kind !== 'message') {
      throw new Error('expected message capture');
    }
    expect(capture.fingerprint).toEqual([
      'app_error',
      'urbit',
      'fetch https://tlon/x failed',
    ]);
  });

  it('maps logLevel to the sentry level', () => {
    expect(toSentryCapture('e', { logLevel: 'warning' }).level).toBe('warning');
    expect(toSentryCapture('e', { logLevel: 'info' }).level).toBe('info');
    expect(toSentryCapture('e', { logLevel: 'error' }).level).toBe('error');
    expect(toSentryCapture('e', { logLevel: 'debug' }).level).toBe('error');
    expect(toSentryCapture('e', {}).level).toBe('error');
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    expect(
      scrubBreadcrumb({ category: 'console', message: 'log line' })
    ).toBeNull();
  });

  it('reduces urls in navigation from/to without mutating the input', () => {
    const crumb = {
      category: 'navigation',
      data: {
        from: 'https://a.tlon.network/apps/groups/dm/~x',
        to: 'https://b.togten.com/apps/groups/group/~y',
      },
    };
    const scrubbed = scrubBreadcrumb(crumb);
    expect(scrubbed).not.toBeNull();
    expect(scrubbed?.data).toEqual({
      from: 'https://tlon/dm',
      to: 'https://togten/group',
    });
    expect(crumb.data.from).toBe('https://a.tlon.network/apps/groups/dm/~x');
  });

  it('reduces urls in the message', () => {
    const scrubbed = scrubBreadcrumb({
      category: 'http',
      message: 'GET https://a.tlon.network/apps/groups/invite/tok?x=1',
    });
    expect(scrubbed?.message).toBe('GET https://tlon/invite');
  });

  it('scrubs fetch data url and keeps other fields', () => {
    const scrubbed = scrubBreadcrumb({
      category: 'fetch',
      level: 'info',
      data: {
        url: 'https://x.tlon.network/apps/groups/assets/file.js',
        status: 200,
      },
    });
    expect(scrubbed?.category).toBe('fetch');
    expect(scrubbed?.level).toBe('info');
    expect(scrubbed?.data).toEqual({ url: 'https://tlon/assets', status: 200 });
  });
});

describe('scrubSentryEvent', () => {
  it('scrubs request, user, breadcrumbs, extra and tags without mutating the input', () => {
    const contexts = { app: { app_version: '1.2.3' } };
    const exception = { values: [{ type: 'Error', value: 'boom' }] };
    const input: SentryEventLike = {
      request: {
        url: 'https://a.tlon.network/apps/groups/dm/~x?token=abc',
        headers: { Cookie: 'session=1' },
        cookies: 'session=1',
        query_string: 'token=abc',
        data: { secret: true },
        method: 'GET',
      },
      user: {
        id: '~sampel-palnet',
        email: 'ship@example.com',
        ip_address: '1.2.3.4',
      },
      breadcrumbs: [
        { category: 'console', message: 'console secret' },
        {
          category: 'navigation',
          data: { to: 'https://b.togten.com/apps/groups/group/~y' },
        },
      ],
      extra: {
        note: 'see https://a.tlon.network/apps/groups/dm/~x',
        body: 'drop me',
      },
      tags: { url: 'https://a.tlon.network/apps/groups/dm/~x', logger: 'sync' },
      contexts,
      exception,
      message: 'original message',
      level: 'error',
    };

    const output = scrubSentryEvent(input);

    expect(output).not.toBe(input);
    expect(output.request).toEqual({ url: 'https://tlon/dm', method: 'GET' });
    expect(output.request).not.toHaveProperty('headers');
    expect(output.request).not.toHaveProperty('cookies');
    expect(output.request).not.toHaveProperty('query_string');
    expect(output.request).not.toHaveProperty('data');
    expect(output.user).toEqual({ id: '~sampel-palnet' });
    expect(output.breadcrumbs).toHaveLength(1);
    expect(output.breadcrumbs?.[0]).toMatchObject({ category: 'navigation' });
    expect(output.breadcrumbs?.[0]?.data).toEqual({
      to: 'https://togten/group',
    });
    expect(output.extra).toEqual({ note: 'see https://tlon/dm' });
    expect(output.tags).toEqual({ logger: 'sync' });
    expect(output.contexts).toBe(contexts);
    expect(output.exception).not.toBe(exception);
    expect(output.exception?.values?.[0]).toEqual({
      type: 'Error',
      value: 'boom',
    });
    expect(output.message).toBe('original message');
    expect(output.level).toBe('error');

    expect(input.request?.url).toBe(
      'https://a.tlon.network/apps/groups/dm/~x?token=abc'
    );
    expect(input.request?.headers).toEqual({ Cookie: 'session=1' });
    expect(input.user).toEqual({
      id: '~sampel-palnet',
      email: 'ship@example.com',
      ip_address: '1.2.3.4',
    });
    expect(input.breadcrumbs).toHaveLength(2);
    expect(input.extra).toEqual({
      note: 'see https://a.tlon.network/apps/groups/dm/~x',
      body: 'drop me',
    });
    expect(input.tags).toEqual({
      url: 'https://a.tlon.network/apps/groups/dm/~x',
      logger: 'sync',
    });
    expect(input.message).toBe('original message');
    expect(exception.values[0].value).toBe('boom');
  });

  it('removes user entirely when id is missing or empty', () => {
    const withoutId = scrubSentryEvent({ user: { email: 'x@example.com' } });
    expect('user' in withoutId).toBe(false);
    const emptyId = scrubSentryEvent({ user: { id: '' } });
    expect('user' in emptyId).toBe(false);
  });

  it('keeps tags without url as the same reference', () => {
    const tags = { logger: 'sync' };
    const output = scrubSentryEvent({ tags });
    expect(output.tags).toBe(tags);
  });

  it('reduces urls in message and exception values without mutating the input', () => {
    const scriptUrl =
      'https://finned-palmer.togten.com/apps/groups/assets/index-abc.js';
    const frames = [
      {
        filename: scriptUrl,
        abs_path: scriptUrl,
        lineno: 42,
        colno: 7,
        function: 'doWork',
        in_app: true,
        debug_id: '00000000-0000-0000-0000-000000000000',
      },
      { filename: 'app:///main.jsbundle' },
    ];
    const stacktrace = { frames };
    const exceptionValue = {
      type: 'Error',
      value: 'Failed https://a.tlon.network/apps/groups/dm/~zod',
      stacktrace,
    };
    const images = [{ code_file: scriptUrl, debug_id: 'abc' }];
    const input: SentryEventLike = {
      message: 'see https://a.tlon.network/apps/groups/dm/~zod',
      exception: { values: [exceptionValue] },
      debug_meta: { images },
    };

    const output = scrubSentryEvent(input);

    expect(output.message).toBe('see https://tlon/dm');
    expect(output.exception?.values?.[0]?.value).toBe('Failed https://tlon/dm');
    const outFrames = output.exception?.values?.[0]?.stacktrace?.frames;
    expect(outFrames).toHaveLength(2);
    expect(outFrames?.[0]).toEqual({
      filename: 'https://togten/apps/groups/assets/index-abc.js',
      abs_path: 'https://togten/apps/groups/assets/index-abc.js',
      lineno: 42,
      colno: 7,
      function: 'doWork',
      in_app: true,
      debug_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(outFrames?.[0]).not.toBe(frames[0]);
    expect(outFrames?.[1]).toEqual({ filename: 'app:///main.jsbundle' });
    expect(output.debug_meta?.images?.[0]).toEqual({
      code_file: 'https://togten/apps/groups/assets/index-abc.js',
      debug_id: 'abc',
    });
    expect(output.debug_meta?.images?.[0]).not.toBe(images[0]);

    expect(input.message).toBe(
      'see https://a.tlon.network/apps/groups/dm/~zod'
    );
    expect(exceptionValue.value).toBe(
      'Failed https://a.tlon.network/apps/groups/dm/~zod'
    );
    expect(frames[0].filename).toBe(scriptUrl);
    expect(frames[0].abs_path).toBe(scriptUrl);
    expect(images[0].code_file).toBe(scriptUrl);
  });
});

describe('SENTRY_CONTENT_KEYS', () => {
  it('covers inviteToken and uploadIntent', () => {
    expect(SENTRY_CONTENT_KEYS).toContain('inviteToken');
    expect(SENTRY_CONTENT_KEYS).toContain('uploadIntent');
  });

  it('covers parsed, entry and draft', () => {
    expect(SENTRY_CONTENT_KEYS).toContain('parsed');
    expect(SENTRY_CONTENT_KEYS).toContain('entry');
    expect(SENTRY_CONTENT_KEYS).toContain('draft');
  });
});

describe('populateScope', () => {
  it('adds reduced crumbs with backdated timestamps, then level, tags, extras', () => {
    const scope = {
      addBreadcrumb: vi.fn(),
      setLevel: vi.fn(),
      setTags: vi.fn(),
      setExtras: vi.fn(),
    };
    const capture = toSentryCapture('Event', {
      logger: 'sync',
      errorTitle: 'Title',
      message: 'Something happened',
    });
    const crumbs = [
      '[a] saw https://join.tlon.io/0v1.abc.secret',
      '[b] plain crumb',
    ];

    populateScope(scope, capture, crumbs, 1_000_000);

    expect(scope.addBreadcrumb).toHaveBeenCalledTimes(2);
    expect(scope.addBreadcrumb.mock.calls[0][0]).toEqual({
      category: 'app',
      message: '[a] saw https://self/',
      timestamp: 998,
    });
    expect(scope.addBreadcrumb.mock.calls[1][0]).toEqual({
      category: 'app',
      message: '[b] plain crumb',
      timestamp: 999,
    });
    expect(scope.setLevel).toHaveBeenCalledWith(capture.level);
    expect(scope.setTags).toHaveBeenCalledWith(capture.tags);
    expect(scope.setExtras).toHaveBeenCalledWith(capture.extra);
  });
});

const MUST_MATCH = [
  'Failed to fetch',
  '[urbit] Failed to fetch',
  'TypeError: Failed to fetch',
  'TypeError: Load failed',
  'TypeError: NetworkError when attempting to fetch resource.',
  'Error: Request timed out',
  'Error: getBytes timed out',
  'TypeError: Network request failed',
  'BadResponseError: HTTP request failed: AbortError: Fetch is aborted',
  'Error: HTTP request failed: TypeError: Failed to fetch',
  'Error: HTTP request failed: AbortError: signal is aborted without reason',
  'Error: HTTP request failed: Error: fetch failed: FetchRequestCanceledException: Fetch request has been canceled (at Expo/NativeResponse.swift:63)',
  'BadResponseError: HTTP request failed: Error: fetch failed: FetchRequestCanceledException: Fetch request has been canceled (at Expo/NativeResponse.swift:63)',
  'Error: fetch failed: UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)',
  'Error: fetch failed: The network connection was lost.',
  'Error: fetch failed: java.net.UnknownHostException: Unable to resolve host "poster-findul.togten.com": No address associated with hostname',
  'BadResponseError: HTTP request failed: Error: fetch failed: java.net.UnknownHostException: Unable to resolve host "www.burtonjernigan.org": No address associated with hostname',
  'Error: fetch failed: UnexpectedException: The request timed out. (at ExpoModulesCore/Promise.swift:56)',
  'Error: fetch failed: The request timed out.',
];

const MUST_NOT_MATCH = [
  'Network request failed: java.security.cert.CertPathValidatorException: Trust anchor for certification path not found.',
  'Failed to fetch access code',
  'Failed to fetch image: 404',
  'Error: Hosting API call failed',
  'Error: HTTP 503: FetchResponse: { status: 503, statusText: service unavailable }',
  'Error: Invalid server response',
  'Error: Failed to PUT channel',
  'PokeAckTimeoutError: Poke ack timed out after 30000ms',
  'Error: Expected content-type to be text/event-stream, Actual: text/html',
  'Error: No error message',
  "TypeError: Failed to update a ServiceWorker for scope ('https://x.org/apps/groups/') with script ('https://x.org/apps/groups/sw-1.js'): An unknown error occurred when fetching the script.",
  'Error: invalid channel id  ~sitful-hatred:',
  'Error: Database not set.',
  'Error: fetch failed: A TLS error caused the secure connection to fail.',
  'Error: discarded fetched data, had been running for 1271371ms',
  '[query] Database Query Error',
  'BadResponseError: HTTP 404: [object Response]',
  'Error: Urbit client not set.',
];

describe('SENTRY_IGNORE_ERRORS', () => {
  it('builds one regex per body', () => {
    expect(SENTRY_IGNORE_ERRORS).toHaveLength(15);
  });

  it.each(MUST_MATCH)('matches %s', (message) => {
    expect(SENTRY_IGNORE_ERRORS.some((r) => r.test(message))).toBe(true);
  });

  it.each(MUST_NOT_MATCH)('does not match %s', (message) => {
    expect(SENTRY_IGNORE_ERRORS.some((r) => r.test(message))).toBe(false);
  });
});

describe('SENTRY_DENY_URLS_WEB', () => {
  it('matches hawk499 urls', () => {
    expect(
      SENTRY_DENY_URLS_WEB.some((r) =>
        r.test('https://x.tlon.network/hawk499/assets/feather-iframe.js')
      )
    ).toBe(true);
  });

  it('does not match regular app asset urls', () => {
    expect(
      SENTRY_DENY_URLS_WEB.some((r) =>
        r.test('https://x.tlon.network/apps/groups/assets/index-abc.js')
      )
    ).toBe(false);
  });
});
