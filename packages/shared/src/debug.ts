import { useEffect, useRef } from 'react';

import { useLiveRef } from './logic/utilHooks';
import { useCurrentSession } from './store/session';

const customLoggers = new Set<string>();

interface Breadcrumb {
  tag: string;
  message: string | null;
  additionalContext?: any;
}

export type Logger = Console & { crumb: (...args: unknown[]) => void };

const debugBreadcrumbs: Breadcrumb[] = [];
const BREADCRUMB_LIMIT = 100;

export function logNavigationChange(from: string, to: string) {
  debugBreadcrumbs.push({
    tag: 'navigation',
    message: `to: ${to}, from: ${from}`,
  });
}

export function addBreadcrumb(
  tag: string,
  message: string | null,
  additionalContext?: any
) {
  const newCrumb = { tag, message, additionalContext };
  debugBreadcrumbs.push(newCrumb);
  if (debugBreadcrumbs.length >= BREADCRUMB_LIMIT) {
    debugBreadcrumbs.shift();
  }
}

export function getCurrentBreadcrumbs() {
  return debugBreadcrumbs.map((crumb) => {
    const context = crumb.additionalContext
      ? typeof crumb.additionalContext === 'object'
        ? JSON.stringify(crumb.additionalContext)
        : crumb.additionalContext.toString()
      : '';
    return `[${crumb.tag}] ${crumb.message} ${crumb ? `(${context})` : ''}`;
  });
}

export function addCustomEnabledLoggers(loggers: string[]) {
  loggers.forEach((logger) => customLoggers.add(logger));
}

export function createDevLogger(tag: string, enabled: boolean) {
  const proxy = new Proxy(console, {
    get(target: Console, prop: string | symbol, receiver) {
      if (prop === 'crumb') {
        return (...args: unknown[]) => {
          // Run the same logic as logger.log
          if (
            (enabled || customLoggers.has(tag)) &&
            process.env.NODE_ENV !== 'production'
          ) {
            const prefix = `${[sessionTimeLabel(), deltaLabel()].filter((v) => !!v).join(':')} [${tag}]`;
            console.log(prefix, ...args);
          }

          // Special handling for the crumb
          addBreadcrumb(tag, args.toString());
        };
      }

      return (...args: unknown[]) => {
        if (
          (enabled || customLoggers.has(tag)) &&
          process.env.NODE_ENV !== 'production'
        ) {
          const val = Reflect.get(target, prop, receiver);
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
