import { existsSync } from 'node:fs';

import type { ShipCredentials, TestClientConfig } from './client.js';

export interface TestEnvConfig {
  testUser: ShipCredentials;
  bot: ShipCredentials;
  thirdParty?: ShipCredentials;
}

export function getTestConfig(): TestClientConfig {
  const runningInDocker = existsSync('/.dockerenv');

  let botUrl = requireEnv('TLON_URL');
  botUrl = normalizeShipUrl(botUrl, runningInDocker);
  const botShip = requireEnv('TLON_SHIP');
  const botCode = requireEnv('TLON_CODE');

  let testUserUrl = process.env.TEST_USER_URL ?? botUrl;
  testUserUrl = normalizeShipUrl(testUserUrl, runningInDocker);
  const testUserShip = process.env.TEST_USER_SHIP ?? botShip;
  const testUserCode = process.env.TEST_USER_CODE ?? botCode;

  return {
    testUser: {
      shipUrl: testUserUrl,
      shipName: testUserShip,
      code: testUserCode,
    },
    bot: {
      shipUrl: botUrl,
      shipName: botShip,
      code: botCode,
    },
  };
}

export function isTestConfigured(): boolean {
  try {
    getTestConfig();
    return true;
  } catch {
    return false;
  }
}

function normalizeShipUrl(url: string, runningInDocker: boolean): string {
  if (!runningInDocker) {
    return url.replace('host.docker.internal', 'localhost');
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'host.docker.internal';
      return parsed.toString();
    }
  } catch {
    // Leave the raw URL in place so the connection attempt reports the issue.
  }

  return url;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
