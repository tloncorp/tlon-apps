/**
 * Test Configuration
 *
 * Reads test configuration from environment variables.
 * Compatible with the root .env file used by docker-compose.
 */

import { existsSync } from "node:fs";
import type { TestClientConfig, ShipCredentials } from "./client.js";

export interface TestEnvConfig {
  /** Test user credentials (for sending prompts) */
  testUser: ShipCredentials;
  /** Bot credentials (for checking state after processing) */
  bot: ShipCredentials;
  /** Third-party ship credentials (non-owner, for security tests) */
  thirdParty?: ShipCredentials;
}

/**
 * Get test configuration from environment variables.
 *
 * Two ships are needed:
 *   1. Test user ship (to send DMs from) — TEST_USER_SHIP, TEST_USER_CODE
 *   2. Bot ship (to send DMs to and check state) — TLON_SHIP, TLON_CODE
 *
 * Environment variables:
 * - TLON_URL: Ship URL (converted from host.docker.internal to localhost)
 * - TLON_SHIP: Bot ship name
 * - TLON_CODE: Bot access code (for state checks)
 * - TEST_USER_URL/SHIP/CODE: Test user ship (default: bot)
 * - TEST_THIRD_PARTY_URL/SHIP/CODE: Optional third-party ship for security tests
 */
export function getTestConfig(): TestClientConfig {
  const runningInDocker = existsSync("/.dockerenv");

  // Bot ship credentials (for receiving DMs and checking state)
  let botUrl = requireEnv("TLON_URL");
  botUrl = normalizeShipUrl(botUrl, runningInDocker);
  const botShip = requireEnv("TLON_SHIP");
  const botCode = requireEnv("TLON_CODE");

  // Test user ship credentials (for sending DMs)
  let testUserUrl = process.env.TEST_USER_URL ?? botUrl;
  testUserUrl = normalizeShipUrl(testUserUrl, runningInDocker);
  const testUserShip = process.env.TEST_USER_SHIP ?? botShip;
  const testUserCode = process.env.TEST_USER_CODE ?? botCode;

  // Third-party ship credentials (non-owner, for security tests)
  // Only populated when all three env vars are set
  let thirdParty: ShipCredentials | undefined;
  const thirdPartyUrl = process.env.TEST_THIRD_PARTY_URL;
  const thirdPartyShip = process.env.TEST_THIRD_PARTY_SHIP;
  const thirdPartyCode = process.env.TEST_THIRD_PARTY_CODE;
  if (thirdPartyUrl && thirdPartyShip && thirdPartyCode) {
    thirdParty = {
      shipUrl: normalizeShipUrl(thirdPartyUrl, runningInDocker),
      shipName: thirdPartyShip,
      code: thirdPartyCode,
    };
  }

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
    thirdParty,
  };
}

function normalizeShipUrl(url: string, runningInDocker: boolean): string {
  // Host tests often use host.docker.internal in .env; map to localhost only outside Docker.
  if (!runningInDocker) {
    return url.replace("host.docker.internal", "localhost");
  }

  // In Docker, localhost points to the container itself, not the host ship.
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      parsed.hostname = "host.docker.internal";
      return parsed.toString();
    }
  } catch {
    // If URL parsing fails, keep original value and let caller surface config errors.
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

/**
 * Check if the test environment is configured.
 */
export function isTestConfigured(): boolean {
  try {
    getTestConfig();
    return true;
  } catch {
    return false;
  }
}
