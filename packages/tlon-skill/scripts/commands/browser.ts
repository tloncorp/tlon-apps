import type { appendToPostBlob } from '@tloncorp/api/client/content-helpers';
import type { BrowserCardPresentationSchema } from '@tloncorp/api/client/browserCards';
import { z } from 'zod';
import { validateBrowserViewerUrl } from '../browser-viewer';
import { markdownToStory } from '../markdown';
import type { PostsDeps } from './posts';
import {
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const BROWSER_HANDOFF_HELP = String.raw`Usage: tlon browser --help

Tlon tool: browser handoff <session_id> --fields <JSON array>
Tlon tool: browser approve-login <session_id> --fields <JSON array> [--record <JSON object>]
Tlon tool: browser share <session_id>

Use the session ID from browser_session_create in the tool's command argument.
Both secure-entry commands require --fields. Prefer current
snapshot refs: browser handoff <session_id> --fields '["@e12","@e13"]'.
Exact {"name":"..."} or {"label":"..."} selectors must match uniquely.
Encode apostrophes in selector text as \u0027 inside the single-quoted JSON:
  browser handoff <session_id> --fields '[{"label":"Owner\u0027s email address"}]'
The card fills only those controls; the agent chooses the next page action.
The plugin resolves a fresh signed link and delivers the card through this CLI.
Do not copy, construct, or pass a viewer URL in a model tool call. This CLI
subcommand is the plugin's delivery transport, not a shell session-handle lookup.`;

export const BROWSER_HELP = `${BROWSER_HANDOFF_HELP}

Use browser share to send a browser card that opens the live session.
Never send raw or labeled browser-session links in ordinary messages.

Use browser approve-login to ask for permission to use a saved login. The owner reviews the site and account, then approves or cancels without entering credentials.

Use browser handoff to send a native secure-entry card for login identifiers,
passwords, verification codes, card fields, and private personal details.
Each card fills one secure step without submitting. The agent then inspects the page and chooses the next action.
Values go directly to the browser service without passing through chat or the bot.
Wait for the service result before using that browser again. The result resumes
the originating conversation even if the app disconnects; sharing alone does not. Neither command grants purchase approval.
Read the hosted-browser skill for checkout, login, sharing, and recovery workflows.
The recipient is always the owner configured for the active bot account and
cannot be overridden.

Tlon tool call:
  ${JSON.stringify({ command: 'browser handoff <session_id> --fields \'["@e12","@e13"]\'' })}`;

export interface BrowserDeps extends Pick<
  PostsDeps,
  'stdout' | 'stderr' | 'authenticate' | 'getCurrentUserId' | 'now' | 'postsApi'
> {
  appendToPostBlob: typeof appendToPostBlob;
  parseBrowserCardPresentation: typeof BrowserCardPresentationSchema.parse;
  browserWalletCard: (requestId: string, surfaceId: string) => unknown;
  getOwnerShip: () => string;
}

export async function run(args: string[], deps: BrowserDeps): Promise<number> {
  try {
    if (args.some(isHelpArg)) {
      return writeHelp(
        deps,
        args[0] === 'handoff' ? BROWSER_HANDOFF_HELP : BROWSER_HELP
      );
    }
    if (!args[0]) {
      throw usageError(BROWSER_HELP);
    }
    if (args[0] === 'wallet' && args.length === 2) {
      const id = z.string().uuid().parse(args[1]);
      const target = deps.getOwnerShip();
      await deps.authenticate(['chat']);
      const sentAt = deps.now();
      await deps.postsApi.sendPost({
        channelId: target,
        authorId: deps.getCurrentUserId(),
        sentAt,
        content: markdownToStory(
          'Your bot has a wallet request for you to review.'
        ),
        blob: JSON.stringify([deps.browserWalletCard(id, `wallet-${id}`)]),
        botProfile: { nickname: null, avatar: null },
      });
      writeLine(deps.stdout, `✓ Wallet request sent to ${target}`);
      return 0;
    }
    if (!['handoff', 'share', 'approve-login'].includes(args[0]) || !args[1]) {
      throw usageError(BROWSER_HELP);
    }

    if (args[0] !== 'share') {
      if (args.at(-1) !== '--service-result')
        throw usageError(
          'Secure entry requires service result delivery. Request a new card through the browser handoff tool.'
        );
      args = args.slice(0, -1);
    }

    let presentation;
    const presentationIndex = args.indexOf('--presentation');
    if (presentationIndex !== -1) {
      try {
        presentation = deps.parseBrowserCardPresentation(
          JSON.parse(args[presentationIndex + 1])
        );
      } catch {
        throw usageError('Invalid browser card presentation.');
      }
      args = [
        ...args.slice(0, presentationIndex),
        ...args.slice(presentationIndex + 2),
      ];
    }

    if (
      args.length !== 2 &&
      !(
        args[0] === 'approve-login' &&
        args.length === 4 &&
        args[2] === '--record'
      )
    ) {
      throw usageError(BROWSER_HANDOFF_HELP);
    }

    if (/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(args[1])) {
      throw usageError(BROWSER_HANDOFF_HELP);
    }

    let loginApproval:
      | { record?: { id: string; revision: number } }
      | undefined;
    if (args[0] === 'approve-login') {
      loginApproval = {};
      if (args.length === 4) {
        try {
          loginApproval.record = z
            .object({
              id: z.string().min(1).max(128),
              revision: z.number().int().positive(),
            })
            .strict()
            .parse(JSON.parse(args[3]));
        } catch {
          throw usageError(BROWSER_HANDOFF_HELP);
        }
      }
    }
    const sharing = args[0] === 'share';
    const viewerUrl = validateBrowserViewerUrl(args[1]);
    const target = deps.getOwnerShip();

    await deps.authenticate(['chat']);
    const sentAt = deps.now();
    await deps.postsApi.sendPost({
      channelId: target,
      authorId: deps.getCurrentUserId(),
      sentAt,
      content: markdownToStory(
        sharing
          ? 'Your bot shared a browser session. Open it in an updated Tlon app.'
          : loginApproval
            ? 'Your bot needs approval to use a saved login. Review it in an updated Tlon app.'
            : 'Your bot needs secure input. Open the secure form in an updated Tlon app.'
      ),
      blob: deps.appendToPostBlob(
        undefined,
        sharing
          ? { type: 'browser-session', version: 1, viewerUrl }
          : {
              type: 'browser-secure-entry',
              version: 1,
              viewerUrl,
              presentation,
              loginApproval,
            }
      ),
      botProfile: { nickname: null, avatar: null },
    });
    writeLine(
      deps.stdout,
      `✓ ${sharing ? 'Browser session' : loginApproval ? 'Saved login approval' : 'Secure browser form'} sent to ${target}`
    );
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
