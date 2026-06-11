import { describe, expect, it } from "vitest";
import {
  computeTargetStage,
  daysBetween,
  DEFAULT_ACTIVE_HOURS_END,
  DEFAULT_ACTIVE_HOURS_START,
  DEFAULT_ACTIVE_HOURS_TIMEZONE,
  inActiveHours,
  resolveActiveHours,
  resolveLastOwnerInstant,
  shouldSend,
} from "./nudge-decision.js";

describe("nudge-decision", () => {
  describe("computeTargetStage", () => {
    it("returns null below the 7-day threshold", () => {
      expect(computeTargetStage(0)).toBeNull();
      expect(computeTargetStage(6)).toBeNull();
    });

    it("returns 1 between 7 and 13 days inclusive", () => {
      expect(computeTargetStage(7)).toBe(1);
      expect(computeTargetStage(13)).toBe(1);
    });

    it("returns 2 between 14 and 29 days inclusive", () => {
      expect(computeTargetStage(14)).toBe(2);
      expect(computeTargetStage(29)).toBe(2);
    });

    it("returns 3 at 30 days and above", () => {
      expect(computeTargetStage(30)).toBe(3);
      expect(computeTargetStage(45)).toBe(3);
    });
  });

  describe("daysBetween", () => {
    const day = 24 * 60 * 60 * 1000;

    it("floors the number of whole days", () => {
      expect(daysBetween(0, day)).toBe(1);
      expect(daysBetween(0, day * 7 + 12 * 60 * 60 * 1000)).toBe(7);
    });

    it("returns 0 for non-positive differences", () => {
      expect(daysBetween(1000, 1000)).toBe(0);
      expect(daysBetween(1000, 500)).toBe(0);
    });

    it("handles non-finite inputs defensively", () => {
      expect(daysBetween(Number.NaN, 1)).toBe(0);
      expect(daysBetween(1, Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe("inActiveHours", () => {
    const hours = {
      start: "09:00",
      end: "21:00",
      timezone: "UTC",
    };

    it("returns true inside a forward window", () => {
      expect(inActiveHours(new Date("2026-04-21T10:00:00Z"), hours)).toBe(true);
    });

    it("returns false outside a forward window", () => {
      expect(inActiveHours(new Date("2026-04-21T22:00:00Z"), hours)).toBe(false);
    });

    it("includes the start boundary and excludes the end boundary", () => {
      expect(inActiveHours(new Date("2026-04-21T09:00:00Z"), hours)).toBe(true);
      expect(inActiveHours(new Date("2026-04-21T21:00:00Z"), hours)).toBe(false);
    });

    it("supports wrap-around windows", () => {
      const wrap = { start: "22:00", end: "06:00", timezone: "UTC" };
      expect(inActiveHours(new Date("2026-04-21T23:00:00Z"), wrap)).toBe(true);
      expect(inActiveHours(new Date("2026-04-21T03:00:00Z"), wrap)).toBe(true);
      expect(inActiveHours(new Date("2026-04-21T10:00:00Z"), wrap)).toBe(false);
    });

    it('treats "00:00"–"24:00" as a full-day window', () => {
      const fullDay = { start: "00:00", end: "24:00", timezone: "UTC" };
      expect(inActiveHours(new Date("2026-04-21T00:00:00Z"), fullDay)).toBe(true);
      expect(inActiveHours(new Date("2026-04-21T23:59:00Z"), fullDay)).toBe(true);
    });

    it("treats a zero-length window as always outside the active window", () => {
      expect(inActiveHours(new Date(), { start: "12:00", end: "12:00", timezone: "UTC" })).toBe(
        false,
      );
    });

    it("honors the configured timezone", () => {
      const nyHours = { start: "09:00", end: "21:00", timezone: "America/New_York" };
      // 12:00 UTC is 08:00 in New York (EDT) — outside the window.
      expect(inActiveHours(new Date("2026-04-21T12:00:00Z"), nyHours)).toBe(false);
      // 14:00 UTC is 10:00 in New York — inside the window.
      expect(inActiveHours(new Date("2026-04-21T14:00:00Z"), nyHours)).toBe(true);
    });
  });

  describe("resolveActiveHours", () => {
    it("tier 1: settings store overrides everything", () => {
      const result = resolveActiveHours(
        {
          nudgeActiveHoursStart: "08:00",
          nudgeActiveHoursEnd: "20:00",
          nudgeActiveHoursTimezone: "UTC",
        },
        {
          channels: {
            tlon: {
              nudgeActiveHours: { start: "06:00", end: "18:00", timezone: "UTC" },
            },
          },
          agents: {
            defaults: {
              heartbeat: {
                activeHours: { start: "10:00", end: "22:00", timezone: "America/New_York" },
              },
            },
          },
        } as never,
      );
      expect(result).toEqual({ start: "08:00", end: "20:00", timezone: "UTC" });
    });

    it("tier 2: channels.tlon.nudgeActiveHours wins when settings store is empty", () => {
      const result = resolveActiveHours(
        {},
        {
          channels: {
            tlon: {
              nudgeActiveHours: { start: "00:00", end: "24:00", timezone: "UTC" },
            },
          },
          agents: {
            defaults: {
              heartbeat: {
                activeHours: { start: "10:00", end: "22:00", timezone: "America/New_York" },
              },
            },
          },
        } as never,
      );
      expect(result).toEqual({ start: "00:00", end: "24:00", timezone: "UTC" });
    });

    it("tier 2: channels.tlon.nudgeActiveHours accepts an omitted timezone and falls back to user tz", () => {
      const result = resolveActiveHours(
        {},
        {
          channels: {
            tlon: { nudgeActiveHours: { start: "09:00", end: "17:00" } },
          },
          agents: { defaults: { userTimezone: "America/Chicago" } },
        } as never,
      );
      expect(result).toEqual({ start: "09:00", end: "17:00", timezone: "America/Chicago" });
    });

    it("tier 3: agents.defaults.heartbeat.activeHours used when channels.tlon is empty", () => {
      const result = resolveActiveHours({}, {
        agents: {
          defaults: {
            heartbeat: {
              activeHours: { start: "07:30", end: "23:30", timezone: "Europe/London" },
            },
          },
        },
      } as never);
      expect(result).toEqual({ start: "07:30", end: "23:30", timezone: "Europe/London" });
    });

    it('tier 3: agents.defaults.heartbeat.activeHours timezone "user" resolves via agents.defaults.userTimezone', () => {
      const result = resolveActiveHours(
        {},
        {
          agents: {
            defaults: {
              userTimezone: "America/Los_Angeles",
              heartbeat: {
                activeHours: { start: "07:30", end: "23:30", timezone: "user" },
              },
            },
          },
        } as never,
      );
      expect(result).toEqual({
        start: "07:30",
        end: "23:30",
        timezone: "America/Los_Angeles",
      });
    });

    it('tier 3: agents.defaults.heartbeat.activeHours timezone "local" resolves to the host timezone', () => {
      const hostTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() || "UTC";
      const result = resolveActiveHours(
        {},
        {
          agents: {
            defaults: {
              heartbeat: {
                activeHours: { start: "07:30", end: "23:30", timezone: "local" },
              },
            },
          },
        } as never,
      );
      expect(result).toEqual({
        start: "07:30",
        end: "23:30",
        timezone: hostTimezone,
      });
    });

    it("tier 3: omitted agents.defaults.heartbeat.activeHours timezone falls back to the configured user timezone", () => {
      const result = resolveActiveHours(
        {},
        {
          agents: {
            defaults: {
              userTimezone: "Europe/Berlin",
              heartbeat: {
                activeHours: { start: "07:30", end: "23:30" },
              },
            },
          },
        } as never,
      );
      expect(result).toEqual({
        start: "07:30",
        end: "23:30",
        timezone: "Europe/Berlin",
      });
    });

    it("tier 4: hard-coded defaults when no source is valid", () => {
      const result = resolveActiveHours({}, null);
      expect(result).toEqual({
        start: DEFAULT_ACTIVE_HOURS_START,
        end: DEFAULT_ACTIVE_HOURS_END,
        timezone: DEFAULT_ACTIVE_HOURS_TIMEZONE,
      });
    });

    it("falls through when settings values are malformed", () => {
      const result = resolveActiveHours(
        {
          nudgeActiveHoursStart: "not-a-time",
          nudgeActiveHoursEnd: "21:00",
          nudgeActiveHoursTimezone: "America/New_York",
        },
        null,
      );
      expect(result.start).toBe(DEFAULT_ACTIVE_HOURS_START);
    });

    it("settings timezone falls through to the baseline tier when invalid", () => {
      // Malformed timezone must NOT promote the settings tier over a
      // valid baseline; the runner falls through to the lower-precedence
      // value for that specific field.
      const result = resolveActiveHours(
        {
          nudgeActiveHoursStart: "09:00",
          nudgeActiveHoursEnd: "21:00",
          nudgeActiveHoursTimezone: "Not/A/Zone",
        },
        {
          channels: {
            tlon: {
              nudgeActiveHours: { start: "06:00", end: "22:00", timezone: "UTC" },
            },
          },
        } as never,
      );
      expect(result.timezone).toBe("UTC");
    });

    it("settings active hours with omitted timezone inherit the baseline timezone", () => {
      const result = resolveActiveHours(
        {
          nudgeActiveHoursStart: "08:00",
          nudgeActiveHoursEnd: "20:00",
        },
        {
          channels: {
            tlon: {
              nudgeActiveHours: { start: "06:00", end: "22:00", timezone: "Asia/Tokyo" },
            },
          },
        } as never,
      );
      expect(result).toEqual({
        start: "08:00",
        end: "20:00",
        timezone: "Asia/Tokyo",
      });
    });

    it("field-wise overlay: settings timezone-only edit overrides baseline timezone only", () => {
      const result = resolveActiveHours(
        { nudgeActiveHoursTimezone: "UTC" },
        {
          channels: {
            tlon: {
              nudgeActiveHours: { start: "07:00", end: "19:00", timezone: "Europe/London" },
            },
          },
        } as never,
      );
      expect(result).toEqual({ start: "07:00", end: "19:00", timezone: "UTC" });
    });

    it('field-wise overlay: timezone-only edit with the "user" keyword resolves via userTimezone', () => {
      const result = resolveActiveHours(
        { nudgeActiveHoursTimezone: "user" },
        {
          agents: { defaults: { userTimezone: "America/Chicago" } },
          channels: {
            tlon: { nudgeActiveHours: { start: "08:00", end: "20:00", timezone: "UTC" } },
          },
        } as never,
      );
      expect(result).toEqual({
        start: "08:00",
        end: "20:00",
        timezone: "America/Chicago",
      });
    });

    it("field-wise overlay: single-bound settings edit overlays onto baseline", () => {
      const result = resolveActiveHours(
        { nudgeActiveHoursEnd: "22:00" },
        {
          channels: {
            tlon: { nudgeActiveHours: { start: "09:00", end: "17:00", timezone: "UTC" } },
          },
        } as never,
      );
      expect(result).toEqual({ start: "09:00", end: "22:00", timezone: "UTC" });
    });

    it("field-wise overlay: malformed single-bound settings value does not mask baseline", () => {
      const result = resolveActiveHours(
        { nudgeActiveHoursEnd: "not-a-time" },
        {
          channels: {
            tlon: { nudgeActiveHours: { start: "09:00", end: "17:00", timezone: "UTC" } },
          },
        } as never,
      );
      expect(result).toEqual({ start: "09:00", end: "17:00", timezone: "UTC" });
    });

    it("field-wise overlay: settings single-bound + heartbeat backwards-compat baseline", () => {
      const result = resolveActiveHours(
        { nudgeActiveHoursStart: "07:00" },
        {
          agents: {
            defaults: {
              heartbeat: { activeHours: { start: "09:00", end: "21:00", timezone: "UTC" } },
            },
          },
        } as never,
      );
      expect(result).toEqual({ start: "07:00", end: "21:00", timezone: "UTC" });
    });
  });

  describe("resolveLastOwnerInstant", () => {
    it("prefers the shadow when present", () => {
      const got = resolveLastOwnerInstant(
        { at: 1000, date: "2026-04-21" },
        { lastOwnerMessageAt: 42 },
      );
      expect(got).toBe(1000);
    });

    it("falls back to lastOwnerMessageAt when shadow missing", () => {
      const got = resolveLastOwnerInstant(null, { lastOwnerMessageAt: 42 });
      expect(got).toBe(42);
    });

    it("falls back to lastOwnerMessageDate when neither shadow nor ms present", () => {
      const iso = "2026-01-02";
      const got = resolveLastOwnerInstant(null, { lastOwnerMessageDate: iso });
      expect(got).toBe(Date.parse(iso));
    });

    it("returns null when nothing is available", () => {
      expect(resolveLastOwnerInstant(null, {})).toBeNull();
    });

    it("returns null when date string is unparseable", () => {
      expect(resolveLastOwnerInstant(null, { lastOwnerMessageDate: "nope" })).toBeNull();
    });
  });

  describe("shouldSend", () => {
    it("returns true only when every gate is open", () => {
      expect(
        shouldSend({
          targetStage: 1,
          lastNudgeStage: 0,
          ownerShip: "~zod",
          isInActiveHours: true,
        }),
      ).toBe(true);
    });

    it("returns false when target is not greater than stored stage", () => {
      expect(
        shouldSend({
          targetStage: 1,
          lastNudgeStage: 1,
          ownerShip: "~zod",
          isInActiveHours: true,
        }),
      ).toBe(false);
      expect(
        shouldSend({
          targetStage: 2,
          lastNudgeStage: 3,
          ownerShip: "~zod",
          isInActiveHours: true,
        }),
      ).toBe(false);
    });

    it("returns false when outside active hours", () => {
      expect(
        shouldSend({
          targetStage: 1,
          lastNudgeStage: 0,
          ownerShip: "~zod",
          isInActiveHours: false,
        }),
      ).toBe(false);
    });

    it("returns false when owner is unresolvable", () => {
      expect(
        shouldSend({
          targetStage: 1,
          lastNudgeStage: 0,
          ownerShip: null,
          isInActiveHours: true,
        }),
      ).toBe(false);
    });

    it("returns false when target is null", () => {
      expect(
        shouldSend({
          targetStage: null,
          lastNudgeStage: 0,
          ownerShip: "~zod",
          isInActiveHours: true,
        }),
      ).toBe(false);
    });
  });
});
