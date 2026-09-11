import { Atom } from '@urbit/nockjs';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ChannelUrlTransformer, Message } from '../http-api';
import { Urbit } from '../http-api/Urbit';

type TransformerArgs = Parameters<ChannelUrlTransformer>;

/**
 * The shape tlon-web installs: only a lone poke earns a query hint, so a batch
 * or a non-poke falls through untouched.
 */
const hostingUrl: ChannelUrlTransformer = (url, messages) => {
  if (messages.length !== 1) {
    return url;
  }
  const json = messages[0];
  return json.action === 'poke' && 'mark' in json
    ? `${url}?mark=${json.mark}`
    : url;
};

function client(transformer?: ChannelUrlTransformer) {
  const fetch = vi.fn(
    async (_url: string, _options?: RequestInit) =>
      new Response(null, { status: 204 })
  );
  const urbit = new Urbit(
    'http://example.test',
    undefined,
    undefined,
    fetch as unknown as typeof globalThis.fetch,
    transformer
  );
  urbit.nodeId = '~sampel-palnet';
  // skip the event source setup a first successful PUT would otherwise trigger
  (urbit as any).sseClientInitialized = true;
  return {
    urbit,
    fetch,
    channelUrl: `http://example.test/~/channel/${urbit.channelId}`,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('channel url transformer', () => {
  test('PUTs to the plain channel url when no transformer is supplied', () => {
    vi.useFakeTimers();
    const { urbit, fetch, channelUrl } = client();

    urbit.poke({ app: 'a', mark: 'm', json: { x: 1 } }).catch(() => {});

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(channelUrl);
  });

  test('a single poke is PUT to the transformed url', () => {
    vi.useFakeTimers();
    const { urbit, fetch, channelUrl } = client(hostingUrl);

    urbit
      .poke({ app: 'a', mark: 'chat-action', json: { x: 1 } })
      .catch(() => {});

    expect(fetch.mock.calls[0][0]).toBe(`${channelUrl}?mark=chat-action`);
  });

  test('the transformer is called with the url and the messages being sent', () => {
    vi.useFakeTimers();
    const transformer = vi.fn<TransformerArgs, string>(
      () => 'http://rewritten'
    );
    const { urbit, fetch, channelUrl } = client(transformer);

    urbit.poke({ app: 'a', mark: 'm', json: { x: 1 } }).catch(() => {});

    expect(transformer).toHaveBeenCalledTimes(1);
    expect(transformer.mock.calls[0][0]).toBe(channelUrl);
    expect(transformer.mock.calls[0][1]).toEqual([
      {
        id: 1,
        action: 'poke',
        ship: 'sampel-palnet',
        app: 'a',
        mark: 'm',
        json: { x: 1 },
      },
    ]);
    // the return value is what gets PUT, verbatim
    expect(fetch.mock.calls[0][0]).toBe('http://rewritten');
  });

  test('a multi-message batch is left alone by the web transformer', async () => {
    const { urbit, fetch, channelUrl } = client(hostingUrl);
    const messages: Message[] = [
      { id: 1, action: 'poke', app: 'a', mark: 'm', json: 1 },
      { id: 2, action: 'poke', app: 'a', mark: 'm', json: 2 },
    ];

    await (urbit as any).sendJSONtoChannel(...messages);

    expect(fetch.mock.calls[0][0]).toBe(channelUrl);
  });

  test('an ack is left alone by the web transformer', async () => {
    const { urbit, fetch, channelUrl } = client(hostingUrl);

    await (urbit as any).ack(3);

    expect(fetch.mock.calls[0][0]).toBe(channelUrl);
  });

  test('noun PUTs go through the transformer too', async () => {
    const transformer = vi.fn<TransformerArgs, string>((url) => `${url}?noun`);
    const { urbit, fetch, channelUrl } = client(transformer);

    await urbit.pokeNoun({ app: 'a', mark: 'm', noun: new Atom(0n) });

    expect(transformer.mock.calls[0][0]).toBe(channelUrl);
    expect(transformer.mock.calls[0][1]).toEqual([
      { id: 1, action: 'poke', ship: 'sampel-palnet', app: 'a', mark: 'm' },
    ]);
    expect(fetch.mock.calls[0][0]).toBe(`${channelUrl}?noun`);
  });
});
