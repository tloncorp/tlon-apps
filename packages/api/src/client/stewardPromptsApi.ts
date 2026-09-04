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
 * Our ship serves no prompts module — either it predates %steward's prompts
 * module, or %steward is mid-restart. The two are indistinguishable from a
 * single probe, so callers retry a bounded number of times before treating
 * this as absence.
 */
export class PromptsModuleUnavailableError extends Error {
  constructor() {
    super('steward prompts module unavailable');
    this.name = 'PromptsModuleUnavailableError';
  }
}

/**
 * Probe our own ship for the prompts module.
 *
 * The per-bot mirror scry cannot carry this signal: %steward 404s that path
 * both when a bot simply has no mirror (an ordinary ship — not an owned
 * bot) and when the agent is restarting, so a null from it is not evidence
 * that a bot is unowned. The module path is served whenever the module
 * exists at all, so its 404 isolates "no module (yet)" from "no mirror".
 *
 * Throws PromptsModuleUnavailableError rather than returning false so the
 * ambiguity is explicit: callers put it through a bounded retry and only
 * an exhausted probe means the module is really absent.
 */
export const probeBotSystemPromptsModule = async (): Promise<true> => {
  try {
    await scry<ub.StewardPromptsScry>({
      app: 'steward',
      path: '/v1/prompts',
    });
    return true;
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      throw new PromptsModuleUnavailableError();
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
    /**
     * The watch was nacked AFTER registration (the subscribe promise had
     * already resolved) — the subscription never went live. Re-subscribe
     * with backoff if the watch must stay live.
     */
    onError?: (error: unknown) => void;
    /**
     * The module was already known to work on this ship (a previous watch
     * was live). A probe 404 is then a momentary desk restart, not an old
     * ship, so it rejects for the caller's retry path instead of resolving
     * null — which would clear the cache and stop retrying for good.
     */
    assumeSupported?: boolean;
    /**
     * The watch went live (gall's positive ack). subscribe() resolves on
     * the channel PUT, so a %sync landing between the caller's backfill
     * scry and this ack would be dropped with nothing to trigger another
     * read — do the backfill here.
     */
    onAck?: () => void;
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
    if (
      error instanceof BadResponseError &&
      error.status === 404 &&
      !opts?.assumeSupported
    ) {
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
