/**
 * OpenClaw compatibility path for the shared scripted fake model client.
 *
 * Keep this file as the stable host-side import target for existing OpenClaw
 * tests. The Docker fake-model container still runs the self-contained
 * `server.mjs` beside this file; do not make that container path import the
 * shared package while it only mounts `packages/openclaw`.
 */
import {
  FakeModelClient,
  fakeModelBaseUrlFromEnv,
} from '../../../../tlon-bot-e2e/src/fake-model/client.js';

export {
  FakeModelClient,
  fakeModelBaseUrlFromEnv,
  normalizeFakeModelBaseUrl,
} from '../../../../tlon-bot-e2e/src/fake-model/client.js';
export type {
  FakeModelReceivedResponse,
  ReceivedCall,
  ScriptOptions,
  Step,
} from '../../../../tlon-bot-e2e/src/fake-model/client.js';

export const fakeModel = new FakeModelClient(fakeModelBaseUrlFromEnv());
