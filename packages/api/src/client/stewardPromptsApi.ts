import { da, parse } from '@urbit/aura';

import { createDevLogger } from '../lib/logger';
import * as ub from '../urbit';
import { BadResponseError, poke, scry, subscribe } from './urbit';

const logger = createDevLogger('stewardPromptsApi', false);

/**
 * Client-facing prompt records use unix timestamps; the wire shape
 * (ub.StewardPromptEntry) keeps the agent's @da string.
 */
export interface BotSystemPrompt {
  /** prompt file name as the gateway knows it, e.g. "SOUL.md" */
  name: string;
  /** full file contents */
  text: string;
  updatedAt: number;
  /** true when the current text is a pinned owner edit */
  edited: boolean;
}

/**
 * Per-prompt byte cap enforced by %steward (an oversized %set nacks).
 * Clients should validate before poking so the user gets a real error.
 */
export const MAX_PROMPT_TEXT_BYTES = 65_536;

export const toBotSystemPrompts = (
  prompts: ub.StewardPromptsMap
): BotSystemPrompt[] => {
  return Object.entries(prompts)
    .map(([name, entry]) => ({
      name,
      text: entry.text,
      updatedAt: parseUpdated(entry.updated),
      edited: entry.edited === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Read a bot's system prompts from our own ship's %steward mirror (fanned in
 * from the bot's canonical set). Returns null when the ship doesn't have the
 * prompts module yet, or nothing has been mirrored for this bot — callers
 * should hide the editing UI in both cases.
 */
export const getBotSystemPrompts = async (
  botShip: string
): Promise<BotSystemPrompt[] | null> => {
  try {
    const response = await scry<ub.StewardPromptsScry>({
      app: 'steward',
      path: `/v1/prompts/${botShip}`,
    });
    const prompts = toBotSystemPrompts(response.prompts.prompts);
    return prompts.length > 0 ? prompts : null;
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      logger.log('steward prompts unavailable for', botShip);
      return null;
    }
    throw error;
  }
};

/**
 * Edit one of the bot's system prompts. Pokes our own %steward, which
 * relays the edit to the bot ship; the bot's gateway applies the new text
 * to its workspace and restarts. Ames retries the relay until ack, so the
 * edit survives the gateway (or bot ship) being down.
 */
export const setBotSystemPrompt = ({
  botShip,
  name,
  text,
}: {
  botShip: string;
  name: string;
  text: string;
}) =>
  poke({
    app: 'steward',
    mark: 'steward-prompts-action-1',
    json: {
      set: { bot: botShip, name, text },
    } satisfies ub.StewardPromptsSetAction,
  });

/**
 * Watch for prompt-set changes (a bot's canonical set fanned back into our
 * mirror). Emits the bot ship whose prompts changed together with the
 * authoritative new set (null when emptied — untrust/revocation), matching
 * getBotSystemPrompts' shape so callers can write it straight into their
 * cache instead of depending on a refetch that could fail. Returns null
 * when the ship lacks the module.
 */
export const subscribeToBotSystemPrompts = async (
  handler: (botShip: string, prompts: BotSystemPrompt[] | null) => void,
  opts?: {
    /**
     * The watch died (desk restart/upgrade). Providing this disables the
     * client's automatic resubscription — recovery is the caller's job:
     * re-subscribe and re-fetch, since facts emitted in the gap are lost.
     */
    onQuit?: () => void;
  }
) => {
  // Probe with a scry so a ship without the prompts module skips the
  // subscription instead of wedging sync (mirrors subscribeToLensUpdates).
  try {
    await scry<ub.StewardPromptsScry>({
      app: 'steward',
      path: '/v1/prompts',
    });
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      // Fires on every profile view against a ship without the module, so
      // keep it out of tracked telemetry.
      logger.log('%steward prompts module missing, skipping subscription');
      return null;
    }
    throw error;
  }

  return subscribe<ub.StewardPromptsUpdate>(
    {
      app: 'steward',
      path: '/v1/prompts',
    },
    (event) => {
      // /v1/prompts carries %prompts (a mirrored set changed, for us) and
      // %set (for the bot's own gateway); only the former concerns clients.
      if ('prompts' in event) {
        const prompts = toBotSystemPrompts(event.prompts.prompts);
        handler(event.prompts.bot, prompts.length > 0 ? prompts : null);
      }
    },
    opts
  );
};

function parseUpdated(updated: string): number {
  try {
    return Number(da.toUnix(parse('da', updated)));
  } catch {
    logger.log('failed to parse prompt updated time', updated);
    return 0;
  }
}
