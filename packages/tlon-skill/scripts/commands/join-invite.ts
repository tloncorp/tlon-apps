import { valid } from '@urbit/aura';

import { isGroupFlag } from '../cli-utils';
import {
  type CommandDeps,
  commandError,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';
import { withSig } from './invite-link';

// Everything below is measured from command start so the whole command stays
// inside the harness kill timers (Hermes 30s, OpenClaw 45s). Polling for the
// invite ends at the deadline; the bite always gets its full cap before it,
// and one final join/request poke gets FINAL_ACTION_TIMEOUT_MS after it, so
// the hard stop is 28s.
export const INVITE_WAIT_DEADLINE_MS = 25_000;
export const INVITE_POLL_INTERVAL_MS = 1_000;
export const PREVIEW_TIMEOUT_MS = 4_000;
export const BITE_TIMEOUT_MS = 5_000;
export const FINAL_ACTION_TIMEOUT_MS = 3_000;

export const JOIN_HELP = `Usage: tlon groups join <group-id>
       tlon groups join --invite <invite-url|token> [--self]

Joins public or invited groups. For private groups without an invite,
requests an invite.

--invite redeems a shared invite link (https://invite.tlon.io/0v...,
join.tlon.io/..., tlon.network/lure/...) or a bare 0v... token. Only the
token is read from the link; the link itself is never opened. A group invite
asks the inviter's ship to send the invite, waits briefly for it, and joins.
A private or secret group can end as "requested" or "unconfirmed" rather than
joined. A personal invite adds the inviter as a contact and joins nothing.

Options:
  --invite <invite-url|token>  Redeem an invite link instead of a group id
  --self                       Use the current credentials (meaningful under
                               bot harnesses)
  -h, --help                   Show this help

Examples:
  tlon groups join ~host/group-slug
  tlon groups join --invite https://invite.tlon.io/0v1.abcde`;

export const BUDGET_EXHAUSTED_MESSAGE =
  'Could not check the invite within the time limit; nothing was sent. Run the command again.';

export type GroupPrivacy = 'public' | 'private' | 'secret';

export interface InviteGroupState {
  member: boolean;
  haveInvite: boolean;
  haveRequestedInvite: boolean;
  // From the ship's foreign-group record; null when it has none.
  privacy: GroupPrivacy | null;
}

export type GroupStateRead =
  | { ok: true; state: InviteGroupState }
  | { ok: false; error: string };

export type InviteMetadataResult =
  | { kind: 'found'; fields: Record<string, string> }
  | { kind: 'not-found' };

export type InviteBiteResult = { kind: 'sent' } | { kind: 'not-found' };

export type ParsedInviteLink =
  | { type: 'lure'; token: string }
  | { type: 'wer'; wer: string };

export interface PhaseTimer {
  expired: Promise<void>;
  cancel: () => void;
}

export interface JoinInviteDeps extends CommandDeps {
  getResolvedShip: () => string;
  authenticate: () => Promise<void>;
  parseInviteLink: (input: string) => ParsedInviteLink | null;
  joinExistingFlag: (flag: string) => Promise<void>;
  fetchInviteMetadata: (token: string) => Promise<InviteMetadataResult>;
  biteInvite: (token: string, ship: string) => Promise<InviteBiteResult>;
  getGroupState: (flag: string) => Promise<GroupStateRead>;
  getPreviewPrivacy: (
    flag: string,
    timeoutMs: number
  ) => Promise<GroupPrivacy | null>;
  joinGroup: (flag: string) => Promise<void>;
  requestInvite: (flag: string) => Promise<void>;
  addContact: (ship: string) => Promise<void>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  startTimer: (ms: number) => PhaseTimer;
}

export type ParsedJoinInviteArgs =
  | { kind: 'help' }
  | { kind: 'run'; input: string };

/** Whether `groups join <args>` is an invite redemption. */
export function isInviteJoin(args: string[]): boolean {
  return args.some((arg) => arg === '--invite' || arg.startsWith('--invite='));
}

/**
 * The group id of a plain `groups join <args>`. A trailing --self from a bot
 * harness is an identity marker, not a group id.
 */
export function plainJoinGroupId(args: string[]): string | undefined {
  return args.find((arg) => arg !== '--self');
}

const MISSING_INVITE_MESSAGE = '--invite requires an invite URL or token';

export function parseJoinInviteArgs(args: string[]): ParsedJoinInviteArgs {
  if (args.some(isHelpArg)) return { kind: 'help' };

  let input: string | undefined;
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // Accepted anywhere and otherwise ignored: identity is the resolver's.
    if (arg === '--self') continue;
    if (arg === '--invite' || arg.startsWith('--invite=')) {
      if (input !== undefined) {
        throw usageError('--invite was given more than once', JOIN_HELP);
      }
      let value: string | undefined;
      if (arg === '--invite') {
        value = args[i + 1];
        i += 1;
      } else {
        value = arg.slice('--invite='.length);
      }
      if (value === undefined || value.startsWith('-') || !value.trim()) {
        throw usageError(MISSING_INVITE_MESSAGE, JOIN_HELP);
      }
      input = value.trim();
      continue;
    }
    if (arg.startsWith('-')) {
      throw usageError(`Unknown option: ${arg}`, JOIN_HELP);
    }
    positionals.push(arg);
  }

  if (input === undefined) throw usageError(MISSING_INVITE_MESSAGE, JOIN_HELP);
  if (positionals.length > 0) {
    throw usageError('Use either <group-id> or --invite, not both', JOIN_HELP);
  }
  return { kind: 'run', input };
}

// %bait mints tokens as (scot %uv …). The link parser accepts any `0v…`
// path segment, so tokens are re-checked against the real aura shape.
const UV_TOKEN = /^0v[0-9a-v]+(\.[0-9a-v]+)*$/;

export type InviteTarget =
  | { kind: 'flag'; flag: string }
  | { kind: 'token'; token: string };

export function classifyInviteInput(
  input: string,
  parseInviteLink: JoinInviteDeps['parseInviteLink']
): InviteTarget {
  if (isGroupFlag(input)) return { kind: 'flag', flag: input };
  if (UV_TOKEN.test(input)) return { kind: 'token', token: input };

  // The host is only checked against the parser's allowlist; nothing ever
  // fetches it.
  const link = parseInviteLink(input);
  if (link?.type === 'wer') {
    const ship = withSig(link.wer.replace(/^dm\//, ''));
    throw commandError(`${input} is a DM link to ${ship}, not a group invite.`);
  }
  if (link?.type === 'lure') {
    // A flag-shaped token is a legacy v1 link: biting it builds %bite-1,
    // which the inviter's grouper rejects, so the flag is joined directly.
    if (isGroupFlag(link.token)) return { kind: 'flag', flag: link.token };
    if (UV_TOKEN.test(link.token)) return { kind: 'token', token: link.token };
  }
  throw usageError(`Not an invite link or token: ${input}`, JOIN_HELP);
}

export function unusableMetadataError(token: string) {
  return commandError(
    `Invite service returned unusable metadata for invite ${token}.`
  );
}

function notFoundError(token: string) {
  return commandError(`Invite link not found (revoked or unknown): ${token}`);
}

type InviteDetails =
  | { kind: 'personal'; inviter: string; nickname: string | null }
  | { kind: 'group'; inviter: string; flag: string; title: string | null };

// Mirrors the app's validation (getMetadataFromInviteToken). Personal invites
// are told apart by inviteType alone: %reel stamps invitedGroupId on every
// invite, personal ones included, so a group id proves nothing.
function readInviteDetails(
  fields: Record<string, string>,
  token: string,
  input: string
): InviteDetails {
  const inviterId = fields.inviterUserId;
  if (!inviterId || !valid('p', withSig(inviterId))) {
    throw unusableMetadataError(token);
  }
  const inviter = withSig(inviterId);

  if (fields.inviteType === 'user') {
    return {
      kind: 'personal',
      inviter,
      nickname: fields.inviterNickname || null,
    };
  }

  const flag = fields.invitedGroupId;
  if (!flag) {
    // The app resolves such a token to nothing at all.
    if (fields.inviteType === undefined) {
      throw commandError(`Not an invite link or token: ${input}`);
    }
    throw unusableMetadataError(token);
  }
  if (!isGroupFlag(flag)) throw unusableMetadataError(token);
  if (fields.invitedGroupDeleted === 'true') {
    throw commandError(`The group for this invite (${flag}) has been deleted.`);
  }
  return {
    kind: 'group',
    inviter,
    flag,
    title: fields.invitedGroupTitle || null,
  };
}

type Capped<T> = { done: true; value: T } | { done: false };

async function withinCap<T>(
  deps: JoinInviteDeps,
  ms: number,
  work: () => Promise<T>
): Promise<Capped<T>> {
  if (ms <= 0) return { done: false };
  const timer = deps.startTimer(ms);
  try {
    return await Promise.race([
      work().then((value): Capped<T> => ({ done: true, value })),
      timer.expired.then((): Capped<T> => ({ done: false })),
    ]);
  } finally {
    timer.cancel();
  }
}

async function finalAction(
  deps: JoinInviteDeps,
  ms: number,
  description: string,
  work: () => Promise<void>,
  hint = ''
): Promise<void> {
  const result = await withinCap(deps, ms, work);
  if (!result.done) {
    throw commandError(
      `Timed out ${description}; it may still complete.${hint}`
    );
  }
}

function syncNote(flag: string, accepted: boolean): string {
  const prefix = accepted ? 'Invite accepted; joining' : 'Joining';
  return `${prefix} ${flag}. Sync may take a moment to show membership.`;
}

export async function run(
  args: string[],
  deps: JoinInviteDeps
): Promise<number> {
  try {
    const start = deps.now();
    const deadline = start + INVITE_WAIT_DEADLINE_MS;
    // Everything before the bite must leave the bite its full cap and the
    // poll some time; running out first means nothing was sent.
    const preBiteRemaining = () => deadline - BITE_TIMEOUT_MS - deps.now();
    const checkPhase = async <T>(work: () => Promise<T>): Promise<T> => {
      const result = await withinCap(deps, preBiteRemaining(), work);
      if (!result.done) throw commandError(BUDGET_EXHAUSTED_MESSAGE);
      return result.value;
    };

    const parsed = parseJoinInviteArgs(args);
    if (parsed.kind === 'help') {
      return writeHelp(deps, JOIN_HELP);
    }
    const target = classifyInviteInput(parsed.input, deps.parseInviteLink);

    // Whatever the normal resolver lands on; `--self` is an explicit no-op,
    // as for invite-link. Identity selection belongs to the bot harnesses.
    const actingShip = withSig(deps.getResolvedShip());
    await checkPhase(() => deps.authenticate());

    // The legacy join never bites, so it gets the rest of the budget: it is
    // the plain join (scries, possibly a preview, then a poke), which a short
    // cap could fail where `groups join <flag>` would succeed.
    if (target.kind === 'flag') {
      const { flag } = target;
      await finalAction(
        deps,
        deadline - deps.now(),
        `joining ${flag}`,
        () => deps.joinExistingFlag(flag),
        ` Check with \`tlon groups list\` or run \`tlon groups join ${flag}\` again.`
      );
      return 0;
    }

    const { token } = target;
    const metadata = await checkPhase(() => deps.fetchInviteMetadata(token));
    if (metadata.kind === 'not-found') throw notFoundError(token);
    const invite = readInviteDetails(metadata.fields, token, parsed.input);

    if (invite.kind === 'personal') {
      // Web parity (useInviteParam): a logged-in user never bites a personal
      // invite; the app adds the inviter as a contact instead.
      writeLine(
        deps.stderr,
        `Personal invite from ${invite.inviter} as ${actingShip}`
      );
      await finalAction(
        deps,
        FINAL_ACTION_TIMEOUT_MS,
        `adding ${invite.inviter} as a contact`,
        () => deps.addContact(invite.inviter)
      );
      const nickname = invite.nickname ? ` (${invite.nickname})` : '';
      writeLine(
        deps.stdout,
        `Personal invite from ${invite.inviter}${nickname}; added ${invite.inviter} as a contact.`
      );
      return 0;
    }

    const { flag, inviter } = invite;
    const title = invite.title ? ` "${invite.title}"` : '';
    writeLine(
      deps.stderr,
      `Invite from ${inviter} for ${flag}${title} as ${actingShip}`
    );

    const join = async (accepted: boolean) => {
      await finalAction(deps, FINAL_ACTION_TIMEOUT_MS, `joining ${flag}`, () =>
        deps.joinGroup(flag)
      );
      writeLine(deps.stdout, syncNote(flag, accepted));
      return 0;
    };
    const alreadyMember = () => {
      writeLine(deps.stdout, `Already a member of ${flag}.`);
      return 0;
    };

    const initial = await checkPhase(() => deps.getGroupState(flag));
    if (!initial.ok) {
      throw commandError(
        `Could not read the invite state for ${flag} (${initial.error}).`
      );
    }
    // Neither case bites, matching the app's redeemInviteIfNeeded.
    if (initial.state.member) return alreadyMember();
    if (initial.state.haveInvite) return await join(true);

    // Previewed once, before the bite: the preview subscription can hang
    // (the desk only answers when it has one), so an unanswered preview reads
    // as unknown privacy rather than holding the command.
    let privacy = initial.state.privacy;
    if (privacy === null) {
      const previewMs = Math.min(PREVIEW_TIMEOUT_MS, preBiteRemaining());
      const preview = await withinCap(deps, previewMs, () =>
        deps.getPreviewPrivacy(flag, previewMs)
      );
      privacy = preview.done ? preview.value : null;
    }

    // Public groups join directly: the bite would only add the inviter's
    // "has joined the network" DM.
    if (privacy === 'public') return await join(false);

    if (preBiteRemaining() <= 0) throw commandError(BUDGET_EXHAUSTED_MESSAGE);
    const waitSeconds = Math.floor((deadline - deps.now()) / 1000);
    writeLine(
      deps.stderr,
      `Asking ${inviter}'s ship to send the invite; waiting up to ${waitSeconds}s...`
    );
    // A 200 only means %bait forwarded the request; the foreign-group poll is
    // the ground truth. A bite that outlives its cap may still have landed,
    // so it is polled for like a sent one.
    const bite = await withinCap(deps, BITE_TIMEOUT_MS, () =>
      deps.biteInvite(token, actingShip)
    );
    if (bite.done && bite.value.kind === 'not-found') {
      throw notFoundError(token);
    }

    // At the deadline, "requested" and privacy reflect the last read that
    // succeeded; a failed read says nothing either way. A foreign record can
    // appear only after the bite, which is when unknown privacy resolves.
    let requested = initial.state.haveRequestedInvite;
    while (deadline - deps.now() > 0) {
      const read = await withinCap(deps, deadline - deps.now(), () =>
        deps.getGroupState(flag)
      );
      if (!read.done) break;
      if (read.value.ok) {
        const { state } = read.value;
        if (state.member) return alreadyMember();
        if (state.haveInvite) return await join(true);
        requested = state.haveRequestedInvite;
        // Only the timeout decision uses this. A stored preview can be stale
        // (a group made private after it was cached), so learning "public"
        // here is no reason to stop waiting for the invite.
        if (state.privacy !== null) privacy = state.privacy;
      }
      const left = deadline - deps.now();
      if (left <= 0) break;
      await deps.sleep(Math.min(INVITE_POLL_INTERVAL_MS, left));
    }

    // Privacy was unknown when the bite went out and has since read as public:
    // a public group needs no invite, so the final action is a direct join.
    if (privacy === 'public') return await join(false);

    if (privacy === 'private') {
      const notArrived = `The invite from ${inviter} did not arrive in time (their ship may be offline).`;
      if (requested) {
        writeLine(
          deps.stdout,
          `${notArrived} An invite to ${flag} is already requested.`
        );
        return 0;
      }
      await finalAction(
        deps,
        FINAL_ACTION_TIMEOUT_MS,
        `requesting an invite to ${flag}`,
        () => deps.requestInvite(flag)
      );
      writeLine(
        deps.stdout,
        `${notArrived} Requested an invite to ${flag} instead.`
      );
      return 0;
    }

    // Secret or unknown (a denied preview is typical of secret groups): there
    // is nothing to request, and delivery is unconfirmed. The plugin strips a
    // leading --self before the CLI runs, so the command cannot tell which
    // identity it ran as; the retry hint names both forms.
    writeLine(
      deps.stdout,
      `The invite from ${inviter} to ${flag} has not arrived, and its delivery is unconfirmed (their ship may be offline, or invites may be disabled for the group). ` +
        `Run \`tlon groups join ${flag}\` again later with the same identity (add a trailing --self if this ran as the bot) to accept the invite once it arrives.`
    );
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
