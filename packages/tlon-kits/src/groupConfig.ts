/**
 * The kit install config the %kits agent writes into a group's `blob` at
 * install time (kits/SCHEMA.md §2, `desk/lib/kits-json.hoon` `+config`).
 *
 * The blob is group-owned state: it replicates with the group and tells an
 * executing harness which kits run there and how their abstract places map to
 * concrete channels. It lives here rather than in the api or openclaw
 * packages because both of them read it, and they previously disagreed about
 * what a malformed payload means.
 *
 * Readers must tolerate unknown keys and skip malformed `kits[]` entries
 * rather than throwing, so an unrecognized future field never blanks a
 * group's config.
 *
 * Stick to the zod 3 / zod 4 common subset here. @tloncorp/api pins zod 3
 * while this package and the OpenClaw harness are on zod 4, and the web
 * bundler collapses them to a single copy, so a version-only API (v4's
 * `z.looseObject`, say) throws at module-eval time in the browser and
 * takes the whole app down with it.
 */
import { z } from 'zod';

export const KITS_BLOB_VERSION = 1;

/**
 * Capabilities a workspace may grant its agent.
 *
 * The type stays `string`, so this is a vocabulary rather than a closed set —
 * the same posture the channel view registry takes for view ids. Enforcement is
 * the executing agent's job; this only records the grant.
 */
export const WORKSPACE_CAPABILITIES = {
  /** Post into the kit's declared places (setup conversation, schedule output). */
  postToPlaces: 'postToPlaces',
  /** Edit its own posts, which applying a card action requires. */
  editOwnPosts: 'editOwnPosts',
  /** Fire the schedules the kit declares. */
  runSchedules: 'runSchedules',
  /** Read the group's contacts. */
  readContacts: 'readContacts',
} as const;

export type WorkspaceCapability =
  | (typeof WORKSPACE_CAPABILITIES)[keyof typeof WORKSPACE_CAPABILITIES]
  | (string & {});

const groupKitScheduleSchema = z.object({
  id: z.string().min(1),
  cron: z.string().min(1),
  // Declaring a schedule is not starting it. A kit's recurring behaviour is
  // offered to the household after their first result and switched on then —
  // never during onboarding — so install records it inactive.
  //
  // Defaults false rather than true: a descriptor written before this field
  // existed described a schedule nothing was firing, and reading it as active
  // would start one the household never agreed to.
  enabled: z.boolean().default(false),
});
export type GroupKitSchedule = z.infer<typeof groupKitScheduleSchema>;

const groupKitRefSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    publisher: z.string().min(1),
  })
  .passthrough();

export const groupKitEntrySchema = z
  .object({
    installId: z.string().min(1),
    kit: groupKitRefSchema,
    /** abstract place name -> concrete channel nest */
    places: z.record(z.string(), z.string()).default({}),
    schedules: z.array(groupKitScheduleSchema).default([]),
    /** ships whose bots are authorized to execute this kit here */
    agents: z.array(z.string()).default([]),
    // Defaults to "done", not "pending": firing setup posts a conversation and
    // writes scaffolds, so an unreadable value must not re-run it. The two
    // readers used to disagree here — openclaw defaulted "done" and the client
    // "pending" — which meant the same malformed blob both suppressed setup and
    // displayed it as outstanding.
    setup: z.enum(['pending', 'done']).catch('done').default('done'),
    // What the executing agent is allowed to do here. Deliberately loose
    // strings, not an enum: a descriptor written by a newer client is a normal
    // input, and an unrecognized capability must read as "not granted" rather
    // than making the whole descriptor malformed. Known ids are listed in
    // WORKSPACE_CAPABILITIES.
    //
    // This is what the agent may do, never who may act — group membership and
    // the channel can-read/can-write gates own that, and a second copy here
    // would drift. See docs/backend/channel-hosts.md.
    permissions: z.array(z.string()).default([]),
    // The live agent writes epoch ms; SCHEMA.md's example shows an ISO string.
    installedAt: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();
export type GroupKitEntry = z.infer<typeof groupKitEntrySchema>;

export type GroupKitConfig = {
  version: number;
  kits: GroupKitEntry[];
};

const envelopeSchema = z
  .object({
    version: z.number().int(),
    kits: z.array(z.unknown()).default([]),
  })
  .passthrough();

export type ParseGroupKitConfigOptions = {
  /** Called with a human-readable reason each time a payload is rejected. */
  log?: (message: string) => void;
};

/**
 * Parse a group blob into its kit install config. Returns null when the blob
 * is absent, is not JSON, is not a kits payload, or is a version this build
 * does not understand. Malformed entries inside `kits[]` are skipped
 * individually rather than failing the whole config.
 */
export function parseGroupKitConfig(
  blob: string | null | undefined,
  options: ParseGroupKitConfigOptions = {}
): GroupKitConfig | null {
  const log = options.log ?? (() => {});

  if (typeof blob !== 'string' || !blob.trim()) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    log('group blob is not JSON');
    return null;
  }

  const envelope = envelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    return null;
  }
  if (envelope.data.version !== KITS_BLOB_VERSION) {
    log(`unsupported kits blob version ${envelope.data.version}`);
    return null;
  }

  const kits = envelope.data.kits.flatMap((entry) => {
    const result = groupKitEntrySchema.safeParse(entry);
    if (!result.success) {
      log('skipping malformed kits entry');
      return [];
    }
    return [result.data];
  });

  return { version: envelope.data.version, kits };
}
