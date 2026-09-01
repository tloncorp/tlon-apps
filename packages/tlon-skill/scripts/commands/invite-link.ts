import { valid } from '@urbit/aura';

import {
  type CommandDeps,
  commandError,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';
import {
  type RawGroupForAdminVerification,
  actingShipCanAdminister,
} from './groups-verification';

// 5s + the 15s mint await leaves ~5s of the runtime's 25s global deadline for
// authentication and the preliminary scries (fresh confirmations land in
// ~1-2s; a stale nonce only needs some timeout to trigger recovery).
export const IN_FLIGHT_AWAIT_TIMEOUT_MS = 5_000;
export const MINT_AWAIT_TIMEOUT_MS = 15_000;

export const INVITE_LINK_HELP = `Usage: tlon groups invite-link <~host/group-slug> [--self]

Retrieve the Lure invite link for a group, minting one through the invite
service if the group has none yet. Prints exactly one line on success: the
canonical invite URL (https://invite.tlon.io/<token>).

The link is retrieved as whichever ship the current credentials resolve to,
and that ship becomes the inviter of record. Bot harnesses run this command
as the owner by default, so recipients onboard attributed to the owner rather
than the bot.

Options:
  --self         Use the current credentials (the default; meaningful under
                 bot harnesses, which otherwise act as the owner)
  -h, --help     Show this help

Private/secret groups require the acting ship to be the host or an admin — a
non-admin's link would not deliver the group invite on redemption.`;

export interface InviteLinkDeps extends CommandDeps {
  getResolvedShip: () => string;
  authenticate: () => Promise<void>;
  scryRawGroup: (flag: string) => Promise<RawGroupForAdminVerification>;
  scryIdUrl: (flag: string) => Promise<string>;
  enableGrouper: (name: string) => Promise<void>;
  describe: (flag: string) => Promise<void>;
  awaitIdLink: (flag: string, timeoutMs: number) => Promise<string>;
  normalizeInviteLink: (url: string) => string | null;
}

export type ParsedInviteLinkArgs =
  | { kind: 'help' }
  | { kind: 'run'; flag: string; self: boolean };

// Mirrors @tloncorp/api's whomIsFlag (value imports from @tloncorp/api are
// forbidden in migrated command modules): ~ship/term with a valid patp ship.
function isGroupFlag(value: string): boolean {
  return (
    /^~[a-z-]+\/[a-z]+[a-z0-9-]*$/.test(value) &&
    valid('p', value.split('/')[0])
  );
}

export function parseInviteLinkArgs(args: string[]): ParsedInviteLinkArgs {
  let self = false;
  const positionals: string[] = [];

  for (const arg of args) {
    if (isHelpArg(arg)) {
      return { kind: 'help' };
    }
    if (arg === '--self') {
      self = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw usageError(`Unknown option: ${arg}`, INVITE_LINK_HELP);
    }
    positionals.push(arg);
  }

  if (positionals.length === 0) {
    throw usageError(INVITE_LINK_HELP);
  }
  if (positionals.length > 1) {
    throw usageError(
      `Unexpected argument: ${positionals[1]}`,
      INVITE_LINK_HELP
    );
  }

  const flag = positionals[0];
  if (!isGroupFlag(flag)) {
    throw usageError(
      `Invalid group flag: ${flag} (expected ~host/group-slug)`,
      INVITE_LINK_HELP
    );
  }

  return { kind: 'run', flag, self };
}

function withSig(ship: string): string {
  return ship.startsWith('~') ? ship : `~${ship}`;
}

function groupNameFromFlag(flag: string): string {
  return flag.split('/')[1];
}

type TokenState = 'valid' | 'missing' | 'legacy' | 'in-flight';

// The /v1/id-url scry returns "" when no token exists, else the provider URL
// prefix plus the stored token. While a describe is in flight the stored
// "token" is a date-shaped nonce. Mirrors the app's checkLureToken /
// checkOldLureToken classification (packages/shared/src/store/lure.ts).
function classifyTokenUrl(rawUrl: string): TokenState {
  if (!rawUrl) return 'missing';
  const segments = rawUrl.split('/');
  const token = segments.pop();
  if (token && token.startsWith('0v')) return 'valid';
  const ship = segments.pop();
  if (token && ship && ship.startsWith('~')) return 'legacy';
  return 'in-flight';
}

// The API wrapper folds HTTP failures into BadResponseError; only a real 404
// from the group scry means the ship is not a member. Statusless (fetch-level)
// and 5xx failures must surface as transport/API errors, never as membership.
function isMembershipFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'BadResponseError' &&
    (error as { status?: unknown }).status === 404
  );
}

function assertCanInvite(
  rawGroup: RawGroupForAdminVerification,
  actingShip: string,
  flag: string
): void {
  const privacy = rawGroup.admissions?.privacy;
  if (!privacy || privacy === 'public') return;

  const hostShip = flag.split('/')[0];
  const result = actingShipCanAdminister(
    rawGroup,
    withSig(actingShip),
    hostShip,
    withSig
  );
  if (!result.ok) {
    throw commandError(
      `${withSig(actingShip)} is not an admin of ${flag} (${privacy}); ` +
        'invite links from non-admins do not deliver invites.'
    );
  }
}

// subscribeOnce rejects with the literal sentinels 'timeout' and 'quit';
// anything else is a real transport/API failure and must surface unchanged.
function classifyAwaitFailure(error: unknown): unknown {
  if (error === 'timeout') {
    return commandError('Timed out waiting for the invite service.');
  }
  if (error === 'quit') {
    return commandError(
      'Invite service subscription quit before returning a link.'
    );
  }
  return error;
}

async function mintLink(flag: string, deps: InviteLinkDeps): Promise<string> {
  await deps.describe(flag);
  try {
    return await deps.awaitIdLink(flag, MINT_AWAIT_TIMEOUT_MS);
  } catch (error) {
    throw classifyAwaitFailure(error);
  }
}

async function resolveLinkUrl(
  rawUrl: string,
  flag: string,
  deps: InviteLinkDeps
): Promise<string> {
  switch (classifyTokenUrl(rawUrl)) {
    case 'valid':
      return rawUrl;
    case 'in-flight': {
      // A nonce means a describe is (or was) in flight. Await the link first;
      // a fresh mint confirms within seconds. Only a timeout marks the nonce
      // permanently stale (reel never cleans a nacked describe) and justifies
      // a recovery describe — a quit or transport failure says nothing about
      // the mint's state, and describing then could rotate a live link.
      try {
        const awaited = await deps.awaitIdLink(
          flag,
          IN_FLIGHT_AWAIT_TIMEOUT_MS
        );
        if (awaited) return awaited;
      } catch (error) {
        if (error !== 'timeout') throw classifyAwaitFailure(error);
      }
      return mintLink(flag, deps);
    }
    case 'missing':
    case 'legacy':
      return mintLink(flag, deps);
  }
}

export async function run(
  args: string[],
  deps: InviteLinkDeps
): Promise<number> {
  try {
    const parsed = parseInviteLinkArgs(args);
    if (parsed.kind === 'help') {
      return writeHelp(deps, INVITE_LINK_HELP);
    }

    // Whatever the normal resolver lands on. `--self` is an explicit no-op
    // here: bot harnesses inject owner credentials for the bare form, and the
    // flag is how a command string opts back out of that injection.
    const actingShip = deps.getResolvedShip();

    await deps.authenticate();

    let rawGroup: RawGroupForAdminVerification;
    try {
      rawGroup = await deps.scryRawGroup(parsed.flag);
    } catch (error) {
      if (isMembershipFailure(error)) {
        throw commandError(
          `${withSig(actingShip)} is not a member of ${parsed.flag}`
        );
      }
      throw error;
    }

    assertCanInvite(rawGroup, actingShip, parsed.flag);

    const rawUrl = await deps.scryIdUrl(parsed.flag);
    const linkUrl = await resolveLinkUrl(rawUrl, parsed.flag, deps);

    const normalized = deps.normalizeInviteLink(linkUrl);
    if (!normalized) {
      throw commandError(
        `Invite service returned an unrecognized URL: ${linkUrl}`
      );
    }

    // Token existence does not imply grouper state — redemption checks
    // enabled-groups independently, so enable on every successful path. Only
    // after a link is in hand: a failed invocation must not leave the
    // redemption side effect behind. Printing comes last, so the link is
    // redeemable the moment anyone has it.
    await deps.enableGrouper(groupNameFromFlag(parsed.flag));

    writeLine(deps.stdout, normalized);
    writeLine(
      deps.stderr,
      `Invite link for ${parsed.flag} as ${withSig(actingShip)}`
    );
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
