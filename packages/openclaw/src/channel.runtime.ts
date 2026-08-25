import { notes, scry } from '@tloncorp/api';
import type {
  ChannelAccountSnapshot,
  ChannelOutboundAdapter,
  ChannelPlugin,
  OpenClawConfig,
} from 'openclaw/plugin-sdk/core';
import { chunkText } from 'openclaw/plugin-sdk/reply-chunking';
import {
  formatTextWithAttachmentLinks,
  resolvePayloadMediaUrls,
  sendTextMediaPayload,
} from 'openclaw/plugin-sdk/reply-payload';

import {
  type ContextLensRegistry,
  getActiveBackgroundContextLens,
  getActiveForegroundContextLensForConversation,
  recordBackgroundContextLensOutput,
} from './context-lens.js';
import { monitorTlonProvider } from './monitor/index.js';
import { notesDeliveryMessageId } from './notes-delivery-state.js';
import { tlonSetupWizard } from './setup-surface.js';
import { formatTargetHint, normalizeShip, parseTlonTarget } from './targets.js';
import { observeActiveTlonTurnDelivery } from './turn-recorder.js';
import { resolveTlonAccount } from './types.js';
import { withAuthenticatedTlonApi } from './urbit/api-client.js';
import { authenticate } from './urbit/auth.js';
import { serializeContextLensReferenceBlob } from './urbit/blob.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './urbit/context.js';
import { urbitFetch } from './urbit/fetch.js';
import {
  type BotProfile,
  buildMediaStory,
  buildMediaText,
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

function notesTitle(markdown: string): string {
  const firstLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return 'Update';
  }
  const title = firstLine
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .trim();
  return (title || 'Update').slice(0, 120);
}

function notesBody(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim());
  if (
    headingIndex === -1 ||
    !/^\s{0,3}#{1,6}\s+\S/.test(lines[headingIndex] ?? '')
  ) {
    return markdown;
  }

  lines.splice(headingIndex, 1);
  while (lines[0]?.trim() === '') {
    lines.shift();
  }
  return lines.join('\n');
}

async function sendNotesEntry({
  fromShip,
  nest,
  text,
}: {
  fromShip: string;
  nest: string;
  text: string;
}) {
  const notebook = await notes.getNotebook(nest);
  const created = await notes.createNote({
    flag: nest,
    folder: notebook.rootFolderId,
    title: notesTitle(text),
    body: notesBody(text),
  });
  return {
    channel: 'tlon' as const,
    messageId: notesDeliveryMessageId(fromShip, created?.id),
    sentAt: Date.now(),
  };
}

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

async function sendNotesEntryWithLens({
  account,
  fromShip,
  nest,
  text,
}: {
  account: ConfiguredTlonAccount;
  fromShip: string;
  nest: string;
  text: string;
}) {
  const target = resolveOutboundLensTarget(account, fromShip, nest);
  const result = await sendNotesEntry({ fromShip, nest, text });
  recordOutboundLensDelivery(target, {
    messageId: result.messageId,
    conversationId: nest,
    kind: 'channel',
    sentAt: result.sentAt,
    text,
  });
  return result;
}

const unobservedTlonRuntimeOutbound: Pick<
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
        const fromShip = normalizeShip(account.ship);
        const replyId = resolveReplyId(replyToId, threadId);
        const botProfile = await getBotProfile(fromShip);
        if (parsed.kind === 'dm') {
          const conversationId = normalizeShip(parsed.ship);
          const target = resolveOutboundLensTarget(
            account,
            fromShip,
            conversationId
          );
          const result = await sendDm({
            fromShip,
            toShip: parsed.ship,
            text,
            blob: target?.blob,
            replyToId: replyId,
            botProfile,
          });
          recordOutboundLensDelivery(target, {
            messageId: result.messageId,
            conversationId,
            kind: 'dm',
            sentAt: result.sentAt,
            text,
          });
          return result;
        }
        if (parsed.kind === 'notebook') {
          return await sendNotesEntryWithLens({
            account,
            fromShip,
            nest: parsed.nest,
            text,
          });
        }
        const target = resolveOutboundLensTarget(
          account,
          fromShip,
          parsed.nest
        );
        const result = await sendChannelPost({
          fromShip,
          nest: parsed.nest,
          story: markdownToStory(text),
          blob: target?.blob,
          replyToId: replyId,
          botProfile,
        });
        recordOutboundLensDelivery(target, {
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
        const media = mediaUrl
          ? await prepareOutboundMedia(mediaUrl)
          : undefined;
        const fromShip = normalizeShip(account.ship);
        const story = buildMediaStory(text, media);
        const replyId = resolveReplyId(replyToId, threadId);
        const botProfile = await getBotProfile(fromShip);
        if (parsed.kind === 'dm') {
          const conversationId = normalizeShip(parsed.ship);
          const target = resolveOutboundLensTarget(
            account,
            fromShip,
            conversationId
          );
          const result = await sendDmWithStory({
            fromShip,
            toShip: parsed.ship,
            story,
            blob: target?.blob,
            replyToId: replyId,
            botProfile,
          });
          recordOutboundLensDelivery(target, {
            messageId: result.messageId,
            conversationId,
            kind: 'dm',
            sentAt: result.sentAt,
            text,
          });
          return result;
        }
        if (parsed.kind === 'notebook') {
          return await sendNotesEntryWithLens({
            account,
            fromShip,
            nest: parsed.nest,
            text: buildMediaText(text, media?.url),
          });
        }
        const target = resolveOutboundLensTarget(
          account,
          fromShip,
          parsed.nest
        );
        const result = await sendChannelPost({
          fromShip,
          nest: parsed.nest,
          story,
          blob: target?.blob,
          replyToId: replyId,
          botProfile,
        });
        recordOutboundLensDelivery(target, {
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

export const tlonRuntimeOutbound: Pick<
  ChannelOutboundAdapter,
  'sendPayload' | 'sendText' | 'sendMedia'
> = {
  sendText: (params) =>
    observeActiveTlonTurnDelivery(() =>
      unobservedTlonRuntimeOutbound.sendText!(params)
    ),
  sendMedia: (params) =>
    observeActiveTlonTurnDelivery(() =>
      unobservedTlonRuntimeOutbound.sendMedia!(params)
    ),
  sendPayload: async (ctx) => {
    const parsed = parseTlonTarget(ctx.to);
    if (parsed?.kind === 'notebook') {
      const { account } = resolveOutboundContext({
        cfg: ctx.cfg,
        accountId: ctx.accountId,
        to: ctx.to,
      });
      const mediaUrls = await withAuthenticatedTlonApi(
        {
          url: account.url,
          code: account.code,
          ship: account.ship,
          allowPrivateNetwork: account.allowPrivateNetwork ?? undefined,
        },
        async () =>
          Promise.all(
            resolvePayloadMediaUrls(ctx.payload).map(
              async (mediaUrl) => (await prepareOutboundMedia(mediaUrl)).url
            )
          )
      );
      const text = formatTextWithAttachmentLinks(ctx.payload.text, mediaUrls);
      return await observeActiveTlonTurnDelivery(() =>
        unobservedTlonRuntimeOutbound.sendText!({ ...ctx, text })
      );
    }
    return await sendTextMediaPayload({
      channel: 'tlon',
      ctx,
      adapter: {
        chunker: chunkText,
        sendMedia: tlonRuntimeOutbound.sendMedia,
        sendText: tlonRuntimeOutbound.sendText,
        textChunkLimit: 10_000,
      },
    });
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
    cfg: ctx.cfg,
  });
}

export { tlonSetupWizard };
