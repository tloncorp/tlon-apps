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
import type { GroupChannelV7 } from '@tloncorp/api/urbit';
import { useSyncExternalStore } from 'react';

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
// Watching a run
// ---------------------------------------------------------------------------

export type WorkspaceSetupStepId = 'create' | 'agent' | 'views';

export type WorkspaceSetupStep = {
  id: WorkspaceSetupStepId;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

/**
 * The live view of a provisioning run, for UIs that want to show the user
 * what "setting up your workspace" is actually doing.
 *
 * In-memory on purpose: the durable `workspaceProvisioning` item answers
 * "did it land?" across restarts, while this answers "what is it doing right
 * now?" for the session that started the run. A relaunch mid-run resumes with
 * coarse durable state, which is fine — the steps only matter while someone
 * is watching them happen.
 */
export type WorkspaceSetupProgress = {
  status: 'idle' | 'running' | 'done' | 'failed';
  groupId: string | null;
  steps: WorkspaceSetupStep[];
};

function initialSetupSteps(): WorkspaceSetupStep[] {
  return [
    { id: 'create', title: 'Creating your workspace', status: 'pending' },
    { id: 'agent', title: 'Adding your agent', status: 'pending' },
    { id: 'views', title: 'Preparing the app view', status: 'pending' },
  ];
}

let setupProgress: WorkspaceSetupProgress = {
  status: 'idle',
  groupId: null,
  steps: initialSetupSteps(),
};

const setupProgressListeners = new Set<() => void>();

function publishSetupProgress(next: WorkspaceSetupProgress): void {
  setupProgress = next;
  setupProgressListeners.forEach((listener) => listener());
}

function stepSetupProgress(
  stepId: WorkspaceSetupStepId,
  status: WorkspaceSetupStep['status']
): void {
  publishSetupProgress({
    ...setupProgress,
    steps: setupProgress.steps.map((step) =>
      step.id === stepId ? { ...step, status } : step
    ),
  });
}

export function getWorkspaceSetupProgress(): WorkspaceSetupProgress {
  return setupProgress;
}

export function subscribeWorkspaceSetupProgress(
  listener: () => void
): () => void {
  setupProgressListeners.add(listener);
  return () => setupProgressListeners.delete(listener);
}

export function useWorkspaceSetupProgress(): WorkspaceSetupProgress {
  return useSyncExternalStore(
    subscribeWorkspaceSetupProgress,
    getWorkspaceSetupProgress,
    getWorkspaceSetupProgress
  );
}

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
  /** Declares channel views on the kit's places; failures are non-fatal. */
  declarePlaceViews?: (groupId: string) => Promise<unknown>;
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
  /**
   * Set by an explicit in-app "create a workspace" action. The duplicate guard
   * exists to stop onboarding from provisioning twice; a user who already has
   * a finished workspace and asks for another one is not a duplicate. Does not
   * bypass the guard for a run that is still in flight.
   */
  fresh?: boolean;
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
    (existing.status === 'running' ||
      (existing.status === 'done' && !deps.fresh))
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

  publishSetupProgress({
    status: 'running',
    groupId,
    steps: initialSetupSteps().map((step) =>
      step.id === 'create' ? { ...step, status: 'running' } : step
    ),
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
    stepSetupProgress('create', 'completed');
    stepSetupProgress('agent', 'running');
    await seatAgent(groupId);
    stepSetupProgress('agent', 'completed');
    stepSetupProgress('views', 'running');
    // Best-effort, after the workspace is functionally complete: a chat place
    // without the bifurcated view is still a working workspace, so a failure
    // here must not fail provisioning.
    try {
      await (deps.declarePlaceViews ?? declareKitPlaceViews)(groupId);
      stepSetupProgress('views', 'completed');
    } catch (error) {
      stepSetupProgress('views', 'failed');
      logger.trackError('Workspace place-view declaration failed', {
        error,
        groupId,
      });
    }
    await db.workspaceProvisioning.setValue((current) => ({
      ...current,
      status: 'done',
    }));
    publishSetupProgress({ ...setupProgress, status: 'done' });
    logger.trackEvent('Workspace Provisioned', { kitId, groupId });
    return groupId;
  } catch (error) {
    await db.workspaceProvisioning.setValue((current) => ({
      ...current,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    publishSetupProgress({
      status: 'failed',
      groupId,
      steps: setupProgress.steps.map((step) =>
        step.status === 'running' ? { ...step, status: 'failed' } : step
      ),
    });
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
// Declaring place views
// ---------------------------------------------------------------------------

export type DeclarePlaceViewsDeps = {
  installs?: () => Promise<Record<string, { places: Record<string, string> }>>;
  getChannelListing?: (
    groupId: string,
    channelId: string
  ) => Promise<GroupChannelV7 | null>;
  updateChannel?: (params: {
    groupId: string;
    channelId: string;
    channel: GroupChannelV7;
  }) => Promise<unknown>;
};

/**
 * Declare the bifurcated pinned-surface view on the kit's chat places, so the
 * agent's interactive card renders as a mini-app above the flowing chat.
 *
 * The declaration is `channelContentConfiguration` inside the channel
 * listing's structured description, which replicates with the group to every
 * member; clients without the renderer degrade to the plain post list per
 * docs/tlon-apps/channel-views.md. The listing is read raw and resubmitted
 * whole because the groups edit replaces it — only the description changes.
 * Idempotent: a place already declaring the view is left alone, so the
 * resume path can re-run this safely.
 */
export async function declareKitPlaceViews(
  groupId: string,
  deps: DeclarePlaceViewsDeps = {}
): Promise<void> {
  const getInstalls = deps.installs ?? api.getInstalls;
  const getListing = deps.getChannelListing ?? api.getGroupChannelListing;
  const update = deps.updateChannel ?? api.updateChannel;

  const install = (await getInstalls())[groupId];
  if (!install) {
    return;
  }
  for (const nest of Object.values(install.places)) {
    if (!nest.startsWith('chat/')) {
      continue;
    }
    const listing = await getListing(groupId, nest);
    if (!listing) {
      continue;
    }
    const decoded = api.StructuredChannelDescriptionPayload.decode(
      listing.meta.description
    );
    const declared = decoded.channelContentConfiguration
      ? api.ChannelContentConfiguration.defaultPostCollectionRenderer(
          decoded.channelContentConfiguration
        ).id
      : null;
    if (declared === api.CollectionRendererId.pinnedSurface) {
      continue;
    }
    const description = api.StructuredChannelDescriptionPayload.encode({
      description: decoded.description,
      channelContentConfiguration: {
        draftInput: api.DraftInputId.chat,
        defaultPostContentRenderer: api.PostContentRendererId.chat,
        defaultPostCollectionRenderer: api.CollectionRendererId.pinnedSurface,
      },
    });
    await update({
      groupId,
      channelId: nest,
      channel: {
        ...listing,
        meta: { ...listing.meta, description: description ?? '' },
      },
    });
  }
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
  invite?: (params: {
    groupId: string;
    contactIds: string[];
  }) => Promise<unknown>;
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
  const invite = deps.invite ?? api.inviteGroupMembers;
  const cordon = deps.cordon ?? api.addTlawnToCordon;
  const join = deps.join ?? api.joinTlawnGroup;
  const role = deps.role ?? api.addMembersToRole;
  const resolve = deps.agent ?? resolveWorkspaceAgent;

  const agent = await resolve();
  if (!agent) {
    // No agent to seat. The workspace is still a workspace, and an agent can
    // be seated later, so this is not a failure.
    logger.trackEvent('Workspace provisioned without an agent', { groupId });
    return;
  }

  // The invite is the primary mechanism everywhere: the agent's harness
  // auto-accepts invites from its owner, and accepting is what triggers its
  // kit reconcile. The hosted cordon/join below are the hosting-specific
  // push half, and only exist when the agent was resolved through hosting.
  try {
    await invite({ groupId, contactIds: [agent.botShipId] });
  } catch (error) {
    // Already invited or already a member nacks; membership below decides.
    logger.trackError('Workspace agent invite failed', { error, groupId });
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
      if (agent.hostedShipId && agent.moon) {
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
  /** Null when the agent was named directly rather than resolved through
   *  hosting — a dev rig, or any future self-hosted agent. Seating then
   *  relies on the plain group invite alone. */
  hostedShipId: string | null;
  moon: string | null;
} | null;

// A directly-named agent ship, for environments with no hosting API to
// resolve one from (local fake ships; eventually self-hosted agents). Set
// once at app startup from build config; null means "resolve via hosting".
let devAgentShip: string | null = null;

export function setDevAgentShip(ship: string | null): void {
  devAgentShip = ship?.trim() ? api.preSig(ship.trim()) : null;
}

/** Resolve the hosting API's moon prefix to one unambiguous full ship. */
export async function resolveWorkspaceAgent(): Promise<ResolvedAgent> {
  if (devAgentShip) {
    return { botShipId: devAgentShip, hostedShipId: null, moon: null };
  }
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
