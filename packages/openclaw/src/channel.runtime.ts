import crypto from "node:crypto";
import type {
  ChannelAccountSnapshot,
  ChannelOutboundAdapter,
  ChannelPlugin,
  OpenClawConfig,
} from "openclaw/plugin-sdk/core";
import { monitorTlonProvider } from "./monitor/index.js";
import { tlonSetupWizard } from "./setup-surface.js";
import {
  formatTargetHint,
  normalizeShip,
  parseTlonTarget,
} from "./targets.js";
import { resolveTlonAccount } from "./types.js";
import { authenticate } from "./urbit/auth.js";
import { withAuthenticatedTlonApi } from "./urbit/api-client.js";
import { ssrfPolicyFromAllowPrivateNetwork } from "./urbit/context.js";
import { urbitFetch } from "./urbit/fetch.js";
import {
  buildMediaStory,
  sendDm,
  sendDmWithStory,
  sendChannelPost,
  type BotProfile,
} from "./urbit/send.js";
import { uploadImageFromUrl } from "./urbit/upload.js";
import { markdownToStory } from "./urbit/story.js";
import { scry } from "@tloncorp/api";

type ResolvedTlonAccount = ReturnType<typeof resolveTlonAccount>;
type ConfiguredTlonAccount = ResolvedTlonAccount & {
  ship: string;
  url: string;
  code: string;
};

// Cache for bot profiles per ship (supports multi-account setups)
const profileCache = new Map<string, BotProfile | null>();

/**
 * Get bot profile for outbound messages from the ship's Tlon profile.
 * Caches per-ship to support multi-account configurations.
 */
async function getBotProfile(ship: string): Promise<BotProfile | undefined> {
  if (profileCache.has(ship)) {
    const cached = profileCache.get(ship);
    if (cached && (cached.nickname || cached.avatar)) {
      return cached;
    }
    return undefined;
  }

  try {
    const selfProfile = await scry<{
      nickname?: { value?: string };
      avatar?: { value?: string };
    }>({ app: "contacts", path: "/v1/self" });

    const profile: BotProfile = {
      nickname: selfProfile?.nickname?.value ?? "",
      avatar: selfProfile?.avatar?.value ?? "",
    };
    profileCache.set(ship, profile);

    if (profile.nickname || profile.avatar) {
      console.log(`[tlon] Using self profile for bot meta (${ship}): ${profile.nickname || "(no nickname)"}`);
      return profile;
    }
  } catch (err) {
    console.log(`[tlon] Could not fetch self profile for bot meta: ${err}`);
  }

  return undefined;
}

function resolveOutboundContext(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
  to: string;
}) {
  const account = resolveTlonAccount(params.cfg, params.accountId ?? undefined);
  if (!account.configured || !account.ship || !account.url || !account.code) {
    throw new Error("Tlon account not configured");
  }

  const parsed = parseTlonTarget(params.to);
  if (!parsed) {
    throw new Error(`Invalid Tlon target. Use ${formatTargetHint()}`);
  }

  return { account: account as ConfiguredTlonAccount, parsed };
}

function resolveReplyId(replyToId?: string | null, threadId?: string | number | null) {
  return (replyToId ?? threadId) ? String(replyToId ?? threadId) : undefined;
}

export const tlonRuntimeOutbound: Pick<ChannelOutboundAdapter, "sendText" | "sendMedia"> = {
  sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) => {
    const { account, parsed } = resolveOutboundContext({ cfg, accountId, to });
    return await withAuthenticatedTlonApi(
      { url: account.url, code: account.code, ship: account.ship, allowPrivateNetwork: account.allowPrivateNetwork ?? undefined },
      async () => {
        const fromShip = normalizeShip(account.ship);
        const replyId = resolveReplyId(replyToId, threadId);
        const botProfile = await getBotProfile(fromShip);
        if (parsed.kind === "dm") {
          return await sendDm({ fromShip, toShip: parsed.ship, text, replyToId: replyId, botProfile });
        }
        return await sendChannelPost({
          fromShip,
          nest: parsed.nest,
          story: markdownToStory(text),
          replyToId: replyId,
          botProfile,
        });
      },
    );
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, replyToId, threadId }) => {
    const { account, parsed } = resolveOutboundContext({ cfg, accountId, to });
    return await withAuthenticatedTlonApi(
      { url: account.url, code: account.code, ship: account.ship, allowPrivateNetwork: account.allowPrivateNetwork ?? undefined },
      async () => {
        const uploadedUrl = mediaUrl ? await uploadImageFromUrl(mediaUrl) : undefined;
        const fromShip = normalizeShip(account.ship);
        const story = buildMediaStory(text, uploadedUrl);
        const replyId = resolveReplyId(replyToId, threadId);
        const botProfile = await getBotProfile(fromShip);
        if (parsed.kind === "dm") {
          return await sendDmWithStory({ fromShip, toShip: parsed.ship, story, replyToId: replyId, botProfile });
        }
        return await sendChannelPost({
          fromShip,
          nest: parsed.nest,
          story,
          replyToId: replyId,
          botProfile,
        });
      },
    );
  },
};

export async function probeTlonAccount(account: ConfiguredTlonAccount) {
  try {
    const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(account.allowPrivateNetwork);
    const cookie = await authenticate(account.url, account.code, { ssrfPolicy });
    const { response, release } = await urbitFetch({
      baseUrl: account.url,
      path: "/~/name",
      init: {
        method: "GET",
        headers: { Cookie: cookie },
      },
      ssrfPolicy,
      timeoutMs: 30_000,
      auditContext: "tlon-probe-account",
    });
    try {
      if (!response.ok) {
        return { ok: false, error: `Name request failed: ${response.status}` };
      }
      return { ok: true };
    } finally {
      await release();
    }
  } catch (error) {
    return { ok: false, error: (error as { message?: string })?.message ?? String(error) };
  }
}

export async function startTlonGatewayAccount(
  ctx: Parameters<NonNullable<NonNullable<ChannelPlugin["gateway"]>["startAccount"]>>[0],
) {
  const account = ctx.account;
  ctx.setStatus({
    accountId: account.accountId,
    ship: account.ship,
    url: account.url,
  } as ChannelAccountSnapshot);
  ctx.log?.info(`[${account.accountId}] starting Tlon provider for ${account.ship ?? "tlon"}`);
  return monitorTlonProvider({
    runtime: ctx.runtime,
    abortSignal: ctx.abortSignal,
    accountId: account.accountId,
  });
}

export { tlonSetupWizard };
