import { type TestClient, createTestClient } from './client.js';
import { getTestConfig } from './config.js';
import { type StateClient, createStateClient } from './state.js';

export interface TestFixtures {
  client: TestClient;
  botState: StateClient;
  userState: StateClient;
  botShip: string;
  userShip: string;
}

let cachedFixtures: TestFixtures | null = null;
let setupPromise: Promise<TestFixtures> | null = null;

export async function getFixtures(): Promise<TestFixtures> {
  if (cachedFixtures) {
    return cachedFixtures;
  }

  if (setupPromise) {
    return setupPromise;
  }

  setupPromise = setupFixtures();
  cachedFixtures = await setupPromise;
  return cachedFixtures;
}

async function setupFixtures(): Promise<TestFixtures> {
  const config = getTestConfig();
  const client = createTestClient(config);
  const botState = createStateClient(config.bot);
  const userState = createStateClient(config.testUser);

  const botShip = config.bot.shipName.startsWith('~')
    ? config.bot.shipName
    : `~${config.bot.shipName}`;
  const userShip = config.testUser.shipName.startsWith('~')
    ? config.testUser.shipName
    : `~${config.testUser.shipName}`;

  console.log('\n[FIXTURES] Setting up Hermes Tlon test fixtures...');
  await botState.connect();
  await userState.connect();
  console.log(`[FIXTURES] Bot ship: ${botShip}`);
  console.log(`[FIXTURES] User ship: ${userShip}`);

  return {
    client,
    botState,
    userState,
    botShip,
    userShip,
  };
}
