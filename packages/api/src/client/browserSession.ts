import type { A2UI } from './a2ui';

export const MAX_BROWSER_VIEWER_URL_LENGTH = 2048;

const VIEWER_LABEL = 'browser-session-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const VIEWER_HOST = new RegExp(
  `^(?:${VIEWER_LABEL}|browser-session|session-viewer)\\.(?:tlon\\.network|test\\.tlon\\.systems)$`
);

export function isTrustedBrowserViewerHost(hostname: string): boolean {
  return VIEWER_HOST.test(hostname);
}

/** A standalone session card, separate from secure credential handoffs. */
export function browserSessionCard(
  viewerUrl: string,
  surfaceId: string
): A2UI.BlobEntry {
  return {
    type: 'a2ui',
    version: 1,
    storyMode: 'fallback',
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: 'tlon.a2ui.basic.v2' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'body' },
            {
              id: 'body',
              component: 'Column',
              children: ['title', 'description', 'open'],
            },
            {
              id: 'title',
              component: 'Text',
              variant: 'h3',
              text: 'Browser session',
            },
            {
              id: 'description',
              component: 'Text',
              text: 'View and control the shared browser.',
            },
            {
              id: 'open',
              component: 'Button',
              variant: 'primary',
              child: 'open-label',
              action: {
                event: {
                  name: 'tlon.navigate',
                  context: {
                    target: {
                      type: 'screen',
                      screen: 'browserSession',
                      viewerUrl,
                    },
                  },
                },
              },
            },
            { id: 'open-label', component: 'Text', text: 'Open browser' },
          ],
        },
      },
    ],
  };
}
