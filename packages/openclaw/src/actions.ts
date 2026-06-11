import { readStringParam } from "openclaw/plugin-sdk/param-readers";
import type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
} from "openclaw/plugin-sdk/channel-contract";
import { resolveTlonAccount } from "./types.js";
import { normalizeShip, parseTlonTarget } from "./targets.js";
import { withAuthenticatedTlonApi } from "./urbit/api-client.js";
import {
  addChannelReaction,
  removeChannelReaction,
  addDmReaction,
  removeDmReaction,
  deleteHeapPost,
  sendChannelPost,
} from "./urbit/send.js";
import { markdownToStory } from "./urbit/story.js";

// Inline helpers previously imported from SDK (removed in new SDK)

function createActionGate(
  actions: Record<string, boolean | undefined> | undefined,
): (key: string) => boolean {
  return (key: string) => {
    if (!actions) return true;
    return actions[key] !== false;
  };
}

function jsonResult(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    details: data,
  };
}

function readReactionParams(
  params: Record<string, unknown>,
  opts?: { removeErrorMessage?: string },
): { emoji: string; remove: boolean; isEmpty: boolean } {
  const raw = readStringParam(params, "emoji") ?? "";
  const remove = params.remove === true || params.remove === "true";

  if (remove && !raw) {
    if (opts?.removeErrorMessage) {
      throw new Error(opts.removeErrorMessage);
    }
  }

  return { emoji: raw, remove, isEmpty: !raw && !remove };
}

const SUPPORTED_ACTIONS = new Set<ChannelMessageActionName>(["react", "delete", "reply"]);

export const tlonMessageActions: ChannelMessageActionAdapter = {
  describeMessageTool: ({ cfg }) => {
    const account = resolveTlonAccount(cfg);
    if (!account.configured || !account.enabled) {
      return null;
    }
    const gate = createActionGate(
      (cfg.channels?.tlon as { actions?: Record<string, boolean | undefined> })?.actions,
    );
    const actions: ChannelMessageActionName[] = [];
    if (gate("reactions")) actions.push("react");
    if (gate("delete")) actions.push("delete");
    if (gate("reply")) actions.push("reply");
    return actions.length > 0 ? { actions } : null;
  },

  supportsAction: ({ action }) => SUPPORTED_ACTIONS.has(action),

  handleAction: async ({ action, params, cfg, accountId, toolContext }) => {
    const account = resolveTlonAccount(cfg, accountId ?? undefined);
    if (!account.configured || !account.ship || !account.url || !account.code) {
      throw new Error("Tlon account not configured");
    }

    return await withAuthenticatedTlonApi(
      { url: account.url, code: account.code, ship: account.ship, allowPrivateNetwork: account.allowPrivateNetwork ?? undefined },
      async () => {
        const fromShip = normalizeShip(account.ship!);

        if (action === "react") {
          const level = account.reactionLevel ?? "minimal";
          if (level === "off" || level === "ack") {
            throw new Error(
              `Tlon agent reactions disabled (reactionLevel="${level}"). ` +
                `Set channels.tlon.reactionLevel to "minimal" or "extensive" to enable.`,
            );
          }
          return await handleReact({ params, fromShip, toolContext });
        }

        if (action === "delete") {
          return await handleDelete({ params, toolContext });
        }

        if (action === "reply") {
          return await handleReply({ params, fromShip, toolContext });
        }

        throw new Error(`Tlon action "${action}" is not supported.`);
      },
    );
  },
};

async function handleReact({
  params,
  fromShip,
  toolContext,
}: {
  params: Record<string, unknown>;
  fromShip: string;
  toolContext?: { currentChannelId?: string };
}) {
  const { emoji, remove, isEmpty } = readReactionParams(params, {
    removeErrorMessage: "Emoji is required to remove a Tlon reaction.",
  });
  if (isEmpty && !remove) {
    throw new Error(
      "Tlon react requires emoji parameter. Use action=react with emoji=<emoji> and messageId=<message_id>.",
    );
  }

  const messageId = readStringParam(params, "messageId");
  if (!messageId) {
    throw new Error("Tlon react requires messageId parameter.");
  }

  const to =
    readStringParam(params, "target") ??
    readStringParam(params, "to") ??
    toolContext?.currentChannelId;
  if (!to) {
    throw new Error("Tlon react requires 'to' parameter (target channel or DM).");
  }

  const parsed = parseTlonTarget(to);
  if (!parsed) {
    throw new Error(`Invalid Tlon target: ${to}`);
  }

  const parentId =
    readStringParam(params, "parentId") ??
    (toolContext as { currentThreadTs?: string })?.currentThreadTs ??
    undefined;

  if (parsed.kind === "dm") {
    if (remove) {
      await removeDmReaction({ fromShip, toShip: parsed.ship, messageId, parentId });
      return jsonResult({ ok: true, removed: true });
    }
    await addDmReaction({ fromShip, toShip: parsed.ship, messageId, react: emoji, parentId });
    return jsonResult({ ok: true, added: emoji });
  }

  const nestPrefix = parsed.nest.split("/")[0];
  if (remove) {
    await removeChannelReaction({
      fromShip,
      hostShip: parsed.hostShip,
      channelName: parsed.channelName,
      postId: messageId,
      nestPrefix,
      parentId,
    });
    return jsonResult({ ok: true, removed: true });
  }
  await addChannelReaction({
    fromShip,
    hostShip: parsed.hostShip,
    channelName: parsed.channelName,
    postId: messageId,
    react: emoji,
    nestPrefix,
    parentId,
  });
  return jsonResult({ ok: true, added: emoji });
}

async function handleDelete({
  params,
  toolContext,
}: {
  params: Record<string, unknown>;
  toolContext?: { currentChannelId?: string };
}) {
  const messageId = readStringParam(params, "messageId");
  if (!messageId) {
    throw new Error("Tlon delete requires messageId parameter.");
  }

  const to =
    readStringParam(params, "target") ??
    readStringParam(params, "to") ??
    toolContext?.currentChannelId;
  if (!to) {
    throw new Error("Tlon delete requires 'to' parameter.");
  }

  const parsed = parseTlonTarget(to);
  if (!parsed || parsed.kind === "dm") {
    throw new Error("Tlon delete is only supported for channel posts.");
  }

  const nestPrefix = parsed.nest.split("/")[0];
  if (nestPrefix !== "heap") {
    throw new Error("Tlon delete is currently only supported for heap posts. Use heap/~host/channel as the target.");
  }

  await deleteHeapPost({
    hostShip: parsed.hostShip,
    channelName: parsed.channelName,
    curioId: messageId,
  });

  return jsonResult({ ok: true, deleted: messageId });
}

async function handleReply({
  params,
  fromShip,
  toolContext,
}: {
  params: Record<string, unknown>;
  fromShip: string;
  toolContext?: { currentChannelId?: string };
}) {
  const messageId = readStringParam(params, "messageId");
  if (!messageId) {
    throw new Error(
      "Tlon reply requires messageId parameter (the ID of the post to reply to).",
    );
  }

  const message = readStringParam(params, "message");
  if (!message) {
    throw new Error("Tlon reply requires message parameter (the reply text).");
  }

  const to =
    readStringParam(params, "target") ??
    readStringParam(params, "to") ??
    toolContext?.currentChannelId;
  if (!to) {
    throw new Error("Tlon reply requires 'to' parameter (target channel).");
  }

  const parsed = parseTlonTarget(to);
  if (!parsed) {
    throw new Error(`Invalid Tlon target: ${to}`);
  }

  const story = markdownToStory(message);

  if (parsed.kind === "dm") {
    throw new Error(
      "Tlon reply action is supported for channel targets. For DMs, use action=send with replyTo.",
    );
  }

  await sendChannelPost({
    fromShip,
    nest: parsed.nest,
    story,
    replyToId: messageId,
  });
  return jsonResult({ ok: true, replied: messageId, target: to });
}
