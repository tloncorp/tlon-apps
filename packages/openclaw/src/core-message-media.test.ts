import { describe, expect, it } from 'vitest';

import {
  coreMessageYieldsMedia,
  loadCoreMessageText,
} from './core-message-media.js';

const cite = (inner: string) => `${inner}`;
const BODY_FIELDS = ['message', 'text', 'content', 'caption', 'SendMessage'];

describe('core message text functions', () => {
  it('loads every function from the installed openclaw dist', async () => {
    const core = await loadCoreMessageText();
    for (const fn of Object.values(core)) expect(typeof fn).toBe('function');
    expect(core.parseReplyDirectives('MEDIA: /x').mediaUrls).toEqual(['/x']);
    expect(
      core.normalizeReplyPayloadsForDelivery([{ text: 'hi\nMEDIA: /x' }])[0]
    ).toMatchObject({ mediaUrls: ['/x'] });
    expect(core.stripFormattedReasoningMessage('a<think>b</think>c')).toBe(
      'ac'
    );
  });
});

describe('core message send path', () => {
  const nested = 'ME<fi<final>na</final>l>D</final>IA: /workspace/private.txt';

  it.each([
    'MEDIA: /workspace/private.txt',
    'MEDIA: https://example.com/a.png',
    'hello\\nMEDIA:/x',
    'look\nMEDIA: ~/x.png',
    'ME<think>x</thinking>DIA: /x',
    'ME<final>D</final>IA: /x',
    'ME<think>s</THINK>DIA: /x',
    `ME${cite('ci<think>x</think>te')}DIA: /x`,
    `ME${cite('cite')}DIA: /workspace/private.txt`,
    'ME‍DIA: /workspace/private.txt',
    '![x](https://example.com/a.png)',
    nested,
    'ME<fi<fi<final>na</final>l>na</final>l>D</final>IA: /workspace/private.txt',
  ])('reports media core would deliver for %j', async (body) => {
    await expect(
      coreMessageYieldsMedia({ action: 'send', message: body })
    ).resolves.toBe(true);
  });

  it.each(['text', 'content', 'SendMessage'])(
    'reports media for the alias-promoted nested-final payload via %s',
    async (field) => {
      await expect(
        coreMessageYieldsMedia({
          action: 'send',
          target: '~zod',
          [field]: nested,
        })
      ).resolves.toBe(true);
    }
  );

  it.each([
    'hello',
    '/etc/hosts maps names to addresses',
    'see ~/notes and notes.md',
    'nice \u{1F44D}\u{1F3FD} work',
  ])('reports no media for plain text %j', async (body) => {
    for (const field of BODY_FIELDS) {
      await expect(
        coreMessageYieldsMedia({ action: 'send', [field]: body })
      ).resolves.toBe(false);
    }
  });
});
