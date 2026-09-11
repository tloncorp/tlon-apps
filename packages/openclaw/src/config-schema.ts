import { buildChannelConfigSchema } from 'openclaw/plugin-sdk/core';
import { z } from 'zod';

const ShipSchema = z.string().trim().min(1);
const ChannelNestSchema = z.string().min(1);

export const TlonChannelRuleSchema = z.object({
  // "allowlist" is the current value; "restricted" is accepted for legacy
  // configs. Both gate senders; only "open" is unrestricted.
  mode: z.enum(['restricted', 'allowlist', 'open']).optional(),
  allowedShips: z.array(ShipSchema).optional(),
});

export const TlonAuthorizationSchema = z.object({
  channelRules: z.record(z.string(), TlonChannelRuleSchema).optional(),
});

export const ReactionLevelSchema = z.enum([
  'off',
  'ack',
  'minimal',
  'extensive',
]);
export const TlonTelemetrySchema = z.object({
  enabled: z.boolean().optional(),
  apiKey: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
});

export const TlonLifecycleSchema = z.object({
  runTimeoutMs: z.number().int().min(1_000).optional(),
  toolTimeoutMs: z.number().int().min(1_000).optional(),
});

/**
 * Context lens: per-run bot introspection surfaced in Tlon clients.
 *
 * Default-off. When enabled, the plugin records run metadata (trigger, tool
 * calls, output) and serves it over gateway HTTP routes. `authToken` is
 * required for those routes to register — lens data exposes bot internals,
 * so there is no unauthenticated mode.
 */
export const TlonContextLensStoreSchema = z.object({
  enabled: z.boolean().optional(),
  path: z.string().min(1).optional(),
  retainDays: z.number().int().min(1).optional(),
  maxStored: z.number().int().min(1).optional(),
});

export const TlonContextLensSchema = z.object({
  enabled: z.boolean().optional(),
  ttlMs: z.number().int().min(60_000).optional(),
  maxEntries: z.number().int().min(1).optional(),
  visibilityDefault: z.enum(['owner', 'participants', 'internal']).optional(),
  authToken: z.string().min(16).optional(),
  allowedOrigins: z.array(z.string().min(1)).optional(),
  // Fallback owner for the %steward ship sync, used only when `ownerShip`
  // is unset. `ownerShip` always wins: the value configures %steward's
  // SHARED owner, which also gates prompt-edit authorization and routing.
  owner: ShipSchema.optional(),
  // Durable on-disk history of finalized runs (default on when the lens is
  // enabled). Hosted deployments with ephemeral disks can point `path` at a
  // mounted volume or set `enabled: false` — the store is a restart
  // backstop, not the source of truth.
  store: TlonContextLensStoreSchema.optional(),
});

/**
 * Canonical private-network opt-in. The flat top-level
 * `allowPrivateNetwork` field below is kept as a deprecated alias; new
 * configs should use `network.dangerouslyAllowPrivateNetwork`.
 * `openclaw doctor --fix` migrates the legacy field automatically.
 */
export const TlonNetworkSchema = z.object({
  dangerouslyAllowPrivateNetwork: z.boolean().optional(),
});

/**
 * Explicit opt-in for the plugin-driven owner re-engagement nudge scheduler.
 *
 * Default-off. The scheduler is hosted-only and requires `ownerShip` to
 * target delivery, but `ownerShip` alone must not enable nudges (it also
 * gates unrelated approval/admin DM flows). This flag is the authoritative
 * enablement signal — see `tlonbot/entrypoint/tlawn.py` for the hosted
 * generator that turns it on.
 */
export const TlonReengagementSchema = z.object({
  enabled: z.boolean().optional(),
});

/**
 * Static file-config override for the plugin scheduler's active-hours
 * window. Takes precedence over `agents.defaults.heartbeat.activeHours`
 * but defers to `%settings` keys (`nudgeActiveHoursStart/End/Timezone`)
 * when those are present.
 */
export const TlonNudgeActiveHoursSchema = z.object({
  start: z.string().min(1).optional(),
  end: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
});

/**
 * Ship-managed system prompt overrides, keyed by workspace file name
 * (e.g. "SOUL.md"). Prompt sync writes these when the owner edits a prompt
 * via %steward; the ship remains the store of record and re-seeds them on
 * every gateway boot.
 */
export const TlonPromptsSchema = z.record(z.string().min(1), z.string());

export const TlonAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  ship: ShipSchema.optional(),
  url: z.string().optional(),
  code: z.string().optional(),
  network: TlonNetworkSchema.optional(),
  /** @deprecated Use `network.dangerouslyAllowPrivateNetwork`. Migrated by `openclaw doctor --fix`. */
  allowPrivateNetwork: z.boolean().optional(),
  groupChannels: z.array(ChannelNestSchema).optional(),
  dmAllowlist: z.array(ShipSchema).optional(),
  groupInviteAllowlist: z.array(ShipSchema).optional(),
  autoDiscoverChannels: z.boolean().optional(),
  showModelSignature: z.boolean().optional(),
  // Auto-accept settings
  autoAcceptDmInvites: z.boolean().optional(), // Auto-accept DMs from ships in dmAllowlist
  autoAcceptGroupInvites: z.boolean().optional(), // No longer governs group-invite authorization (groupInviteAllowlist does); retained for channel persistence and back-compat
  // Owner ship for approval system
  ownerShip: ShipSchema.optional(), // Ship that receives approval requests and can approve/deny
  // Reaction level: off (no reactions), ack (notify only), minimal (react sparingly), extensive (react freely)
  reactionLevel: ReactionLevelSchema.optional(),
  // Rate limiting for bot-to-bot responses
  maxConsecutiveBotResponses: z.number().int().min(0).optional(), // Max consecutive responses to another bot (default: 3)
  telemetry: TlonTelemetrySchema.optional(),
  lifecycle: TlonLifecycleSchema.optional(),
  contextLens: TlonContextLensSchema.optional(),
  // Owner-listen: in channels hosted by the owner or the bot itself, engage
  // on owner messages without requiring an @-mention. Default: enabled.
  ownerListenEnabled: z.boolean().optional(),
  // Channels (chat/heap/diary nests) opted out of owner-listen even when the
  // global toggle is on. Owner messages in these channels still require an
  // @-mention to engage the bot.
  ownerListenDisabledChannels: z.array(ChannelNestSchema).optional(),
  // Ship-managed system prompt overrides (see TlonPromptsSchema).
  prompts: TlonPromptsSchema.optional(),
  // Bot ship the prompts cache was generated for; a repointed account slot
  // invalidates a cache stamped for a different ship.
  promptsShip: z.string().optional(),
});

export const TlonConfigSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  ship: ShipSchema.optional(),
  url: z.string().optional(),
  code: z.string().optional(),
  network: TlonNetworkSchema.optional(),
  /** @deprecated Use `network.dangerouslyAllowPrivateNetwork`. Migrated by `openclaw doctor --fix`. */
  allowPrivateNetwork: z.boolean().optional(),
  groupChannels: z.array(ChannelNestSchema).optional(),
  dmAllowlist: z.array(ShipSchema).optional(),
  groupInviteAllowlist: z.array(ShipSchema).optional(),
  autoDiscoverChannels: z.boolean().optional(),
  showModelSignature: z.boolean().optional(),
  authorization: TlonAuthorizationSchema.optional(),
  defaultAuthorizedShips: z.array(ShipSchema).optional(),
  accounts: z.record(z.string(), TlonAccountSchema).optional(),
  // Auto-accept settings
  autoAcceptDmInvites: z.boolean().optional(), // Auto-accept DMs from ships in dmAllowlist
  autoAcceptGroupInvites: z.boolean().optional(), // No longer governs group-invite authorization (groupInviteAllowlist does); retained for channel persistence and back-compat
  // Owner ship for approval system
  ownerShip: ShipSchema.optional(), // Ship that receives approval requests and can approve/deny
  // Reaction level: off (no reactions), ack (notify only), minimal (react sparingly), extensive (react freely)
  reactionLevel: ReactionLevelSchema.optional(),
  // Rate limiting for bot-to-bot responses
  maxConsecutiveBotResponses: z.number().int().min(0).optional(), // Max consecutive responses to another bot (default: 3)
  telemetry: TlonTelemetrySchema.optional(),
  lifecycle: TlonLifecycleSchema.optional(),
  contextLens: TlonContextLensSchema.optional(),
  // Opt-in hosted-only re-engagement nudges; absent/false keeps the
  // scheduler off even when ownerShip is configured.
  reengagement: TlonReengagementSchema.optional(),
  // Optional static file-config override for the plugin scheduler's
  // active hours. See TlonNudgeActiveHoursSchema for precedence.
  nudgeActiveHours: TlonNudgeActiveHoursSchema.optional(),
  // Owner-listen: in channels hosted by the owner or the bot itself, engage
  // on owner messages without requiring an @-mention. Default: enabled.
  ownerListenEnabled: z.boolean().optional(),
  // Channels (chat/heap/diary nests) opted out of owner-listen even when the
  // global toggle is on. Owner messages in these channels still require an
  // @-mention to engage the bot.
  ownerListenDisabledChannels: z.array(ChannelNestSchema).optional(),
  // Ship-managed system prompt overrides (see TlonPromptsSchema).
  prompts: TlonPromptsSchema.optional(),
  // Bot ship the prompts cache was generated for; a repointed account slot
  // invalidates a cache stamped for a different ship.
  promptsShip: z.string().optional(),
  // Prompt-sync shadow ledger, written by prompt sync alongside the
  // per-account caches. Keyed by SHIP and living OUTSIDE the account
  // blocks, so deleting or repointing an account keeps a record of the
  // prompt text its owner edited onto the shared agent workspace — the
  // next syncing authority filters those texts out of its seed instead of
  // leaking them to a different ship.
  promptSync: z
    .object({
      // Per-ship, per-name HISTORY of edited texts (bounded) — older texts
      // may still sit on the shared workspace if an apply failed.
      ships: z.record(
        z.string().min(1),
        z.record(z.string().min(1), z.array(z.string()))
      ),
      // Per-ship, per-name text last successfully APPLIED to the workspace
      // files. Never evicted — it is by definition what may still be on
      // disk, so the foreign filter must always recognize it.
      applied: z.record(z.string().min(1), TlonPromptsSchema).optional(),
      // Per-FILE owner stamp: which ship's stored edits last wrote this
      // workspace file. Provenance by ownership, not text inference —
      // entrypoints legitimately rewrite prompt files (re-appending marked
      // blocks), so a former owner's file can differ from every recorded
      // text while still carrying their content.
      files: z.record(z.string().min(1), z.string()).optional(),
    })
    .optional(),
});

// Cast bridges a type-only mismatch: this repo's zod and openclaw's bundled
// zod can resolve to different minors (e.g. under pnpm 9, which doesn't dedup
// across openclaw's nested postinstall). The two copies are runtime-compatible
// — only zod's literal `version.minor` narrowing differs. Cast to the
// function's declared parameter type so we adopt whichever zod openclaw uses.
export const tlonChannelConfigSchema = buildChannelConfigSchema(
  TlonConfigSchema as unknown as Parameters<typeof buildChannelConfigSchema>[0]
);
