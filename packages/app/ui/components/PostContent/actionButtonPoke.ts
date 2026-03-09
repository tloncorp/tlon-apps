import { getCurrentUserId, poke } from '@tloncorp/api';
import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';

export type PokeTemplateContext = {
  targetUser?: string;
  currentChannel?: string;
  targetChannel?: string;
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
  await pokeFn({
    app: actionButton.pokeApp,
    mark: actionButton.pokeMark,
    json: resolvePokeTemplates(actionButton.pokeJson, ctx),
  });
}

export function actionButtonErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `Failed to send action: ${error.message}`;
  }

  return 'Failed to send action. Please try again.';
}
