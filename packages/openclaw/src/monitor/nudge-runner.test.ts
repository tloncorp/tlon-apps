import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingNudge } from "../pending-nudge.js";
import type { TlonSettingsStore } from "../settings.js";
import type { LastNudgeStageShadow, LastOwnerActivity } from "./nudge-state.js";
import { NUDGE_MESSAGES } from "../nudge-messages.js";
import {
  createNudgeRunner,
  shouldStartNudgeRunner,
  type NudgeRunnerDeps,
} from "./nudge-runner.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_ID = "default";
const BOT_SHIP = "~nec";
const OWNER_SHIP = "~zod";

type Harness = {
  run: () => Promise<void>;
  stop: () => Promise<void>;
  api: {
    scry: ReturnType<typeof vi.fn>;
    poke: ReturnType<typeof vi.fn>;
  };
  sendDm: ReturnType<typeof vi.fn>;
  setLocalPendingNudge: ReturnType<typeof vi.fn>;
  setLastNudgeStageShadow: ReturnType<typeof vi.fn>;
  telemetry: { captureHeartbeatNudge: ReturnType<typeof vi.fn> };
  deps: NudgeRunnerDeps;
  ownerActivity: { value: LastOwnerActivity | null };
  stageShadow: { value: LastNudgeStageShadow | null };
  enqueueStageClear: ReturnType<typeof vi.fn>;
  timeRef: { value: number };
};

type SendDmResult = { channel: "tlon"; messageId: string; sentAt: number };

type HarnessOpts = {
  now: number;
  owner?: string | null;
  settings?: TlonSettingsStore;
  shadowActivity?: LastOwnerActivity | null;
  shadowStage?: LastNudgeStageShadow | null;
  scryResult?: unknown;
  scryImpl?: () => Promise<unknown>;
  pokeImpl?: () => Promise<unknown>;
  sendDmImpl?: () => Promise<SendDmResult>;
  cfg?: OpenClawConfig;
};

const DEFAULT_SEND_RESULT_SENT_AT = 1_700_000_000_000;
const DEFAULT_SEND_RESULT_MESSAGE_ID = `${BOT_SHIP}/default-fixture-id`;
function defaultSendResult(): SendDmResult {
  return {
    channel: "tlon",
    messageId: DEFAULT_SEND_RESULT_MESSAGE_ID,
    sentAt: DEFAULT_SEND_RESULT_SENT_AT,
  };
}

function makeHarness(opts: HarnessOpts): Harness {
  const ownerActivity = { value: opts.shadowActivity ?? null };
  const stageShadow = { value: opts.shadowStage ?? 0 };
  const timeRef = { value: opts.now };

  const api = {
    scry: vi
      .fn<(path: string) => Promise<unknown>>()
      .mockImplementation(
        opts.scryImpl ?? (async () => opts.scryResult ?? { all: { moltbot: { tlon: {} } } }),
      ),
    poke: vi
      .fn<(params: unknown) => Promise<unknown>>()
      .mockImplementation(opts.pokeImpl ?? (async () => undefined)),
  };
  const sendDm = vi
    .fn<(params: unknown) => Promise<SendDmResult>>()
    .mockImplementation(opts.sendDmImpl ?? (async () => defaultSendResult()));
  const setLocalPendingNudge = vi.fn<(accountId: string, nudge: PendingNudge) => void>();
  const setLastNudgeStageShadow = vi
    .fn<(accountId: string, stage: LastNudgeStageShadow) => void>()
    .mockImplementation((_id, stage) => {
      stageShadow.value = stage;
    });
  const telemetry = { captureHeartbeatNudge: vi.fn() };

  const cfg =
    opts.cfg ??
    ({
      channels: { tlon: { enabled: true } },
    } as unknown as OpenClawConfig);

  const enqueueStageClear = vi.fn<() => void>();

  const deps: NudgeRunnerDeps = {
    accountId: ACCOUNT_ID,
    botShip: BOT_SHIP,
    api,
    cfg,
    getSettings: () => opts.settings ?? {},
    getEffectiveOwnerShip: () => (opts.owner === undefined ? OWNER_SHIP : opts.owner),
    getLastOwnerActivity: () => ownerActivity.value,
    getLastNudgeStageShadow: () => stageShadow.value,
    setLastNudgeStageShadow,
    setLocalPendingNudge,
    sendDm,
    telemetry: telemetry as unknown as NudgeRunnerDeps["telemetry"],
    runtime: {
      log: () => undefined,
      error: () => undefined,
      exit: (_code: number): never => {
        throw new Error("exit");
      },
    },
    now: () => timeRef.value,
    intervalMs: 60_000,
    ownerReplyPersistence: { enqueueStageClear },
  };

  const runner = createNudgeRunner(deps);

  return {
    run: () => runner.tickNow(),
    stop: () => runner.stop(),
    api,
    sendDm,
    setLocalPendingNudge,
    setLastNudgeStageShadow,
    telemetry,
    deps,
    enqueueStageClear,
    timeRef,
    ownerActivity,
    stageShadow,
  };
}

function scryReturning(stage: number | undefined) {
  const tlon: Record<string, unknown> = {};
  if (stage != null) {tlon.lastNudgeStage = stage;}
  return { all: { moltbot: { tlon } } };
}

const activeHoursSettings: TlonSettingsStore = {
  nudgeActiveHoursStart: "00:00",
  nudgeActiveHoursEnd: "23:59",
  nudgeActiveHoursTimezone: "UTC",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("nudge-runner", () => {
  it("happy path: idle 8 days, fresh scry 0, sends stage 1", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: {
        ...activeHoursSettings,
        lastOwnerMessageAt: lastOwnerAt,
        lastOwnerMessageDate: "2026-04-13",
      },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(undefined),
    });

    await h.run();

    expect(h.api.scry).toHaveBeenCalledWith("/settings/all.json");
    expect(h.api.poke).toHaveBeenCalledTimes(1);
    const poke = h.api.poke.mock.calls[0][0] as { json: Record<string, unknown> };
    const put = poke.json["put-entry"] as Record<string, unknown>;
    expect(put["entry-key"]).toBe("lastNudgeStage");
    expect(put.value).toBe(1);

    expect(h.setLastNudgeStageShadow).toHaveBeenLastCalledWith(ACCOUNT_ID, 1);
    expect(h.sendDm).toHaveBeenCalledTimes(1);
    expect(h.sendDm.mock.calls[0][0]).toMatchObject({
      fromShip: BOT_SHIP,
      toShip: OWNER_SHIP,
      text: NUDGE_MESSAGES[1],
    });

    expect(h.setLocalPendingNudge).toHaveBeenCalledTimes(1);
    expect(h.setLocalPendingNudge.mock.calls[0][1]).toMatchObject({
      stage: 1,
      ownerShip: OWNER_SHIP,
      accountId: ACCOUNT_ID,
      content: NUDGE_MESSAGES[1],
      // §3.2: pending-nudge `sentAt` must match the canonical send-result
      // timestamp so downstream consumers agree with the telemetry event's
      // `nudgeSentAtMs`.
      sentAt: DEFAULT_SEND_RESULT_SENT_AT,
    });
    expect(h.telemetry.captureHeartbeatNudge).toHaveBeenCalledTimes(1);
    expect(h.telemetry.captureHeartbeatNudge.mock.calls[0][0]).toMatchObject({
      nudgeStage: 1,
      success: true,
      // §3.3: heartbeat-nudge telemetry carries the canonical messageId
      // and unix-ms timestamp so the Homestead-side tap join (TLON-5728)
      // can correlate by exact `messageId`.
      messageId: DEFAULT_SEND_RESULT_MESSAGE_ID,
      nudgeSentAtMs: DEFAULT_SEND_RESULT_SENT_AT,
    });
  });

  it("mirror drift: reconciled shadow blocks the send even when settings mirror has no stage", async () => {
    // The ~socsel-pacted regression: subscription reconcile already
    // lifted the shadow to 1 from a put-entry event, but the settings
    // mirror currently reads `undefined` (the drift this design was
    // meant to survive). The shadow is authoritative for the guard, so
    // no resend fires.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 10 * DAY_MS;
    const h = makeHarness({
      now,
      settings: {
        ...activeHoursSettings,
        // Deliberately omit lastNudgeStage to simulate the mirror drift.
        lastOwnerMessageAt: lastOwnerAt,
      },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-11" },
      shadowStage: 1,
      scryResult: scryReturning(1),
    });

    await h.run();

    expect(h.api.poke).not.toHaveBeenCalled();
    expect(h.sendDm).not.toHaveBeenCalled();
    expect(h.telemetry.captureHeartbeatNudge).not.toHaveBeenCalled();
    // The shadow stays at its reconciled value; scry-based writes have
    // been removed so this is a no-op check against regressions.
    expect(h.setLastNudgeStageShadow).not.toHaveBeenCalled();
  });

  it("stage guard when the reconciled shadow already matches target", async () => {
    // Shadow already reflects a previous poke or a trusted reconcile.
    // The runner short-circuits without touching storage, regardless of
    // what the best-effort scry reports.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 1,
      scryResult: scryReturning(1),
    });

    await h.run();

    expect(h.api.poke).not.toHaveBeenCalled();
    expect(h.sendDm).not.toHaveBeenCalled();
  });

  it("trusted shadow lower wins over a stale higher scry (admin clear honored immediately)", async () => {
    // Admin/test-harness pokes `del-entry lastNudgeStage`; subscription
    // reconcile has already moved the shadow down to 0, but
    // `/settings/all.json` still returns the previous higher value on
    // this tick. The shadow is authoritative, so the intended stage-1
    // resend proceeds on the same tick.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      // Stale: storage hasn't echoed the del-entry yet.
      scryResult: scryReturning(1),
    });

    await h.run();

    expect(h.api.poke).toHaveBeenCalledTimes(1);
    expect(h.sendDm).toHaveBeenCalledTimes(1);
    expect(h.sendDm.mock.calls[0][0]).toMatchObject({ text: NUDGE_MESSAGES[1] });
    expect(h.stageShadow.value).toBe(1);
  });

  it("stage progression: idle 15 days with scry=1 → stage 2 sent", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 15 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-06" },
      shadowStage: 1,
      scryResult: scryReturning(1),
    });

    await h.run();

    const poke = h.api.poke.mock.calls[0][0] as { json: Record<string, unknown> };
    const put = poke.json["put-entry"] as Record<string, unknown>;
    expect(put.value).toBe(2);
    expect(h.sendDm.mock.calls[0][0]).toMatchObject({ text: NUDGE_MESSAGES[2] });
  });

  it("stage 3 terminal: idle 60 days with scry=3 → no send", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 60 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-02-20" },
      shadowStage: 3,
      scryResult: scryReturning(3),
    });

    await h.run();

    expect(h.api.poke).not.toHaveBeenCalled();
    expect(h.sendDm).not.toHaveBeenCalled();
  });

  it("active-hours gate short-circuits before scry", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 10 * DAY_MS;
    const h = makeHarness({
      now,
      settings: {
        nudgeActiveHoursStart: "03:00",
        nudgeActiveHoursEnd: "04:00",
        nudgeActiveHoursTimezone: "UTC",
        lastOwnerMessageAt: lastOwnerAt,
      },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-11" },
      shadowStage: 0,
      scryResult: scryReturning(0),
    });

    await h.run();

    expect(h.api.scry).not.toHaveBeenCalled();
    expect(h.api.poke).not.toHaveBeenCalled();
    expect(h.sendDm).not.toHaveBeenCalled();
  });

  it("owner unresolvable: early return before any I/O", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const h = makeHarness({
      now,
      owner: null,
      shadowActivity: { at: now - 10 * DAY_MS, date: "2026-04-11" },
      shadowStage: 0,
      scryResult: scryReturning(0),
    });

    await h.run();

    expect(h.api.scry).not.toHaveBeenCalled();
    expect(h.api.poke).not.toHaveBeenCalled();
  });

  it("owner shadow missing: early return", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const h = makeHarness({
      now,
      settings: activeHoursSettings,
      shadowActivity: null,
      shadowStage: 0,
    });

    await h.run();

    expect(h.api.scry).not.toHaveBeenCalled();
  });

  it("fresh scry fails, shadow authoritative: single send, subsequent ticks idle", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryImpl: async () => {
        throw new Error("scry dead");
      },
    });

    await h.run();
    expect(h.sendDm).toHaveBeenCalledTimes(1);
    // Shadow should now be 1.
    expect(h.stageShadow.value).toBe(1);

    // Tick again — scry still fails. Shadow guard short-circuits.
    await h.run();
    expect(h.sendDm).toHaveBeenCalledTimes(1);
  });

  it("fresh scry fails across five consecutive ticks: exactly one send", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryImpl: async () => {
        throw new Error("scry dead");
      },
    });

    for (let i = 0; i < 5; i++) {
      await h.run();
    }
    expect(h.sendDm).toHaveBeenCalledTimes(1);
  });

  it("poke failure: no send, no shadow advance, no pending-nudge write, no telemetry", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(0),
      pokeImpl: async () => {
        throw new Error("poke dead");
      },
    });

    await h.run();

    expect(h.sendDm).not.toHaveBeenCalled();
    expect(h.setLocalPendingNudge).not.toHaveBeenCalled();
    expect(h.telemetry.captureHeartbeatNudge).not.toHaveBeenCalled();
    // Shadow must not advance past 0 on poke failure. With the no-downgrade
    // change the scry no longer touches the shadow at all, so it stays at
    // its starting value of 0.
    expect(h.stageShadow.value).toBe(0);
  });

  it("send failure: shadow advanced, pending not written, telemetry fires success:false", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(0),
      sendDmImpl: async () => {
        throw new Error("send dead");
      },
    });

    await h.run();

    expect(h.api.poke).toHaveBeenCalledTimes(1);
    expect(h.stageShadow.value).toBe(1);
    expect(h.setLocalPendingNudge).not.toHaveBeenCalled();
    expect(h.telemetry.captureHeartbeatNudge).toHaveBeenCalledTimes(1);
    expect(h.telemetry.captureHeartbeatNudge.mock.calls[0][0]).toMatchObject({
      success: false,
      // §3.2/§3.3: on send failure both messageId and nudgeSentAtMs are
      // null. The HogQL funnel filters `success = true`, so the null
      // fields never end up joining against a mobile tap.
      messageId: null,
      nudgeSentAtMs: null,
    });
  });

  it("reply-timestamp race: shadow activity fresh → no scry, no send", async () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const h = makeHarness({
      now,
      settings: {
        ...activeHoursSettings,
        // Store mirror is stale: lastOwnerMessageAt not yet echoed.
      },
      // Shadow was just updated by the owner-reply handler.
      shadowActivity: { at: now, date: "2026-04-21" },
      // Handler also set the stage shadow to 0.
      shadowStage: 0,
    });

    await h.run();

    expect(h.api.scry).not.toHaveBeenCalled();
    expect(h.api.poke).not.toHaveBeenCalled();
    expect(h.sendDm).not.toHaveBeenCalled();
  });

  it("active-hours tier: settings-store wins when valid", async () => {
    const now = Date.UTC(2026, 3, 21, 1, 0, 0);
    const lastOwnerAt = now - 10 * DAY_MS;
    const h = makeHarness({
      now,
      settings: {
        nudgeActiveHoursStart: "00:00",
        nudgeActiveHoursEnd: "23:59",
        nudgeActiveHoursTimezone: "UTC",
        lastOwnerMessageAt: lastOwnerAt,
      },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-11" },
      shadowStage: 0,
      scryResult: scryReturning(0),
    });

    await h.run();
    expect(h.sendDm).toHaveBeenCalledTimes(1);
  });

  it("active-hours tier: file config used when settings store missing", async () => {
    const now = Date.UTC(2026, 3, 21, 10, 0, 0);
    const lastOwnerAt = now - 10 * DAY_MS;
    const cfg = {
      agents: {
        defaults: {
          heartbeat: {
            activeHours: { start: "08:00", end: "12:00", timezone: "UTC" },
          },
        },
      },
      channels: { tlon: { enabled: true } },
    } as unknown as OpenClawConfig;

    const h = makeHarness({
      now,
      cfg,
      settings: { lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-11" },
      shadowStage: 0,
      scryResult: scryReturning(0),
    });

    await h.run();
    expect(h.sendDm).toHaveBeenCalledTimes(1);
  });

  it("active-hours tier: falls to default when neither source valid (outside default window)", async () => {
    // Default window is 09:00–21:00 America/New_York. 03:00 UTC is 23:00 NY
    // the previous day (April 20) — outside the window.
    const now = Date.UTC(2026, 3, 21, 3, 0, 0);
    const lastOwnerAt = now - 10 * DAY_MS;

    const h = makeHarness({
      now,
      settings: { lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-11" },
      shadowStage: 0,
    });

    await h.run();
    expect(h.api.scry).not.toHaveBeenCalled();
  });

  it("stale fresh-scry returning lower stage does not downgrade the shadow or resend", async () => {
    // Prior tick already poked stage 1; the shadow reflects that. Storage
    // is eventually consistent and the next scry still returns 0. Without
    // the no-downgrade fix the shadow would be clobbered to 0 and a later
    // tick would re-send stage 1.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 1,
      scryResult: scryReturning(0),
    });

    for (let i = 0; i < 5; i++) {
      await h.run();
    }

    expect(h.api.poke).not.toHaveBeenCalled();
    expect(h.sendDm).not.toHaveBeenCalled();
    // Shadow must remain at 1; the stale 0 from scry must not downgrade it.
    expect(h.stageShadow.value).toBe(1);
    expect(h.setLastNudgeStageShadow).not.toHaveBeenCalledWith(ACCOUNT_ID, 0);
  });

  it("post-poke recheck: owner reply between poke and send suppresses send, clears stage, restores shadow", async () => {
    // The reply handler ran during the poke await. In that window it saw
    // `shadowStage === 0` (we hadn't committed the advance yet) and
    // skipped enqueuing the del-entry itself. The runner must restore
    // the stage-reset invariant — shadow back to 0, storage cleared via
    // the ordered persistence queue — so the next inactivity cycle can
    // resend the same stage.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(0),
      pokeImpl: async () => {
        // Reply handler fires while the poke is in flight: activity
        // shadow advances, stage shadow stays at 0 (handler observes 0).
        h.ownerActivity.value = { at: now - 1, date: "2026-04-21" };
        h.stageShadow.value = 0;
        return undefined;
      },
    });

    await h.run();

    // The stage advance poke still happened; that's what put the value
    // into storage that we now need to clear.
    expect(h.api.poke).toHaveBeenCalledTimes(1);
    expect(h.sendDm).not.toHaveBeenCalled();
    expect(h.setLocalPendingNudge).not.toHaveBeenCalled();
    expect(h.telemetry.captureHeartbeatNudge).not.toHaveBeenCalled();
    // Shadow must not remain stuck at the advanced stage.
    expect(h.stageShadow.value).toBe(0);
    expect(h.setLastNudgeStageShadow).toHaveBeenCalledWith(ACCOUNT_ID, 0);
    expect(h.setLastNudgeStageShadow).not.toHaveBeenCalledWith(ACCOUNT_ID, 1);
    // Storage clear routed through the ordered queue so activity
    // put-entries settle before the del-entry lands.
    expect(h.enqueueStageClear).toHaveBeenCalledTimes(1);
  });

  it("runner.stop() drains an in-flight tick so its late pendingNudge write lands before shutdown continues", async () => {
    // Exercises the shutdown-race contract: a tick stuck in `sendDm`
    // must finish (and commit `setLocalPendingNudge`) before `stop()`
    // resolves, so the monitor's subsequent persistence-queue flush
    // catches the write instead of losing it.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    let releaseSend!: (result: SendDmResult) => void;
    const sendPromise = new Promise<SendDmResult>((resolve) => {
      releaseSend = resolve;
    });
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(0),
      sendDmImpl: () => sendPromise,
    });

    // Fire a tick; don't await. Let it advance to the sendDm await.
    const tickPromise = h.run();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(h.sendDm).toHaveBeenCalledTimes(1);
    expect(h.setLocalPendingNudge).not.toHaveBeenCalled();

    // Start stopping — stop should NOT resolve until the tick finishes.
    let stopResolved = false;
    const stopPromise = h.stop().then(() => {
      stopResolved = true;
    });
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(stopResolved).toBe(false);

    // Release sendDm and let the tick commit its final writes.
    releaseSend(defaultSendResult());
    await tickPromise;
    await stopPromise;

    expect(stopResolved).toBe(true);
    expect(h.setLocalPendingNudge).toHaveBeenCalledTimes(1);
    expect(h.telemetry.captureHeartbeatNudge).toHaveBeenCalledTimes(1);
  });

  it("runner.stop() drains a race-path tick so the enqueueStageClear happens before shutdown continues", async () => {
    // Same idea for the pre-send race path: if the tick is mid-poke and
    // the reply handler advanced activity, the runner's race branch must
    // run to completion (including `enqueueStageClear`) before stop resolves.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    let releasePoke!: () => void;
    const pokePromise = new Promise<void>((resolve) => {
      releasePoke = resolve;
    });
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(0),
      pokeImpl: () => {
        // Reply handler fires during the poke await.
        h.ownerActivity.value = { at: now - 1, date: "2026-04-21" };
        h.stageShadow.value = 0;
        return pokePromise;
      },
    });

    const tickPromise = h.run();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(h.api.poke).toHaveBeenCalledTimes(1);

    let stopResolved = false;
    const stopPromise = h.stop().then(() => {
      stopResolved = true;
    });
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(stopResolved).toBe(false);

    releasePoke();
    await tickPromise;
    await stopPromise;

    expect(stopResolved).toBe(true);
    expect(h.enqueueStageClear).toHaveBeenCalledTimes(1);
    expect(h.sendDm).not.toHaveBeenCalled();
    expect(h.setLocalPendingNudge).not.toHaveBeenCalled();
  });

  it("post-poke recheck: after the race, a later same-stage nudge is permitted on renewed inactivity", async () => {
    // First tick: race path — handler ran during poke, runner clears.
    const t0 = Date.UTC(2026, 3, 21, 12, 0, 0);
    const eightDaysAgo = t0 - 8 * DAY_MS;
    const h = makeHarness({
      now: t0,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: eightDaysAgo },
      shadowActivity: { at: eightDaysAgo, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(0),
      pokeImpl: async () => {
        // Reply lands during the poke await.
        h.ownerActivity.value = { at: t0 - 1, date: "2026-04-21" };
        h.stageShadow.value = 0;
        return undefined;
      },
    });

    await h.run();
    expect(h.enqueueStageClear).toHaveBeenCalledTimes(1);
    expect(h.stageShadow.value).toBe(0);

    // Second tick: renewed inactivity — owner hasn't replied again and
    // is now 8 days idle from the reply timestamp. With shadow=0 and the
    // queued stage clear having drained storage to 0, the runner's
    // `max(shadow, scry)` guard returns 0 and the same stage should fire.
    const t1 = t0 + 8 * DAY_MS;
    h.timeRef.value = t1;
    h.api.scry.mockResolvedValue(scryReturning(0));
    h.api.poke.mockImplementation(async () => undefined);

    await h.run();
    // A stage-1 send goes out this time — the race no longer suppresses
    // a legitimate future nudge.
    expect(h.sendDm).toHaveBeenCalledTimes(1);
    expect(h.sendDm.mock.calls[0][0]).toMatchObject({ text: NUDGE_MESSAGES[1] });
    expect(h.stageShadow.value).toBe(1);
  });

  it("post-send recheck: owner reply during sendDm skips pendingNudge but still emits telemetry", async () => {
    // Reply lands while sendDm is in flight — the DM is already on the
    // wire and we can't recall it, but we must avoid recording a fresh
    // pendingNudge that would mis-attribute the owner's real reply to a
    // nudge we sent moments later.
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);
    const lastOwnerAt = now - 8 * DAY_MS;
    const h = makeHarness({
      now,
      settings: { ...activeHoursSettings, lastOwnerMessageAt: lastOwnerAt },
      shadowActivity: { at: lastOwnerAt, date: "2026-04-13" },
      shadowStage: 0,
      scryResult: scryReturning(0),
      sendDmImpl: async () => {
        // Owner reply lands while sendDm await is in flight.
        h.ownerActivity.value = { at: now - 1, date: "2026-04-21" };
        h.stageShadow.value = 0;
        return defaultSendResult();
      },
    });

    await h.run();

    expect(h.api.poke).toHaveBeenCalledTimes(1);
    expect(h.sendDm).toHaveBeenCalledTimes(1);
    // Pending nudge must NOT be written — the owner reply has already
    // happened, so this would create a stale 72h reply-context window.
    expect(h.setLocalPendingNudge).not.toHaveBeenCalled();
    // Telemetry still fires; the send happened and the event is observable.
    expect(h.telemetry.captureHeartbeatNudge).toHaveBeenCalledTimes(1);
    expect(h.telemetry.captureHeartbeatNudge.mock.calls[0][0]).toMatchObject({
      success: true,
    });
  });
});

describe("shouldStartNudgeRunner", () => {
  function cfg(tlon: Record<string, unknown> | undefined): OpenClawConfig {
    return { channels: { tlon } } as unknown as OpenClawConfig;
  }

  it("refuses to start when the re-engagement flag is absent, even with ownerShip set", () => {
    const decision = shouldStartNudgeRunner(
      cfg({ ship: "~nec", url: "https://urbit", code: "c", ownerShip: "~zod" }),
    );
    expect(decision.start).toBe(false);
    if (!decision.start) {
      expect(decision.reason).toBe("flag-disabled");
    }
  });

  it("refuses to start when the re-engagement flag is explicitly false", () => {
    const decision = shouldStartNudgeRunner(
      cfg({
        ship: "~nec",
        url: "https://urbit",
        code: "c",
        ownerShip: "~zod",
        reengagement: { enabled: false },
      }),
    );
    expect(decision.start).toBe(false);
    if (!decision.start) {
      expect(decision.reason).toBe("flag-disabled");
    }
  });

  it("starts when flag is true and exactly one account is configured (single-account mode)", () => {
    const decision = shouldStartNudgeRunner(
      cfg({
        ship: "~nec",
        url: "https://urbit",
        code: "c",
        ownerShip: "~zod",
        reengagement: { enabled: true },
      }),
    );
    expect(decision.start).toBe(true);
  });

  it("starts when flag is true and exactly one account lives under accounts.*", () => {
    const decision = shouldStartNudgeRunner(
      cfg({
        reengagement: { enabled: true },
        accounts: {
          hosted: { ship: "~nec", url: "https://urbit", code: "c", ownerShip: "~zod" },
        },
      }),
    );
    expect(decision.start).toBe(true);
  });

  it("refuses to start when flag is true but multi-account mode is configured", () => {
    const decision = shouldStartNudgeRunner(
      cfg({
        ship: "~nec",
        url: "https://urbit",
        code: "c",
        reengagement: { enabled: true },
        accounts: {
          secondary: { ship: "~zod", url: "https://urbit-z", code: "c2" },
        },
      }),
    );
    expect(decision.start).toBe(false);
    if (!decision.start) {
      expect(decision.reason).toBe("multi-account");
    }
  });

  it("refuses to start when flag is true but no accounts are configured", () => {
    const decision = shouldStartNudgeRunner(cfg({ reengagement: { enabled: true } }));
    expect(decision.start).toBe(false);
    if (!decision.start) {
      expect(decision.reason).toBe("multi-account");
    }
  });

  it("refuses when channels.tlon itself is absent", () => {
    const decision = shouldStartNudgeRunner({} as unknown as OpenClawConfig);
    expect(decision.start).toBe(false);
    if (!decision.start) {
      expect(decision.reason).toBe("flag-disabled");
    }
  });

  it("counts disabled stub accounts as non-runnable: still starts on a single runnable account", () => {
    const decision = shouldStartNudgeRunner(
      cfg({
        ship: "~nec",
        url: "https://urbit",
        code: "c",
        ownerShip: "~zod",
        reengagement: { enabled: true },
        accounts: {
          spare: {
            enabled: false,
            ship: "~zod",
            url: "https://urbit-z",
            code: "c2",
          },
        },
      }),
    );
    expect(decision.start).toBe(true);
  });

  it("counts unconfigured stub accounts as non-runnable: still starts on a single runnable account", () => {
    // No base ship/url/code so the per-account fields don't fall back to
    // base — the stub is truly unconfigured.
    const decision = shouldStartNudgeRunner(
      cfg({
        reengagement: { enabled: true },
        accounts: {
          primary: { ship: "~nec", url: "https://urbit", code: "c", ownerShip: "~zod" },
          stub: {},
        },
      }),
    );
    expect(decision.start).toBe(true);
  });

  it("refuses to start when two accounts are both runnable", () => {
    const decision = shouldStartNudgeRunner(
      cfg({
        ship: "~nec",
        url: "https://urbit",
        code: "c",
        reengagement: { enabled: true },
        accounts: {
          secondary: {
            ship: "~zod",
            url: "https://urbit-z",
            code: "c2",
          },
        },
      }),
    );
    expect(decision.start).toBe(false);
    if (!decision.start) {
      expect(decision.reason).toBe("multi-account");
    }
  });
});

describe("integration test config", () => {
  function readEntrypoint(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "..", "..");
    return readFileSync(path.join(repoRoot, "dev/entrypoint.test.sh"), "utf8");
  }

  it("dev/entrypoint.test.sh enables channels.tlon.reengagement.enabled in CI", () => {
    // The CI integration harness must opt the scheduler in, otherwise
    // shouldStartNudgeRunner stays in `flag-disabled` and the new
    // plugin-driven path is never exercised end-to-end.
    const entrypoint = readEntrypoint();

    // Tolerate either compact or formatted JSON within the heredoc.
    const compact = entrypoint.replace(/\s+/g, "");
    expect(compact).toContain('"reengagement":{"enabled":true}');
  });

  it("dev/entrypoint.test.sh does NOT configure a legacy agents.defaults.heartbeat block", () => {
    // The generated CI `openclaw.json` must not co-enable the legacy
    // LLM heartbeat alongside the plugin-driven scheduler. Both would
    // race to send owner DMs on each inactivity cycle, making the
    // integration path nondeterministic and defeating the purpose of
    // migrating to the plugin scheduler.
    const entrypoint = readEntrypoint();
    const compact = entrypoint.replace(/\s+/g, "");

    // The heredoc is a static JSON literal; a substring check on the
    // heartbeat key is sufficient to catch a regression that re-adds it
    // anywhere in the generated config.
    expect(compact).not.toContain('"heartbeat":{');
  });

  it("dev/entrypoint.test.sh does not copy HEARTBEAT.md into the integration workspace", () => {
    // The legacy heartbeat prompt must not be present in the CI
    // workspace. Even with `agents.defaults.heartbeat` removed from the
    // config, a loaded `HEARTBEAT.md` could still be invoked via manual
    // agent triggers — this check defends against regressions in the
    // prompt-copy block.
    const entrypoint = readEntrypoint();

    // The prompt-copy loops iterate a space-separated list of filenames;
    // check that HEARTBEAT.md isn't in the copy list of any branch.
    // Also tolerate the explicit `rm -f` defensive cleanup we added.
    const copyLoops = entrypoint.match(/for f in [^;]+; do/g) ?? [];
    for (const loop of copyLoops) {
      expect(loop).not.toContain("HEARTBEAT.md");
    }

    // Explicit verification that the cleanup step is present.
    expect(entrypoint).toContain('rm -f "$WORKSPACE_DIR/HEARTBEAT.md"');
  });

  it("dev/entrypoint.test.sh provides an all-day nudgeActiveHours override", () => {
    // Without a file-config active-hours override the scheduler falls
    // back to the hard-coded 09:00–21:00 America/New_York window, which
    // would make CI/dev coverage depend on wall-clock time. This test
    // guards the 24-hour window that keeps the scheduler active during
    // integration runs regardless of when they start.
    const entrypoint = readEntrypoint();
    const compact = entrypoint.replace(/\s+/g, "");
    expect(compact).toContain('"nudgeActiveHours":{');
    expect(compact).toContain('"start":"00:00"');
    expect(compact).toContain('"end":"24:00"');
  });
});
