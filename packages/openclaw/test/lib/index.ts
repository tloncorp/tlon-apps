/**
 * Test Library
 *
 * Utilities for integration testing the Tlon plugin.
 */

export {
  createStateClient,
  type StateClient,
  type StateClientConfig,
  withStateClientLock,
} from './state.js';

export {
  createBoundedNounClient,
  decodeDa,
  decodeGatewayStatus,
  type BoundedNounClient,
  type BoundedNounScryOptions,
  type GatewayStatusScry,
  type GatewayStatusValue,
} from './noun-scry.js';

export {
  createTlonClient,
  createTestClient,
  type TestClient,
  type AgentResponse,
  type TlonClientConfig,
  type TestClientConfig,
  type ShipCredentials,
} from './client.js';

export { getTestConfig, type TestEnvConfig } from './config.js';

export { registerEngagingTurn } from './scripted.js';

export {
  waitFor,
  getFixtures,
  requireFixtureGroup,
  requireThirdParty,
  ensureThirdPartyDmAccess,
  type TestFixtures,
} from './fixtures.js';

export {
  assertOpenClawContainerRunning,
  getContainerLogsSince,
  setGatewayStatusRestartConfig,
  startLiveToolTrace,
  toolWasInvoked,
  type ConfigSetResult,
  type LiveToolTraceHandle,
} from './docker-logs.js';
