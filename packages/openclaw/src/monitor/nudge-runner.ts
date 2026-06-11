/**
 * Plumbing layer that wires the pure nudge-scheduler to live Urbit API,
 * settings snapshot, shadows, telemetry, and the pending-nudge record.
 *
 * The runner owns the tick body. The scheduler owns the timer lifecycle.
 */
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import {
  computeTargetStage,
  daysBetween,
  inActiveHours,
  resolveActiveHours,
  resolveLastOwnerInstant,
} from '../nudge-decision.js';
import { NUDGE_MESSAGES, type NudgeStage } from '../nudge-messages.js';
import {
  DEFAULT_NUDGE_TICK_INTERVAL_MS,
  type NudgeScheduler,
  createNudgeScheduler,
} from '../nudge-scheduler.js';
import type { PendingNudge } from '../pending-nudge.js';
import { type TlonSettingsStore, parseSettingsResponse } from '../settings.js';
import type { TlonTelemetryClient } from '../telemetry.js';
import { listRunnableTlonAccountIds } from '../types.js';
import type { BotProfile } from '../urbit/send.js';
import type { UrbitSSEClient } from '../urbit/sse-client.js';
import type { LastNudgeStageShadow, LastOwnerActivity } from './nudge-state.js';
import type { OwnerReplyPersistenceQueue } from './owner-reply-persistence.js';

export type NudgeRunnerStartDecision =
  | { start: true; reason: null }
  | { start: false; reason: 'flag-disabled' | 'multi-account'; detail: string };

/**
 * Decide whether the monitor should construct and start the nudge runner.
 *
 * Two gates:
 *  1. `channels.tlon.reengagement.enabled` must be explicitly `true`. The
 *     feature is default-off so self-hosted installs that configure
 *     `ownerShip` for approval DMs do not automatically get owner nudges.
 *  2. Exactly one Tlon account must be configured. The runner sends DMs
 *     through the global `@tloncorp/api` client configured by
 *     `configureTlonApiWithPoke`, and the last-started monitor wins that
 *     singleton — so multi-account mode is not safe until a per-account
 *     send path lands.
 *
 * Pure helper; does not read process state.
 */
export function shouldStartNudgeRunner(
  cfg: OpenClawConfig
): NudgeRunnerStartDecision {
  const reengagementEnabled =
    (cfg.channels?.tlon as { reengagement?: { enabled?: boolean } } | undefined)
      ?.reengagement?.enabled === true;
  if (!reengagementEnabled) {
    return {
      start: false,
      reason: 'flag-disabled',
      detail: 'channels.tlon.reengagement.enabled is not true',
    };
  }
  // Count *runnable* accounts (enabled + fully configured). Disabled or
  // half-configured stub entries should not trip the multi-account guard,
  // since they would never start a monitor and so cannot race the global
  // `@tloncorp/api` singleton with the active account.
  const accountIds = listRunnableTlonAccountIds(cfg);
  if (accountIds.length !== 1) {
    return {
      start: false,
      reason: 'multi-account',
      detail: `${accountIds.length} runnable Tlon accounts; runner requires exactly 1`,
    };
  }
  return { start: true, reason: null };
}

export type NudgeRunnerDeps = {
  accountId: string;
  botShip: string;
  api: Pick<UrbitSSEClient, 'scry' | 'poke'>;
  cfg: OpenClawConfig;
  getSettings: () => TlonSettingsStore;
  getEffectiveOwnerShip: (accountId: string) => string | null;
  getLastOwnerActivity: (accountId: string) => LastOwnerActivity | null;
  getLastNudgeStageShadow: (accountId: string) => LastNudgeStageShadow | null;
  setLastNudgeStageShadow: (
    accountId: string,
    stage: LastNudgeStageShadow
  ) => void;
  setLocalPendingNudge: (accountId: string, nudge: PendingNudge) => void;
  sendDm: (params: {
    fromShip: string;
    toShip: string;
    text: string;
    botProfile?: BotProfile;
  }) => Promise<{ channel: 'tlon'; messageId: string; sentAt: number }>;
  getBotProfile?: () => BotProfile | undefined;
  telemetry?: TlonTelemetryClient | null;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  intervalMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
  /**
   * Ordered persistence queue used by the owner-reply handler. The runner
   * needs this to issue a `lastNudgeStage` del-entry when it detects a
   * reply-during-poke race, since the handler itself may have observed
   * `shadowStage === 0` in that window and skipped the clear.
   */
  ownerReplyPersistence?: Pick<OwnerReplyPersistenceQueue, 'enqueueStageClear'>;
};

export type NudgeRunner = {
  start: () => void;
  /**
   * Stop the runner and await any in-flight tick. Caller-serializable:
   * callers should `await runner.stop()` before flushing persistence
   * queues or closing `api`.
   */
  stop: () => Promise<void>;
  tickNow: () => Promise<void>;
};

export function createNudgeRunner(deps: NudgeRunnerDeps): NudgeRunner {
  const now = deps.now ?? (() => Date.now());
  const intervalMs = deps.intervalMs ?? DEFAULT_NUDGE_TICK_INTERVAL_MS;

  /**
   * Resolve the authoritative `lastNudgeStage` for the duplicate-prevention
   * guard.
   *
   * The shadow is updated synchronously by every trusted path (post-poke
   * advance, owner-reply clear, subscription reconcile, fresh-refresh
   * reconcile) and is never downgraded from a stale scry. It is therefore
   * authoritative for the guard: returning it honors a trusted lower or
   * clear immediately — even if `/settings/all.json` still lags with the
   * old higher value — and still short-circuits duplicates when a local
   * advance has not yet propagated to storage.
   *
   * A best-effort scry is kept for observability so operators can see
   * subscription-lag drift in the logs, but its value does not feed the
   * guard. Admin raises delivered while subscription is dead catch up
   * through the periodic fresh-refresh path (`applySettingsSnapshot`
   * with `fresh: true`), which updates the shadow before the next tick.
   */
  async function resolveAuthoritativeStage(): Promise<number> {
    const shadow = deps.getLastNudgeStageShadow(deps.accountId) ?? 0;
    try {
      const raw = await deps.api.scry('/settings/all.json');
      const bucket = (raw as { all?: Record<string, unknown> })?.all?.moltbot;
      const parsed = parseSettingsResponse(bucket ?? {});
      const fresh = parsed.lastNudgeStage ?? 0;
      if (fresh !== shadow) {
        deps.runtime?.log?.(
          `[tlon] nudge: stage shadow=${shadow} scry=${fresh} — shadow wins (trusted path)`
        );
      }
    } catch (err) {
      deps.runtime?.error?.(
        `[tlon] nudge: fresh lastNudgeStage scry failed: ${String(err)}`
      );
    }
    return shadow;
  }

  async function pokeLastNudgeStage(stage: NudgeStage): Promise<void> {
    await deps.api.poke({
      app: 'settings',
      mark: 'settings-event',
      json: {
        'put-entry': {
          desk: 'moltbot',
          'bucket-key': 'tlon',
          'entry-key': 'lastNudgeStage',
          value: stage,
        },
      },
    });
  }

  /**
   * Re-read owner activity through the same shadow/mirror resolver the
   * tick used at its top. Returns true when activity has advanced since
   * the threshold captured at the start of the tick. Used to suppress
   * a stale send and to skip recording a fresh `pendingNudge` after the
   * owner has resumed activity mid-tick.
   */
  function ownerActivityAdvancedSince(thresholdMs: number): boolean {
    const recheck = resolveLastOwnerInstant(
      deps.getLastOwnerActivity(deps.accountId),
      deps.getSettings()
    );
    return recheck != null && recheck > thresholdMs;
  }

  async function tick(): Promise<void> {
    if (deps.abortSignal?.aborted) {
      return;
    }

    const settings = deps.getSettings();
    const ownerShip = deps.getEffectiveOwnerShip(deps.accountId);
    if (!ownerShip) {
      return;
    }

    const activeHours = resolveActiveHours(settings, deps.cfg);
    if (!inActiveHours(new Date(now()), activeHours)) {
      return;
    }

    const lastOwnerAt = resolveLastOwnerInstant(
      deps.getLastOwnerActivity(deps.accountId),
      settings
    );
    if (lastOwnerAt == null) {
      return;
    }

    const idle = daysBetween(lastOwnerAt, now());
    const targetStage = computeTargetStage(idle);
    if (targetStage == null) {
      return;
    }

    const freshStage = await resolveAuthoritativeStage();
    if (targetStage <= freshStage) {
      return;
    }

    try {
      await pokeLastNudgeStage(targetStage);
    } catch (err) {
      deps.runtime?.error?.(
        `[tlon] nudge: failed to advance lastNudgeStage to ${targetStage}: ${String(err)}`
      );
      return;
    }

    // Pre-send recheck runs BEFORE committing the local shadow advance.
    // If the owner reply handler ran during the poke await, it observed
    // `shadowStage === 0` (we hadn't advanced yet) and `pending === null`,
    // so `willClearStage` was false and it skipped the del-entry. We
    // need to restore the stage-reset invariant ourselves: leave the
    // shadow at whatever the handler set (0) and enqueue a stage clear
    // through the ordered persistence queue so activity put-entries
    // settle before the del-entry lands, matching the crash-consistency
    // rules the handler normally observes.
    if (ownerActivityAdvancedSince(lastOwnerAt)) {
      deps.runtime?.log?.(
        `[tlon] nudge: owner replied between scry and send; clearing stage ${targetStage} for next cycle`
      );
      deps.setLastNudgeStageShadow(deps.accountId, 0);
      deps.ownerReplyPersistence?.enqueueStageClear();
      return;
    }

    // Commit the advance now that we know we'll actually send. Placing
    // this write after the recheck avoids leaving the shadow stuck at
    // `targetStage` on the race above.
    deps.setLastNudgeStageShadow(deps.accountId, targetStage);

    const content = NUDGE_MESSAGES[targetStage];
    // `localSentAt` is captured before the network call as a fallback for
    // log/telemetry call sites that need *some* timestamp when the send
    // failed and the canonical value is unavailable. The DM's actual sent
    // timestamp comes from the send result and is preferred everywhere
    // it's available — see `nudgeSentAtMs` and the success-path
    // `setLocalPendingNudge` write below.
    const localSentAt = now();
    let sent = false;
    let sendResult: {
      channel: 'tlon';
      messageId: string;
      sentAt: number;
    } | null = null;
    try {
      sendResult = await deps.sendDm({
        fromShip: deps.botShip,
        toShip: ownerShip,
        text: content,
        botProfile: deps.getBotProfile?.(),
      });
      sent = true;
    } catch (sendErr) {
      deps.runtime?.error?.(
        `[tlon] nudge: send failed after stage advance (stage ${targetStage}): ${String(sendErr)}`
      );
    }

    const canonicalSentAt = sent && sendResult ? sendResult.sentAt : null;
    const messageId = sent && sendResult ? sendResult.messageId : null;

    try {
      deps.telemetry?.captureHeartbeatNudge({
        ownerShip,
        botShip: deps.botShip,
        nudgeStage: targetStage,
        nudgeTarget: ownerShip,
        channel: 'tlon',
        success: sent,
        accountId: deps.accountId,
        messageId,
        nudgeSentAtMs: canonicalSentAt,
      });
    } catch (err) {
      deps.runtime?.error?.(
        `[tlon] nudge: telemetry capture failed: ${String(err)}`
      );
    }

    if (sent) {
      // Post-send recheck: the DM is already on the wire, but if the
      // owner replied during the `await sendDm` we must not record a
      // fresh `pendingNudge`. That record powers reply-context injection
      // for the next 72h, and writing it after a real reply would
      // misattribute their message to a nudge we sent moments later.
      if (ownerActivityAdvancedSince(lastOwnerAt)) {
        deps.runtime?.log?.(
          `[tlon] nudge: owner replied during stage ${targetStage} send; not recording pendingNudge`
        );
        return;
      }
      try {
        deps.setLocalPendingNudge(deps.accountId, {
          // Use the canonical send-result timestamp so the pending-nudge
          // record agrees with the telemetry event's `nudgeSentAtMs`. The
          // null-coalesce can only fire if the send "succeeded" but the
          // result is missing — defensive belt-and-braces only.
          sentAt: canonicalSentAt ?? localSentAt,
          stage: targetStage,
          ownerShip,
          accountId: deps.accountId,
          content,
        });
      } catch (err) {
        deps.runtime?.error?.(
          `[tlon] nudge: setLocalPendingNudge failed: ${String(err)}`
        );
      }
      deps.runtime?.log?.(
        `[tlon] nudge: sent stage ${targetStage} to ${ownerShip}`
      );
    }
  }

  const scheduler: NudgeScheduler = createNudgeScheduler({
    tick,
    intervalMs,
    abortSignal: deps.abortSignal,
    log: (msg) => deps.runtime?.log?.(msg),
    error: (msg) => deps.runtime?.error?.(msg),
  });

  return {
    start: () => scheduler.start(),
    stop: () => scheduler.stop(),
    tickNow: () => scheduler.tickNow(),
  };
}
