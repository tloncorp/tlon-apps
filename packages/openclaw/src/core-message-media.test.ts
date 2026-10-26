import { describe, expect, it } from 'vitest';

import {
  UNRESOLVED_MEDIA,
  coreMessageMedia as resolveCoreMessageMedia,
  loadCoreMessageText,
} from './core-message-media.js';

const coreMessageMedia = async (params: Record<string, unknown>) =>
  (await resolveCoreMessageMedia(params)).media;

const yieldsMedia = async (params: Record<string, unknown>) =>
  (await coreMessageMedia(params)).length > 0;

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
    await expect(yieldsMedia({ action: 'send', message: body })).resolves.toBe(
      true
    );
  });

  it.each(['text', 'content', 'SendMessage'])(
    'reports media for the alias-promoted nested-final payload via %s',
    async (field) => {
      await expect(
        yieldsMedia({
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
        yieldsMedia({ action: 'send', [field]: body })
      ).resolves.toBe(false);
    }
  });

  it('resolves the referenced media, not just its presence', async () => {
    await expect(
      coreMessageMedia({ action: 'send', message: 'MEDIA: /workspace/x.png' })
    ).resolves.toEqual(['/workspace/x.png']);
    await expect(
      coreMessageMedia({
        action: 'send',
        message: 'hi\nMEDIA: https://example.com/x.png',
      })
    ).resolves.toEqual(['https://example.com/x.png']);
  });

  it('reports an unresolved entry when stripping never settles', async () => {
    const deep = `${'<fi'.repeat(20)}<final>${'na</final>l>'.repeat(20)}`;
    await expect(
      coreMessageMedia({ action: 'send', message: deep })
    ).resolves.toContain(UNRESOLVED_MEDIA);
  });
});

// Core strips tool-call blocks without code protection on plugin actions
// (reply, edit), so a reference inside an inline code span that covers the
// block surfaces there and nowhere on the send path.
const fencedReplyBody = (ref: string) =>
  ['x `', '[x]', '{"a":"` ``"}', '[/x]', `![i](${ref}) \`\``].join('\n');

describe('core message reply/edit path', () => {
  it('finds a reference only stripping without code protection reveals', async () => {
    const core = await loadCoreMessageText();
    const body = fencedReplyBody('https://example.com/a.png');
    const directives = (text: string) =>
      core.parseReplyDirectives(text, { extractMarkdownImages: true })
        .mediaUrls ?? [];
    // The send path's protected strip keeps the image in code.
    expect(directives(body)).toEqual([]);
    expect(directives(core.stripPlainTextToolCallBlocks(body))).toEqual([
      'https://example.com/a.png',
    ]);
    // Core extracts only https markdown images; a local path in this shape
    // yields no media on any path.
    for (const ref of [
      'https://example.com/a.png',
      'https://zod.tlon.network/x.png',
      'https://media.svc/x.png',
    ]) {
      for (const action of ['reply', 'edit']) {
        await expect(
          coreMessageMedia({ action, message: fencedReplyBody(ref) })
        ).resolves.toContain(ref);
      }
    }
  });
});

const url = (i: number | string) => `https://example.com/${i}.png`;
const directives = (n: number) =>
  Array.from({ length: n }, (_, i) => `MEDIA: ${url(i)}`).join('\n');
const images = (n: number, src = url('img')) =>
  Array(n).fill(`![i](${src})`).join('\n');

describe('core message media counts', () => {
  it('counts the attachments core would fetch, keys and body together', async () => {
    const result = await resolveCoreMessageMedia({
      action: 'send',
      mediaUrls: [0, 1, 2, 3].map(url),
      message: `MEDIA: ${url(0)}`,
    });
    expect(result.downloads).toBe(4);
    for (const n of [1, 3, 5]) {
      await expect(
        resolveCoreMessageMedia({ action: 'send', message: directives(n) })
      ).resolves.toMatchObject({ downloads: n });
    }
  });

  it("counts image blocks with Tlon's story converter", async () => {
    await expect(
      resolveCoreMessageMedia({ action: 'reply', message: images(12) })
    ).resolves.toMatchObject({ imageBlocks: 12 });
    // The converter renders an escaped image and skips one in inline code.
    await expect(
      resolveCoreMessageMedia({
        action: 'send',
        message: `${directives(4)}\nsee \\![e](${url('e')})`,
      })
    ).resolves.toMatchObject({ downloads: 4, imageBlocks: 1 });
    await expect(
      resolveCoreMessageMedia({
        action: 'reply',
        message: `${images(4)}\nlike \`![c](${url('c')})\``,
      })
    ).resolves.toMatchObject({ imageBlocks: 4 });
  });
});
