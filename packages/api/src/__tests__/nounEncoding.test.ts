import { parse, render } from '@urbit/aura';
import { Atom, Cell, Noun, cue_bytes, dejs, dwim, jam } from '@urbit/nockjs';
import { describe, expect, test, vi } from 'vitest';

import { Urbit } from '../http-api/Urbit';
import { jamBytes, jamToUw } from '../http-api/nounEncoding';
import { packJamBytes, unpackJamBytes } from '../http-api/utils';

function expectSameEncoding(noun: Noun) {
  expect(jamBytes(noun)).toEqual(new Uint8Array(jam(noun).bytes()));
  expect(jamToUw(noun)).toBe(render('uw', jam(noun).number));
  expect(cue_bytes(new DataView(jamBytes(noun).buffer)).equals(noun)).toBe(
    true
  );
}

function discoveryRequest(count: number, unchanged = false) {
  const phones = Array.from({ length: count }, (_, index) => [
    'phone',
    `+1555${String(index).padStart(7, '0')}`,
  ]);
  const phoneSet = dejs.set(phones);
  return dejs.list([
    [
      'poke',
      19,
      new Atom(0x12345678n),
      'lanyard',
      'lanyard-query-1',
      dwim([
        null,
        [null, 456789],
        'whose-bulk',
        0x123456789abcdefn,
        unchanged ? phoneSet : null,
        unchanged ? null : phoneSet,
        null,
      ]),
    ],
  ]);
}

describe('noun byte encoding', () => {
  test.each([0n, 1n, 2n, 63n, 64n, 255n, 256n, 1n << 64n, 1n << 1024n])(
    'preserves canonical atom encoding for %s',
    (value) => expectSameEncoding(new Atom(value))
  );

  test('preserves structural backreferences and short repeated atoms', () => {
    const first = dwim([42, [0, 42]]);
    const equivalent = dwim([42, [0, 42]]);
    expectSameEncoding(dwim([first, equivalent, first, 0, 0, 42, 42]));
  });

  test('distinguishes nouns with colliding hashes', () => {
    const first = new Atom(10000n);
    const second = new Atom(20000n);
    vi.spyOn(first, 'mug').mockReturnValue(1);
    vi.spyOn(second, 'mug').mockReturnValue(1);
    expectSameEncoding(dwim([first, second, first, second]));
  });

  test('matches upstream encoding across varied noun shapes', () => {
    let seed = 17;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const corpus: Noun[] = [Atom.zero, Atom.one];
    for (let index = 0; index < 200; index++) {
      const noun =
        index % 3 === 0
          ? new Atom(BigInt(random()))
          : new Cell(
              corpus[random() % corpus.length],
              corpus[random() % corpus.length]
            );
      expectSameEncoding(noun);
      corpus.push(noun);
    }
  });

  test.each([false, true])(
    'encodes a large discovery request (unchanged=%s)',
    async (unchanged) => {
      const noun = discoveryRequest(1911, unchanged);
      expect(jamBytes(noun).length).toBeGreaterThan(8192);
      expectSameEncoding(noun);
      const packed = packJamBytes(noun) as Uint8Array<ArrayBuffer>;
      expect((await unpackJamBytes(packed.buffer)).equals(noun)).toBe(true);
    }
  );

  test('sends the canonical noun body through the channel transport', async () => {
    const fetch = vi.fn(
      async (..._args: Parameters<typeof globalThis.fetch>) =>
        new Response(null, { status: 204 })
    );
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetch
    );
    client.nodeId = '~sampel-palnet';
    Object.assign(client, { sseClientInitialized: true });
    const noun = discoveryRequest(1911);
    await client.pokeNoun({ app: 'lanyard', mark: 'lanyard-query-1', noun });
    const expected = dejs.list([
      [
        'poke',
        1,
        new Atom(parse('p', '~sampel-palnet')),
        'lanyard',
        'lanyard-query-1',
        noun,
      ],
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]?.body).toBe(
      render('uw', jam(expected).number)
    );
  });
});
