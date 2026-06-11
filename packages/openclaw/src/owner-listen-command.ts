import type { ApprovalCommandBridge } from "./monitor/command-bridge.js";
import { nestFromCtxFrom } from "./monitor/utils.js";

/**
 * Pure handler for the /owner-listen slash command.
 *
 * Caller is responsible for gating on owner via resolveBridgeForCommand.
 * Returns response text.
 */
export async function handleOwnerListenCommand(
  bridge: Pick<
    ApprovalCommandBridge,
    | "isOwnedChannel"
    | "getOwnerListenGlobal"
    | "setOwnerListenGlobal"
    | "isOwnerListenDisabled"
    | "setOwnerListenDisabled"
    | "listOwnerListenDisabled"
  >,
  rawArgs: string | undefined,
  ctxFrom: string | undefined,
): Promise<string> {
  const args = (rawArgs ?? "").trim().split(/\s+/).filter(Boolean);
  const argsLower = args.map((a) => a.toLowerCase());
  const first = argsLower[0] ?? "";

  // Global kill switch — accept either order:
  //   /owner-listen all                  → status
  //   /owner-listen all on  | all off    → flip
  //   /owner-listen on all  | off all    → flip (swapped)
  const allIdx = argsLower.indexOf("all");
  if (allIdx !== -1) {
    const sub = argsLower.find((a, i) => i !== allIdx) ?? "";
    if (sub === "") {
      const cur = bridge.getOwnerListenGlobal();
      const disabledCount = bridge.listOwnerListenDisabled().length;
      return (
        `Global owner-listen: ${cur ? "on" : "off"}.` +
        (disabledCount > 0 ? ` ${disabledCount} channel(s) individually disabled.` : "")
      );
    }
    if (sub !== "on" && sub !== "off") {
      return "Usage: /owner-listen all [on|off]";
    }
    const next = await bridge.setOwnerListenGlobal(sub === "on");
    return `Global owner-listen is now ${next ? "on" : "off"}.`;
  }

  // List
  if (first === "list") {
    const global = bridge.getOwnerListenGlobal();
    const disabled = bridge.listOwnerListenDisabled();
    const head = `Global owner-listen: ${global ? "on" : "off"}.`;
    const tail =
      disabled.length === 0
        ? "No channels individually disabled."
        : `Disabled channels:\n${disabled.map((n) => `• ${n}`).join("\n")}`;
    return `${head}\n${tail}`;
  }

  // Per-channel
  const action = first;
  const explicitNest = args[1];
  const ctxNest = nestFromCtxFrom(ctxFrom);
  const targetNest = explicitNest ?? ctxNest;

  if (!targetNest) {
    return (
      "Usage: /owner-listen [on|off|status|list] [<channel-nest>]\n" +
      "Run inside a channel, pass a nest like chat/~sampel-palnet/foo, " +
      "or use /owner-listen all [on|off] for the global toggle."
    );
  }

  if (!bridge.isOwnedChannel(targetNest)) {
    return `${targetNest} is not an owned channel (host is not the owner or bot). Owner-listen only applies in owned channels.`;
  }

  if (action === "" || action === "status") {
    const channelOff = bridge.isOwnerListenDisabled(targetNest);
    const global = bridge.getOwnerListenGlobal();
    const effective = global && !channelOff;
    const detail = !global ? "global is off" : channelOff ? "channel is muted" : "active";
    return `Owner-listen for ${targetNest}: ${effective ? "on" : "off"} (${detail}).`;
  }

  if (action !== "on" && action !== "off") {
    return "Usage: /owner-listen [on|off|status|list] [<channel-nest>] | /owner-listen all [on|off]";
  }

  await bridge.setOwnerListenDisabled(targetNest, action === "off");
  const channelOff = bridge.isOwnerListenDisabled(targetNest);
  const global = bridge.getOwnerListenGlobal();
  const effective = global && !channelOff;

  if (action === "on" && !global) {
    return `Owner-listen for ${targetNest}: off (global is off; channel mute cleared). Run /owner-listen all on to enable it.`;
  }

  const detail = !global ? "global is off" : channelOff ? "channel is muted" : "active";
  return `Owner-listen for ${targetNest}: ${effective ? "on" : "off"} (${detail}).`;
}
