const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/;

// Parse a full semver string into its numeric core, or null if the entire
// string is not a valid semver (a partially parseable prefix like
// "11.2.2 dirty" returns null, not [11, 2, 2]).
export function parseVersion(version: string): [number, number, number] | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareCore(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (!parsedA || !parsedB) return 0;
  for (let i = 0; i < 3; i++) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i];
  }
  return 0;
}

export function isVersionBelow(current: string, minimum: string): boolean {
  return compareCore(current, minimum) < 0;
}

// Oldest %groups desk this client supports. Ships reporting a lower docket
// version get the desk-outdated notice instead of an empty home (12.2.0 =
// first desk with /v10/init and the /v3/groups subscription, which the
// client currently requires with no fallback).
//
// By policy this is the previous desk release
// (docs/tlon-apps/desk-compatibility.md). This constant RECORDS the floor;
// it is NOT the lever for shipping a new desk dependency: a client change
// needing something only the current desk serves waits for that desk to
// become N-1, or carries a fallback tested against N-1. Raise it only as
// part of a release, once the desk release it names has shipped and the
// N-1 E2E job passes against it. The registry check
// (client/requests/floor.test.ts) fails any non-exempt declared desk request
// whose `since` is above it unless it names a guard.
export const MIN_GROUPS_VERSION = '12.2.0';

// Shape only: `${number}` admits '1e0'. The registry check re-validates every
// `since` strictly.
export type DeskVersion = `${number}.${number}.${number}`;

// Every capability the client gates on the backend's %groups version, with
// the first release that has it. A guarded registry entry names one as its
// `guardedBy`, and its `since` must equal the version here (the registry
// check). Entries for unreleased desks must move in lockstep with
// desk/desk.docket-0's version if the release number changes.
export const DESK_CAPABILITIES = {
  // %activity's v9 endpoints (v6 feed, v5 subscription, activity-action-1 /
  // activity-event-1 marks) and react emission. 11.3.0 lacks them, and
  // below this the client uses the v5 feed, v4 subscription and v8 marks.
  activityReactions: '11.4.0',
  // %activity's v10 endpoints (v7 feed, v6 subscription, activity-action-2 /
  // activity-event-2 marks) and %notes event emission.
  activityNotes: '12.1.0',
  // %notes' bounded search (/notes/~/v1/notebooks/{host}/{name}/search/
  // bounded/text and its scry). This is our own ship's version, not the
  // notebook host's: our ship answers a search from its local replica.
  notesSearch: '12.1.0',
  // %buckets and /v11/init (/v10 plus Buckets and their writer roles). Above
  // MIN_GROUPS_VERSION, so the supported 12.2.x band passes the desk gate
  // without %buckets at all.
  buckets: '12.3.0',
  // %steward's task delivery block. The mirror and the edit loop arrived a
  // release earlier, but an edit sent to that release drops the destination
  // and still answers "created", so the task screens are gated on this one.
  automations: '12.3.1',
  // init and changes scries count every seat, not just the 15 they keep
  // (TLON-6779). Below this, a member count of exactly 15 may be that cap.
  allSeatsCounted: '12.4.0',
  // %steward's prompts module: the owner-side mirror of a bot's OpenClaw
  // prompt files and the edit relay (/steward/~/v1/prompts).
  stewardPrompts: '12.4.0',
  // A big roster served in parts: the light ui group and the seat pages
  // (TLON-4698, desk side in tloncorp/tlon-apps#6752, first in 12.5.0).
  rosterPages: '12.5.0',
  // %steward pages one cron job's lens runs (/v1/lens/cron) and relays a
  // test run of a task (the %test edit). 12.4.0 shipped without them.
  taskRuns: '12.5.0',
  // %steward serves its trusted bots (/v1/bots), which workspace config reads
  // to name the bot a workspace is for.
  stewardBots: '12.5.0',
} as const satisfies Record<string, DeskVersion>;

export type DeskCapability = keyof typeof DESK_CAPABILITIES;

// Whether a backend at this %groups version has the capability. Conservative:
// a missing version, or one that isn't fully valid semver ('n/a' when the
// version scry failed, '12.1.0 dirty' from docket metadata), reads as
// unsupported, so the client never sends an older backend a request it would
// reject. A loose prefix check is not enough: '12.1.0 dirty' fails the strict
// parse inside isVersionBelow and would compare equal to the minimum.
export function versionSupports(
  groupsVersion: string | null | undefined,
  capability: DeskCapability
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, DESK_CAPABILITIES[capability]);
}
