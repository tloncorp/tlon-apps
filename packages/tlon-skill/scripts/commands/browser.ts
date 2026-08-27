import { markdownToStory } from '../markdown';
import type { PostsDeps } from './posts';
import {
  commandError,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const BROWSER_HELP = `Usage: tlon browser handoff <signed-viewer-url> [--to ~ship]

Send the owner a native credential form for the login page open in a hosted
browser session. The form submits directly to the browser service; credential
values are never posted to chat or returned to the bot.

The target defaults to TLON_BROWSER_HANDOFF_TARGET. OpenClaw sets that to the
configured owner ship. Use --to only when running the CLI outside OpenClaw.

Example:
  tlon browser handoff https://browser-session-ovh1.tlon.network/s/<capability>`;

export const BROWSER_HANDOFF_HELP =
  'Usage: tlon browser handoff <signed-viewer-url> [--to ~ship]';

const VIEWER_LABEL = 'browser-session-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const PRODUCTION_VIEWER_HOST = new RegExp(`^${VIEWER_LABEL}\\.tlon\\.network$`);
const TEST_VIEWER_HOST = new RegExp(
  `^${VIEWER_LABEL}\\.test\\.tlon\\.systems$`
);
const SHIP = /^~[a-z]+(?:-[a-z]+)*$/;

export interface BrowserDeps extends Pick<
  PostsDeps,
  'stdout' | 'stderr' | 'authenticate' | 'getCurrentUserId' | 'now' | 'postsApi'
> {
  env: Record<string, string | undefined>;
}

function validateViewerUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw commandError('viewer URL is invalid');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (!PRODUCTION_VIEWER_HOST.test(url.hostname) &&
      !TEST_VIEWER_HOST.test(url.hostname)) ||
    !/^\/s\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url.pathname)
  ) {
    throw commandError(
      'viewer URL must be a signed browser-session-*.tlon.network or browser-session-*.test.tlon.systems URL'
    );
  }

  return url.toString();
}

function parseTarget(args: string[], env: BrowserDeps['env']): string {
  const toIndexes = args.flatMap((arg, index) =>
    arg === '--to' ? [index] : []
  );
  if (toIndexes.length > 1) throw usageError(BROWSER_HANDOFF_HELP);

  const toIndex = toIndexes[0];
  const explicitTarget = toIndex === undefined ? undefined : args[toIndex + 1];
  if (
    toIndex !== undefined &&
    (!explicitTarget || explicitTarget.startsWith('--'))
  ) {
    throw usageError(BROWSER_HANDOFF_HELP);
  }

  const target = explicitTarget ?? env.TLON_BROWSER_HANDOFF_TARGET;
  if (!target) {
    throw commandError(
      'no handoff recipient is configured; set TLON_BROWSER_HANDOFF_TARGET or pass --to ~ship'
    );
  }
  if (!SHIP.test(target)) {
    throw commandError(`invalid handoff recipient: ${target}`);
  }
  return target;
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
      text: 'The browser reached a login screen that needs your input.',
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
    if (!args[0] || args.some(isHelpArg)) {
      return writeHelp(
        deps,
        args[0] === 'handoff' ? BROWSER_HANDOFF_HELP : BROWSER_HELP
      );
    }
    if (args[0] !== 'handoff' || !args[1]) {
      throw usageError(BROWSER_HELP);
    }

    const allowedArgs = args.filter((_, index) => {
      const toIndex = args.indexOf('--to');
      return index < 2 || index === toIndex || index === toIndex + 1;
    });
    if (allowedArgs.length !== args.length) {
      throw usageError(BROWSER_HANDOFF_HELP);
    }

    const viewerUrl = validateViewerUrl(args[1]);
    const target = parseTarget(args, deps.env);

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
