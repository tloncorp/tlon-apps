import { getCurrentUserId, poke, sendPost } from '@tloncorp/api';
import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';
import { appendActionResponseToPostBlob } from '@tloncorp/api/lib/content-helpers';
import type { Story } from '@tloncorp/api/urbit';

export type PokeTemplateContext = {
  targetUser?: string;
  currentChannel?: string;
  targetChannel?: string;
  /** ID of the post containing the action button */
  sourcePostId?: string;
};

/**
 * Replace template variables in poke JSON before sending.
 * Supported variables:
 *   {{currentUser}}    — the pressing user's ship name
 *   {{targetUser}}     — the post author's ship name
 *   {{currentChannel}} — the channel the post appears in
 *   {{targetChannel}}  — the channel the post potentially references
 *                        (e.g. a channel being linked to)
 * Template variables are replaced globally, so they can be used in nested
 * structures and multiple times. If a variable is present in the JSON but not
 * provided in the context, it will be left as-is.
 */
function resolvePokeTemplates(
  json: unknown,
  ctx: PokeTemplateContext
): unknown {
  if (typeof json === 'string') {
    let out = json;
    if (out.includes('{{currentUser}}')) {
      out = out.replace(/\{\{currentUser\}\}/g, getCurrentUserId());
    }
    if (ctx.targetUser != null) {
      out = out.replace(/\{\{targetUser\}\}/g, ctx.targetUser);
    }
    if (ctx.currentChannel != null) {
      out = out.replace(/\{\{currentChannel\}\}/g, ctx.currentChannel);
    }
    if (ctx.targetChannel != null) {
      out = out.replace(/\{\{targetChannel\}\}/g, ctx.targetChannel);
    }
    return out;
  }
  if (Array.isArray(json)) {
    return json.map((item) => resolvePokeTemplates(item, ctx));
  }
  if (json !== null && typeof json === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(json)) {
      out[k] = resolvePokeTemplates(v, ctx);
    }
    return out;
  }
  return json;
}

export async function fireActionButtonPoke(
  actionButton: PostBlobDataEntryActionButton,
  ctx: PokeTemplateContext = {},
  pokeFn: typeof poke = poke
) {
  if (!actionButton.pokeApp || !actionButton.pokeMark) {
    return;
  }
  await pokeFn({
    app: actionButton.pokeApp,
    mark: actionButton.pokeMark,
    json: resolvePokeTemplates(actionButton.pokeJson, ctx),
  });
}

/**
 * Send a response message to the channel after an action button is pressed.
 * The message carries an `action-response` blob entry so the sender's UI
 * can suppress it while the recipient sees the text.
 */
export async function sendActionResponse(
  actionButton: PostBlobDataEntryActionButton,
  ctx: PokeTemplateContext,
  sendPostFn: typeof sendPost = sendPost,
  getCurrentUserIdFn: typeof getCurrentUserId = getCurrentUserId
) {
  if (!actionButton.responseText || !ctx.currentChannel || !ctx.sourcePostId) {
    return;
  }

  const authorId = getCurrentUserIdFn();
  const senderHidden = actionButton.responseSenderHidden !== false;
  const blob = appendActionResponseToPostBlob(undefined, {
    sourcePostId: ctx.sourcePostId,
    actionLabel: actionButton.label,
    senderHidden,
  });

  const story: Story = [{ inline: [actionButton.responseText] }];

  await sendPostFn({
    channelId: ctx.currentChannel,
    authorId,
    sentAt: Date.now(),
    content: story,
    blob,
  });
}

export function actionButtonErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `Failed to send action: ${error.message}`;
  }

  return 'Failed to send action. Please try again.';
}
