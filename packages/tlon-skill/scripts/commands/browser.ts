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

Use the sess_ handle from browser_session_create in the tool's command argument.
The plugin resolves a fresh signed link and delivers the card through this CLI.
Do not copy, construct, or pass a viewer URL in a model tool call. This CLI
subcommand is the plugin's delivery transport, not a shell session-handle lookup.`;

export const BROWSER_HELP = `${BROWSER_HANDOFF_HELP}

Send the owner a native password or one-time-code form for the login or
verification page open in a hosted browser session. The form submits directly
to the browser service; credential values are never posted to chat or returned
to the bot. The recipient is always the owner configured for the active bot
account and cannot be overridden.

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
      text: 'Sign in to continue',
    },
    { id: 'title-divider', component: 'Divider' },
    {
      id: 'explanation',
      component: 'Text',
      text: 'The browser reached a login or verification screen that needs your input.',
    },
    {
      id: 'privacy-direct',
      component: 'Text',
      variant: 'caption',
      text: 'Your credentials go directly to the live browser.',
    },
    {
      id: 'privacy-context',
      component: 'Text',
      variant: 'caption',
      text: 'They are never posted to chat or returned to the bot.',
    },
    { id: 'action-divider', component: 'Divider' },
    {
      id: 'actions',
      component: 'Row',
      children: ['open-login', 'continue'],
      align: 'center',
    },
    {
      id: 'open-login',
      component: 'Button',
      weight: 1,
      variant: 'primary',
      child: 'open-login-label',
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
      id: 'open-login-label',
      component: 'Text',
      text: 'Open secure login',
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
          context: { text: 'I signed in; continue the browser task.' },
        },
      },
    },
    {
      id: 'continue-label',
      component: 'Text',
      text: 'I’m signed in',
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
    if (args[0] !== 'handoff' || !args[1]) {
      throw usageError(BROWSER_HELP);
    }

    if (args.length !== 2) {
      throw usageError(BROWSER_HANDOFF_HELP);
    }

    if (args[1].startsWith('sess_')) {
      throw usageError(BROWSER_HANDOFF_HELP);
    }

    const viewerUrl = validateBrowserViewerUrl(args[1]);
    const target = deps.getOwnerShip();

    await deps.authenticate(['chat']);
    const sentAt = deps.now();
    await deps.postsApi.sendPost({
      channelId: target,
      authorId: deps.getCurrentUserId(),
      sentAt,
      content: markdownToStory(
        'The browser needs you to sign in before I can continue.'
      ),
      blob: browserCredentialHandoffBlob(viewerUrl, `browser-login-${sentAt}`),
      botProfile: { nickname: null, avatar: null },
    });
    writeLine(deps.stdout, `✓ Browser login handoff sent to ${target}`);
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
