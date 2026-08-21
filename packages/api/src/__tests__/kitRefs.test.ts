import { describe, expect, test, vi } from 'vitest';

import type { Kit } from '../client/kitsApi';
import {
  KIT_REF_REGEX,
  enrichKitAttachment,
  kitAttachmentFromRef,
  kitRefPath,
} from '../client/kitsApi';
import { scry } from '../client/urbit';
import { REF_REGEX, REF_URL_REGEX } from '../client/utils';

vi.mock('../client/urbit', () => ({
  BadResponseError: class BadResponseError extends Error {
    status: number;
    constructor(status: number) {
      super(`bad response ${status}`);
      this.status = status;
    }
  },
  poke: vi.fn(),
  scry: vi.fn(),
  subscribe: vi.fn(),
}));

const mockedScry = vi.mocked(scry);

const libraryKit: Kit = {
  manifest: {
    id: 'book-club',
    name: 'Book Club',
    version: '1.2.3',
    publisher: '~sampel-palnet',
    description: 'Reads books together',
    image: 'https://cdn.example.com/kit.png',
    scope: 'group',
    places: [],
    bindings: [],
    schedules: [],
    scaffolds: [],
    policy: null,
  },
  files: {},
};

describe('kit reference regexes', () => {
  test('REF_REGEX matches kit references alongside existing kinds', () => {
    const text =
      'look /1/kit/~lagrev-ridsyp-nocsyx-lassul/book-club and ' +
      '/1/chan/chat/~zod/general/msg/~zod/123 and /1/group/~zod/flag';
    const matches = text.match(REF_REGEX);
    expect(matches).toEqual([
      '/1/kit/~lagrev-ridsyp-nocsyx-lassul/book-club',
      '/1/chan/chat/~zod/general/msg/~zod/123',
      '/1/group/~zod/flag',
    ]);
  });

  test('REF_URL_REGEX matches a leading kit reference', () => {
    expect(REF_URL_REGEX.test('/1/kit/~sampel-palnet/book-club')).toBe(true);
    expect(REF_URL_REGEX.test('x /1/kit/~sampel-palnet/book-club')).toBe(false);
  });

  test('KIT_REF_REGEX only matches kit references', () => {
    expect(KIT_REF_REGEX.test('/1/kit/~sampel-palnet/book-club')).toBe(true);
    expect(KIT_REF_REGEX.test('/1/chan/chat/~zod/general')).toBe(false);
    expect(KIT_REF_REGEX.test('/1/group/~zod/flag')).toBe(false);
  });
});

describe('kitAttachmentFromRef', () => {
  test('parses a kit reference into a bare attachment', () => {
    expect(
      kitAttachmentFromRef('/1/kit/~lagrev-ridsyp-nocsyx-lassul/book-club')
    ).toEqual({
      type: 'kit',
      publisher: '~lagrev-ridsyp-nocsyx-lassul',
      id: 'book-club',
    });
  });

  test('parses a kit reference embedded in text', () => {
    expect(
      kitAttachmentFromRef('check out /1/kit/~sampel-palnet/book-club!')
    ).toEqual({
      type: 'kit',
      publisher: '~sampel-palnet',
      id: 'book-club',
    });
  });

  test('returns null for non-kit references', () => {
    expect(kitAttachmentFromRef('/1/chan/chat/~zod/general')).toBeNull();
    expect(kitAttachmentFromRef('/1/group/~zod/flag')).toBeNull();
    expect(kitAttachmentFromRef('plain text')).toBeNull();
  });

  test('round-trips with kitRefPath', () => {
    const path = kitRefPath('~sampel-palnet', 'book-club');
    expect(path).toBe('/1/kit/~sampel-palnet/book-club');
    expect(kitAttachmentFromRef(path)).toEqual({
      type: 'kit',
      publisher: '~sampel-palnet',
      id: 'book-club',
    });
  });
});

describe('enrichKitAttachment', () => {
  const bare = {
    type: 'kit',
    publisher: '~sampel-palnet',
    id: 'book-club',
  } as const;

  test('fills in display fields from the local library', async () => {
    mockedScry.mockResolvedValueOnce({ kit: libraryKit });
    await expect(enrichKitAttachment(bare)).resolves.toEqual({
      type: 'kit',
      publisher: '~sampel-palnet',
      id: 'book-club',
      version: '1.2.3',
      name: 'Book Club',
      description: 'Reads books together',
      image: 'https://cdn.example.com/kit.png',
    });
  });

  test('ignores a library kit from a different publisher', async () => {
    mockedScry.mockResolvedValueOnce({ kit: libraryKit });
    const attachment = { ...bare, publisher: '~zod' };
    await expect(enrichKitAttachment(attachment)).resolves.toEqual(attachment);
  });

  test('returns the attachment unchanged when the scry fails', async () => {
    mockedScry.mockRejectedValueOnce(new Error('boom'));
    await expect(enrichKitAttachment(bare)).resolves.toEqual(bare);
  });

  test('returns the attachment unchanged when the scry times out', async () => {
    mockedScry.mockImplementationOnce(() => new Promise(() => {}));
    await expect(enrichKitAttachment(bare, 10)).resolves.toEqual(bare);
  });
});
