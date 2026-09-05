export type Hosting = 'tlon' | 'togten' | 'local' | 'self';

export type SentryLevel = 'error' | 'warning' | 'info';

export interface SentryBreadcrumbLike {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface SentryEventLike {
  request?: {
    url?: string;
    headers?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    data?: unknown;
    [k: string]: unknown;
  };
  user?: Record<string, unknown>;
  breadcrumbs?: SentryBreadcrumbLike[];
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  message?: string;
  exception?: {
    values?: Array<{
      value?: string;
      stacktrace?: {
        frames?: Array<{
          filename?: string;
          abs_path?: string;
          [k: string]: unknown;
        }>;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }>;
    [k: string]: unknown;
  };
  debug_meta?: {
    images?: Array<{ code_file?: string; [k: string]: unknown }>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export type SentryCapture =
  | {
      kind: 'exception';
      error: Error;
      level: SentryLevel;
      tags: { logger: string };
      extra: Record<string, unknown>;
    }
  | {
      kind: 'message';
      message: string;
      level: SentryLevel;
      fingerprint: string[];
      tags: { logger: string };
      extra: Record<string, unknown>;
    };

export const SENTRY_CONTENT_KEYS: readonly string[] = [
  'noun',
  'body',
  'json',
  'blob',
  'content',
  'text',
  'story',
  'inviteToken',
  'uploadIntent',
  'parsed',
  'entry',
  'draft',
];

const MAX_SCRUB_DEPTH = 4;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isRfc1918Ipv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) {
    return false;
  }
  if (!parts.every((part) => /^\d+$/.test(part))) {
    return false;
  }
  const [a, b] = parts.map(Number);
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}

export function hostingFromHostname(hostname: string): Hosting {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'tlon.network' || host.endsWith('.tlon.network')) {
    return 'tlon';
  }
  if (host === 'togten.com' || host.endsWith('.togten.com')) {
    return 'togten';
  }
  if (
    host === '' ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.endsWith('.lan') ||
    host.endsWith('.local') ||
    isRfc1918Ipv4(host)
  ) {
    return 'local';
  }
  return 'self';
}

const URL_PATTERN = /https?:\/\/[^\s"'<>()]+/gi;

export function reduceUrls(input: string): string {
  return input.replace(URL_PATTERN, (match) => {
    let hosting: Hosting = 'self';
    let segment = '';
    try {
      const parsed = new URL(match);
      hosting = hostingFromHostname(parsed.hostname);
      const groupsPrefix = '/apps/groups/';
      const pathname = parsed.pathname;
      if (pathname.startsWith(groupsPrefix)) {
        const rest = pathname.slice(groupsPrefix.length);
        const slashIndex = rest.indexOf('/');
        segment = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
      }
    } catch {
      hosting = 'self';
      segment = '';
    }
    return `https://${hosting}/${segment}`;
  });
}

// The browser SDK puts absolute script URLs (ship hostname) into frame
// filenames and copies them into debug_meta; Debug-ID symbolication and
// grouping only need the path, so rewrite the origin only.
export function reduceOrigin(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return url;
  }
  return url.replace(/^https?:\/\/[^/]+/i, (origin) => {
    try {
      return `https://${hostingFromHostname(new URL(origin).hostname)}`;
    } catch {
      return origin;
    }
  });
}

export function scrubExtra(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    if (value.length > 500) {
      return `[omitted ${value.length} chars]`;
    }
    return reduceUrls(value);
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (Array.isArray(value)) {
    if (depth > MAX_SCRUB_DEPTH) {
      return '[truncated]';
    }
    return value.map((item) => scrubExtra(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth > MAX_SCRUB_DEPTH) {
      return '[truncated]';
    }
    if (isPlainObject(value)) {
      const result: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (SENTRY_CONTENT_KEYS.includes(key)) {
          continue;
        }
        result[key] = scrubExtra(entry, depth + 1);
      }
      return result;
    }
    return String(value);
  }
  return value;
}

export function toSentryCapture(
  event: string,
  data: Record<string, unknown>
): SentryCapture {
  const logger =
    typeof data.logger === 'string' && data.logger.length > 0
      ? data.logger
      : 'debug-store';
  const errorTitle =
    typeof data.errorTitle === 'string' && data.errorTitle.length > 0
      ? data.errorTitle
      : event;
  const level: SentryLevel =
    data.logLevel === 'warning' || data.logLevel === 'info'
      ? data.logLevel
      : 'error';

  const errorObject = data.errorObject;
  const isException = errorObject instanceof Error;

  const rest: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(data)) {
    if (
      key === 'errorObject' ||
      key === 'breadcrumbs' ||
      key === 'logger' ||
      key === 'errorTitle' ||
      (isException && (key === 'errorStack' || key === 'errorMessage'))
    ) {
      continue;
    }
    rest[key] = entry;
  }
  const extra = scrubExtra(rest) as Record<string, unknown>;

  if (errorObject instanceof Error) {
    return {
      kind: 'exception',
      error: errorObject,
      level,
      tags: { logger },
      extra,
    };
  }

  const message =
    typeof data.message === 'string' && data.message.length > 0
      ? data.message
      : `[${logger}] ${errorTitle}`;
  return {
    kind: 'message',
    message,
    level,
    fingerprint: ['app_error', logger, reduceUrls(errorTitle)],
    tags: { logger },
    extra,
  };
}

export function scrubBreadcrumb<B extends SentryBreadcrumbLike>(
  crumb: B
): B | null {
  if (crumb.category === 'console') {
    return null;
  }
  const copy = { ...crumb };
  if (typeof copy.message === 'string') {
    copy.message = reduceUrls(copy.message);
  }
  if (
    copy.data !== undefined &&
    copy.data !== null &&
    typeof copy.data === 'object' &&
    isPlainObject(copy.data)
  ) {
    copy.data = scrubExtra(copy.data) as Record<string, unknown>;
  }
  return copy;
}

export function scrubSentryEvent<E extends SentryEventLike>(event: E): E {
  const result: SentryEventLike = { ...event };

  if (event.request !== undefined && event.request !== null) {
    const { headers, cookies, query_string, data, ...restRequest } =
      event.request;
    const cleanedRequest: NonNullable<SentryEventLike['request']> = {
      ...restRequest,
    };
    if (typeof restRequest.url === 'string') {
      cleanedRequest.url = reduceUrls(restRequest.url);
    }
    result.request = cleanedRequest;
  }

  if (event.user !== undefined && event.user !== null) {
    const id = event.user.id;
    if (typeof id === 'string' && id.length > 0) {
      result.user = { id };
    } else {
      delete result.user;
    }
  }

  if (event.breadcrumbs !== undefined) {
    const scrubbed: SentryBreadcrumbLike[] = [];
    for (const crumb of event.breadcrumbs) {
      const scrubbedCrumb = scrubBreadcrumb(crumb);
      if (scrubbedCrumb !== null) {
        scrubbed.push(scrubbedCrumb);
      }
    }
    result.breadcrumbs = scrubbed;
  }

  if (event.extra !== undefined) {
    result.extra = scrubExtra(event.extra) as Record<string, unknown>;
  }

  if (event.tags !== undefined && event.tags !== null && 'url' in event.tags) {
    const { url, ...restTags } = event.tags;
    result.tags = restTags;
  }

  if (typeof event.message === 'string') {
    result.message = reduceUrls(event.message);
  }

  if (event.exception !== undefined && event.exception !== null) {
    const cleanedException: NonNullable<SentryEventLike['exception']> = {
      ...event.exception,
    };
    if (Array.isArray(event.exception.values)) {
      cleanedException.values = event.exception.values.map((value) => {
        const cleanedValue = { ...value };
        if (typeof cleanedValue.value === 'string') {
          cleanedValue.value = reduceUrls(cleanedValue.value);
        }
        if (
          cleanedValue.stacktrace !== undefined &&
          cleanedValue.stacktrace !== null &&
          Array.isArray(cleanedValue.stacktrace.frames)
        ) {
          cleanedValue.stacktrace = {
            ...cleanedValue.stacktrace,
            frames: cleanedValue.stacktrace.frames.map((frame) => {
              const cleanedFrame = { ...frame };
              if (typeof cleanedFrame.filename === 'string') {
                cleanedFrame.filename = reduceOrigin(cleanedFrame.filename);
              }
              if (typeof cleanedFrame.abs_path === 'string') {
                cleanedFrame.abs_path = reduceOrigin(cleanedFrame.abs_path);
              }
              return cleanedFrame;
            }),
          };
        }
        return cleanedValue;
      });
    }
    result.exception = cleanedException;
  }

  if (event.debug_meta !== undefined && event.debug_meta !== null) {
    const cleanedDebugMeta: NonNullable<SentryEventLike['debug_meta']> = {
      ...event.debug_meta,
    };
    if (Array.isArray(event.debug_meta.images)) {
      cleanedDebugMeta.images = event.debug_meta.images.map((image) => {
        const cleanedImage = { ...image };
        if (typeof cleanedImage.code_file === 'string') {
          cleanedImage.code_file = reduceOrigin(cleanedImage.code_file);
        }
        return cleanedImage;
      });
    }
    result.debug_meta = cleanedDebugMeta;
  }

  return result as E;
}

export interface ScopeLike {
  addBreadcrumb: (crumb: {
    category: string;
    message: string;
    timestamp: number;
  }) => unknown;
  setLevel: (level: SentryLevel) => unknown;
  setTags: (tags: Record<string, string>) => unknown;
  setExtras: (extras: Record<string, unknown>) => unknown;
}

export function populateScope(
  scope: ScopeLike,
  capture: SentryCapture,
  crumbs: string[],
  now: number = Date.now()
): void {
  crumbs.forEach((crumb, i) =>
    scope.addBreadcrumb({
      category: 'app',
      message: reduceUrls(crumb),
      timestamp: now / 1000 - (crumbs.length - i),
    })
  );
  scope.setLevel(capture.level);
  scope.setTags(capture.tags);
  scope.setExtras(capture.extra);
}

const IGNORE_ERROR_PREFIX = '(?:\\[[\\w.:-]+\\] )?(?:[A-Za-z]*Error: )?';
const HTTP_WRAPPED_PREFIX = 'HTTP request failed: (?:[A-Za-z]*Error: )?';

const LITERAL_IGNORE_BODIES = [
  'Failed to fetch',
  'Load failed',
  'NetworkError when attempting to fetch resource.',
  'Fetch is aborted',
  'signal is aborted without reason',
  'The operation was aborted.',
  'Network request failed',
  'Request timed out',
  'getBytes timed out',
  'Software caused connection abort',
  'Connection reset',
];

const REGEX_IGNORE_BODIES = [
  'fetch failed: FetchRequestCanceledException: Fetch request has been canceled(?: \\([^)]*\\))?',
  'fetch failed: (?:UnexpectedException: )?The network connection was lost\\.(?: \\([^)]*\\))?',
  'fetch failed: java\\.net\\.UnknownHostException: Unable to resolve host "[^"]*"(?:: No address associated with hostname)?',
  'fetch failed: (?:UnexpectedException: )?The request timed out\\.(?: \\([^)]*\\))?',
];

const IGNORE_BODIES = [
  ...LITERAL_IGNORE_BODIES.map(escapeRegExp),
  ...REGEX_IGNORE_BODIES,
];

export const SENTRY_IGNORE_ERRORS: RegExp[] = IGNORE_BODIES.map(
  (body) =>
    new RegExp(`^${IGNORE_ERROR_PREFIX}(?:${HTTP_WRAPPED_PREFIX})?${body}$`)
);

export const SENTRY_DENY_URLS_WEB: RegExp[] = [/\/hawk499\//];
