import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';
import {
  StewardAutomationConnectionUnavailableError,
  submitStewardAutomationProjection,
} from './steward-automation-adapter.js';
import type { StewardAutomationProjection } from './steward-automation-projection.js';

const paramsSlot = sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT);

const projection: StewardAutomationProjection = {
  project: {
    tasks: [
      {
        id: 'job-1',
        enabled: false,
        payload: { kind: 'agentTurn', message: 'check status' },
      },
    ],
  },
};

function paramsWithPoke(
  poke: SharedApiClientParams['poke']
): SharedApiClientParams {
  return {
    poke,
    shipName: 'zod',
    shipUrl: 'http://localhost:8080',
  };
}

describe('submitStewardAutomationProjection', () => {
  beforeEach(() => {
    paramsSlot.set(null);
  });

  afterEach(() => {
    paramsSlot.set(null);
  });

  it('submits the exact automation poke through the published connection', async () => {
    const poke = vi.fn().mockResolvedValue(42);
    paramsSlot.set(paramsWithPoke(poke));

    await submitStewardAutomationProjection(projection);

    expect(poke).toHaveBeenCalledOnce();
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-automation-action-1',
      json: projection,
    });
  });

  it('fails with a retryable availability error when no connection is published', async () => {
    const submission = submitStewardAutomationProjection(projection);

    await expect(submission).rejects.toMatchObject({
      name: 'StewardAutomationConnectionUnavailableError',
      retryable: true,
    });
    await expect(submission).rejects.toBeInstanceOf(
      StewardAutomationConnectionUnavailableError
    );
  });

  it('does not resolve until the poke acknowledgement resolves', async () => {
    let acknowledge!: (value: unknown) => void;
    const poke = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          acknowledge = resolve;
        })
    );
    paramsSlot.set(paramsWithPoke(poke));
    let settled = false;

    const submission = submitStewardAutomationProjection(projection).then(
      () => {
        settled = true;
      }
    );
    await Promise.resolve();

    expect(poke).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    acknowledge(42);
    await expect(submission).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it('propagates poke acknowledgement failures unchanged', async () => {
    const nack = new Error('poke nack');
    const poke = vi.fn().mockRejectedValue(nack);
    paramsSlot.set(paramsWithPoke(poke));

    await expect(submitStewardAutomationProjection(projection)).rejects.toBe(
      nack
    );
  });

  it('looks up the current slot value for every submission', async () => {
    const stalePoke = vi.fn().mockResolvedValue(1);
    const currentPoke = vi.fn().mockResolvedValue(2);

    paramsSlot.set(paramsWithPoke(stalePoke));
    await submitStewardAutomationProjection(projection);
    paramsSlot.set(paramsWithPoke(currentPoke));
    await submitStewardAutomationProjection(projection);

    expect(stalePoke).toHaveBeenCalledOnce();
    expect(currentPoke).toHaveBeenCalledOnce();
    expect(currentPoke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-automation-action-1',
      json: projection,
    });
  });
});
