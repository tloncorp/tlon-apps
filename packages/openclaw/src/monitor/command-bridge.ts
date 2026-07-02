/**
 * Command Bridge Registry
 *
 * Bridges OpenClaw slash commands (registered at plugin init) with monitor
 * approval state (available after SSE starts). Each monitor registers a bridge
 * keyed by accountId; command handlers resolve the correct bridge at runtime.
 */
import { sharedMap } from '../shared-state.js';

export interface ApprovalCommandBridge {
  /** Handle /allow, /reject, /ban. Returns response text. */
  handleAction(
    action: 'approve' | 'deny' | 'block',
    id?: string
  ): Promise<string>;
  /** Get formatted pending approvals list. */
  getPendingList(): Promise<string>;
  /** Get formatted blocked ships list. */
  getBlockedList(): Promise<string>;
  /** Handle /unban ~ship. Returns response text. */
  handleUnblock(ship: string): Promise<string>;
  /** The owner ship for this account (for auth checks). Should be a getter, not a snapshot. */
  readonly ownerShip: string | null;

  // ── Owner-listen controls (per-channel + global) ─────────────────────────
  /** True if the channel's host is the owner or the bot itself. */
  isOwnedChannel(nest: string): boolean;
  /** Current global owner-listen toggle. */
  getOwnerListenGlobal(): boolean;
  /** Flip the global toggle and persist. Returns the new value. */
  setOwnerListenGlobal(enabled: boolean): Promise<boolean>;
  /** True if owner-listen is currently disabled for this channel. */
  isOwnerListenDisabled(nest: string): boolean;
  /**
   * Set/clear the per-channel override and persist.
   * Returns the resulting per-channel listening state
   * (true = bot listens for owner here, ignoring the global toggle).
   */
  setOwnerListenDisabled(nest: string, disabled: boolean): Promise<boolean>;
  /** List all channels currently in the per-channel disabled list. */
  listOwnerListenDisabled(): string[];
}

const bridges = sharedMap<string, ApprovalCommandBridge>(
  'monitor.command-bridge.bridges'
);

const DEFAULT_KEY = 'default';

export function setBridge(
  accountId: string | undefined,
  b: ApprovalCommandBridge
): void {
  bridges.set(accountId ?? DEFAULT_KEY, b);
}

/** Only removes if the current entry is the same object (safe across monitor restarts). */
export function removeBridge(
  accountId: string | undefined,
  b: ApprovalCommandBridge
): void {
  const key = accountId ?? DEFAULT_KEY;
  if (bridges.get(key) === b) {
    bridges.delete(key);
  }
}

export function getBridge(
  accountId: string | undefined
): ApprovalCommandBridge | null {
  return bridges.get(accountId ?? DEFAULT_KEY) ?? null;
}

/** Get all registered bridges (for fallback resolution when accountId is unavailable). */
export function getAllBridges(): ReadonlyMap<string, ApprovalCommandBridge> {
  return bridges;
}
