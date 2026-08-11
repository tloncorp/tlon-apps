import { z } from 'zod';

import { createDevLogger } from '../lib/logger';

const logger = createDevLogger('groupKitConfig', false);

// Parsed representation of the kit install config the %kits agent writes
// into a group's blob at install time. See kits/SCHEMA.md §2 for the source
// of truth. Readers must tolerate unknown keys and skip malformed kits[]
// entries rather than crash.

const GroupKitScheduleSchema = z.object({
  id: z.string().min(1),
  cron: z.string().min(1),
});

export type GroupKitSchedule = z.infer<typeof GroupKitScheduleSchema>;

const GroupKitEntrySchema = z.object({
  installId: z.string().min(1),
  kit: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    publisher: z.string().min(1),
  }),
  /** abstract place name -> concrete channel nest */
  places: z.record(z.string()).default({}),
  schedules: z.array(GroupKitScheduleSchema).default([]),
  /** ships whose bots are authorized to execute this kit here */
  agents: z.array(z.string()).default([]),
  setup: z.enum(['pending', 'done']).default('pending'),
  installedAt: z.number().optional(),
});

export type GroupKitEntry = z.infer<typeof GroupKitEntrySchema>;

export interface GroupKitConfig {
  kits: GroupKitEntry[];
}

const GroupKitConfigEnvelopeSchema = z.object({
  version: z.literal(1),
  kits: z.array(z.unknown()),
});

/**
 * Parse a group's blob into its kit install config. Returns null when the
 * blob is absent, isn't JSON, or isn't a version-1 kit config. Malformed
 * entries in `kits` are skipped.
 */
export function parseGroupKitConfig(
  blob: string | null | undefined
): GroupKitConfig | null {
  if (!blob) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch (error) {
    logger.log('failed to parse group blob as JSON', { blob, error });
    return null;
  }

  const envelope = GroupKitConfigEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    return null;
  }

  const kits = envelope.data.kits.flatMap((entry) => {
    const result = GroupKitEntrySchema.safeParse(entry);
    if (!result.success) {
      logger.log('skipping malformed group kit entry', { entry });
      return [];
    }
    return [result.data];
  });

  return { kits };
}
