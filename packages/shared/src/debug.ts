import { useEffect, useRef } from 'react';
import create from 'zustand';

import * as db from './db';
import { useLiveRef } from './logic/utilHooks';
import { useCurrentSession } from './store/session';

const BREADCRUMB_LIMIT = 100;

interface Breadcrumb {
  tag: string;
  message?: string | null;
  sensitive?: string | null;
}

interface DebugPlatformState {
  network: string;
  battery: string;
  easUpdate: string;
}

type PlatformState = {
  getDebugInfo: () => Promise<DebugPlatformState | null>;
};

interface Log {
  timestamp: number;
  message: string;
}

export type Logger = Console & {
  crumb: (...args: unknown[]) => void;
  sensitiveCrumb: (...args: unknown[]) => void;
  trackError: (message: string, data?: Record<string, any>) => void;
};

interface ErrorLoggerStub {
  capture: (event: string, data: Record<string, unknown>) => void;
}

interface DebugStore {
  enabled: boolean;
  debugBreadcrumbs: Breadcrumb[];
  customLoggers: Set<string>;
  errorLogger: ErrorLoggerStub | null;
  logs: Log[];
  logsUrl: string | null;
  platform: PlatformState | null;
  toggle: (enabled: boolean) => void;
  appendLog: (log: Log) => void;
  uploadLogs: () => Promise<void>;
  addBreadcrumb: (crumb: Breadcrumb) => void;
  getBreadcrumbs: () => string[];
  addCustomEnabledLoggers: (loggers: string[]) => void;
  initializePlatform: (platform: PlatformState) => void;
  initializeErrorLogger: (errorLoggerInput: ErrorLoggerStub) => void;
}

export const useDebugStore = create<DebugStore>((set, get) => ({
  enabled: false,
  customLoggers: new Set<string>(),
  errorLogger: null,
  debugBreadcrumbs: [],
  logs: [],
  logsUrl: null,
  platform: null,
  toggle: (enabled) => {
    set(() => ({
      enabled,
    }));
  },
  appendLog: (log: Log) => {
    set((state) => ({
      logs: [...state.logs, log],
    }));
  },
  uploadLogs: async () => {
    const { errorLogger, platform, debugBreadcrumbs } = get();
    const debugInfo = await platform?.getDebugInfo();

    errorLogger?.capture('debug_logs', {
      logs: get().logs,
      breadcrumbs: debugBreadcrumbs,
      debugInfo,
    });
  },
  addBreadcrumb: (crumb: Breadcrumb) => {
    set((state) => {
      const debugBreadcrumbs = state.debugBreadcrumbs.slice();
      debugBreadcrumbs.push(crumb);

      if (debugBreadcrumbs.length >= BREADCRUMB_LIMIT) {
        debugBreadcrumbs.shift();
      }

      return state;
    });
  },
  getBreadcrumbs: () => {
    const { debugBreadcrumbs } = get();
    const includeSensitiveContext = true; // TODO: handle accordingly
    return debugBreadcrumbs.map((crumb) => {
      return `[${crumb.tag}] ${crumb.message ?? ''}${includeSensitiveContext && crumb.sensitive ? crumb.sensitive : ''}`;
    });
  },
  addCustomEnabledLoggers: (loggers) => {
    set((state) => {
      loggers.forEach((logger) => state.customLoggers.add(logger));
      return state;
    });
  },
  initializePlatform: (platform) => {
    set(() => ({
      platform,
    }));
  },
  initializeErrorLogger: (errorLoggerInput) => {
    set(() => ({
      errorLogger: errorLoggerInput,
    }));
  },
}));

export function addCustomEnabledLoggers(loggers: string[]) {
  return useDebugStore.getState().addCustomEnabledLoggers(loggers);
}

async function getDebugInfo() {
  let appInfo = null;
  let platformState = null;
  const { platform } = useDebugStore.getState();
  try {
    appInfo = await db.getAppInfoSettings();
    platformState = await platform?.getDebugInfo();
  } catch (e) {
    console.error('Failed to get app info or platform state', e);
  }

  return {
    groupsSource: appInfo?.groupsSyncNode,
    groupsHash: appInfo?.groupsHash,
    network: platformState?.network,
    battery: platformState?.battery,
    easUpdate: platformState?.easUpdate,
  };
}

export function createDevLogger(tag: string, enabled: boolean) {
  const proxy = new Proxy(console, {
    get(target: Console, prop: string | symbol, receiver) {
      return (...args: unknown[]) => {
        let resolvedProp = prop;
        const {
          enabled: debugEnabled,
          errorLogger,
          customLoggers,
          addBreadcrumb,
        } = useDebugStore.getState();

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

        if (prop === 'trackError') {
          const customProps =
            args[1] && typeof args[1] === 'object' ? args[1] : {};
          const report = (debugInfo: any = undefined) =>
            errorLogger?.capture('app_error', {
              ...customProps,
              debugInfo,
              message:
                typeof args[0] === 'string'
                  ? `[${tag}] ${args[0]}`
                  : 'no message',
              breadcrumbs: useDebugStore.getState().getBreadcrumbs(),
            });
          getDebugInfo()
            .then(report)
            .catch(() => report());
          resolvedProp = 'error';
        }

        if (!(debugEnabled || enabled || customLoggers.has(tag))) {
          return;
        }

        const prefix = `${[sessionTimeLabel(), deltaLabel()].filter((v) => !!v).join(':')} [${tag}]`;
        if (debugEnabled) {
          useDebugStore.getState().appendLog({
            timestamp: Date.now(),
            message: `${prefix} ${stringifyArgs(...args)}`,
          });
        }

        if (__DEV__) {
          const val = Reflect.get(target, resolvedProp, receiver);
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
export const runIfDev = <TReturn>(fn: () => TReturn) => {
  if (__DEV__) {
    return fn();
  }
};

/**
 * Escapes double quotes in strings.
 * Needed because sometimes values with " literals fail to fully log in the debug console. This is probably related to the missing bundler logs issue.
 */
export const escapeLog = (value: string) =>
  runIfDev(() => value.replace(/"/g, '\\"'));

/**
 * String representation of a list of values.
 */
export const listDebugLabel = (list: Iterable<string | number>) =>
  runIfDev(() => {
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

/**
 * Logs a message when any property of an object changes. Uses shallow equality
 * check to determine whether a change has occurred.
 */
export function useObjectChangeLogging(
  o: Record<string, unknown>,
  logger: Console = window.console
) {
  const lastValues = useRef(o);
  Object.entries(o).forEach(([k, v]) => {
    if (v !== lastValues.current[k]) {
      logger.log('[change]', k, 'old:', lastValues.current[k], 'new:', v);
      lastValues.current[k] = v;
    }
  });
}

function stringifyArgs(...args: unknown[]): string {
  return args
    .map((arg) => {
      if (!arg) {
        return JSON.stringify(arg);
      }
      if (typeof arg === 'string') {
        return arg;
      }

      if (typeof arg === 'object' && 'toString' in arg) {
        return arg.toString();
      }

      return JSON.stringify(arg);
    })
    .join(' ');
}
