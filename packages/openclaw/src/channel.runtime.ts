import { scry } from '@tloncorp/api';
import crypto from 'node:crypto';
import type {
  ChannelAccountSnapshot,
  ChannelOutboundAdapter,
  ChannelPlugin,
  OpenClawConfig,
} from 'openclaw/plugin-sdk/core';

import {
  getActiveBackgroundContextLens,
  recordBackgroundContextLensOutput,
} from './context-lens.js';
import { monitorTlonProvider } from './monitor/index.js';
import { tlonSetupWizard } from './setup-surface.js';
import { formatTargetHint, normalizeShip, parseTlonTarget } from './targets.js';
import { resolveTlonAccount } from './types.js';
import { withAuthenticatedTlonApi } from './urbit/api-client.js';
import { authenticate } from './urbit/auth.js';
import { serializeContextLensReferenceBlob } from './urbit/blob.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './urbit/context.js';
import { urbitFetch } from './urbit/fetch.js';
import {
  type BotProfile,
  buildMediaStory,
  sendChannelPost,
  sendDm,
  sendDmWithStory,
  sendVouchedDm,
  sendVouchedDmWithStory,
} from './urbit/send.js';
import { markdownToStory } from './urbit/story.js';
import { uploadImageFromUrl } from './urbit/upload.js';

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
    }>({ app: 'contacts', path: '/v1/self' });

    const profile: BotProfile = {
      nickname: selfProfile?.nickname?.value ?? '',
      avatar: selfProfile?.avatar?.value ?? '',
    };
    profileCache.set(ship, profile);

    if (profile.nickname || profile.avatar) {
      console.log(
        `[tlon] Using self profile for bot meta (${ship}): ${profile.nickname || '(no nickname)'}`
      );
      return profile;
    }
  } catch (err) {
    console.log(`[tlon] Could not fetch self profile for bot meta: ${err}`);
  }

  return undefined;
}

// Resolve the identity to author outbound content as. When a `moon` is
// configured the plugin runs on the host (`account.ship`) but speaks as the
// moon: author = the moon, with a bot-meta object so it's flagged as a bot
// (display name/avatar resolve from the host's published profile). Without a
// moon we keep the legacy behavior of acting as the connected ship itself.
async function resolveOutboundIdentity(
  account: ConfiguredTlonAccount
): Promise<{ fromShip: string; botProfile?: BotProfile }> {
  if (account.moon) {
    return {
      fromShip: normalizeShip(account.moon),
      botProfile: { nickname: '', avatar: '' },
    };
  }
  const fromShip = normalizeShip(account.ship);
  return { fromShip, botProfile: await getBotProfile(fromShip) };
}

function resolveOutboundContext(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
  to: string;
}) {
  const account = resolveTlonAccount(params.cfg, params.accountId ?? undefined);
  if (!account.configured || !account.ship || !account.url || !account.code) {
    throw new Error('Tlon account not configured');
  }

  const parsed = parseTlonTarget(params.to);
  if (!parsed) {
    throw new Error(`Invalid Tlon target. Use ${formatTargetHint()}`);
  }

  return { account: account as ConfiguredTlonAccount, parsed };
}

function resolveReplyId(
  replyToId?: string | null,
  threadId?: string | number | null
) {
  return replyToId ?? threadId ? String(replyToId ?? threadId) : undefined;
}

/**
 * Gateway-delivered sends (cron announcements, CLI sends) carry no session
 * context, so messages produced by background runs would otherwise land
 * without a lens pointer. Stamp them with the currently active background
 * lens — best-effort correlation, bounded by the lens's short post-run
 * finalize window.
 */
function resolveBackgroundLensStamp(
  cfg: OpenClawConfig,
  botShip: string
): { lensId: string; blob: string } | null {
  if (!resolveTlonAccount(cfg).contextLens.enabled) {
    return null;
  }
  const lens = getActiveBackgroundContextLens();
  if (!lens) {
    return null;
  }
  return {
    lensId: lens.lensId,
    blob: serializeContextLensReferenceBlob(lens.lensId, botShip),
  };
}

function recordBackgroundLensDelivery(params: {
  stamp: { lensId: string } | null;
  messageId: string;
  conversationId: string;
  kind: 'dm' | 'channel';
  sentAt?: number;
  text?: string;
}) {
  if (!params.stamp) {
    return;
  }
  recordBackgroundContextLensOutput(params.stamp.lensId, {
    messageId: params.messageId,
    conversationId: params.conversationId,
    kind: params.kind,
    sentAt: params.sentAt ?? Date.now(),
    preview: params.text ? params.text.slice(0, 140) : undefined,
  });
}

export const tlonRuntimeOutbound: Pick<
  ChannelOutboundAdapter,
  'sendText' | 'sendMedia'
> = {
  sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) => {
    const { account, parsed } = resolveOutboundContext({ cfg, accountId, to });
    return await withAuthenticatedTlonApi(
      {
        url: account.url,
        code: account.code,
        ship: account.ship,
        allowPrivateNetwork: account.allowPrivateNetwork ?? undefined,
      },
      async () => {
        const { fromShip, botProfile } = await resolveOutboundIdentity(account);
        const replyId = resolveReplyId(replyToId, threadId);
        const stamp = resolveBackgroundLensStamp(cfg, normalizeShip(account.ship));
        if (parsed.kind === 'dm') {
          // As a moon, route DMs through the vouched [moon,human] path so they
          // don't commingle with the host's own DMs.
          const result = account.moon
            ? await sendVouchedDm({
                as: fromShip,
                toShip: parsed.ship,
                text,
                blob: stamp?.blob,
                botProfile,
              })
            : await sendDm({
                fromShip,
                toShip: parsed.ship,
                text,
                blob: stamp?.blob,
                replyToId: replyId,
                botProfile,
              });
          recordBackgroundLensDelivery({
            stamp,
            messageId: result.messageId,
            conversationId: parsed.ship,
            kind: 'dm',
            sentAt: result.sentAt,
            text,
          });
          return result;
        }
        const result = await sendChannelPost({
          fromShip,
          nest: parsed.nest,
          story: markdownToStory(text),
          blob: stamp?.blob,
          replyToId: replyId,
          botProfile,
        });
        recordBackgroundLensDelivery({
          stamp,
          messageId: result.messageId,
          conversationId: parsed.nest,
          kind: 'channel',
          text,
        });
        return result;
      }
    );
  },
  sendMedia: async ({
    cfg,
    to,
    text,
    mediaUrl,
    accountId,
    replyToId,
    threadId,
  }) => {
    const { account, parsed } = resolveOutboundContext({ cfg, accountId, to });
    return await withAuthenticatedTlonApi(
      {
        url: account.url,
        code: account.code,
        ship: account.ship,
        allowPrivateNetwork: account.allowPrivateNetwork ?? undefined,
      },
      async () => {
        const uploadedUrl = mediaUrl
          ? await uploadImageFromUrl(mediaUrl)
          : undefined;
        const { fromShip, botProfile } = await resolveOutboundIdentity(account);
        const story = buildMediaStory(text, uploadedUrl);
        const replyId = resolveReplyId(replyToId, threadId);
        const stamp = resolveBackgroundLensStamp(cfg, normalizeShip(account.ship));
        if (parsed.kind === 'dm') {
          const result = account.moon
            ? await sendVouchedDmWithStory({
                as: fromShip,
                toShip: parsed.ship,
                story,
                blob: stamp?.blob,
                botProfile,
              })
            : await sendDmWithStory({
                fromShip,
                toShip: parsed.ship,
                story,
                blob: stamp?.blob,
                replyToId: replyId,
                botProfile,
              });
          recordBackgroundLensDelivery({
            stamp,
            messageId: result.messageId,
            conversationId: parsed.ship,
            kind: 'dm',
            sentAt: result.sentAt,
            text,
          });
          return result;
        }
        const result = await sendChannelPost({
          fromShip,
          nest: parsed.nest,
          story,
          blob: stamp?.blob,
          replyToId: replyId,
          botProfile,
        });
        recordBackgroundLensDelivery({
          stamp,
          messageId: result.messageId,
          conversationId: parsed.nest,
          kind: 'channel',
          text,
        });
        return result;
      }
    );
  },
};

export async function probeTlonAccount(account: ConfiguredTlonAccount) {
  try {
    const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(
      account.allowPrivateNetwork
    );
    const cookie = await authenticate(account.url, account.code, {
      ssrfPolicy,
    });
    const { response, release } = await urbitFetch({
      baseUrl: account.url,
      path: '/~/name',
      init: {
        method: 'GET',
        headers: { Cookie: cookie },
      },
      ssrfPolicy,
      timeoutMs: 30_000,
      auditContext: 'tlon-probe-account',
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
    return {
      ok: false,
      error: (error as { message?: string })?.message ?? String(error),
    };
  }
}

export async function startTlonGatewayAccount(
  ctx: Parameters<
    NonNullable<NonNullable<ChannelPlugin['gateway']>['startAccount']>
  >[0]
) {
  const account = ctx.account;
  ctx.setStatus({
    accountId: account.accountId,
    ship: account.ship,
    url: account.url,
  } as ChannelAccountSnapshot);
  ctx.log?.info(
    `[${account.accountId}] starting Tlon provider for ${account.ship ?? 'tlon'}`
  );
  return monitorTlonProvider({
    runtime: ctx.runtime,
    abortSignal: ctx.abortSignal,
    accountId: account.accountId,
  });
}

export { tlonSetupWizard };
