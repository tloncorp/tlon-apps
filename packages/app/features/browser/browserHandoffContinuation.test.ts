import type { PostBlobDataEntryA2UISelection } from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BROWSER_HANDOFF_CONTINUATION,
  getBrowserHandoffContinuationSelection,
  sendBrowserHandoffContinuation,
} from './browserHandoffContinuation';

const getSelections = vi.hoisted(() => vi.fn());
vi.mock('@tloncorp/shared/db', () => ({
  getA2UISelections: getSelections,
}));

const viewerUrl = 'https://browser-session.tlon.network/s/payload.signature';
const selection: PostBlobDataEntryA2UISelection = {
  type: 'tlon-a2ui-selection',
  version: 1,
  sourcePostId: 'source',
  surfaceId: 'surface',
  componentId: 'resume',
  values: [BROWSER_HANDOFF_CONTINUATION],
};

function sourcePost(includeFallback = true) {
  return {
    id: 'source',
    blob: JSON.stringify([
      {
        type: 'a2ui',
        version: 1,
        messages: [
          {
            version: 'v0.9',
            createSurface: {
              surfaceId: 'surface',
              catalogId: 'tlon.a2ui.basic.v2',
            },
          },
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'surface',
              root: 'root',
              components: [
                {
                  id: 'root',
                  component: 'Column',
                  children: includeFallback ? ['login', 'resume'] : ['login'],
                },
                {
                  id: 'login',
                  component: 'Button',
                  child: 'login-label',
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
                  id: 'login-label',
                  component: 'Text',
                  text: 'Open secure login',
                },
                ...(includeFallback
                  ? [
                      {
                        id: 'resume',
                        component: 'Button',
                        child: 'resume-label',
                        action: {
                          event: {
                            name: 'tlon.sendMessage',
                            context: { text: BROWSER_HANDOFF_CONTINUATION },
                          },
                        },
                      },
                      {
                        id: 'resume-label',
                        component: 'Text',
                        text: 'I’m signed in',
                      },
                    ]
                  : []),
              ],
            },
          },
        ],
      },
    ]),
  };
}

describe('browser handoff continuation', () => {
  beforeEach(() => {
    getSelections.mockReset().mockResolvedValue([]);
  });

  it('uses the fallback button’s exact durable receipt for automatic completion', () => {
    expect(
      getBrowserHandoffContinuationSelection(sourcePost(), viewerUrl)
    ).toEqual(selection);
    expect(
      getBrowserHandoffContinuationSelection(sourcePost(), `${viewerUrl}other`)
    ).toBeUndefined();
  });

  it('uses the login component for a card without a fallback button', () => {
    expect(
      getBrowserHandoffContinuationSelection(sourcePost(false), viewerUrl)
    ).toEqual({ ...selection, componentId: 'login' });
  });

  it('reads durable consumption when invoked, including a receipt from another device', async () => {
    const send = vi.fn();
    const complete = () =>
      sendBrowserHandoffContinuation({
        channelId: '~bot',
        authorId: '~owner',
        selection,
        send,
      });
    getSelections.mockResolvedValue([selection]);
    await complete();
    expect(getSelections).toHaveBeenCalledWith({
      channelId: '~bot',
      authorId: '~owner',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['sourcePostId', 'surfaceId', 'componentId'] as const)(
    'does not consume a different %s',
    async (field) => {
      getSelections.mockResolvedValue([{ ...selection, [field]: 'other' }]);
      const send = vi.fn().mockResolvedValue(undefined);
      await sendBrowserHandoffContinuation({
        channelId: '~bot',
        authorId: '~owner',
        selection,
        send,
      });
      expect(send).toHaveBeenCalledOnce();
    }
  );

  it('coalesces concurrent fallback and automatic sends and consumes subsequent attempts', async () => {
    let finish!: () => void;
    const send = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const args = { channelId: '~bot', authorId: '~owner', selection, send };
    const fallback = sendBrowserHandoffContinuation(args);
    const automatic = sendBrowserHandoffContinuation(args);
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    getSelections.mockResolvedValue([selection]);
    finish();
    await Promise.all([fallback, automatic]);
    await sendBrowserHandoffContinuation(args);
    expect(send).toHaveBeenCalledOnce();
  });

  it('allows retries when a send fails without creating a durable receipt', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('Send failed'))
      .mockResolvedValue(undefined);
    const args = { channelId: '~bot', authorId: '~owner', selection, send };
    await expect(sendBrowserHandoffContinuation(args)).rejects.toThrow(
      'Send failed'
    );
    await sendBrowserHandoffContinuation(args);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
