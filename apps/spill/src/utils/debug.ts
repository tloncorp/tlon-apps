import {useEffect, useMemo, useRef} from 'react';

// expands object types one level deep
export type Expand<T> = T extends infer O ? {[K in keyof O]: O[K]} : never;

// expands object types recursively
export type ExpandRecursively<T> = T extends object
  ? T extends infer O
    ? {[K in keyof O]: ExpandRecursively<O[K]>}
    : never
  : T;

const instances: Record<string, number> = {};
export const useInstanceId = (prefix: string) => {
  instances[prefix] ||= 0;
  return useMemo(() => {
    return `${prefix}-${instances[prefix]++}`;
  }, [prefix]);
};

export function createLogger(
  tag: string,
  enabled = isDev(),
): Pick<Console, 'log' | 'warn' | 'error'> {
  const prefix = `[${tag}]`;
  const noop = () => {};
  const log = enabled ? console.log.bind(console, prefix) : noop;
  const warn = enabled ? console.warn.bind(console, prefix) : noop;
  const error = enabled ? console.error.bind(console, prefix) : noop;
  return {log, warn, error};
}

export function stopwatch(label: string) {
  const startTime = Date.now();
  return {
    stop() {
      const endTime = Date.now();
      console.log(`${label} took ${endTime - startTime}ms`);
    },
  };
}

const timers: Record<string, number> = {};
const timerLogger = createLogger('timer', true);

export const timer = {
  start(label: string) {
    timers[label] = Date.now();
  },
  stop(label: string) {
    const endTime = Date.now();
    const startTime = timers[label];
    startTime
      ? timerLogger.log(`${label} took ${endTime - startTime}ms`)
      : timerLogger.log('no timer found for', label);
  },
};

export function logDuration(label: string, cb: () => void) {
  const startTime = Date.now();
  const result = cb();
  const endTime = Date.now();
  console.log(`${formatTag(label)}took ${endTime - startTime}ms`);
  return result;
}

const formatTag = (tag: string) => `[${tag}]`;

export function isDev() {
  return __DEV__;
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export function useLogChange(label: string, value: any, logValue = false) {
  const prevValue = usePrevious(value);
  if (prevValue !== value) {
    if (logValue) {
      console.log(`${label}:change`, 'CURRENT', value, 'PREVIOUS', prevValue);
    } else {
      console.log(`${label}:change`);
    }
  }
}
