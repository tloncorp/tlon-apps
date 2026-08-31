import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Foreigns } from '../urbit/foreigns.js';
import {
  type GroupInviteDeps,
  createCatchUpRunner,
  parseForeignsSnapshot,
  processPendingForeigns,
} from './group-invites.js';

function makeForeign(
  flag: string,
  from: string,
  opts: {
    valid?: boolean;
    title?: string;
    progress?: Foreigns[string]['progress'];
  } = {}
): Foreigns {
  return {
    [flag]: {
      invites: [
        {
          flag,
          time: 1,
          from,
          token: null,
          note: null,
          preview: {
            meta: {
              title: opts.title ?? 'Test Group',
              description: '',
              image: '',
              cover: '',
            },
            'channel-count': 1,
            'member-count': 2,
            admissions: { privacy: 'private' },
          },
          valid: opts.valid ?? true,
        },
      ],
      lookup: null,
      preview: null,
      progress: opts.progress ?? null,
      token: null,
    },
  };
}

type FakeDeps = GroupInviteDeps & {
  acceptInvite: ReturnType<typeof vi.fn>;
  queueApproval: ReturnType<typeof vi.fn>;
  fetchBlockedShips: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function makeDeps(overrides: Partial<GroupInviteDeps> = {}): FakeDeps {
  return {
    processedGroupInvites: new Set<string>(),
    ownerShip: '~owner',
    allowlist: () => [],
    fetchBlockedShips: vi.fn().mockResolvedValue([]),
    acceptInvite: vi.fn().mockResolvedValue(undefined),
    queueApproval: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
    ...overrides,
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('processPendingForeigns', () => {
  let deps: FakeDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('queues non-allowlisted invites without marking the processed flag', async () => {
    await processPendingForeigns(makeForeign('~host/group', '~stranger'), deps);

    expect(deps.queueApproval).toHaveBeenCalledWith({
      requestingShip: '~stranger',
      groupFlag: '~host/group',
      groupTitle: 'Test Group',
    });
    // Idempotency lives in the approval record; the queue path never marks.
    expect(deps.processedGroupInvites.has('~host/group')).toBe(false);
    expect(deps.acceptInvite).not.toHaveBeenCalled();
  });

  it('marks the flag only on a successful auto-accept', async () => {
    await processPendingForeigns(makeForeign('~host/group', '~owner'), deps);

    expect(deps.acceptInvite).toHaveBeenCalledWith('~host/group');
    expect(deps.processedGroupInvites.has('~host/group')).toBe(true);
    expect(deps.queueApproval).not.toHaveBeenCalled();
  });

  it('leaves the flag unmarked when the accept poke fails', async () => {
    deps = makeDeps({
      acceptInvite: vi.fn().mockRejectedValue(new Error('poke failed')),
    });

    await processPendingForeigns(makeForeign('~host/group', '~owner'), deps);

    expect(deps.processedGroupInvites.has('~host/group')).toBe(false);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining('poke failed')
    );
  });

  it('marks the flag on a decision-level confirmed-blocked ignore', async () => {
    deps = makeDeps({
      allowlist: () => ['~inviter'],
      fetchBlockedShips: vi.fn().mockResolvedValue(['~inviter']),
    });

    await processPendingForeigns(makeForeign('~host/group', '~inviter'), deps);

    expect(deps.processedGroupInvites.has('~host/group')).toBe(true);
    expect(deps.queueApproval).not.toHaveBeenCalled();
    expect(deps.acceptInvite).not.toHaveBeenCalled();
  });

  it('logs one line when invites exist but none are valid', async () => {
    await processPendingForeigns(
      makeForeign('~host/group', '~stranger', { valid: false }),
      deps
    );

    expect(deps.log).toHaveBeenCalledWith(
      expect.stringContaining('none valid')
    );
    expect(deps.acceptInvite).not.toHaveBeenCalled();
    expect(deps.queueApproval).not.toHaveBeenCalled();
    expect(deps.processedGroupInvites.size).toBe(0);
  });

  it('skips an invite whose join is already in flight (post-/allow fact)', async () => {
    const deps = makeDeps();
    await processPendingForeigns(
      makeForeign('~host/garden', '~inviter', { progress: 'join' }),
      deps
    );

    // The /allow already accepted this invite; re-carding it would duplicate
    // the approval the owner just actioned.
    expect(deps.queueApproval).not.toHaveBeenCalled();
    expect(deps.acceptInvite).not.toHaveBeenCalled();
    expect(deps.processedGroupInvites.size).toBe(0);
  });

  it('keeps an invite actionable while an entry ask is pending', async () => {
    const deps = makeDeps();
    await processPendingForeigns(
      makeForeign('~host/garden', '~inviter', { progress: 'ask' }),
      deps
    );

    // %ask is the bot's own entry request, not a join in flight — a valid
    // invite arriving alongside it must still reach the owner.
    expect(deps.queueApproval).toHaveBeenCalledTimes(1);
  });

  it('still processes an invite whose previous join errored', async () => {
    const deps = makeDeps();
    await processPendingForeigns(
      makeForeign('~host/garden', '~inviter', { progress: 'error' }),
      deps
    );

    expect(deps.queueApproval).toHaveBeenCalledTimes(1);
  });

  it('clears the processed marker when an auto-accepted join later errors', async () => {
    const deps = makeDeps({
      processedGroupInvites: new Set(['~host/garden']),
    });

    await processPendingForeigns(
      makeForeign('~host/garden', '~owner', { progress: 'error' }),
      deps
    );

    // The accept poke acked but the backend join failed; the flag has to be
    // a live decision again rather than stay suppressed until restart.
    expect(deps.acceptInvite).toHaveBeenCalledWith('~host/garden');
    expect(deps.processedGroupInvites.has('~host/garden')).toBe(true);
  });

  it('clears the processed marker on an error even with no valid invite', async () => {
    const deps = makeDeps({
      processedGroupInvites: new Set(['~host/garden']),
    });

    await processPendingForeigns(
      makeForeign('~host/garden', '~owner', {
        progress: 'error',
        valid: false,
      }),
      deps
    );

    // The loop exits at the invites check, but the flag must be actionable
    // again for the observation that carries a valid invite.
    expect(deps.processedGroupInvites.has('~host/garden')).toBe(false);
    expect(deps.acceptInvite).not.toHaveBeenCalled();
  });

  it('re-decides and re-marks a confirmed-blocked flag when the join errors', async () => {
    const deps = makeDeps({
      processedGroupInvites: new Set(['~host/garden']),
      allowlist: () => ['~inviter'],
      fetchBlockedShips: vi.fn().mockResolvedValue(['~inviter']),
    });

    await processPendingForeigns(
      makeForeign('~host/garden', '~inviter', { progress: 'error' }),
      deps
    );

    // Bounded cost: one batch-memoized block-list read, no owner card.
    expect(deps.fetchBlockedShips).toHaveBeenCalledTimes(1);
    expect(deps.processedGroupInvites.has('~host/garden')).toBe(true);
    expect(deps.queueApproval).not.toHaveBeenCalled();
  });

  it('queues with no title when the invite preview title is not a string', async () => {
    const deps = makeDeps();
    const foreigns = makeForeign('~host/group', '~stranger');
    // Remote-inviter-controlled and only type-asserted on the way in.
    (
      foreigns['~host/group'].invites[0].preview!.meta as { title: unknown }
    ).title = 7;

    await processPendingForeigns(foreigns, deps);

    expect(deps.queueApproval).toHaveBeenCalledWith({
      requestingShip: '~stranger',
      groupFlag: '~host/group',
    });
  });

  it('stays silent for foreigners without invites (previews/joins-in-progress)', async () => {
    const foreigns: Foreigns = {
      '~host/group': {
        invites: [],
        lookup: null,
        preview: null,
        progress: null,
        token: null,
      },
    };

    await processPendingForeigns(foreigns, deps);

    expect(deps.log).not.toHaveBeenCalled();
    expect(deps.error).not.toHaveBeenCalled();
    expect(deps.queueApproval).not.toHaveBeenCalled();
  });
});

describe('createCatchUpRunner', () => {
  let runner: ReturnType<typeof createCatchUpRunner>;

  it('coalesces overlapping catch-ups into one run', async () => {
    let gate!: () => void;
    const blocked = new Promise<void>((resolve) => {
      gate = resolve;
    });
    const run = vi.fn(async () => {
      if (run.mock.calls.length === 1) {
        await blocked;
      }
    });
    runner = createCatchUpRunner(run);

    const first = runner.catchUp();
    await flush();
    expect(run).toHaveBeenCalledTimes(1);

    // While the first catch-up is running, further requests coalesce into it.
    const second = runner.catchUp();
    const third = runner.catchUp();
    expect(second).toBe(first);
    expect(third).toBe(first);

    gate();
    await first;
    expect(run).toHaveBeenCalledTimes(1);

    // After settling, a fresh catch-up request runs again.
    await runner.catchUp();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('serializes live-fact runs so processor runs never interleave', async () => {
    let active = 0;
    let maxActive = 0;
    const task = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    };
    runner = createCatchUpRunner(async () => {});

    await Promise.all([
      runner.enqueue(task),
      runner.enqueue(task),
      runner.enqueue(task),
    ]);

    expect(maxActive).toBe(1);
  });

  it('observes run rejections (no unhandled rejection) and keeps the chain going', async () => {
    const error = vi.fn();
    const order: string[] = [];
    runner = createCatchUpRunner(
      async () => {
        order.push('bad');
        throw new Error('boom');
      },
      { error }
    );

    // Must resolve, not reject.
    await runner.catchUp();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('boom'));

    const task = vi.fn(async () => {
      order.push('good');
    });
    await runner.enqueue(task);
    expect(task).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['bad', 'good']);
  });

  it('refuses new enqueues after abort', async () => {
    const controller = new AbortController();
    const run = vi.fn(async () => {});
    runner = createCatchUpRunner(run, { abortSignal: controller.signal });
    controller.abort();

    await runner.catchUp();
    const task = vi.fn(async () => {});
    await runner.enqueue(task);

    expect(run).not.toHaveBeenCalled();
    expect(task).not.toHaveBeenCalled();
  });
});

describe('parseForeignsSnapshot', () => {
  it('accepts an empty snapshot (no pending invites)', () => {
    expect(parseForeignsSnapshot({})).toEqual({});
  });

  it('throws on shapes that mean the snapshot was not read', () => {
    for (const raw of [null, undefined, [], 'nope', 42]) {
      expect(() => parseForeignsSnapshot(raw)).toThrow(
        /Malformed foreigns snapshot/
      );
    }
  });
});
