import {
  getGroup,
  joinGroup,
  poke,
  preSig,
  requestGroupInvitation,
  scry,
  subscribeOnce,
  toClientGroupFromForeign,
} from '@tloncorp/api';
import { parseInviteDeepLink } from '@tloncorp/api/client/deeplinks';
// The request registry by subpath: only its plain-data entries are read here.
// Its request helpers resolve to a separate, unconfigured client instance.
import { groups as groupRequests } from '@tloncorp/api/client/requests/groups';
import {
  type Foreign,
  type GroupPreview,
  extractGroupPrivacy,
} from '@tloncorp/api/urbit';

import { ensureClient, getCredentialResolution } from './api-client';
import { errorMessage, isNotFoundError } from './commands/command';
import {
  type GroupPrivacy,
  type GroupStateRead,
  type JoinInviteDeps,
  run,
} from './commands/join-invite';
import {
  type InviteProviderClient,
  createInviteProviderClient,
  resolveInviteProviderOrigin,
} from './invite-provider';
import { createProcessCommandDeps, sleep } from './runtime-deps';

/** groups.ts helpers the invite flow reuses; groups.ts runs main() on load. */
export interface JoinInviteLocal {
  joinGroupById: (flag: string) => Promise<void>;
}

// Only a real 404 from the joined-group scry means "not a member"; anything
// else is a failed read and must not be mistaken for an answer.
async function isMember(flag: string): Promise<boolean> {
  try {
    const group = await getGroup(flag);
    return Boolean(group.currentUserIsMember);
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

const NO_RECORD = {
  member: false,
  haveInvite: false,
  haveRequestedInvite: false,
  privacy: null,
} as const;

// The per-flag record scry (groups.hoon `[%x ?(%v1 %v2) %foreigns ship=@
// name=@ ~]`) answers [~ ~] for a missing record, which eyre serves as a 404.
async function readForeign(flag: string): Promise<Foreign | null> {
  const [ship, name] = flag.split('/');
  try {
    return await scry<Foreign>({
      app: 'groups',
      path: `/v1/foreigns/${ship}/${name}`,
    });
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

// groups.ts's getForeignGroupState folds read failures into "no record",
// which would let a failed poll erase an earlier "requested" observation.
// Reads here report success or failure explicitly instead.
async function readForeignState(
  flag: string,
  actingShip: string
): Promise<GroupStateRead> {
  try {
    const foreign = await readForeign(flag);
    if (!foreign) return { ok: true, state: NO_RECORD };
    // The app's own projection for invites: revoked ones don't count. Its
    // privacy reads a preview-less record as secret, but the desk creates
    // such records itself (the first preview watch, or a host that never
    // answered one), so no preview means unknown here.
    const group = toClientGroupFromForeign(flag, foreign, actingShip);
    return {
      ok: true,
      state: {
        member: false,
        haveInvite: Boolean(group.haveInvite),
        haveRequestedInvite: Boolean(group.haveRequestedInvite),
        privacy: foreign.preview ? extractGroupPrivacy(foreign.preview) : null,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function readGroupState(
  flag: string,
  actingShip: string
): Promise<GroupStateRead> {
  try {
    if (await isMember(flag)) {
      return { ok: true, state: { ...NO_RECORD, member: true } };
    }
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  return readForeignState(flag, actingShip);
}

// Filled from the registry entry, so a path change there follows here.
function previewPath(flag: string): string {
  return groupRequests.gangPreview.path.replace(/\{[^}]+\}/, flag);
}

const GROUP_PRIVACIES: readonly unknown[] = ['public', 'private', 'secret'];

// extractGroupPrivacy reads an empty answer as secret and a shapeless one as
// public; either is unknown here, so the stored privacy stands.
function previewPrivacy(result: unknown): GroupPrivacy | null {
  if (!result || typeof result !== 'object') return null;
  const preview = result as Record<string, unknown>;
  if ('privacy' in preview) {
    return GROUP_PRIVACIES.includes(preview.privacy)
      ? (preview.privacy as GroupPrivacy)
      : null;
  }
  if (typeof preview.secret !== 'boolean') return null;
  return extractGroupPrivacy(result as GroupPreview);
}

// The desk answers a preview watch only when it has a preview, so the
// subscription can hang indefinitely. subscribeOnce arms its own timeout (and
// unsubscribes, tolerating failure) only once the channel PUT lands; the race
// covers a PUT that never does. The api's subscribeOnce never exposes the
// subscription id, so a watch whose PUT lands after the race is left to that
// internal timer to close. Any failure or late answer reads as unknown.
async function readPreviewPrivacy(
  flag: string,
  timeoutMs: number
): Promise<GroupPrivacy | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const preview = subscribeOnce<GroupPreview>(
    { app: groupRequests.gangPreview.agent, path: previewPath(flag) },
    timeoutMs
  ).then(
    (result) => previewPrivacy(result),
    () => null
  );
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([preview, expired]);
  } finally {
    clearTimeout(timer);
  }
}

export function createJoinInviteDeps(local: JoinInviteLocal): JoinInviteDeps {
  const actingShip = () => preSig(getCredentialResolution().config.ship);

  // Resolved on first use, after parsing and authentication, so a bad
  // TLON_INVITE_PROVIDER cannot fail an invocation that never fetches.
  let provider: InviteProviderClient | undefined;
  const getProvider = () =>
    (provider ??= createInviteProviderClient({
      origin: resolveInviteProviderOrigin(process.env),
    }));

  return {
    ...createProcessCommandDeps(),
    getResolvedShip: () => getCredentialResolution().config.ship,
    // Every request is a scry, an untracked poke, or its own subscribeOnce,
    // so no standing subscription is opened.
    authenticate: async () => {
      await ensureClient([]);
    },
    parseInviteLink: (input) => parseInviteDeepLink(input),
    joinExistingFlag: (flag) => local.joinGroupById(flag),
    fetchInviteMetadata: (token) => getProvider().getMetadata(token),
    biteInvite: (token, ship) => getProvider().bite(token, ship),
    getGroupState: (flag) => readGroupState(flag, actingShip()),
    getPreviewPrivacy: readPreviewPrivacy,
    joinGroup: async (flag) => {
      await joinGroup(flag);
    },
    requestInvite: async (flag) => {
      await requestGroupInvitation(flag);
    },
    // The same two pokes as the api's addContact, which the web app uses for
    // a personal inviter. That helper leaves the suggestion-hide poke's
    // rejection unhandled, so the pokes are sent here. Both are awaited (the
    // process exits as soon as the command returns); only the contact poke
    // decides the result, and a failed hide is reported and ignored.
    addContact: async (ship) => {
      const [hide, contact] = await Promise.allSettled([
        poke({ app: 'groups-ui', mark: 'ui-hide-contact', json: ship }),
        poke({
          app: 'contacts',
          mark: 'contact-action-1',
          json: { page: { kip: ship, contact: {} } },
        }),
      ]);
      if (hide.status === 'rejected') {
        process.stderr.write(
          `Could not hide ${ship} from contact suggestions (${errorMessage(hide.reason)}).\n`
        );
      }
      if (contact.status === 'rejected') throw contact.reason;
    },
    now: () => Date.now(),
    sleep,
    startTimer: (ms) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const expired = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });
      return { expired, cancel: () => clearTimeout(timer) };
    },
  };
}

export function runJoinInviteCommand(
  args: string[],
  local: JoinInviteLocal
): Promise<number> {
  return run(args, createJoinInviteDeps(local));
}
