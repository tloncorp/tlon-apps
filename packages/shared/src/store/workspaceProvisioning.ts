/**
 * Provisioning a workspace in the background while the user is on the
 * onboarding interstitials.
 *
 * PLAN.md describes provisioning as a lot of work: a secret group, membership
 * and permissions, a notes-backed artifact space, the agent seated, the kit
 * installed, the descriptor written. Almost all of it is one poke. `%kits`
 * `%install` creates the group `%private`, creates every place the manifest
 * declares (including the notes one), writes the descriptor into the group's
 * blob, and records the install ledger — in a single Gall event. So this module
 * is not a provisioner; it is the orchestration around one, doing the three
 * things the backend cannot do for itself:
 *
 *   1. run without blocking the UI,
 *   2. seat the agent, which is a separate ship and a multi-event dance,
 *   3. survive the app dying halfway.
 *
 * The ordering rule the whole thing rests on: **record the intent durably
 * before acting on it.** The group flag is `${our}/${name}`, so writing the
 * chosen name before poking means a relaunch can always ask the ship whether
 * the install landed, instead of guessing. Every step after that is idempotent,
 * so a resume can re-run the tail without checking what it already did.
 *
 * Duplicate protection is not ours: `%kits` asserts `?< (~(has by installs)
 * flag)`, so a second install for the same flag nacks. There is no client
 * bookkeeping that could get this wrong.
 */
import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';

import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('workspaceProvisioning', false);

/**
 * The kit a user who picked no starter gets.
 *
 * Not "no kit": TASK-8 defines a workspace as a group carrying a kit install,
 * so a kit-less group would not be a workspace and would get none of the
 * app-shaped treatment. A deliberately empty kit keeps one definition instead
 * of two code paths.
 */
export const DEFAULT_STARTER_KIT_ID = 'blank';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// The decision, separated from the doing
// ---------------------------------------------------------------------------

export type ResumeDecision =
  /** Nothing to do. */
  | { kind: 'nothing'; reason: string }
  /** The install landed; run the steps that come after it. */
  | { kind: 'finish' }
  /** The install never landed; poke it again. */
  | { kind: 'restart' };

/**
 * What a relaunch should do, given the durable state and whether the ship's
 * install ledger actually carries the flag.
 *
 * Pure on purpose: this is the part of AC #3 worth testing exhaustively, and it
 * needs no ship to test.
 *
 * The ledger is the authority, not the group blob. `%kits` records the ledger
 * entry in the same event as the install and answers a scry immediately, while
 * the blob write is a card to `%groups` and the local group row trails behind
 * sync. Asking the slower of the two would make a completed install look
 * unfinished.
 */
export function decideResume(params: {
  state: db.WorkspaceProvisioningState;
  installed: boolean;
}): ResumeDecision {
  const { state, installed } = params;

  if (state.status === 'idle') {
    return { kind: 'nothing', reason: 'provisioning never started' };
  }
  if (state.status === 'done') {
    return { kind: 'nothing', reason: 'provisioning already complete' };
  }
  // Both fields are written in the same durable write as `running`, so their
  // absence means the record is corrupt rather than partial. Re-poking without
  // a name would create a *second* workspace, which is the one outcome AC #3
  // forbids — so refuse instead.
  if (!state.name || !state.kitId) {
    return { kind: 'nothing', reason: 'no recorded install to resume' };
  }
  return installed ? { kind: 'finish' } : { kind: 'restart' };
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

/**
 * A group name for a fresh install.
 *
 * `%kits` asserts `((sane %tas) name)`, so this has to be a valid term: the kit
 * id (already lowercase-and-hyphens) plus a short random suffix. The suffix is
 * there so a user who provisions twice does not collide with their own earlier
 * group and get a nack.
 */
export function workspaceGroupName(kitId: string): string {
  return `${kitId}-${randomSuffix()}`;
}

function randomSuffix(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(4));
    return Array.from(bytes)
      .map((byte) => byte.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 6);
  }
  return Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Starting
// ---------------------------------------------------------------------------

// Dependencies are declared as what this module reads and calls, not as
// `typeof api.thing`. The poke wrappers resolve to a request id nobody here
// looks at, and the ledger entries are only tested for presence, so mirroring
// their full signatures would make every test fake carry detail the code
// ignores.
export type ProvisionDeps = {
  install?: (params: {
    id: string;
    name: string;
    meta: api.KitInstallMeta;
    agent: string | null;
  }) => Promise<unknown>;
  installs?: () => Promise<Record<string, unknown>>;
  seatAgent?: (groupId: string) => Promise<unknown>;
  /** Resolves the ship whose harness will execute the kit. */
  agent?: () => Promise<ResolvedAgent>;
  currentUserId?: () => string;
  name?: string;
  kit?: typeof api.getKit;
  /**
   * Set by the resume path, which has already asked the ledger and knows the
   * install did not land. Without it the duplicate guard below (whose job is to
   * stop a *second* workspace) would also block the legitimate retry of a first
   * one that never happened.
   */
  resume?: boolean;
};

/**
 * Begin provisioning. Returns once the workspace is usable, or throws.
 *
 * Callers on the onboarding path should NOT await this — that is how AC #2's
 * "does not block screen transitions" is satisfied by construction rather than
 * by remembering to be careful. `startWorkspaceProvisioning` exists for that
 * caller.
 */
export async function provisionWorkspace(
  kitId: string,
  deps: ProvisionDeps = {}
): Promise<string> {
  const install = deps.install ?? api.installKit;
  const seatAgent = deps.seatAgent ?? ensureWorkspaceAgentSeated;
  const resolveAgent = deps.agent ?? resolveWorkspaceAgent;
  const currentUserId = deps.currentUserId ?? (() => api.getCurrentUserId());

  const existing = await db.workspaceProvisioning.getValue();
  if (
    !deps.resume &&
    (existing.status === 'running' || existing.status === 'done')
  ) {
    // A second call is a duplicate, not a retry. Recovery goes through
    // `resumeWorkspaceProvisioning`, which knows how to tell the two apart.
    if (existing.groupId) {
      return existing.groupId;
    }
  }

  const name = deps.name ?? workspaceGroupName(kitId);
  const groupId = `${currentUserId()}/${name}`;

  // Durable before the poke, always. If the process dies between this write and
  // the poke landing, a relaunch can ask the ledger which side of it we were
  // on; if it died before the write, nothing happened at all.
  await db.workspaceProvisioning.setValue({
    status: 'running',
    kitId,
    name,
    groupId,
  });

  try {
    // Resolved before the install, not after: %kits writes the descriptor in
    // the same event, and `agents` is what gates the harness's setup run. Get
    // it wrong here and the workspace is built correctly but no agent will
    // ever claim it.
    const agent = await resolveAgent();
    await install({
      id: kitId,
      name,
      meta: await workspaceMeta(kitId, deps.kit),
      agent: agent?.botShipId ?? null,
    });
    await seatAgent(groupId);
    await db.workspaceProvisioning.setValue((current) => ({
      ...current,
      status: 'done',
    }));
    logger.trackEvent('Workspace Provisioned', { kitId, groupId });
    return groupId;
  } catch (error) {
    await db.workspaceProvisioning.setValue((current) => ({
      ...current,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    logger.trackError('Workspace provisioning failed', {
      error,
      kitId,
      groupId,
    });
    throw error;
  }
}

/**
 * Fire provisioning and return immediately.
 *
 * The onboarding caller's entry point. Nothing awaits the result, so a slow
 * ship cannot hold up a pane transition; the durable state is how anyone finds
 * out how it went.
 */
export function startWorkspaceProvisioning(
  kitId: string | undefined,
  deps: ProvisionDeps = {}
): void {
  provisionWorkspace(kitId ?? DEFAULT_STARTER_KIT_ID, deps).catch(() => {
    // Already recorded as `failed` and logged inside `provisionWorkspace`.
    // Swallowed here so an unhandled rejection cannot surface as a crash
    // during onboarding.
  });
}

// ---------------------------------------------------------------------------
// Resuming
// ---------------------------------------------------------------------------

/**
 * Reconcile provisioning at launch. Safe to call unconditionally.
 *
 * AC #3 and #4: the app may have been killed or backgrounded at any point. Both
 * outcomes reduce to the same question — did the install land? — because every
 * step after the install is idempotent.
 */
export async function resumeWorkspaceProvisioning(
  deps: ProvisionDeps = {}
): Promise<ResumeDecision> {
  const installs = deps.installs ?? api.getInstalls;
  const seatAgent = deps.seatAgent ?? ensureWorkspaceAgentSeated;

  const state = await db.workspaceProvisioning.getValue();
  if (state.status === 'idle' || state.status === 'done') {
    return decideResume({ state, installed: false });
  }

  let installed = false;
  try {
    const ledger = await installs();
    installed = Boolean(state.groupId && ledger[state.groupId]);
  } catch (error) {
    // An unreachable ship is not a failed install. Leaving the state alone
    // means the next launch tries again, which is better than recording a
    // failure the user would be asked to recover from.
    logger.trackError('Failed to read the kit install ledger', { error });
    return { kind: 'nothing', reason: 'could not reach the install ledger' };
  }

  const decision = decideResume({ state, installed });

  if (decision.kind === 'finish' && state.groupId) {
    try {
      await seatAgent(state.groupId);
      await db.workspaceProvisioning.setValue((current) => ({
        ...current,
        status: 'done',
        error: undefined,
      }));
    } catch (error) {
      await db.workspaceProvisioning.setValue((current) => ({
        ...current,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      }));
      logger.trackError('Failed to finish workspace provisioning', { error });
    }
  }

  if (decision.kind === 'restart' && state.kitId && state.name) {
    // The flag is absent from the ledger, so re-poking cannot nack on the
    // duplicate assert — this is a retry of something that demonstrably never
    // happened, reusing the same name so it stays one workspace.
    await provisionWorkspace(state.kitId, {
      ...deps,
      name: state.name,
      resume: true,
    });
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Seating the agent
// ---------------------------------------------------------------------------

const seating = new Map<string, Promise<void>>();

/** Only what seating reads off a group. */
type SeatableGroup = {
  members?:
    | {
        contactId: string;
        status?: string | null;
        roles?: { roleId: string }[] | null;
      }[]
    | null;
};

export type SeatAgentDeps = {
  delays?: number[];
  sleep?: (ms: number) => Promise<unknown>;
  group?: (groupId: string) => Promise<SeatableGroup>;
  cordon?: (
    hostedShipId: string,
    groupId: string,
    moon: string
  ) => Promise<unknown>;
  join?: (
    hostedShipId: string,
    groupId: string,
    moon: string
  ) => Promise<unknown>;
  role?: (params: {
    groupId: string;
    roleId: string;
    ships: string[];
  }) => Promise<unknown>;
  agent?: () => Promise<ResolvedAgent>;
};

/**
 * Seat the workspace's agent as a member, then give it a role.
 *
 * Concurrent callers share one run: provisioning calls this, and so does a
 * later reconcile, and the two must not both be poking the same group. Runs are
 * keyed by group id and dropped when they settle, so a genuine later retry
 * still starts a fresh attempt.
 */
export function ensureWorkspaceAgentSeated(
  groupId: string,
  deps: SeatAgentDeps = {}
): Promise<void> {
  const existing = seating.get(groupId);
  if (existing) {
    return existing;
  }
  const run = seatAgent(groupId, deps).finally(() => {
    seating.delete(groupId);
  });
  seating.set(groupId, run);
  return run;
}

async function seatAgent(groupId: string, deps: SeatAgentDeps): Promise<void> {
  // Escalating waits rather than a fixed interval: the join usually lands on
  // the first or second look, and the long tail is a ship under load.
  const delays = deps.delays ?? [0, 1_500, 3_000, 5_000, 15_000];
  const wait = deps.sleep ?? sleep;
  const group = deps.group ?? api.getGroup;
  const cordon = deps.cordon ?? api.addTlawnToCordon;
  const join = deps.join ?? api.joinTlawnGroup;
  const role = deps.role ?? api.addMembersToRole;
  const resolve = deps.agent ?? resolveWorkspaceAgent;

  const agent = await resolve();
  if (!agent) {
    // No hosted agent: a self-hosted or dev node. The workspace is still a
    // workspace, and an agent can be seated later, so this is not a failure.
    logger.trackEvent('Workspace provisioned without an agent', { groupId });
    return;
  }

  let lastError: unknown;
  for (const delay of delays) {
    if (delay) {
      await wait(delay);
    }

    let current: SeatableGroup | null = null;
    try {
      current = await group(groupId);
    } catch (error) {
      lastError = error;
      continue;
    }

    if (agentHasRole(current, agent.botShipId)) {
      return;
    }

    if (!agentHasJoined(current, agent.botShipId)) {
      try {
        await cordon(agent.hostedShipId, groupId, agent.moon);
      } catch (error) {
        // The moon may already be allowed; the join below is what decides.
        lastError = error;
      }
      try {
        await join(agent.hostedShipId, groupId, agent.moon);
      } catch (error) {
        lastError = error;
      }
      continue;
    }

    try {
      await role({ groupId, roleId: 'admin', ships: [agent.botShipId] });
      // The ack is the evidence. Looping to re-read the group instead would
      // make a successful grant depend on sync having caught up, and throw on
      // a workspace that is in fact correctly seated.
      return;
    } catch (error) {
      // A lost ack is ambiguous — the role may have landed anyway, so the next
      // pass re-reads the group rather than assuming either way.
      lastError = error;
    }
  }

  throw new Error(
    `Could not seat the workspace agent in ${groupId}${
      lastError instanceof Error ? `: ${lastError.message}` : ''
    }`
  );
}

type ResolvedAgent = {
  botShipId: string;
  hostedShipId: string;
  moon: string;
} | null;

/** Resolve the hosting API's moon prefix to one unambiguous full ship. */
export async function resolveWorkspaceAgent(): Promise<ResolvedAgent> {
  try {
    const [botEnabled, hostedShipId] = await Promise.all([
      db.hostingBotEnabled.getValue(),
      db.hostedUserNodeId.getValue(),
    ]);
    if (!botEnabled || !hostedShipId) {
      return null;
    }
    const moon = await api.getTlawnMoon(hostedShipId);
    if (!moon) {
      return null;
    }
    const host = desig(hostedShipId.trim());
    const prefix = desig(moon.trim());
    const full = prefix.endsWith(`-${host}`) ? prefix : `${prefix}-${host}`;
    return { botShipId: api.preSig(full), hostedShipId, moon };
  } catch (error) {
    logger.trackError('Failed to resolve the workspace agent', { error });
    return null;
  }
}

function agentHasJoined(group: SeatableGroup, botShipId: string): boolean {
  return Boolean(
    group.members?.some(
      (member) => member.contactId === botShipId && member.status !== 'invited'
    )
  );
}

function agentHasRole(group: SeatableGroup, botShipId: string): boolean {
  return Boolean(
    group.members?.some(
      (member) =>
        member.contactId === botShipId &&
        member.status !== 'invited' &&
        member.roles?.some((memberRole) => memberRole.roleId === 'admin')
    )
  );
}

/**
 * The group's title and description, taken from the kit's own manifest.
 *
 * `%kits` install does not read the manifest for this — it takes whatever meta
 * the action carries — so the client is the one that has to look it up. A kit
 * that is somehow missing from the library falls back to something neutral
 * rather than failing the install: an untitled workspace is recoverable, a
 * failed one is a dead end.
 */
async function workspaceMeta(
  kitId: string,
  fetchKit: typeof api.getKit = api.getKit
): Promise<api.KitInstallMeta> {
  const fallback = {
    title: 'Workspace',
    description: '',
    image: '',
    cover: '',
  };
  try {
    const kit = await fetchKit(kitId);
    if (!kit) {
      return fallback;
    }
    return {
      title: kit.manifest.name,
      description: kit.manifest.description,
      image: kit.manifest.image ?? '',
      cover: '',
    };
  } catch (error) {
    logger.trackError('Failed to read the kit manifest for install meta', {
      error,
      kitId,
    });
    return fallback;
  }
}
