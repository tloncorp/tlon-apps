import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';
import {
  StewardAutomationConnectionUnavailableError,
  submitStewardAutomationProject,
} from './steward-automation-adapter.js';
import type { StewardAutomationProjectAction } from './steward-automation-projection.js';

const paramsSlot = sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT);

const action: StewardAutomationProjectAction = {
  project: {
    tasks: [
      {
        id: 'job-1',
        enabled: false,
        payload: { kind: 'agentTurn', text: 'check status' },
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

describe('submitStewardAutomationProject', () => {
  beforeEach(() => {
    paramsSlot.set(null);
  });

  afterEach(() => {
    paramsSlot.set(null);
  });

  it('submits the exact automation poke through the published connection', async () => {
    const poke = vi.fn().mockResolvedValue(42);
    paramsSlot.set(paramsWithPoke(poke));

    await submitStewardAutomationProject(action);

    expect(poke).toHaveBeenCalledOnce();
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-automation-action-1',
      json: action,
    });
  });

  it('fails with a retryable availability error when no connection is published', async () => {
    const submission = submitStewardAutomationProject(action);

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

    const submission = submitStewardAutomationProject(action).then(() => {
      settled = true;
    });
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

    await expect(submitStewardAutomationProject(action)).rejects.toBe(nack);
  });

  it('looks up the current slot value for every submission', async () => {
    const stalePoke = vi.fn().mockResolvedValue(1);
    const currentPoke = vi.fn().mockResolvedValue(2);

    paramsSlot.set(paramsWithPoke(stalePoke));
    await submitStewardAutomationProject(action);
    paramsSlot.set(paramsWithPoke(currentPoke));
    await submitStewardAutomationProject(action);

    expect(stalePoke).toHaveBeenCalledOnce();
    expect(currentPoke).toHaveBeenCalledOnce();
    expect(currentPoke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-automation-action-1',
      json: action,
    });
  });
});
