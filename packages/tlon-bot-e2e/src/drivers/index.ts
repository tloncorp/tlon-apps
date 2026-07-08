import { hermesDriver } from './hermes.js';
import { openclawDriver } from './openclaw.js';
import type { BotDriver, DriverName } from './types.js';

export * from './hermes.js';
export * from './openclaw.js';
export * from './types.js';

export function driverForName(name: DriverName): BotDriver {
  if (name === 'hermes') {
    return hermesDriver;
  }
  if (name === 'openclaw') {
    return openclawDriver;
  }
  throw new Error(`Unsupported TLON bot E2E driver: ${name}`);
}
