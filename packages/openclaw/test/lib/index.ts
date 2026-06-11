/**
 * Test Library
 *
 * Utilities for integration testing the Tlon plugin.
 */

export { createStateClient, type StateClient, type StateClientConfig } from "./state.js";

export {
  createTlonClient,
  createTestClient,
  type TestClient,
  type AgentResponse,
  type TlonClientConfig,
  type TestClientConfig,
  type ShipCredentials,
} from "./client.js";

export { getTestConfig, type TestEnvConfig } from "./config.js";

export {
  waitFor,
  getFixtures,
  requireFixtureGroup,
  requireThirdParty,
  ensureThirdPartyDmAccess,
  type TestFixtures,
} from "./fixtures.js";

export {
  getContainerLogsSince,
  startLiveToolTrace,
  toolWasInvoked,
  type LiveToolTraceHandle,
} from "./docker-logs.js";
