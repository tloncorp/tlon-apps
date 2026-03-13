/* eslint-disable no-console */

declare const __DEV__: boolean | undefined;

type ApiLogger = Console & {
  crumb: (...args: unknown[]) => void;
  sensitiveCrumb: (...args: unknown[]) => void;
  trackError: (message: string, data?: Error | Record<string, unknown>) => void;
  trackEvent: (eventId: string, data?: Record<string, unknown>) => void;
};

type LoggerFactory = (tag: string, enabled: boolean) => ApiLogger;

function isDevRuntime() {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production';
  }

  return false;
}

function createFallbackLogger(tag: string, enabled: boolean): ApiLogger {
  const forward = (method: keyof Console, ...args: unknown[]) => {
    if (!enabled || !isDevRuntime()) {
      return;
    }

    const fn = console[method] ?? console.log;
    if (typeof fn === 'function') {
      (fn as (...values: unknown[]) => void)(`[${tag}]`, ...args);
    } else {
      console.log(`[${tag}]`, ...args);
    }
  };

  return {
    ...console,
    log: (...args: unknown[]) => forward('log', ...args),
    debug: (...args: unknown[]) => forward('debug', ...args),
    info: (...args: unknown[]) => forward('info', ...args),
    warn: (...args: unknown[]) => forward('warn', ...args),
    error: (...args: unknown[]) => forward('error', ...args),
    crumb: (...args: unknown[]) => forward('log', ...args),
    sensitiveCrumb: (...args: unknown[]) => forward('log', ...args),
    trackError: (message: string, data?: Error | Record<string, unknown>) => {
      forward('error', message, data);
    },
    trackEvent: (eventId: string, data?: Record<string, unknown>) =>
      forward('log', eventId, data),
  } as ApiLogger;
}

const defaultLoggerFactory: LoggerFactory = createFallbackLogger;
let loggerFactory: LoggerFactory = defaultLoggerFactory;

export function configureLoggerFactory(nextFactory: LoggerFactory) {
  loggerFactory = nextFactory;
}

export function createDevLogger(tag: string, enabled: boolean): ApiLogger {
  let activeFactory = loggerFactory;
  let activeLogger = activeFactory(tag, enabled);

  const resolveLogger = () => {
    if (activeFactory !== loggerFactory) {
      activeFactory = loggerFactory;
      activeLogger = activeFactory(tag, enabled);
    }

    return activeLogger;
  };

  const delegate = <TArgs extends unknown[]>(
    getMethod: (logger: ApiLogger) => (...args: TArgs) => unknown,
    ...args: TArgs
  ) => getMethod(resolveLogger())(...args);

  return {
    ...console,
    log: (...args: unknown[]) => delegate((logger) => logger.log, ...args),
    debug: (...args: unknown[]) => delegate((logger) => logger.debug, ...args),
    info: (...args: unknown[]) => delegate((logger) => logger.info, ...args),
    warn: (...args: unknown[]) => delegate((logger) => logger.warn, ...args),
    error: (...args: unknown[]) => delegate((logger) => logger.error, ...args),
    crumb: (...args: unknown[]) => delegate((logger) => logger.crumb, ...args),
    sensitiveCrumb: (...args: unknown[]) =>
      delegate((logger) => logger.sensitiveCrumb, ...args),
    trackError: (message: string, data?: Error | Record<string, unknown>) =>
      delegate((logger) => logger.trackError, message, data),
    trackEvent: (eventId: string, data?: Record<string, unknown>) =>
      delegate((logger) => logger.trackEvent, eventId, data),
  } as ApiLogger;
}

export const runIfDev = <TReturn>(fn: () => TReturn) => {
  if (isDevRuntime()) {
    return fn();
  }
};

export const escapeLog = (value: string) => runIfDev(() => value.replace(/"/g, '\\"'));
