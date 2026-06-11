/**
 * Command Auth — bridge resolution + owner guard for slash commands.
 *
 * Pure module with no OpenClaw SDK dependency. Accepts a minimal
 * CommandContextLike instead of the full PluginCommandContext.
 */

import { getBridge, getAllBridges, type ApprovalCommandBridge } from "./command-bridge.js";
import { normalizeShip } from "../targets.js";

/** Minimal input shape — avoids coupling to plugin SDK types. */
export type CommandContextLike = {
  accountId?: string | null;
  senderId?: string | null;
};

/**
 * Resolve the correct bridge for a command invocation and verify ownership.
 *
 * Selection strategy (does not assume accountId exists):
 * 1. If accountId is set and matches a bridge → use it
 * 2. Else if exactly one bridge exists → use it
 * 3. Else if senderId matches exactly one bridge's ownerShip → use it
 * 4. Else → error
 */
export function resolveBridgeForCommand(
  ctx: CommandContextLike,
): { bridge: ApprovalCommandBridge } | { error: string } {
  // 1. Try accountId if available
  if (ctx.accountId) {
    const bridge = getBridge(ctx.accountId);
    if (bridge) return checkOwner(ctx, bridge);
  }

  // 2. Fallback: enumerate all bridges
  const all = getAllBridges();
  if (all.size === 0) return { error: "Bot is not connected yet." };
  if (all.size === 1) {
    const [, only] = [...all.entries()][0];
    return checkOwner(ctx, only);
  }

  // 3. Multiple bridges — try to match by senderId
  // Note: if two accounts share the same ownerShip, matches.length > 1
  // and we correctly fall through to the ambiguity error.
  if (ctx.senderId) {
    const normalized = normalizeShip(ctx.senderId);
    const matches = [...all.values()].filter((b) => b.ownerShip === normalized);
    if (matches.length === 1) return checkOwner(ctx, matches[0]);
  }

  return {
    error: "Multiple accounts connected. Run this command from the owner DM for the target account.",
  };
}

/**
 * Default-deny owner check. Both ownerShip and senderId must be known
 * and must match; otherwise the command is refused.
 */
export function checkOwner(
  ctx: CommandContextLike,
  bridge: ApprovalCommandBridge,
): { bridge: ApprovalCommandBridge } | { error: string } {
  if (!bridge.ownerShip) {
    return { error: "Owner ship not configured." };
  }
  if (!ctx.senderId) {
    return { error: "Cannot identify sender." };
  }
  if (normalizeShip(ctx.senderId) !== bridge.ownerShip) {
    return { error: "Only the bot owner can use this command." };
  }
  return { bridge };
}
