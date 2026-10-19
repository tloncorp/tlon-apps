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
import {
  type Foreigns,
  type GroupPreview,
  extractGroupPrivacy,
} from '@tloncorp/api/urbit';

import { ensureClient, getCredentialResolution } from './api-client';
import { errorMessage } from './commands/command';
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
// else is a failed read and must not be mistaken for an answer. The api
// wraps a first-attempt failure in BadResponseError, but the retry after a
// 403 reauth rejects with the raw Response.
function isNotFound(error: unknown): boolean {
  if (error instanceof Response) return error.status === 404;
  return (
    error instanceof Error &&
    error.name === 'BadResponseError' &&
    (error as { status?: unknown }).status === 404
  );
}

async function isMember(flag: string): Promise<boolean> {
  try {
    const group = await getGroup(flag);
    return Boolean(group.currentUserIsMember);
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

// groups.ts's getForeignGroupState folds read failures into "no record",
// which would let a failed poll erase an earlier "requested" observation.
// Reads here report success or failure explicitly instead.
async function readGroupState(
  flag: string,
  actingShip: string
): Promise<GroupStateRead> {
  try {
    if (await isMember(flag)) {
      return {
        ok: true,
        state: {
          member: true,
          haveInvite: false,
          haveRequestedInvite: false,
          privacy: null,
        },
      };
    }
    const foreigns = await scry<Foreigns>({
      app: 'groups',
      path: '/v1/foreigns',
    });
    const foreign = foreigns?.[flag];
    if (!foreign) {
      return {
        ok: true,
        state: {
          member: false,
          haveInvite: false,
          haveRequestedInvite: false,
          privacy: null,
        },
      };
    }
    // The app's own projection: revoked invites don't count, and a record
    // without a preview reads as secret.
    const group = toClientGroupFromForeign(flag, foreign, actingShip);
    return {
      ok: true,
      state: {
        member: false,
        haveInvite: Boolean(group.haveInvite),
        haveRequestedInvite: Boolean(group.haveRequestedInvite),
        privacy: group.privacy ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
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
    { app: 'groups', path: `/gangs/${flag}/preview` },
    timeoutMs
  ).then(
    (result) => extractGroupPrivacy(result),
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
    authenticate: async () => {
      await ensureClient(['groups', 'channels']);
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
    // rejection unhandled, so the pokes are sent here: only the contact poke
    // decides the result, and a failed hide is reported and ignored.
    addContact: async (ship) => {
      poke({ app: 'groups-ui', mark: 'ui-hide-contact', json: ship }).catch(
        (error) => {
          process.stderr.write(
            `Could not hide ${ship} from contact suggestions (${errorMessage(error)}).\n`
          );
        }
      );
      await poke({
        app: 'contacts',
        mark: 'contact-action-1',
        json: { page: { kip: ship, contact: {} } },
      });
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
