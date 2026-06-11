/**
 * Pure decisioning helpers for the re-engagement nudge scheduler.
 *
 * All functions here are deterministic and do not perform I/O. The
 * scheduler uses them to compute whether a tick should send anything.
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { NudgeStage } from "./nudge-messages.js";
import type { TlonSettingsStore } from "./settings.js";

export const DEFAULT_ACTIVE_HOURS_START = "09:00";
export const DEFAULT_ACTIVE_HOURS_END = "21:00";
export const DEFAULT_ACTIVE_HOURS_TIMEZONE = "America/New_York";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Whole 24-hour days between two absolute instants. */
export function daysBetween(earlierMs: number, laterMs: number): number {
  if (!Number.isFinite(earlierMs) || !Number.isFinite(laterMs)) {
    return 0;
  }
  const diff = laterMs - earlierMs;
  if (diff <= 0) {
    return 0;
  }
  return Math.floor(diff / ONE_DAY_MS);
}

/**
 * Map days-idle to the stage we'd like to have sent by now.
 *
 * Returns `null` when no nudge is wanted at this idle level.
 */
export function computeTargetStage(daysIdle: number): NudgeStage | null {
  if (daysIdle < 7) {return null;}
  if (daysIdle < 14) {return 1;}
  if (daysIdle < 30) {return 2;}
  return 3;
}

export type ActiveHours = {
  start: string;
  end: string;
  timezone: string;
};

const ACTIVE_HOURS_TIME_PATTERN = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/;

function resolveUserTimezone(cfg: OpenClawConfig | null | undefined): string {
  const configured = (
    cfg as { agents?: { defaults?: { userTimezone?: unknown } } } | null | undefined
  )?.agents?.defaults?.userTimezone;
  if (typeof configured === "string") {
    const trimmed = configured.trim();
    if (trimmed) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
        return trimmed;
      } catch {
        // Fall through to the host timezone below.
      }
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() || "UTC";
}

function resolveActiveHoursTimezone(
  cfg: OpenClawConfig | null | undefined,
  raw: unknown,
): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed || trimmed === "user") {
    return resolveUserTimezone(cfg);
  }
  if (trimmed === "local") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() || "UTC";
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return resolveUserTimezone(cfg);
  }
}

function parseActiveHoursTime(raw: unknown, opts: { allow24: boolean }): number | null {
  if (typeof raw !== "string") {return null;}
  const trimmed = raw.trim();
  if (!ACTIVE_HOURS_TIME_PATTERN.test(trimmed)) {return null;}
  const [hourStr, minuteStr] = trimmed.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {return null;}
  if (hour === 24) {
    if (!opts.allow24 || minute !== 0) {return null;}
    return 24 * 60;
  }
  return hour * 60 + minute;
}

/**
 * Return a trimmed `HH:MM` time string from `raw` if it parses against
 * `parseActiveHoursTime`. Returns `null` when `raw` is unset, empty, or
 * malformed. Callers use the `null` case to fall through to a lower-
 * precedence tier's value for that field.
 */
function overlayActiveHoursTime(
  raw: unknown,
  opts: { allow24: boolean },
): string | null {
  if (typeof raw !== "string") {return null;}
  const trimmed = raw.trim();
  if (!trimmed) {return null;}
  if (parseActiveHoursTime(trimmed, opts) == null) {return null;}
  return trimmed;
}

/**
 * Return an IANA timezone from `raw` when the user has explicitly set
 * the `nudgeActiveHoursTimezone` key to a valid zone or keyword
 * (`"user"` / `"local"`). Returns `null` when unset or malformed — the
 * caller falls through to the baseline timezone in that case.
 */
function overlayActiveHoursTimezone(
  cfg: OpenClawConfig | null | undefined,
  raw: unknown,
): string | null {
  if (typeof raw !== "string") {return null;}
  const trimmed = raw.trim();
  if (!trimmed) {return null;}
  if (trimmed === "user") {return resolveUserTimezone(cfg);}
  if (trimmed === "local") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() || null;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return null;
  }
}

function activeHoursFromShape(
  cfg: OpenClawConfig | null | undefined,
  raw: { start?: unknown; end?: unknown; timezone?: unknown } | undefined | null,
): ActiveHours | null {
  if (!raw) {return null;}
  const start = typeof raw.start === "string" ? raw.start.trim() : undefined;
  const end = typeof raw.end === "string" ? raw.end.trim() : undefined;
  if (!start || !end) {
    return null;
  }
  if (
    parseActiveHoursTime(start, { allow24: false }) == null ||
    parseActiveHoursTime(end, { allow24: true }) == null
  ) {
    return null;
  }
  return {
    start,
    end,
    timezone: resolveActiveHoursTimezone(cfg, raw.timezone),
  };
}

function activeHoursFromChannelsTlon(
  cfg: OpenClawConfig | null | undefined,
): ActiveHours | null {
  const tlon = (
    cfg as { channels?: { tlon?: { nudgeActiveHours?: unknown } } } | null | undefined
  )?.channels?.tlon;
  const raw = (tlon as { nudgeActiveHours?: unknown } | undefined)?.nudgeActiveHours;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return activeHoursFromShape(
    cfg,
    raw as { start?: unknown; end?: unknown; timezone?: unknown },
  );
}

function activeHoursFromFileConfig(cfg: OpenClawConfig | null | undefined): ActiveHours | null {
  const agentsDefaults = (
    cfg as { agents?: { defaults?: { heartbeat?: { activeHours?: unknown } } } } | null | undefined
  )?.agents?.defaults?.heartbeat?.activeHours;
  if (!agentsDefaults || typeof agentsDefaults !== "object") {
    return null;
  }
  return activeHoursFromShape(
    cfg,
    agentsDefaults as { start?: unknown; end?: unknown; timezone?: unknown },
  );
}

/**
 * Four-tier fallback for active hours, applied as a field-wise overlay:
 *   1. Settings store keys (`nudgeActiveHours*`) — runtime-tunable via
 *      %settings. Each of `start` / `end` / `timezone` is overlaid
 *      individually over the baseline below; a partial settings edit
 *      (e.g. timezone-only, or single bound) takes effect without
 *      forcing operators to rewrite the full triple.
 *   2. Plugin file config at `cfg.channels.tlon.nudgeActiveHours` — a
 *      first-class static override for deployments that want the plugin
 *      scheduler to run on a fixed window without reusing the legacy
 *      heartbeat block.
 *   3. Backwards-compat at `cfg.agents.defaults.heartbeat.activeHours` —
 *      preserves behavior for tlawn.py-generated hosted configs that set
 *      the legacy heartbeat block.
 *   4. Hard-coded defaults (`09:00`–`21:00`, `America/New_York`).
 *
 * Malformed settings values (bad `HH:MM`, unknown timezone) fall
 * through to the baseline for that specific field, so a broken
 * individual key cannot promote a broken settings tier over a valid
 * lower-precedence configuration.
 */
export function resolveActiveHours(
  settings: TlonSettingsStore,
  cfg: OpenClawConfig | null | undefined,
): ActiveHours {
  const baseline =
    activeHoursFromChannelsTlon(cfg) ??
    activeHoursFromFileConfig(cfg) ?? {
      start: DEFAULT_ACTIVE_HOURS_START,
      end: DEFAULT_ACTIVE_HOURS_END,
      timezone: DEFAULT_ACTIVE_HOURS_TIMEZONE,
    };

  const startOverride = overlayActiveHoursTime(
    settings.nudgeActiveHoursStart,
    { allow24: false },
  );
  const endOverride = overlayActiveHoursTime(settings.nudgeActiveHoursEnd, {
    allow24: true,
  });
  const timezoneOverride = overlayActiveHoursTimezone(
    cfg,
    settings.nudgeActiveHoursTimezone,
  );

  return {
    start: startOverride ?? baseline.start,
    end: endOverride ?? baseline.end,
    timezone: timezoneOverride ?? baseline.timezone,
  };
}

/**
 * Derive "HH:MM" for `date` in the given IANA timezone.
 */
function formatLocalHhMm(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  let hh = "00";
  let mm = "00";
  for (const part of parts) {
    if (part.type === "hour") {hh = part.value;}
    if (part.type === "minute") {mm = part.value;}
  }
  // `Intl.DateTimeFormat` with `hour12: false` can yield "24:00" at midnight
  // on some engines; normalize to "00:00" for comparison consistency.
  if (hh === "24") {hh = "00";}
  return `${hh}:${mm}`;
}

function resolveMinutesInTimeZone(date: Date, timezone: string): number | null {
  const local = formatLocalHhMm(date, timezone);
  const [hourStr, minuteStr] = local.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  return hour * 60 + minute;
}

/**
 * `true` when `date` falls inside `[start, end)` in the configured timezone.
 * Supports wrap-around windows (e.g. `22:00`–`06:00`).
 */
export function inActiveHours(date: Date, activeHours: ActiveHours): boolean {
  const startMin = parseActiveHoursTime(activeHours.start, { allow24: false });
  const endMin = parseActiveHoursTime(activeHours.end, { allow24: true });
  if (startMin == null || endMin == null) {
    return true;
  }
  if (startMin === endMin) {
    // Match OpenClaw heartbeat semantics: equal bounds form a zero-width
    // window, so scheduled work is always outside the active window.
    return false;
  }
  const now = resolveMinutesInTimeZone(date, activeHours.timezone);
  if (now == null) {
    return true;
  }
  if (endMin > startMin) {
    return now >= startMin && now < endMin;
  }
  // Wrap-around: e.g. 22:00 – 06:00.
  return now >= startMin || now < endMin;
}

/**
 * Resolve the most authoritative last-owner-activity timestamp (epoch ms).
 *
 * Prefers the synchronous in-memory shadow over the settings mirror, since
 * the shadow is updated the moment the owner-reply handler observes a
 * message and cannot lag behind a subscription-delivered clear.
 */
export function resolveLastOwnerInstant(
  shadow: { at: number; date: string } | null,
  settings: TlonSettingsStore,
): number | null {
  if (shadow && typeof shadow.at === "number" && Number.isFinite(shadow.at)) {
    return shadow.at;
  }
  if (typeof settings.lastOwnerMessageAt === "number") {
    return settings.lastOwnerMessageAt;
  }
  if (typeof settings.lastOwnerMessageDate === "string") {
    const parsed = Date.parse(settings.lastOwnerMessageDate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Small convenience used by tests to describe the all-green path.
 */
export type ShouldSendInputs = {
  targetStage: NudgeStage | null;
  lastNudgeStage: number;
  ownerShip: string | null;
  isInActiveHours: boolean;
};

export function shouldSend(inputs: ShouldSendInputs): boolean {
  if (inputs.targetStage == null) {return false;}
  if (!inputs.ownerShip) {return false;}
  if (!inputs.isInActiveHours) {return false;}
  return inputs.targetStage > inputs.lastNudgeStage;
}
