/**
 * Applying one tap on an interactive card: the part that touches the network.
 *
 * The decision itself is pure and lives in `surface-actions.ts`. This resolves
 * the target post, asks for the decision, and on `apply` edits the post. Split
 * that way because the interesting rules — authorization, idempotency, stale
 * revisions, concurrency — are all in the decision and are tested without I/O.
 *
 * See docs/tlon-apps/interactive-surfaces.md.
 */
import { formatUd } from '@tloncorp/api';
import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import {
  type InteractiveActionEntry,
  readSurfaceState,
  rebuildBlobWithSurface,
} from '../urbit/blob.js';
import { type EditPostMetadata, editChannelPost } from '../urbit/send.js';
import type { Story } from '../urbit/story.js';
import type { JsonObject } from './state-ops.js';
import { decideSurfaceAction } from './surface-actions.js';

export type ApplyOutcome =
  | 'applied'
  | 'noop'
  | 'rejected'
  /** The card could not be resolved, or is not ours to edit. */
  | 'unavailable';

/** The bot's own post carrying the card, as read back off the ship. */
export type TargetPost = {
  id: string;
  author: string;
  sentAt: number;
  content: Story;
  blob: string | null;
  isBot: boolean;
  metadata?: EditPostMetadata;
};

export type SurfaceApplyDeps = {
  /** Read the post the action targets, or null when it cannot be read. */
  fetchTargetPost: (
    channelNest: string,
    postId: string
  ) => Promise<TargetPost | null>;
  editPost: (params: {
    nest: string;
    postId: string;
    story: Story;
    blob: string;
    sentAt: number;
    isBot: boolean;
    metadata?: EditPostMetadata;
  }) => Promise<void>;
  botShip: string;
  runtime?: RuntimeEnv;
};

/**
 * Handle an inbound `interactive-action`.
 *
 * On **authorization**: the actor is the reply's author, and the host already
 * enforced that they may write this channel — a reply the bot can see is a
 * reply the host accepted. Tapping a card is posting, so that check *is* the
 * permission. What this adds on top is narrower and its own kind of necessary:
 * the card must be a post the **bot itself wrote**, because an action pointed
 * at anyone else's post is not the bot's to apply.
 */
export async function applyInteractiveAction({
  action,
  actorShip,
  channelNest,
  deps,
}: {
  action: InteractiveActionEntry;
  actorShip: string;
  /** The channel the action reply arrived in. */
  channelNest: string;
  deps: SurfaceApplyDeps;
}): Promise<ApplyOutcome> {
  const log = (message: string) =>
    deps.runtime?.log?.(`[tlon] surface action: ${message}`);

  // An action naming a different channel than the one it was posted in is
  // either confused or hostile; either way the reply's own channel is the only
  // one whose write permission we know the actor passed.
  if (action.targetChannelId !== channelNest) {
    log(
      `ignoring action targeting ${action.targetChannelId} from a reply in ${channelNest}`
    );
    return 'unavailable';
  }

  const post = await deps.fetchTargetPost(channelNest, action.targetPostId);
  if (!post) {
    log(`could not read target post ${action.targetPostId}`);
    return 'unavailable';
  }

  if (normalizeShipName(post.author) !== normalizeShipName(deps.botShip)) {
    log(`target post ${action.targetPostId} is not ours to edit`);
    return 'unavailable';
  }

  const decision = decideSurfaceAction({
    surface: readSurfaceState(post.blob, action.surfaceId),
    action: {
      surfaceId: action.surfaceId,
      actionId: action.actionId,
      expectedRevision: action.expectedRevision,
      name: action.name,
      params: action.params as JsonObject | undefined,
    },
    // See the note on this function: the host already established this.
    actorMayWrite: true,
  });

  if (decision.kind === 'noop') {
    // Deliberately no edit. The tapping client receives nothing and falls back
    // to its timeout; editing here would apply the action a second time.
    log(`${action.actionId} from ${actorShip}: ${decision.reason}`);
    return 'noop';
  }

  if (decision.kind === 'reject') {
    log(`${action.actionId} from ${actorShip} rejected: ${decision.reason}`);
    return 'rejected';
  }

  await deps.editPost({
    nest: channelNest,
    postId: post.id,
    story: post.content,
    // Rebuilt from the post's whole blob, not just the surface entry: %edit
    // erases anything not re-emitted, and the card's own a2ui view is in there.
    blob: rebuildBlobWithSurface(post.blob, {
      surfaceId: action.surfaceId,
      revision: decision.revision,
      state: decision.state,
      processedActionIds: decision.processedActionIds,
    }),
    sentAt: post.sentAt,
    isBot: post.isBot,
    metadata: post.metadata,
  });

  log(
    decision.noChange
      ? `${action.actionId} from ${actorShip} resolved to no change at revision ${decision.revision}`
      : `${action.actionId} from ${actorShip} applied at revision ${decision.revision}`
  );
  return 'applied';
}

/**
 * Read the bot's own card post back off the ship.
 *
 * Only chat channels: a card in a gallery would carry a title in its kind-data,
 * and %edit drops metadata that is not resent, so declining is safer than
 * silently erasing it. Cards are posted to chat today.
 */
export function makeTargetPostFetcher(
  api: { scry: (path: string) => Promise<unknown> },
  runtime?: RuntimeEnv
) {
  return async (
    channelNest: string,
    postId: string
  ): Promise<TargetPost | null> => {
    if (!channelNest.startsWith('chat/')) {
      runtime?.log?.(
        `[tlon] surface action: declining a card in a non-chat channel ${channelNest}`
      );
      return null;
    }
    try {
      // Matches %channels' +on-peek arm `[%post time=@ ~]`; the mark goes in
      // the extension.
      const payload = await api.scry(
        `/channels/v4/${channelNest}/posts/post/${formatUd(postId)}.json`
      );
      return toTargetPost(payload, postId);
    } catch (error) {
      runtime?.log?.(
        `[tlon] surface action: could not read ${postId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  };
}

/** Map a single-post scry payload onto what an edit needs. */
export function toTargetPost(
  payload: unknown,
  fallbackId: string
): TargetPost | null {
  if (!isRecord(payload) || !isRecord(payload.essay)) {
    return null;
  }
  const essay = payload.essay;
  const author = essay.author;
  // A bot author is an object carrying the ship; a human author is a bare
  // string. That shape is what the "Bot" tag keys off, so it has to survive.
  const isBot = isRecord(author) && typeof author.ship === 'string';
  const ship = isBot
    ? (author as { ship: string }).ship
    : typeof author === 'string'
      ? author
      : null;
  if (!ship || !Array.isArray(essay.content)) {
    return null;
  }
  const seal = isRecord(payload.seal) ? payload.seal : undefined;
  return {
    id: typeof seal?.id === 'string' ? seal.id : fallbackId,
    author: ship,
    sentAt: typeof essay.sent === 'number' ? essay.sent : 0,
    content: essay.content as Story,
    blob: typeof essay.blob === 'string' ? essay.blob : null,
    isBot,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The real edit, for callers that are not a test. */
export function makeSurfaceEditor(botShip: string) {
  return async (params: {
    nest: string;
    postId: string;
    story: Story;
    blob: string;
    sentAt: number;
    isBot: boolean;
    metadata?: EditPostMetadata;
  }) => {
    await editChannelPost({
      fromShip: botShip,
      nest: params.nest,
      postId: params.postId,
      story: params.story,
      blob: params.blob,
      sentAt: params.sentAt,
      metadata: params.metadata,
      // Carried back so a bot-authored card keeps its "Bot" tag. Display values
      // come from contact sync, so only the shape matters.
      ...(params.isBot ? { botProfile: { nickname: null, avatar: null } } : {}),
    });
  };
}

function normalizeShipName(ship: string): string {
  return ship.startsWith('~') ? ship : `~${ship}`;
}
