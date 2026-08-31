import {
  type RawGroupForAdminVerification,
  actingShipCanAdminister,
} from './groups-verification';
import {
  type SurfaceDeps,
  type SurfaceGroupChannel,
  type SurfaceNestEntry,
  type SurfaceReport,
  emitReport,
  observeUntil,
  parseSurfaceArgs,
  parseSurfaceNest,
  requireValue,
  singleValue,
  surfaceError,
  usageSurfaceError,
} from './surface-common';

export const SURFACE_CREATE_HELP = `Usage: tlon surface create <group-id> --title <title> [options]

Create a dashboard (surface) channel in a group your ship administers.

The channel name is random by default. That is not a style choice: a channel
name is single-use on a ship forever, because deleting a channel unlists it
from %groups while %channels-server keeps its own entry, and a later create
under the same name is a SILENT no-op whose poke still succeeds. Pass --name
only when you mean to own that risk, and say what should happen on a
collision.

Options:
  --title <title>        Channel title (required)
  --name <slug>          Explicit channel name (default: random)
  --description <text>   Human-readable channel description
  --on-collision <mode>  With --name: fail (default) or reuse an existing
                         channel of that name
  --skip-storage-check   Skip the remote-storage pre-flight
  --json                 Emit a machine-readable result
  -h, --help             Show this help

Examples:
  tlon surface create ~zod/my-group --title "Potluck"
  tlon surface create ~zod/my-group --title "Standup" --name standup --on-collision reuse`;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** How many random names may be drawn and checked before the create gives up. */
const RANDOM_NAME_ATTEMPTS = 8;

/** How the create is allowed to react to a name that is already in use. */
export type CollisionPolicy = 'fail' | 'reuse';

/**
 * What the two agents currently say about a nest. Both answers matter and
 * neither substitutes for the other: `%channels` holds the channel resource,
 * `%groups` holds the listing, and the client's poke ack reports on neither
 * (D50). A channel is created when both agree it exists.
 */
export interface ChannelPresence {
  inChannels: boolean;
  inGroups: boolean;
  /** the group flag `%channels` has on the nest's perms, if any */
  channelsGroupFlag: string | null;
}

export function readChannelPresence(input: {
  channelId: string;
  groupId: string;
  nests: Record<string, SurfaceNestEntry>;
  groupChannels: Record<string, SurfaceGroupChannel> | null;
}): ChannelPresence {
  const nest = Object.prototype.hasOwnProperty.call(
    input.nests,
    input.channelId
  )
    ? input.nests[input.channelId]
    : undefined;
  const flag = nest?.perms?.group;
  return {
    inChannels: nest !== undefined,
    inGroups: input.groupChannels
      ? Object.prototype.hasOwnProperty.call(
          input.groupChannels,
          input.channelId
        )
      : false,
    channelsGroupFlag: typeof flag === 'string' ? flag : null,
  };
}

/**
 * The D50 signature: `%channels` holds the nest but `%groups` never listed
 * it. The bunt group flag (`~zod/`, a ship with an empty name) is the
 * tell-tale of a create that `%channels-server` never relayed on, but the
 * listing is the decisive half — a nest whose flag points somewhere else is
 * equally unusable under this group.
 */
export function isBurnedName(presence: ChannelPresence): boolean {
  return presence.inChannels && !presence.inGroups;
}

export function isBuntGroupFlag(flag: string | null): boolean {
  return flag !== null && /^~[a-z-]+\/$/.test(flag);
}

/** What this command did, as far as it can actually be shown. */
export type CreateDisposition = 'reused' | 'created-unverified';

/**
 * The newest host stamp the group's listing carried before this command poked.
 *
 * `added` is the one field of a channel listing the CALLER does not supply:
 * `%groups` overwrites whatever the create poke carried with its own clock
 * when it executes the add (`se-c-channel`: `=. added.chan now.bowl`), keeps
 * that value across every later `%edit`, and every subscriber stores the
 * host's value verbatim (`go-u-channel`). So all the `added` values a ship can
 * read for one group came from ONE clock, the group host's, and comparing an
 * observed stamp against the newest stamp already held is a comparison inside
 * that clock. No local clock is read, which is why the host/client skew that
 * made an earlier round reject `added` cannot reach this baseline.
 *
 * `null` when the group lists nothing yet: there is then no stamp to be newer
 * than, and substituting one (zero, or the local clock) would be inventing the
 * evidence this whole check exists to avoid inventing.
 */
export function newestListedAdded(
  channels: Record<string, SurfaceGroupChannel> | null
): number | null {
  if (!channels) return null;
  let newest: number | null = null;
  for (const channel of Object.values(channels)) {
    const added = channel?.added;
    if (typeof added === 'number' && (newest === null || added > newest)) {
      newest = added;
    }
  }
  return newest;
}

export type ListingVerdict =
  | { ok: true; title: string; added: number | null }
  | { ok: false; detail: string };

/**
 * Reads back the listing a create poke was supposed to produce, and reports
 * the ways it can be shown NOT to be that listing.
 *
 * Every test here is a refutation, and none of them is a verification. That
 * asymmetry is the whole content of this function:
 *
 * - A title that is not the one we poked with proves the listing is someone
 *   else's, because `%groups` keeps the title of the create it actually took
 *   and a colliding `%add` is a no-op that changes nothing (`se-c-channel`:
 *   `?: &(?=(%add -.c-channel) (has:by-ch nest)) se-core`). The CONVERSE does
 *   not hold — a title is caller-chosen data, and two callers naturally pick
 *   "Standup" — which is the bug this replaces.
 * - A host stamp no newer than the newest one we already held proves the
 *   listing predates the poke, so the poke did not produce it. Strictly
 *   newer, not newer-or-equal: a ship's event time advances between events,
 *   so a listing sharing a stamp we had already read was written by an event
 *   we had already read.
 *
 * What survives both refutations is NOT this command's create. It is a
 * listing that could be this command's create: a concurrent `ca-create` under
 * the same name lands in the same window and gets a stamp from the same clock
 * a moment later, and the no-op it forces on our poke leaves no trace in
 * either agent — no update, no log entry, no counter. Neither agent stamps
 * anything that names the poking client, so authorship is not a fact a client
 * can read back, and the report says so rather than inferring it.
 *
 * `pokedTitle` is `null` on the reuse path, where this command wrote nothing
 * and there is no create to refute — only a title to read back.
 */
export function assessObservedListing(input: {
  channelId: string;
  groupId: string;
  pokedTitle: string | null;
  baselineAdded: number | null;
  listed: SurfaceGroupChannel | undefined;
}): ListingVerdict {
  const { channelId, groupId, pokedTitle, baselineAdded, listed } = input;
  const title = listed?.meta?.title;
  if (typeof title !== 'string') {
    return {
      ok: false,
      detail: `${groupId} lists ${channelId} but holds no readable title for it`,
    };
  }
  const added = typeof listed?.added === 'number' ? listed.added : null;
  if (pokedTitle === null) {
    return { ok: true, title, added };
  }
  if (title !== pokedTitle) {
    return {
      ok: false,
      detail: `${groupId} lists ${channelId} under the title "${title}", not "${pokedTitle}" — %groups keeps the title of the create it took, so this listing is not the one this create poked for`,
    };
  }
  if (added === null) {
    return {
      ok: false,
      detail: `${groupId} lists ${channelId} but stamps it with no added time, so there is nothing host-stamped to date the listing by`,
    };
  }
  if (baselineAdded !== null && added <= baselineAdded) {
    return {
      ok: false,
      detail: `${groupId} lists ${channelId} with the host stamp ${added}, which is not newer than the ${baselineAdded} this command had already read before poking — the listing predates the poke`,
    };
  }
  return { ok: true, title, added };
}

export function validateChannelSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw surfaceError(
      'usage',
      `"${slug}" is not a usable channel name — use lowercase letters, digits and hyphens, starting with a letter or digit.`,
      { name: slug }
    );
  }
}

function burnedNameMessage(channelId: string, groupId: string): string {
  return (
    `The name "${parseSurfaceNest(channelId).name}" is burned on this ship. ` +
    `%channels already holds ${channelId}, but ${groupId} does not list it — ` +
    'the state a deleted channel leaves behind. Creating it again would be a ' +
    'silent no-op that still reports success, so this command refuses. ' +
    'Choose a different name (or omit --name for a random one).'
  );
}

async function assertCanAdminister(
  deps: SurfaceDeps,
  groupId: string
): Promise<void> {
  const group = await deps.readGroupAdmin(groupId);
  if (!group) {
    throw surfaceError(
      'group-not-found',
      `No group ${groupId} is visible from this ship. Check the id, or join the group first.`,
      { group: groupId }
    );
  }
  const host = groupId.split('/')[0] ?? '';
  const verdict = actingShipCanAdminister(
    group as RawGroupForAdminVerification,
    deps.actingShip(),
    host,
    deps.normalizeShip
  );
  if (!verdict.ok) {
    throw surfaceError(
      'admin-required',
      `Cannot create a channel in ${groupId}: ${verdict.reason}`,
      { group: groupId, ship: deps.normalizeShip(deps.actingShip()) }
    );
  }
}

/**
 * Storage is checked at CREATE rather than only at publish because a
 * dashboard channel with no way to host a bundle is a channel that can
 * never do anything, and the remedy (configure storage, or pick a bucket)
 * belongs to the person setting the bot up rather than to the moment they
 * try to publish. The two failures are separate codes for the same reason:
 * "no storage at all" and "storage but no bucket" are fixed in different
 * places.
 */
async function assertStorageReachable(deps: SurfaceDeps): Promise<void> {
  const preflight = await deps.storagePreflight();
  if (!preflight || preflight.canStore) {
    return;
  }
  if (preflight.reason === 'no-bucket') {
    throw surfaceError(
      'storage-no-bucket',
      'This ship has S3 credentials but no bucket selected, so a dashboard bundle could not be uploaded. Choose a bucket in storage settings, then retry.',
      {}
    );
  }
  throw surfaceError(
    'storage-unavailable',
    'This ship cannot store uploads, so a dashboard bundle could not be hosted. Configure remote storage (or set TLON_HOSTING on a hosted node), then retry.',
    {}
  );
}

export async function runSurfaceCreate(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    {
      value: ['--title', '--name', '--description', '--on-collision'],
      boolean: ['--json', '--skip-storage-check'],
    },
    SURFACE_CREATE_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_CREATE_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const groupId = parsed.positional[0];
  if (!groupId) {
    throw usageSurfaceError('a group id is required', SURFACE_CREATE_HELP);
  }
  if (parsed.positional.length > 1) {
    throw usageSurfaceError(
      `Unexpected argument: ${parsed.positional[1]}`,
      SURFACE_CREATE_HELP
    );
  }
  const title = requireValue(parsed, '--title', SURFACE_CREATE_HELP);
  const description = singleValue(parsed, '--description') ?? '';
  const explicitName = singleValue(parsed, '--name');
  const collisionRaw = singleValue(parsed, '--on-collision');
  if (
    collisionRaw !== undefined &&
    collisionRaw !== 'fail' &&
    collisionRaw !== 'reuse'
  ) {
    throw usageSurfaceError(
      `--on-collision must be "fail" or "reuse", not "${collisionRaw}"`,
      SURFACE_CREATE_HELP
    );
  }
  if (collisionRaw !== undefined && explicitName === undefined) {
    throw usageSurfaceError(
      '--on-collision only applies with --name (random names never collide by intent)',
      SURFACE_CREATE_HELP
    );
  }
  const collisionPolicy: CollisionPolicy = collisionRaw ?? 'fail';

  await deps.authenticate();
  await assertCanAdminister(deps, groupId);
  if (!parsed.flags.has('--skip-storage-check')) {
    await assertStorageReachable(deps);
  }

  const host = deps.normalizeShip(deps.actingShip());
  const nests = await deps.readChannelNests();
  const groupChannels = await deps.readGroupChannels(groupId);

  let name: string;
  let reused = false;
  if (explicitName !== undefined) {
    validateChannelSlug(explicitName);
    name = explicitName;
    const channelId = `chat/${host}/${name}`;
    const presence = readChannelPresence({
      channelId,
      groupId,
      nests,
      groupChannels,
    });
    if (isBurnedName(presence)) {
      throw surfaceError('name-burned', burnedNameMessage(channelId, groupId), {
        channel: channelId,
        group: groupId,
        channelsGroupFlag: presence.channelsGroupFlag,
        buntGroupFlag: isBuntGroupFlag(presence.channelsGroupFlag),
      });
    }
    if (presence.inGroups) {
      if (collisionPolicy === 'fail') {
        throw surfaceError(
          'name-taken',
          `${channelId} already exists in ${groupId}. Pass --on-collision reuse to use it as-is, or choose another name.`,
          { channel: channelId, group: groupId }
        );
      }
      reused = true;
    }
  } else {
    // Every candidate that gets USED is a candidate that was checked. The
    // loop this replaces drew a fresh name on its last pass and left the
    // loop with it unexamined, so a run that collided eight times went on to
    // create under a ninth name nothing had ever looked at — and a create
    // onto a taken name is a silent no-op that still reports success.
    //
    // Exhaustion is a refusal rather than one more draw. Eight collisions in
    // a row mean the name space is exhausted or the generator is degenerate,
    // and in neither case is a ninth draw likelier to be free; it is only
    // likelier to be unchecked.
    const drawn: string[] = [];
    let free: string | undefined;
    for (let attempt = 0; attempt < RANDOM_NAME_ATTEMPTS; attempt += 1) {
      const candidate = deps.randomSlug();
      drawn.push(candidate);
      const presence = readChannelPresence({
        channelId: `chat/${host}/${candidate}`,
        groupId,
        nests,
        groupChannels,
      });
      if (!presence.inChannels && !presence.inGroups) {
        free = candidate;
        break;
      }
    }
    if (free === undefined) {
      throw surfaceError(
        'name-taken',
        `${RANDOM_NAME_ATTEMPTS} random channel names were drawn for ${groupId} and every one of them is already in use on this ship, so nothing was created. Retry, or pass --name with a name you have chosen.`,
        { group: groupId, attempts: drawn.length, candidates: drawn }
      );
    }
    name = free;
  }

  const channelId = `chat/${host}/${name}`;

  // Taken from the read that gated the name, which is the last read before
  // the poke. A later baseline would refute more, an earlier one less; there
  // is nothing between this read and the poke but pure name arithmetic.
  const baselineAdded = newestListedAdded(groupChannels);

  if (!reused) {
    await deps.createChannel({
      id: channelId,
      kind: 'chat',
      group: groupId,
      name,
      title,
      description: deps.description.encode({
        ...(description ? { description } : {}),
        channelContentConfiguration: deps.surfaceContentConfiguration,
      }),
      // The v0 personal-group policy: an empty writer set admits every
      // member, and what a member's post can MEAN is bounded by the invoke
      // design rather than by who may write.
      readers: [],
      writers: [],
    });
  }

  const observation = await observeUntil(
    deps,
    deps.observationBudget,
    async () => {
      const currentNests = await deps.readChannelNests();
      const currentGroupChannels = await deps.readGroupChannels(groupId);
      const presence = readChannelPresence({
        channelId,
        groupId,
        nests: currentNests,
        groupChannels: currentGroupChannels,
      });
      if (presence.inChannels && presence.inGroups) {
        // Presence is not proof of THIS create. Both agents holding a channel
        // of this name is equally what a silent no-op onto a name taken since
        // the pre-flight check looks like, and that no-op leaves the channel
        // it landed on untouched. So the listing is put to every test that
        // can REFUTE it being ours; passing them all is not the same as being
        // ours, and the report is written accordingly.
        const verdict = assessObservedListing({
          channelId,
          groupId,
          pokedTitle: reused ? null : title,
          baselineAdded,
          listed: currentGroupChannels?.[channelId],
        });
        if (!verdict.ok) {
          return { done: false, detail: verdict.detail };
        }
        return {
          done: true,
          value: { title: verdict.title, added: verdict.added },
        };
      }
      if (presence.inChannels) {
        return {
          done: false,
          detail: `%channels holds ${channelId} but ${groupId} has not listed it`,
        };
      }
      if (presence.inGroups) {
        return {
          done: false,
          detail: `${groupId} lists ${channelId} but %channels does not hold it`,
        };
      }
      return {
        done: false,
        detail: `neither %channels nor ${groupId} has ${channelId}`,
      };
    }
  );

  if (!observation.ok) {
    throw surfaceError(
      'create-unconfirmed',
      `The create poke was accepted but the channel was never observed in both agents: ${observation.detail}. ` +
        'A resolved poke is not evidence — %channels acks a create that %channels-server may have dropped.',
      {
        channel: channelId,
        group: groupId,
        observed: observation.detail,
        attempts: observation.attempts,
      }
    );
  }

  // The title READ BACK, never the one asked for. On the create path the two
  // are equal because the observation refused to finish until they were; on
  // the reuse path they are frequently different — `--on-collision reuse`
  // renames nothing — and reporting the requested one there would be a claim
  // about the channel that is simply false.
  const observedTitle = observation.value.title;

  /**
   * What this run can honestly say it did.
   *
   * `reused` is a fact about this command: it poked nothing, and it read the
   * channel it reports on both before and after. `created-unverified` is the
   * honest name for the other branch — a create was poked, and a channel of
   * that name is now in both agents having survived every refutation there
   * is, which is as close to "I made it" as anything a client can read. A
   * concurrent creator taking the name inside the poke window produces
   * exactly this state, and the no-op it forces leaves nothing behind to tell
   * the two apart, so the word stops short of authorship on purpose.
   */
  const disposition: CreateDisposition = reused
    ? 'reused'
    : 'created-unverified';
  const stamped =
    reused || baselineAdded === null
      ? ''
      : ', stamped after every listing this command had read';

  const report: SurfaceReport = {
    json: {
      channel: channelId,
      group: groupId,
      title: observedTitle,
      name,
      disposition,
      /** the group host's stamp on the listing — the dating evidence itself */
      listedAt: observation.value.added,
      observedIn: ['channels', 'groups'],
      attempts: observation.attempts,
    },
    lines: [
      reused
        ? `Reused existing channel ${channelId}`
        : `Poked a create for ${channelId}`,
      `  title:    ${observedTitle}`,
      `  group:    ${groupId}`,
      `  observed: present in %channels and listed in ${groupId}${stamped}`,
      ...(reused
        ? []
        : [
            '  unproven: a create onto a name taken since the check is a silent no-op, and neither agent stamps anything naming the client that poked, so this is not proof the channel is the one this command made.',
          ]),
    ],
  };
  return emitReport(deps, report, asJson);
}
