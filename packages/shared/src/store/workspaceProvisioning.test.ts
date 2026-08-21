import {
  ChannelContentConfiguration,
  StructuredChannelDescriptionPayload,
} from '@tloncorp/api';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as db from '../db';
import type { DeclarePlaceViewsDeps } from './workspaceProvisioning';
import {
  DEFAULT_STARTER_KIT_ID,
  decideResume,
  declareKitPlaceViews,
  ensureWorkspaceAgentSeated,
  provisionWorkspace,
  resumeWorkspaceProvisioning,
  startWorkspaceProvisioning,
  workspaceGroupName,
} from './workspaceProvisioning';

const OUR = '~sampel-palnet';
const NAME = 'meal-plan-abc123';
const GROUP = `${OUR}/${NAME}`;
const BOT = '~ridlur-figbud-sampel-palnet';

// The storage item's own durability is AsyncStorage's, and it does not write in
// node. What matters here is the ordering and the transitions, so the item is
// stood in for with an in-memory equivalent that honours the same functional-
// updater contract.
let stored: db.WorkspaceProvisioningState;

function seed(state: Partial<db.WorkspaceProvisioningState> = {}) {
  stored = {
    status: 'idle',
    kitId: null,
    name: null,
    groupId: null,
    ...state,
  };
}

beforeEach(() => {
  seed();
  vi.spyOn(db.workspaceProvisioning, 'getValue').mockImplementation(
    async () => stored
  );
  vi.spyOn(db.workspaceProvisioning, 'setValue').mockImplementation(
    async (next) => {
      stored = next instanceof Function ? next(stored) : next;
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

type Deps = NonNullable<Parameters<typeof provisionWorkspace>[1]>;
type TestDeps = Deps & {
  install: Mock;
  installs: Mock;
  seatAgent: Mock;
};

type Overrides = {
  install?: Mock;
  installs?: Mock;
  seatAgent?: Mock;
  agent?: Mock;
};

function deps(overrides: Overrides = {}): TestDeps {
  return {
    install: overrides.install ?? vi.fn(async () => undefined),
    installs: overrides.installs ?? vi.fn(async () => ({})),
    seatAgent: overrides.seatAgent ?? vi.fn(async () => undefined),
    kit: vi.fn(async () => null),
    currentUserId: () => OUR,
    name: NAME,
  } as unknown as TestDeps;
}

// ---------------------------------------------------------------------------

describe('naming', () => {
  // `%kits` asserts `((sane %tas) name)`, so a name that is not a valid term
  // fails the poke rather than the validation.
  test('produces a valid urbit term', () => {
    for (let i = 0; i < 50; i++) {
      expect(workspaceGroupName('meal-plan')).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  test('is unique across calls, so provisioning twice cannot self-collide', () => {
    const names = new Set(
      Array.from({ length: 50 }, () => workspaceGroupName('blank'))
    );
    expect(names.size).toBeGreaterThan(45);
  });
});

// ---------------------------------------------------------------------------

describe('the happy path', () => {
  // AC #1, the part this layer owns: one install poke for the recorded kit,
  // and the agent seated before the workspace is called done.
  test('installs the kit and seats the agent', async () => {
    const d = deps();
    const groupId = await provisionWorkspace('meal-plan', d);

    expect(groupId).toBe(GROUP);
    expect(d.install).toHaveBeenCalledTimes(1);
    expect(d.install).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meal-plan', name: NAME })
    );
    expect(d.seatAgent).toHaveBeenCalledWith(GROUP);
    expect(stored).toMatchObject({
      status: 'done',
      kitId: 'meal-plan',
      name: NAME,
      groupId: GROUP,
    });
  });

  // The ordering the whole recovery story rests on. If the poke went first and
  // the process died, a relaunch would have no name to check the ledger with,
  // and could only guess between "already installed" and "never started".
  test('records the name durably before poking', async () => {
    const seen: string[] = [];
    const d = deps({
      install: vi.fn(async () => {
        seen.push(`install:${stored.status}:${stored.name}`);
      }),
    });
    await provisionWorkspace('meal-plan', d);

    expect(seen).toEqual([`install:running:${NAME}`]);
  });

  // TASK-32. %kits writes `agents` from this parameter, and the harness gates
  // its setup run on it — so passing the wrong ship builds a correct workspace
  // that no agent will ever claim. Asserted on the exact value, not
  // objectContaining, because the bug was a *missing* key.
  test('names the resolved agent ship on the install', async () => {
    const d = deps();
    d.agent = vi.fn(async () => ({
      botShipId: BOT,
      hostedShipId: OUR,
      moon: 'ridlur-figbud',
    }));

    await provisionWorkspace('meal-plan', d);

    expect(d.install.mock.calls[0][0].agent).toBe(BOT);
  });

  // Null, not the installer's ship: %kits falls back to `our` itself, and
  // spelling it here would hide which side owns the default.
  test('sends null when no agent can be resolved', async () => {
    const d = deps();
    d.agent = vi.fn(async () => null);

    await provisionWorkspace('meal-plan', d);

    expect(d.install.mock.calls[0][0].agent).toBeNull();
  });

  // The resolve has to happen before the poke: %kits writes the descriptor in
  // the same event as the install, so a later correction would race its blob
  // write.
  test('resolves the agent before poking the install', async () => {
    const order: string[] = [];
    const d = deps({
      install: vi.fn(async () => {
        order.push('install');
      }),
    });
    d.agent = vi.fn(async () => {
      order.push('resolve');
      return null;
    });

    await provisionWorkspace('meal-plan', d);

    expect(order).toEqual(['resolve', 'install']);
  });

  test('a user who picked no starter gets the blank kit', async () => {
    const d = deps();
    startWorkspaceProvisioning(undefined, d);
    await vi.waitFor(() => expect(d.install).toHaveBeenCalled());

    expect(d.install).toHaveBeenCalledWith(
      expect.objectContaining({ id: DEFAULT_STARTER_KIT_ID })
    );
  });
});

// ---------------------------------------------------------------------------

describe('not blocking the interstitials (AC #2)', () => {
  // The property, stated directly: the fire-and-forget entry point returns
  // before the install has been poked, so a caller cannot accidentally await it
  // and stall a pane transition.
  test('returns before the install is poked', () => {
    let poked = false;
    const d = deps({
      install: vi.fn(async () => {
        poked = true;
      }),
    });

    startWorkspaceProvisioning('meal-plan', d);

    expect(poked).toBe(false);
  });

  test('returns undefined, so awaiting it is a no-op rather than a wait', () => {
    expect(startWorkspaceProvisioning('meal-plan', deps())).toBeUndefined();
  });

  // A failing install must not surface as an unhandled rejection during
  // onboarding — the durable state is how anyone finds out.
  test('a failure does not reject at the call site', async () => {
    const d = deps({
      install: vi.fn(async () => {
        throw new Error('ship unreachable');
      }),
    });

    expect(() => startWorkspaceProvisioning('meal-plan', d)).not.toThrow();
    await vi.waitFor(() => expect(stored.status).toBe('failed'));
  });
});

// ---------------------------------------------------------------------------

describe('decideResume', () => {
  const running = {
    status: 'running' as const,
    kitId: 'meal-plan',
    name: NAME,
    groupId: GROUP,
  };

  test('does nothing when provisioning never started', () => {
    expect(
      decideResume({
        state: { status: 'idle', kitId: null, name: null, groupId: null },
        installed: false,
      })
    ).toMatchObject({ kind: 'nothing' });
  });

  test('does nothing when provisioning already finished', () => {
    expect(
      decideResume({ state: { ...running, status: 'done' }, installed: true })
    ).toMatchObject({ kind: 'nothing' });
  });

  test('finishes when the install landed', () => {
    expect(decideResume({ state: running, installed: true })).toEqual({
      kind: 'finish',
    });
  });

  test('restarts when the install never landed', () => {
    expect(decideResume({ state: running, installed: false })).toEqual({
      kind: 'restart',
    });
  });

  // A failed attempt and an interrupted one recover identically: both ask the
  // ledger, because both may or may not have got the install in.
  test('recovers a failed attempt the same way as an interrupted one', () => {
    const failed = { ...running, status: 'failed' as const };
    expect(decideResume({ state: failed, installed: true })).toEqual({
      kind: 'finish',
    });
    expect(decideResume({ state: failed, installed: false })).toEqual({
      kind: 'restart',
    });
  });

  // The one case where doing nothing is strictly better than trying. Without a
  // name there is no flag to check, so a re-poke would mint a *second*
  // workspace — the single outcome AC #3 rules out.
  test('refuses to act on a record with no name', () => {
    expect(
      decideResume({ state: { ...running, name: null }, installed: false })
    ).toMatchObject({ kind: 'nothing' });
    expect(
      decideResume({ state: { ...running, kitId: null }, installed: false })
    ).toMatchObject({ kind: 'nothing' });
  });
});

// ---------------------------------------------------------------------------

describe('resuming after the app was killed (AC #3)', () => {
  test('finishes the tail when the install had landed', async () => {
    seed({ status: 'running', kitId: 'meal-plan', name: NAME, groupId: GROUP });
    const d = deps({ installs: vi.fn(async () => ({ [GROUP]: {} })) });

    await expect(resumeWorkspaceProvisioning(d)).resolves.toEqual({
      kind: 'finish',
    });
    expect(d.install).not.toHaveBeenCalled();
    expect(d.seatAgent).toHaveBeenCalledWith(GROUP);
    expect(stored.status).toBe('done');
  });

  // Re-poking is safe precisely because the flag is absent from the ledger:
  // `%kits` would have nacked otherwise.
  test('re-pokes the install when it never landed, reusing the same name', async () => {
    seed({ status: 'running', kitId: 'meal-plan', name: NAME, groupId: GROUP });
    const d = deps();

    await expect(resumeWorkspaceProvisioning(d)).resolves.toEqual({
      kind: 'restart',
    });
    expect(d.install).toHaveBeenCalledTimes(1);
    expect(d.install).toHaveBeenCalledWith(
      expect.objectContaining({ name: NAME })
    );
    expect(stored).toMatchObject({
      status: 'done',
      name: NAME,
      groupId: GROUP,
    });
  });

  test('does nothing for a workspace already provisioned', async () => {
    seed({ status: 'done', kitId: 'meal-plan', name: NAME, groupId: GROUP });
    const d = deps();

    await resumeWorkspaceProvisioning(d);

    expect(d.installs).not.toHaveBeenCalled();
    expect(d.install).not.toHaveBeenCalled();
  });

  test('does nothing when provisioning never started', async () => {
    const d = deps();
    await resumeWorkspaceProvisioning(d);
    expect(d.install).not.toHaveBeenCalled();
  });

  // "Cannot reach the ship" is not "the install never happened". Recording a
  // failure here would ask the user to recover from a network blip, and
  // re-poking would risk a duplicate.
  test('leaves the state alone when the ledger cannot be read', async () => {
    seed({ status: 'running', kitId: 'meal-plan', name: NAME, groupId: GROUP });
    const d = deps({
      installs: vi.fn(async () => {
        throw new Error('offline');
      }),
    });

    await expect(resumeWorkspaceProvisioning(d)).resolves.toMatchObject({
      kind: 'nothing',
    });
    expect(d.install).not.toHaveBeenCalled();
    expect(stored.status).toBe('running');
  });

  // AC #3's "without duplicates", through the path a relaunch actually takes:
  // whatever the interruption, exactly one install is ever poked for one
  // recorded name.
  test('two resumes after a landed install poke no installs at all', async () => {
    seed({ status: 'running', kitId: 'meal-plan', name: NAME, groupId: GROUP });
    const d = deps({ installs: vi.fn(async () => ({ [GROUP]: {} })) });

    await resumeWorkspaceProvisioning(d);
    await resumeWorkspaceProvisioning(d);

    expect(d.install).not.toHaveBeenCalled();
  });

  test('a second start after a completed one does not provision again', async () => {
    const d = deps();
    await provisionWorkspace('meal-plan', d);
    await provisionWorkspace('meal-plan', d);

    expect(d.install).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------

describe('failing recoverably (AC #5)', () => {
  test('a failed install lands in failed, not done', async () => {
    const d = deps({
      install: vi.fn(async () => {
        throw new Error('nacked');
      }),
    });

    await expect(provisionWorkspace('meal-plan', d)).rejects.toThrow('nacked');
    expect(stored).toMatchObject({ status: 'failed', error: 'nacked' });
  });

  // The distinction that makes the state recoverable: `failed` and `running`
  // are different, so a reader can tell "retry this" from "still going".
  test('a failure is distinguishable from work still in flight', async () => {
    let release: (() => void) | undefined;
    const d = deps({
      install: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          })
      ),
    });

    const running = provisionWorkspace('meal-plan', d);
    await vi.waitFor(() => expect(stored.status).toBe('running'));
    release?.();
    await running;
    expect(stored.status).toBe('done');
  });

  // Seating happens after the install, so this is the half-configured case the
  // AC is really about: the group exists but the agent is not in it. It must
  // not be reported as ready.
  test('an unseated agent is a failure, not a ready workspace', async () => {
    const d = deps({
      seatAgent: vi.fn(async () => {
        throw new Error('agent never joined');
      }),
    });

    await expect(provisionWorkspace('meal-plan', d)).rejects.toThrow();
    expect(stored.status).toBe('failed');
  });

  // And it recovers: the install did land, so the next launch only has to
  // retry the part that failed.
  test('a failure at the seating step recovers by retrying only that step', async () => {
    seed({ status: 'failed', kitId: 'meal-plan', name: NAME, groupId: GROUP });
    const d = deps({ installs: vi.fn(async () => ({ [GROUP]: {} })) });

    await resumeWorkspaceProvisioning(d);

    expect(d.install).not.toHaveBeenCalled();
    expect(d.seatAgent).toHaveBeenCalledWith(GROUP);
    expect(stored).toMatchObject({ status: 'done', error: undefined });
  });
});

// ---------------------------------------------------------------------------

describe('seating the agent', () => {
  function group(
    members: {
      contactId: string;
      status?: string;
      roles?: { roleId: string }[];
    }[]
  ) {
    return { members };
  }

  const agent = async () => ({
    botShipId: BOT,
    hostedShipId: OUR,
    moon: 'ridlur-figbud',
  });

  // Every seating run sends the invite; tests that don't care assert nothing
  // about it but must stub it so no real client call is attempted.
  const inviteStub = () => vi.fn(async () => undefined);

  test('joins, then grants the role', async () => {
    const calls: string[] = [];
    let joined = false;
    await ensureWorkspaceAgentSeated(GROUP, {
      delays: [0, 0, 0],
      agent,
      invite: inviteStub(),
      group: async () =>
        group(joined ? [{ contactId: BOT, status: 'joined' }] : []),
      cordon: async () => {
        calls.push('cordon');
      },
      join: async () => {
        calls.push('join');
        joined = true;
      },
      role: async () => {
        calls.push('role');
      },
    });

    expect(calls).toEqual(['cordon', 'join', 'role']);
  });

  test('is satisfied by an agent that already has the role', async () => {
    const join = vi.fn();
    await ensureWorkspaceAgentSeated(GROUP, {
      delays: [0],
      agent,
      invite: inviteStub(),
      group: async () =>
        group([
          { contactId: BOT, status: 'joined', roles: [{ roleId: 'admin' }] },
        ]),
      cordon: join,
      join,
      role: join,
    });

    expect(join).not.toHaveBeenCalled();
  });

  // Provisioning seats the agent, and so does the launch reconcile. If both are
  // in flight they must not both be poking the same group.
  test('concurrent callers share one run', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const role = vi.fn(async () => undefined);
    const shared = {
      delays: [0],
      agent,
      invite: inviteStub(),
      group: async () => {
        await gate;
        return group([{ contactId: BOT, status: 'joined' }]);
      },
      cordon: async () => undefined,
      join: async () => undefined,
      role,
    };

    const first = ensureWorkspaceAgentSeated(GROUP, shared);
    const second = ensureWorkspaceAgentSeated(GROUP, shared);
    expect(second).toBe(first);
    release?.();
    await Promise.all([first, second]);

    expect(role).toHaveBeenCalledTimes(1);
  });

  // A late-joining agent is the case the branch's experience is worth having:
  // the first passes see no member at all, and the role still lands once it
  // shows up.
  test('grants the role to an agent that joins on a later pass', async () => {
    let passes = 0;
    const role = vi.fn(async () => undefined);
    await ensureWorkspaceAgentSeated(GROUP, {
      delays: [0, 0, 0, 0],
      agent,
      invite: inviteStub(),
      group: async () => {
        passes++;
        return group(passes >= 3 ? [{ contactId: BOT, status: 'joined' }] : []);
      },
      cordon: async () => undefined,
      join: async () => undefined,
      role,
    });

    expect(role).toHaveBeenCalledWith({
      groupId: GROUP,
      roleId: 'admin',
      ships: [BOT],
    });
  });

  // An invited-but-not-joined agent is not seated. Granting a role to a member
  // who never accepted would look like success and leave the workspace without
  // a working agent.
  test('an invited agent does not count as joined', async () => {
    const role = vi.fn(async () => undefined);
    await expect(
      ensureWorkspaceAgentSeated(GROUP, {
        delays: [0, 0],
        agent,
        invite: inviteStub(),
        group: async () => group([{ contactId: BOT, status: 'invited' }]),
        cordon: async () => undefined,
        join: async () => undefined,
        role,
      })
    ).rejects.toThrow(/Could not seat/);
    expect(role).not.toHaveBeenCalled();
  });

  // The invite is the primary seating mechanism: the agent's harness
  // auto-accepts invites from its owner, and accepting is what triggers its
  // kit reconcile. It must go out before membership polling starts.
  test('invites the agent before polling for membership', async () => {
    const order: string[] = [];
    await ensureWorkspaceAgentSeated(GROUP, {
      delays: [0],
      agent,
      invite: vi.fn(async () => {
        order.push('invite');
      }),
      group: async () => {
        order.push('poll');
        return group([
          { contactId: BOT, status: 'joined', roles: [{ roleId: 'admin' }] },
        ]);
      },
      cordon: async () => undefined,
      join: async () => undefined,
      role: async () => undefined,
    });

    expect(order[0]).toBe('invite');
    expect(order).toContain('poll');
  });

  // A directly-named agent (dev rig, self-hosted) has no hosted node, so the
  // hosting-specific cordon/join must not fire — the invite alone seats it.
  test('skips the hosted push for a directly-named agent', async () => {
    const cordon = vi.fn(async () => undefined);
    const join = vi.fn(async () => undefined);
    const invite = vi.fn(async () => undefined);
    await expect(
      ensureWorkspaceAgentSeated(GROUP, {
        delays: [0, 0],
        agent: async () => ({
          botShipId: BOT,
          hostedShipId: null,
          moon: null,
        }),
        invite,
        group: async () => group([]),
        cordon,
        join,
        role: async () => undefined,
      })
    ).rejects.toThrow(/Could not seat/);

    expect(invite).toHaveBeenCalledWith({ groupId: GROUP, contactIds: [BOT] });
    expect(cordon).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
  });

  // A self-hosted or dev node has no hosted agent to seat. The workspace is
  // still a workspace, so this is not a provisioning failure.
  test('a node with no hosted agent provisions without one', async () => {
    const join = vi.fn();
    await expect(
      ensureWorkspaceAgentSeated(GROUP, {
        delays: [0],
        agent: async () => null,
        cordon: join,
        join,
        role: join,
      })
    ).resolves.toBeUndefined();
    expect(join).not.toHaveBeenCalled();
  });
});

describe('declaring place views', () => {
  const LISTING = {
    added: 123,
    section: 'default',
    readers: [],
    join: false,
    meta: {
      title: 'Kitchen',
      description: 'Where the week gets planned and argued about',
      image: '',
      cover: '',
    },
  };

  function makeDeps(overrides: Partial<DeclarePlaceViewsDeps> = {}) {
    const updateChannel = vi.fn().mockResolvedValue(undefined);
    const deps: DeclarePlaceViewsDeps = {
      updateChannel,
      installs: async () => ({
        [GROUP]: {
          places: {
            kitchen: `chat/${OUR}/kitchen-${NAME}`,
            plans: `notes/${OUR}/plans-${NAME}`,
          },
        },
      }),
      getChannelListing: async () => ({
        ...LISTING,
        meta: { ...LISTING.meta },
      }),
      ...overrides,
    };
    return { deps, updateChannel };
  }

  test('declares the pinned-surface view on chat places only', async () => {
    const { deps, updateChannel } = makeDeps();
    await declareKitPlaceViews(GROUP, deps);
    expect(updateChannel).toHaveBeenCalledTimes(1);
    const call = updateChannel.mock.calls[0][0];
    expect(call.channelId).toBe(`chat/${OUR}/kitchen-${NAME}`);
    const decoded = StructuredChannelDescriptionPayload.decode(
      call.channel.meta.description
    );
    expect(
      ChannelContentConfiguration.defaultPostCollectionRenderer(
        decoded.channelContentConfiguration!
      ).id
    ).toBe('tlon.r0.collection.pinnedSurface');
    // The human-facing description and the rest of the listing survive.
    expect(decoded.description).toBe(LISTING.meta.description);
    expect(call.channel.meta.title).toBe('Kitchen');
    expect(call.channel.section).toBe('default');
    expect(call.channel.added).toBe(123);
  });

  test('is idempotent: an already-declared place is left alone', async () => {
    const declared = StructuredChannelDescriptionPayload.encode({
      description: 'already set up',
      channelContentConfiguration: {
        draftInput: 'tlon.r0.input.chat',
        defaultPostContentRenderer: 'tlon.r0.content.chat',
        defaultPostCollectionRenderer: 'tlon.r0.collection.pinnedSurface',
      },
    });
    const { deps, updateChannel } = makeDeps({
      getChannelListing: async () => ({
        ...LISTING,
        meta: { ...LISTING.meta, description: declared! },
      }),
    });
    await declareKitPlaceViews(GROUP, deps);
    expect(updateChannel).not.toHaveBeenCalled();
  });

  test('no install for the group is a no-op', async () => {
    const { deps, updateChannel } = makeDeps({ installs: async () => ({}) });
    await declareKitPlaceViews(GROUP, deps);
    expect(updateChannel).not.toHaveBeenCalled();
  });

  test('a listing the host cannot serve yet is skipped, not fatal', async () => {
    const { deps, updateChannel } = makeDeps({
      getChannelListing: async () => null,
    });
    await expect(declareKitPlaceViews(GROUP, deps)).resolves.toBeUndefined();
    expect(updateChannel).not.toHaveBeenCalled();
  });
});
