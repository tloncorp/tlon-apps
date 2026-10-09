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

export const BROWSER_HANDOFF_HELP = `Usage: tlon browser --help

Tlon tool: browser handoff <session_id>
Tlon tool: browser share <session_id>

Use the sess_ handle from browser_session_create in the tool's command argument.
The plugin resolves a fresh signed link and delivers the card through this CLI.
Do not copy, construct, or pass a viewer URL in a model tool call. This CLI
subcommand is the plugin's delivery transport, not a shell session-handle lookup.`;

export const BROWSER_HELP = `${BROWSER_HANDOFF_HELP}

Use browser share to send a rich link card that opens the live session in the browser.
Never send raw or labeled browser-session links in ordinary messages.

Ask for ordinary contact, shipping, billing-address, and delivery details in chat
and enter them through browser tools. Send a secure form for login identifiers,
passwords, verification codes, and card fields. Secure input goes directly to the
browser service without passing through chat or the bot. Each handoff completes
one fill; request a fresh handoff for another secure step. Card entry does not
submit a transaction or grant purchase approval. The recipient is always the
owner configured for the active bot account and cannot be overridden.

Tlon tool call:
  {"command": "browser handoff <session_id>"}`;

export interface BrowserDeps extends Pick<
  PostsDeps,
  'stdout' | 'stderr' | 'authenticate' | 'getCurrentUserId' | 'now' | 'postsApi'
> {
  getOwnerShip: () => string;
}

function browserCredentialHandoffBlob(
  viewerUrl: string,
  surfaceId: string
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
      text: 'Secure browser input',
    },
    { id: 'title-divider', component: 'Divider' },
    {
      id: 'explanation',
      component: 'Text',
      text: 'The browser needs information you can enter securely.',
    },
    {
      id: 'privacy-direct',
      component: 'Text',
      variant: 'caption',
      text: 'Your input goes directly to the live browser.',
    },
    {
      id: 'privacy-context',
      component: 'Text',
      variant: 'caption',
      text: 'It does not pass through chat or the bot.',
    },
    { id: 'action-divider', component: 'Divider' },
    {
      id: 'actions',
      component: 'Row',
      children: ['open-form', 'continue'],
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
            },
          },
        },
      },
    },
    {
      id: 'open-form-label',
      component: 'Text',
      text: 'Open secure form',
    },
    {
      id: 'continue',
      component: 'Button',
      weight: 1,
      variant: 'secondary',
      child: 'continue-label',
      action: {
        event: {
          name: 'tlon.sendMessage',
          context: {
            text: 'Continue the browser task. Check the current page; this does not confirm sign-in or authorize a purchase.',
          },
        },
      },
    },
    {
      id: 'continue-label',
      component: 'Text',
      text: 'Continue task',
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
    if (!['handoff', 'share'].includes(args[0]) || !args[1]) {
      throw usageError(BROWSER_HELP);
    }

    if (args.length !== 2) {
      throw usageError(BROWSER_HANDOFF_HELP);
    }

    if (args[1].startsWith('sess_')) {
      throw usageError(BROWSER_HANDOFF_HELP);
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
            'The browser needs you to sign in before I can continue.'
          ),
      blob: sharing
        ? undefined
        : browserCredentialHandoffBlob(viewerUrl, `browser-form-${sentAt}`),
      botProfile: { nickname: null, avatar: null },
    });
    writeLine(
      deps.stdout,
      `✓ ${sharing ? 'Browser session' : 'Secure browser form'} sent to ${target}`
    );
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
