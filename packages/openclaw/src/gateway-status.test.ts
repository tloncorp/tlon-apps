import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tloncorp/api", () => ({
  gatewayHeartbeat: vi.fn().mockResolvedValue(undefined),
  gatewayStop: vi.fn().mockResolvedValue(undefined),
}));

// The heartbeat now calls configureTlonApiWithPoke each tick to defeat
// OpenClaw plugin module isolation; in tests we stub it to a no-op so the
// fake @tloncorp/api singleton stays as the vitest mock above.
vi.mock("./urbit/api-client.js", () => ({
  configureTlonApiWithPoke: vi.fn(),
}));

import { gatewayHeartbeat, gatewayStop } from "@tloncorp/api";
import { configureTlonApiWithPoke } from "./urbit/api-client.js";
import { sharedSlot } from "./shared-state.js";
import {
  API_CLIENT_PARAMS_SLOT,
  createGatewayStatusManager,
  setGatewayStatusManager,
  getGatewayStatusManager,
  sendGatewayStop,
  computeLeaseUntil,
  type GatewayStatusManager,
  type SharedApiClientParams,
} from "./gateway-status.js";

const stubApiClientParams: SharedApiClientParams = {
  poke: vi.fn().mockResolvedValue(undefined),
  shipName: "test-bot",
  shipUrl: "http://localhost:8080",
};

describe("gateway-status: createGatewayStatusManager", () => {
  let manager: GatewayStatusManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(gatewayHeartbeat).mockClear();
    // Publish stub api-client params so the heartbeat's per-tick
    // configure-then-poke can find data in the shared slot and proceed.
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(
      stubApiClientParams,
    );
    manager = createGatewayStatusManager({ logger: undefined });
  });

  afterEach(() => {
    manager.stopHeartbeat();
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
    vi.useRealTimers();
  });

  it("bootId is a valid UUID", () => {
    expect(manager.bootId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("each manager gets a unique bootId", () => {
    const other = createGatewayStatusManager({ logger: undefined });
    expect(manager.bootId).not.toBe(other.bootId);
  });

  describe("gateway_start coordination", () => {
    it("signalGatewayStarted resolves waitForGatewayStart", async () => {
      let resolved = false;
      const p = manager.waitForGatewayStart().then(() => {
        resolved = true;
      });
      expect(resolved).toBe(false);

      manager.signalGatewayStarted();
      await p;
      expect(resolved).toBe(true);
    });

    it("waitForGatewayStart resolves immediately if already signaled", async () => {
      manager.signalGatewayStarted();

      let resolved = false;
      await manager.waitForGatewayStart().then(() => {
        resolved = true;
      });
      expect(resolved).toBe(true);
    });
  });

  describe("heartbeat", () => {
    it("startHeartbeat is no-op when not activated", () => {
      manager.startHeartbeat();
      vi.advanceTimersByTime(60_000);
      expect(gatewayHeartbeat).not.toHaveBeenCalled();
    });

    it("startHeartbeat is no-op when stopped", () => {
      manager.markActivated();
      manager.markStopped();
      manager.startHeartbeat();
      vi.advanceTimersByTime(60_000);
      expect(gatewayHeartbeat).not.toHaveBeenCalled();
    });

    it("sends periodic heartbeats when activated", () => {
      manager.markActivated();
      manager.startHeartbeat();

      expect(gatewayHeartbeat).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);

      const call = vi.mocked(gatewayHeartbeat).mock.calls[0][0];
      expect(call.bootId).toBe(manager.bootId);
      expect(call.leaseUntil).toBeGreaterThan(Date.now());

      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(2);
    });

    it("stopHeartbeat clears interval", () => {
      manager.markActivated();
      manager.startHeartbeat();

      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);

      manager.stopHeartbeat();
      vi.advanceTimersByTime(60_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);
    });

    it("stopHeartbeat is idempotent", () => {
      manager.markActivated();
      manager.startHeartbeat();
      manager.stopHeartbeat();
      manager.stopHeartbeat(); // should not throw
    });

    it("heartbeat error does not crash", () => {
      vi.mocked(gatewayHeartbeat).mockRejectedValueOnce(new Error("poke failed"));
      manager.markActivated();
      manager.startHeartbeat();

      // First heartbeat fails
      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);

      // Second heartbeat still fires
      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(2);
    });

    it("startHeartbeat does not create duplicate intervals", () => {
      manager.markActivated();
      manager.startHeartbeat();
      manager.startHeartbeat(); // second call should be no-op

      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(1); // not 2
    });

    it("skips the heartbeat poke when api-client params are not published", () => {
      // Clear the params the suite beforeEach published. The per-tick body
      // must bail before configuring/pokeing when the shared slot is empty.
      sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
      manager.markActivated();
      manager.startHeartbeat();

      vi.advanceTimersByTime(60_000);
      expect(gatewayHeartbeat).not.toHaveBeenCalled();
    });

    it("re-activates after stopHeartbeat without markStopped (config-reload survival)", () => {
      // First monitor incarnation: activate + heartbeat.
      manager.markActivated();
      manager.startHeartbeat();
      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);

      // Monitor teardown stops the heartbeat but must NOT latch the shared
      // manager stopped — that's the gateway_stop hook's job. A replacement
      // monitor (config reload) reuses this same process-lifetime manager.
      manager.stopHeartbeat();
      expect(manager.stopped).toBe(false);

      // Replacement monitor re-activates; the heartbeat resumes instead of
      // staying dead until a full gateway restart.
      manager.startHeartbeat();
      vi.advanceTimersByTime(30_000);
      expect(gatewayHeartbeat).toHaveBeenCalledTimes(2);
    });
  });

  describe("lifecycle flags", () => {
    it("starting starts false", () => {
      expect(manager.starting).toBe(false);
    });

    it("markStarting sets starting", () => {
      manager.markStarting();
      expect(manager.starting).toBe(true);
    });

    it("activated starts false", () => {
      expect(manager.activated).toBe(false);
    });

    it("markActivated sets activated", () => {
      manager.markActivated();
      expect(manager.activated).toBe(true);
    });

    it("stopped starts false", () => {
      expect(manager.stopped).toBe(false);
    });

    it("markStopped sets stopped", () => {
      manager.markStopped();
      expect(manager.stopped).toBe(true);
    });

    it("starting is set independently of activated (in-flight start window)", () => {
      // The gateway_stop hook relies on `starting` to know a %gateway-start
      // poke is in flight even before markActivated() runs, so it can still
      // send a matching %gateway-stop during a shutdown that races activation.
      manager.markStarting();
      expect(manager.starting).toBe(true);
      expect(manager.activated).toBe(false);
    });
  });
});

describe("gateway-status: module-level accessor", () => {
  beforeEach(() => {
    setGatewayStatusManager(null);
  });

  it("returns null when not set", () => {
    // Reset by setting to null via internal trick — in real code, null is the initial state
    expect(getGatewayStatusManager()).toBeNull();
  });

  it("stores and retrieves manager", () => {
    const manager = createGatewayStatusManager({ logger: undefined });
    setGatewayStatusManager(manager);
    expect(getGatewayStatusManager()).toBe(manager);
  });
});

describe("gateway-status: computeLeaseUntil", () => {
  it("returns a timestamp in the future", () => {
    const now = Date.now();
    const lease = computeLeaseUntil();
    expect(lease).toBeGreaterThan(now);
    // Should be ~90 seconds in the future
    expect(lease - now).toBeGreaterThanOrEqual(89_000);
    expect(lease - now).toBeLessThanOrEqual(91_000);
  });
});

describe("gateway-status: sendGatewayStop", () => {
  beforeEach(() => {
    vi.mocked(gatewayStop).mockClear();
    vi.mocked(configureTlonApiWithPoke).mockClear();
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
  });

  afterEach(() => {
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
  });

  it("returns false and does not poke when params are not published", async () => {
    const sent = await sendGatewayStop({ bootId: "boot-1", reason: "shutdown" });
    expect(sent).toBe(false);
    expect(gatewayStop).not.toHaveBeenCalled();
  });

  it("configures the api client before sending the stop poke", async () => {
    const params: SharedApiClientParams = {
      poke: vi.fn().mockResolvedValue(undefined),
      shipName: "test-bot",
      shipUrl: "http://localhost:8080",
    };
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(params);

    const sent = await sendGatewayStop({ bootId: "boot-1", reason: "shutdown" });
    expect(sent).toBe(true);
    expect(configureTlonApiWithPoke).toHaveBeenCalledTimes(1);
    expect(gatewayStop).toHaveBeenCalledTimes(1);
    // configure must run before the poke so the stop reaches the SSE-bound
    // client in this module's @tloncorp/api instance.
    const configureOrder =
      vi.mocked(configureTlonApiWithPoke).mock.invocationCallOrder[0];
    const stopOrder = vi.mocked(gatewayStop).mock.invocationCallOrder[0];
    expect(configureOrder).toBeLessThan(stopOrder);
  });
});
