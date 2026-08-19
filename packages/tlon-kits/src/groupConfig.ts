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
 */
import { z } from 'zod';

export const KITS_BLOB_VERSION = 1;

const groupKitScheduleSchema = z.object({
  id: z.string().min(1),
  cron: z.string().min(1),
});
export type GroupKitSchedule = z.infer<typeof groupKitScheduleSchema>;

const groupKitRefSchema = z.looseObject({
  id: z.string().min(1),
  version: z.string().min(1),
  publisher: z.string().min(1),
});

export const groupKitEntrySchema = z.looseObject({
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
  // The live agent writes epoch ms; SCHEMA.md's example shows an ISO string.
  installedAt: z.union([z.number(), z.string()]).optional(),
});
export type GroupKitEntry = z.infer<typeof groupKitEntrySchema>;

export type GroupKitConfig = {
  version: number;
  kits: GroupKitEntry[];
};

const envelopeSchema = z.looseObject({
  version: z.number().int(),
  kits: z.array(z.unknown()).default([]),
});

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
