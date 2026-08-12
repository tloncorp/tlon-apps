import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';
import type { StewardAutomationProjection } from './steward-automation-projection.js';

const apiClientParamsSlot = sharedSlot<SharedApiClientParams>(
  API_CLIENT_PARAMS_SLOT
);

export class StewardAutomationConnectionUnavailableError extends Error {
  readonly retryable = true;

  constructor() {
    super(
      'Steward automation projection is temporarily unavailable: ' +
        'the Tlon monitor has not published a ship connection; retry later'
    );
    this.name = 'StewardAutomationConnectionUnavailableError';
  }
}

/** Submit one complete automation projection through the current monitor. */
export async function submitStewardAutomationProjection(
  projection: StewardAutomationProjection
): Promise<void> {
  const params = apiClientParamsSlot.get();
  if (!params) {
    throw new StewardAutomationConnectionUnavailableError();
  }

  await params.poke({
    app: 'steward',
    mark: 'steward-automation-action-1',
    json: projection,
  });
}
