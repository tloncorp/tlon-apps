export interface TestConfig {
  shipUrl: string;
  shipCode: string;
}

export function getTestConfig(): TestConfig {
  const shipUrl = process.env.URBIT_SHIP_URL;
  const shipCode = process.env.URBIT_SHIP_CODE;

  if (!shipUrl || !shipCode) {
    throw new Error(
      'Missing test configuration. Set URBIT_SHIP_URL and URBIT_SHIP_CODE environment variables.'
    );
  }

  return { shipUrl, shipCode };
}

export function skipIfNoShip(): boolean {
  const hasConfig = process.env.URBIT_SHIP_URL && process.env.URBIT_SHIP_CODE;
  return !hasConfig;
}
