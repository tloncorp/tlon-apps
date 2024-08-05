import { useEffect, useRef } from 'react';

import { useLiveRef } from './logic/utilHooks';
import { useCurrentSession } from './store/session';

const customLoggers = new Set<string>();

interface Breadcrumb {
  tag: string;
  message?: string | null;
  sensitive?: string | null;
}

export type Logger = Console & {
  crumb: (...args: unknown[]) => void;
  sensitiveCrumb: (...args: unknown[]) => void;
};

const debugBreadcrumbs: Breadcrumb[] = [];
const BREADCRUMB_LIMIT = 100;

function addBreadcrumb(crumb: Breadcrumb) {
  debugBreadcrumbs.push(crumb);
  if (debugBreadcrumbs.length >= BREADCRUMB_LIMIT) {
    debugBreadcrumbs.shift();
  }
}

export function getCurrentBreadcrumbs() {
  const includeSensitiveContext = true; // TODO: handle accordingly
  return debugBreadcrumbs.map((crumb) => {
    return `[${crumb.tag}] ${crumb.message ?? ''}${includeSensitiveContext && crumb.sensitive ? crumb.sensitive : ''}`;
  });
}

export function addCustomEnabledLoggers(loggers: string[]) {
  loggers.forEach((logger) => customLoggers.add(logger));
}

export function createDevLogger(tag: string, enabled: boolean) {
  const proxy = new Proxy(console, {
    get(target: Console, prop: string | symbol, receiver) {
      return (...args: unknown[]) => {
        let resolvedProp = prop;

        if (prop === 'crumb') {
          addBreadcrumb({
            tag,
            message: args.length > 0 ? args.join(' ') : null,
          });
          resolvedProp = 'log';
        }

        if (prop === 'sensitiveCrumb') {
          addBreadcrumb({
            tag,
            sensitive: args.length > 0 ? args.join(' ') : null,
          });
          resolvedProp = 'log';
        }

        if (prop === 'error') {
          // TODO: feel like it might be revealing too much to always log the message?
          addBreadcrumb({
            tag,
            message: 'error logged',
          });
        }

        if (
          (enabled || customLoggers.has(tag)) &&
          process.env.NODE_ENV !== 'production'
        ) {
          const val = Reflect.get(target, resolvedProp, receiver);
          const prefix = `${[sessionTimeLabel(), deltaLabel()].filter((v) => !!v).join(':')} [${tag}]`;
          val(prefix, ...args);
        }
      };
    },
  });

  return proxy as Logger;
}

export async function logDuration<T>(
  label: string,
  logger: Console,
  fn: () => Promise<T>
) {
  const start = Date.now();
  logger.log('start:time:' + label);
  const result = await fn();
  logger.log('end:time:' + label + '', `(${Date.now() - start}ms)`);
  return result;
}

export function logSyncDuration<T>(
  label: string,
  logger: Console,
  fn: () => T
) {
  const start = Date.now();
  logger.log('start:time:' + label);
  const result = fn();
  logger.log('end:time:' + label + '', `(${Date.now() - start}ms)`);
  return result;
}

// Attempts to slice off rarely significant digits for more legible logging.
export function shortPostId(postId: string) {
  return postId.slice(14, 27);
}

/**
 * Execute a function only in development mode. Currently using for more
 * expensive log operations -- logs themselves are disabled in  prod, but their
 * contents string still gets constructed.
 */
export const runIfDev =
  <T extends any[], TReturn>(fn: (...args: T) => TReturn) =>
  (...args: T): TReturn | undefined => {
    if (__DEV__) {
      return fn(...args);
    }
  };

/**
 * Escapes double quotes in strings.
 * Needed because sometimes values with " literals fail to fully log in the debug console. This is probably related to the missing bundler logs issue.
 */
export const escapeLog = runIfDev((value: string) =>
  value.replace(/"/g, '\\"')
);

/**
 * String representation of a list of values.
 */
export const listDebugLabel = runIfDev((list: Iterable<string | number>) => {
  return '[' + Array.from(list).join(' ') + ']';
});

const sessionStartTime = Date.now();

const LOG_SESSION_TIME = true;
const LOG_DELTA = true;

function sessionTimeLabel() {
  return LOG_SESSION_TIME ? `${Date.now() - sessionStartTime}` : null;
}

let lastTime = sessionStartTime;

function deltaLabel() {
  if (!LOG_DELTA) {
    return null;
  }
  const nextTime = Date.now();
  const delta = nextTime - lastTime;
  lastTime = nextTime;
  return delta;
}

type PostSender = (content: any, _channelId: string, metadata?: any) => void;

export function useSendPosts(
  {
    channelId,
    interval = 500,
    initialDelay = 3000,
  }: { channelId: string; interval: number; initialDelay: number },
  sendPost: PostSender
) {
  const session = useCurrentSession();
  const counter = useRef(0);
  const senderRef = useLiveRef(sendPost);
  useEffect(() => {
    if (!session) {
      return;
    }
    let intervalHandle: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      intervalHandle = setInterval(() => {
        const text =
          counter.current === 0
            ? 'session start ' + new Date().toISOString()
            : ['cliff', 'meadow', 'river', 'forest'][counter.current % 4];
        ++counter.current;
        senderRef.current([{ inline: [text, { break: null }] }], channelId);
      }, interval);
    }, initialDelay);
    return () => {
      clearTimeout(timeout);
      clearInterval(intervalHandle);
    };
  }, [channelId, initialDelay, interval, senderRef, session]);
}

export const useLogChange = (label: string, value: unknown) => {
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    console.log(label, 'changed', value);
  }, [label, value]);
};

export const useLogLifecycleEvents = (
  label: string,
  includeRender?: boolean
) => {
  if (includeRender) {
    console.log('label', 'rendered');
  }
  return useEffect(() => {
    console.log(label, 'mounted');
    return () => console.log(label, 'unmounted');
  }, []);
};
