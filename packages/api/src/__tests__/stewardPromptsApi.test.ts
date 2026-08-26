import { beforeEach, expect, test, vi } from 'vitest';

import {
  getBotSystemPrompts,
  setBotSystemPrompt,
  toBotSystemPrompts,
} from '../index';
import { BadResponseError, poke, scry } from '../client/urbit';

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');
  return {
    BadResponseError: actual.BadResponseError,
    poke: vi.fn().mockResolvedValue(undefined),
    scry: vi.fn(),
    subscribe: vi.fn(),
  };
});

beforeEach(() => {
  vi.mocked(poke).mockClear();
  vi.mocked(scry).mockReset();
});

test('setBotSystemPrompt pokes the %set action', async () => {
  await setBotSystemPrompt({
    botShip: '~zod',
    name: 'SOUL.md',
    text: 'be kind',
  });
  expect(poke).toHaveBeenCalledWith({
    app: 'steward',
    mark: 'steward-prompts-action-1',
    json: { set: { bot: '~zod', name: 'SOUL.md', text: 'be kind' } },
  });
});

test('toBotSystemPrompts maps and sorts the wire shape', () => {
  const prompts = toBotSystemPrompts({
    'SOUL.md': { text: 'be kind', updated: '~2026.8.26..12.00.00..0000' },
    'AGENTS.md': { text: 'do things', updated: 'not-a-da' },
  });
  expect(prompts.map((p) => p.name)).toEqual(['AGENTS.md', 'SOUL.md']);
  expect(prompts[1].text).toBe('be kind');
  expect(prompts[1].updatedAt).toBeGreaterThan(0);
  // unparseable @da degrades to 0 rather than throwing
  expect(prompts[0].updatedAt).toBe(0);
});

test('getBotSystemPrompts scries the mirror and maps entries', async () => {
  vi.mocked(scry).mockResolvedValue({
    prompts: {
      bot: '~zod',
      prompts: {
        'SOUL.md': { text: 'be kind', updated: '~2026.8.26..12.00.00..0000' },
      },
    },
  });
  const prompts = await getBotSystemPrompts('~zod');
  expect(scry).toHaveBeenCalledWith({
    app: 'steward',
    path: '/v1/prompts/~zod',
  });
  expect(prompts).toEqual([
    expect.objectContaining({ name: 'SOUL.md', text: 'be kind' }),
  ]);
});

test('getBotSystemPrompts returns null on 404 (older ships)', async () => {
  vi.mocked(scry).mockRejectedValue(new BadResponseError(404, 'not found'));
  expect(await getBotSystemPrompts('~zod')).toBeNull();
});

test('getBotSystemPrompts returns null when nothing is mirrored yet', async () => {
  vi.mocked(scry).mockResolvedValue({
    prompts: { bot: '~zod', prompts: {} },
  });
  expect(await getBotSystemPrompts('~zod')).toBeNull();
});
