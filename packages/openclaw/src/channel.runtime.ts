import { scry } from '@tloncorp/api';
import type {
  ChannelAccountSnapshot,
  ChannelOutboundAdapter,
  ChannelPlugin,
  OpenClawConfig,
} from 'openclaw/plugin-sdk/core';

import {
  approvalSurfaceId,
  buildTlonPresentationBlobField,
  readTlonReplyBlob,
} from './approval-presentation.js';
import {
  type ContextLensRegistry,
  getActiveBackgroundContextLens,
  getActiveForegroundContextLensForConversation,
  recordBackgroundContextLensOutput,
} from './context-lens.js';
import { monitorTlonProvider } from './monitor/index.js';
import { tlonSetupWizard } from './setup-surface.js';
import { formatTargetHint, normalizeShip, parseTlonTarget } from './targets.js';
import { observeActiveTlonTurnDelivery } from './turn-recorder.js';
import { resolveTlonAccount } from './types.js';
import { withAuthenticatedTlonApi } from './urbit/api-client.js';
import { authenticate } from './urbit/auth.js';
import {
  combineBlobFields,
  serializeContextLensReferenceBlob,
} from './urbit/blob.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './urbit/context.js';
import { urbitFetch } from './urbit/fetch.js';
import {
  type BotProfile,
  buildMediaStory,
  sendChannelPost,
  sendDm,
  sendDmWithStory,
} from './urbit/send.js';
import { markdownToStory } from './urbit/story.js';
import { prepareOutboundMedia } from './urbit/upload.js';

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
  return (replyToId ?? threadId) ? String(replyToId ?? threadId) : undefined;
}

type OutboundLensTarget = {
  // Foreground runs hold their own registry instance; background sends route
  // through the shared module-level background registry (registry === null).
  registry: ContextLensRegistry | null;
  lensId: string;
  blob: string;
  foreground: boolean;
};

/**
 * Resolve the context lens an outbound send should attach to.
 *
 * Prefers the foreground run that is mid-dispatch for this conversation, so a
 * reply the model issues by calling the `message` tool itself (instead of
 * emitting a normal final reply) is recorded against that run — otherwise the
 * run finalizes as `no_reply` despite having posted. Falls back to the most
 * recent background lens for gateway/cron/CLI sends that carry no session
 * context (best-effort, bounded by the lens's short post-run finalize window).
 *
 * Attribution is keyed on conversationId, which keeps concurrent runs in
 * different conversations separated. Two foreground runs overlapping in the
 * same conversation cannot be told apart here (the outbound adapter has no run
 * identity), so a tool post may land on the most recently bound of them — a
 * best-effort tradeoff matching the background-stamp heuristic.
 */
function resolveOutboundLensTarget(
  account: ConfiguredTlonAccount,
  botShip: string,
  conversationId: string
): OutboundLensTarget | null {
  if (!account.contextLens.enabled) {
    return null;
  }
  const foreground =
    getActiveForegroundContextLensForConversation(conversationId);
  if (foreground) {
    return {
      registry: foreground.registry,
      lensId: foreground.lensId,
      blob: serializeContextLensReferenceBlob(foreground.lensId, botShip),
      foreground: true,
    };
  }
  const background = getActiveBackgroundContextLens();
  if (!background) {
    return null;
  }
  return {
    registry: null,
    lensId: background.lensId,
    blob: serializeContextLensReferenceBlob(background.lensId, botShip),
    foreground: false,
  };
}

function recordOutboundLensDelivery(
  target: OutboundLensTarget | null,
  params: {
    messageId: string;
    conversationId: string;
    kind: 'dm' | 'channel';
    sentAt?: number;
    text?: string;
  }
) {
  if (!target) {
    return;
  }
  const output = {
    messageId: params.messageId,
    conversationId: params.conversationId,
    kind: params.kind,
    sentAt: params.sentAt ?? Date.now(),
    preview: params.text ? params.text.slice(0, 140) : undefined,
  };
  if (target.foreground && target.registry) {
    target.registry.recordOutput(target.lensId, output);
    target.registry.recordPersistence(target.lensId, { postsReply: true });
    return;
  }
  recordBackgroundContextLensOutput(target.lensId, output);
}

type TlonOutboundMessageParams = {
  cfg: OpenClawConfig;
  to: string;
  text: string;
  mediaUrl?: string;
  accountId?: string | null;
  replyToId?: string | null;
  threadId?: string | number | null;
  blob?: string;
};

async function sendTlonOutboundMessage(params: TlonOutboundMessageParams) {
  const { account, parsed } = resolveOutboundContext(params);
  return await withAuthenticatedTlonApi(
    {
      url: account.url,
      code: account.code,
      ship: account.ship,
      allowPrivateNetwork: account.allowPrivateNetwork ?? undefined,
    },
    async () => {
      const media = params.mediaUrl
        ? await prepareOutboundMedia(params.mediaUrl)
        : undefined;
      const fromShip = normalizeShip(account.ship);
      const story = media
        ? buildMediaStory(params.text, media)
        : markdownToStory(params.text);
      const replyId = resolveReplyId(params.replyToId, params.threadId);
      const botProfile = await getBotProfile(fromShip);
      if (parsed.kind === 'dm') {
        const conversationId = normalizeShip(parsed.ship);
        const target = resolveOutboundLensTarget(
          account,
          fromShip,
          conversationId
        );
        const blob = combineBlobFields(params.blob, target?.blob);
        const result = media
          ? await sendDmWithStory({
              fromShip,
              toShip: parsed.ship,
              story,
              blob,
              replyToId: replyId,
              botProfile,
            })
          : await sendDm({
              fromShip,
              toShip: parsed.ship,
              text: params.text,
              blob,
              replyToId: replyId,
              botProfile,
            });
        recordOutboundLensDelivery(target, {
          messageId: result.messageId,
          conversationId,
          kind: 'dm',
          sentAt: result.sentAt,
          text: params.text,
        });
        return result;
      }
      const target = resolveOutboundLensTarget(account, fromShip, parsed.nest);
      const result = await sendChannelPost({
        fromShip,
        nest: parsed.nest,
        story,
        blob: combineBlobFields(params.blob, target?.blob),
        replyToId: replyId,
        botProfile,
      });
      recordOutboundLensDelivery(target, {
        messageId: result.messageId,
        conversationId: parsed.nest,
        kind: 'channel',
        text: params.text,
      });
      return result;
    }
  );
}

const unobservedTlonRuntimeOutbound: Pick<
  ChannelOutboundAdapter,
  'renderPresentation' | 'sendPayload' | 'sendText' | 'sendMedia'
> = {
  renderPresentation: ({ payload, presentation }) => {
    const blob = buildTlonPresentationBlobField({
      presentation,
      fallbackText: payload.text,
      surfaceId: approvalSurfaceId(payload),
    });
    if (!blob) {
      return payload;
    }
    return {
      ...payload,
      channelData: {
        ...payload.channelData,
        tlon: {
          ...(payload.channelData?.tlon as Record<string, unknown> | undefined),
          blob: combineBlobFields(readTlonReplyBlob(payload), blob),
          presentationRendered: true,
        },
      },
    };
  },
  sendPayload: async (ctx) => {
    const presentationRendered =
      (
        ctx.payload.channelData?.tlon as
          | { presentationRendered?: unknown }
          | undefined
      )?.presentationRendered === true;
    const rendered =
      ctx.payload.presentation && !presentationRendered
        ? (unobservedTlonRuntimeOutbound.renderPresentation?.({
            payload: ctx.payload,
            presentation: ctx.payload.presentation,
            ctx,
          }) ?? ctx.payload)
        : ctx.payload;
    const payload = await rendered;
    if (!payload) {
      return { channel: 'tlon', messageId: '' };
    }
    const mediaUrls = [
      ...(payload.mediaUrls ?? []),
      ...(payload.mediaUrl ? [payload.mediaUrl] : []),
    ].filter(Boolean);
    if (mediaUrls.length === 0) {
      const result = await sendTlonOutboundMessage({
        ...ctx,
        text: payload.text ?? '',
        blob: readTlonReplyBlob(payload),
      });
      await ctx.onDeliveryResult?.(result);
      return result;
    }
    let lastResult = await sendTlonOutboundMessage({
      ...ctx,
      text: payload.text ?? '',
      mediaUrl: mediaUrls[0],
      blob: readTlonReplyBlob(payload),
    });
    await ctx.onDeliveryResult?.(lastResult);
    for (const mediaUrl of mediaUrls.slice(1)) {
      lastResult = await sendTlonOutboundMessage({
        ...ctx,
        text: '',
        mediaUrl,
      });
      await ctx.onDeliveryResult?.(lastResult);
    }
    return lastResult;
  },
  sendText: async (params) => await sendTlonOutboundMessage(params),
  sendMedia: async (params) => await sendTlonOutboundMessage(params),
};

export const tlonRuntimeOutbound: Pick<
  ChannelOutboundAdapter,
  'renderPresentation' | 'sendPayload' | 'sendText' | 'sendMedia'
> = {
  renderPresentation: (params) =>
    unobservedTlonRuntimeOutbound.renderPresentation!(params),
  sendPayload: (params) =>
    observeActiveTlonTurnDelivery(() =>
      unobservedTlonRuntimeOutbound.sendPayload!(params)
    ),
  sendText: (params) =>
    observeActiveTlonTurnDelivery(() =>
      unobservedTlonRuntimeOutbound.sendText!(params)
    ),
  sendMedia: (params) =>
    observeActiveTlonTurnDelivery(() =>
      unobservedTlonRuntimeOutbound.sendMedia!(params)
    ),
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
    cfg: ctx.cfg,
  });
}

export { tlonSetupWizard };
