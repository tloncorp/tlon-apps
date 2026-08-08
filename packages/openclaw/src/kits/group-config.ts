/**
 * Kits group install config: the JSON payload written into a group's `blob`
 * field by the %kits agent at install time (see kits/SCHEMA.md §2 and
 * desk/lib/kits-json.hoon `+config`).
 *
 * The blob is group-owned state: it replicates with the group and tells an
 * executing harness which kits run there and how their abstract places map to
 * concrete channels. Readers must tolerate unknown keys and skip malformed
 * `kits[]` entries without throwing (forward compatibility).
 */
import { z } from 'zod';

export const KITS_BLOB_VERSION = 1;

const KitRefSchema = z.looseObject({
  id: z.string().min(1),
  version: z.string().min(1),
  publisher: z.string().min(1),
});

const KitScheduleRefSchema = z.looseObject({
  id: z.string().min(1),
  cron: z.string().min(1),
});

export const InstalledKitConfigSchema = z.looseObject({
  installId: z.string().min(1),
  kit: KitRefSchema,
  places: z.record(z.string(), z.string()).default({}),
  schedules: z.array(KitScheduleRefSchema).default([]),
  agents: z.array(z.string()).default([]),
  // "pending" | "done" on the wire today; keep open for forward compat.
  setup: z.string().default('done'),
  // Written as epoch ms by the live agent; SCHEMA.md shows an ISO string.
  installedAt: z.union([z.number(), z.string()]).optional(),
});

export type InstalledKitConfig = z.infer<typeof InstalledKitConfigSchema>;

export type KitsGroupConfig = {
  version: number;
  kits: InstalledKitConfig[];
};

const BlobEnvelopeSchema = z.looseObject({
  version: z.number().int(),
  kits: z.array(z.unknown()).default([]),
});

/**
 * Parse a group blob string into a kits config. Returns null when the blob is
 * absent, not JSON, not a kits payload, or an unknown version. Malformed
 * entries inside `kits[]` are skipped individually, never thrown on.
 */
export function parseKitsBlob(
  blob: string | null | undefined,
  opts?: { log?: (msg: string) => void }
): KitsGroupConfig | null {
  if (typeof blob !== 'string' || !blob.trim()) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(blob);
  } catch {
    opts?.log?.('[tlon] kits: group blob is not valid JSON; ignoring');
    return null;
  }
  const envelope = BlobEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    opts?.log?.('[tlon] kits: group blob is not a kits config; ignoring');
    return null;
  }
  if (envelope.data.version !== KITS_BLOB_VERSION) {
    opts?.log?.(
      `[tlon] kits: unknown blob config version ${envelope.data.version}; ignoring`
    );
    return null;
  }
  const kits: InstalledKitConfig[] = [];
  for (const entry of envelope.data.kits) {
    const parsed = InstalledKitConfigSchema.safeParse(entry);
    if (parsed.success) {
      kits.push(parsed.data);
    } else {
      opts?.log?.('[tlon] kits: skipping malformed kits[] entry in group blob');
    }
  }
  return { version: envelope.data.version, kits };
}

/** `~host/name` → `{ host, name }`, or null when the flag is malformed. */
export function parseGroupFlag(
  flag: string
): { host: string; name: string } | null {
  const match = /^(~[a-z-]+)\/([a-z0-9-]+)$/i.exec(flag.trim());
  if (!match) {
    return null;
  }
  return { host: match[1], name: match[2] };
}

const DEFAULT_TTL_MS = 60_000;

export type GroupConfigReader = {
  /** Cached read of the group's kits config (null = no kit config). */
  get(groupFlag: string): Promise<KitsGroupConfig | null>;
  /** Drop the cache entry (e.g. on a %groups blob update fact). */
  invalidate(groupFlag: string): void;
  clear(): void;
};

/**
 * TTL-cached reader for group kit configs, backed by the targeted scry
 * `/groups/v3/ui/groups/<host>/<name>.json` (group-ui-3 carries a top-level
 * `blob` string field). Cache entries — including negative results — expire
 * after `ttlMs` and can be invalidated eagerly from %groups blob events.
 */
export function createGroupConfigReader(deps: {
  scry: (path: string) => Promise<unknown>;
  ttlMs?: number;
  now?: () => number;
  log?: (msg: string) => void;
}): GroupConfigReader {
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const now = deps.now ?? Date.now;
  const cache = new Map<
    string,
    { at: number; config: KitsGroupConfig | null }
  >();
  const inFlight = new Map<string, Promise<KitsGroupConfig | null>>();

  const fetchConfig = async (
    groupFlag: string
  ): Promise<KitsGroupConfig | null> => {
    const parsed = parseGroupFlag(groupFlag);
    if (!parsed) {
      deps.log?.(`[tlon] kits: cannot parse group flag ${groupFlag}`);
      return null;
    }
    const response = (await deps.scry(
      `/groups/v3/ui/groups/${parsed.host}/${parsed.name}.json`
    )) as { blob?: unknown } | null;
    const blob = typeof response?.blob === 'string' ? response.blob : null;
    return parseKitsBlob(blob, { log: deps.log });
  };

  return {
    async get(groupFlag: string): Promise<KitsGroupConfig | null> {
      const cached = cache.get(groupFlag);
      if (cached && now() - cached.at < ttlMs) {
        return cached.config;
      }
      const pending = inFlight.get(groupFlag);
      if (pending) {
        return pending;
      }
      const task = fetchConfig(groupFlag)
        .then((config) => {
          cache.set(groupFlag, { at: now(), config });
          return config;
        })
        .finally(() => {
          inFlight.delete(groupFlag);
        });
      inFlight.set(groupFlag, task);
      return task;
    },
    invalidate(groupFlag: string): void {
      cache.delete(groupFlag);
    },
    clear(): void {
      cache.clear();
    },
  };
}
