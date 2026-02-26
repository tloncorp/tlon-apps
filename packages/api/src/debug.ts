// Simplified console-based logger (no Zustand)

/**
 * Cross-platform check for development mode.
 * Works in Node.js, browsers, and React Native.
 */
export function isDev(): boolean {
  // Check for React Native's __DEV__ global
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  // Fall back to NODE_ENV check
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production';
  }
  // Default to false in unknown environments
  return false;
}

// Declare __DEV__ for TypeScript (React Native global)
declare const __DEV__: boolean | undefined;

export interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  crumb: (...args: any[]) => void;
  trackError: (message: string, data?: any) => void;
  trackEvent: (event: string, data?: any) => void;
  sensorsLog: (...args: any[]) => void;
}

export function createDevLogger(tag: string, enabled = true): Logger {
  const prefix = `[${tag}]`;
  return {
    log: (...args) => enabled && console.log(prefix, ...args),
    warn: (...args) => enabled && console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
    debug: (...args) => enabled && console.debug(prefix, ...args),
    crumb: (...args) => enabled && console.log(prefix, '[crumb]', ...args),
    trackError: (msg, data) => console.error(prefix, '[error]', msg, data),
    trackEvent: (event, data) => enabled && console.log(prefix, '[event]', event, data),
    sensorsLog: (...args) => enabled && console.log(prefix, '[sensors]', ...args),
  };
}

export function escapeLog(value: string): string {
  return value.replace(/\n/g, '\\n');
}

export function runIfDev<T>(fn: () => T): T | undefined {
  if (process.env.NODE_ENV !== 'production') {
    return fn();
  }
  return undefined;
}

// Add custom enabled loggers support (no-op for simplified version)
export function addCustomEnabledLoggers(_loggers: string[]): void {
  // No-op in simplified version
}

// Log sync duration (simplified)
export function logSyncDuration(
  _operation: string,
  _startTime: number,
  _metadata?: Record<string, any>
): void {
  // No-op in simplified version
}
