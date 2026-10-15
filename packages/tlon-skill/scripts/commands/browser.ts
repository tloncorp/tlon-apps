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

Tlon tool: browser handoff <session_id> [--fields <JSON array>]
Tlon tool: browser approve-login <session_id> [--record <JSON object>]
Tlon tool: browser share <session_id>

Use the session ID from browser_session_create in the tool's command argument.
Use --fields when the owner should fill only selected controls. Prefer current
snapshot refs: browser handoff <session_id> --fields '["@e12","@e13"]'.
Exact {"name":"..."} or {"label":"..."} selectors must match uniquely.
Encode apostrophes in selector text as \u0027 inside the single-quoted JSON:
  browser handoff <session_id> --fields '[{"label":"Owner\u0027s email address"}]'
Omit --fields for automatic discovery of the visible form.
The plugin resolves a fresh signed link and delivers the card through this CLI.
Do not copy, construct, or pass a viewer URL in a model tool call. This CLI
subcommand is the plugin's delivery transport, not a shell session-handle lookup.`;

export const BROWSER_HELP = `${BROWSER_HANDOFF_HELP}

Use browser share to send a rich link card that opens the live session in the browser.
Never send raw or labeled browser-session links in ordinary messages.

Use browser approve-login to ask for permission to use a saved login. The owner reviews the site and account, then approves or cancels without entering credentials.

Use browser handoff to send a native secure-entry card for login identifiers,
passwords, verification codes, card fields, and private personal details.
Each card fills one secure step. Login forms may submit; other forms only fill.
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
  getOwnerShip: () => string;
}

function browserCredentialHandoffBlob(
  viewerUrl: string,
  surfaceId: string,
  loginApproval?: { record?: { id: string; revision: number } }
): string {
  const components = [
    { id: 'root', component: 'Card', child: 'body' },
    {
      id: 'body',
      component: 'Column',
      children: [
        'title',
        'title-divider',
        'explanation',
        'privacy-direct',
        'privacy-context',
        'action-divider',
        'actions',
      ],
    },
    {
      id: 'title',
      component: 'Text',
      variant: 'h3',
      text: loginApproval ? 'Approve saved sign-in' : 'Secure browser input',
    },
    { id: 'title-divider', component: 'Divider' },
    {
      id: 'explanation',
      component: 'Text',
      text: loginApproval
        ? 'Your bot is asking to use a saved login. Review the account and site before approving.'
        : 'The browser needs information you can enter securely.',
    },
    {
      id: 'privacy-direct',
      component: 'Text',
      variant: 'caption',
      text: loginApproval
        ? 'Approval allows this sign-in only.'
        : 'Your input goes directly to the live browser.',
    },
    {
      id: 'privacy-context',
      component: 'Text',
      variant: 'caption',
      text: loginApproval
        ? 'Your password stays hidden from chat and your bot.'
        : 'It does not pass through chat or the bot.',
    },
    { id: 'action-divider', component: 'Divider' },
    {
      id: 'actions',
      component: 'Row',
      children: ['open-form'],
      align: 'center',
    },
    {
      id: 'open-form',
      component: 'Button',
      weight: 1,
      variant: 'primary',
      child: 'open-form-label',
      action: {
        event: {
          name: 'tlon.navigate',
          context: {
            target: {
              type: 'screen',
              screen: 'browserCredentialHandoff',
              viewerUrl,
              ...(loginApproval ? { loginApproval } : {}),
            },
          },
        },
      },
    },
    {
      id: 'open-form-label',
      component: 'Text',
      text: loginApproval ? 'Review sign-in' : 'Open secure form',
    },
  ];

  const entry = {
    type: 'a2ui',
    version: 1,
    storyMode: 'fallback',
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: 'tlon.a2ui.basic.v2',
        },
      },
      {
        version: 'v0.9',
        updateComponents: { surfaceId, root: 'root', components },
      },
    ],
  };
  return JSON.stringify([entry]);
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
    if (!['handoff', 'share', 'approve-login'].includes(args[0]) || !args[1]) {
      throw usageError(BROWSER_HELP);
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
              id: z.string().uuid(),
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
      content: sharing
        ? [
            {
              block: {
                link: {
                  url: viewerUrl,
                  meta: {
                    siteName: 'Browser session',
                    title: 'Open browser',
                    description: 'View and control the shared browser.',
                  },
                },
              },
            },
          ]
        : markdownToStory(
            loginApproval
              ? 'Your bot needs approval to use a saved login.'
              : 'The browser needs information you can enter securely.'
          ),
      blob: sharing
        ? undefined
        : browserCredentialHandoffBlob(
            viewerUrl,
            `browser-form-${sentAt}`,
            loginApproval
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
