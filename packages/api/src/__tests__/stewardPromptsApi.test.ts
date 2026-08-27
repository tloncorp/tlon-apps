import { beforeEach, expect, test, vi } from 'vitest';

import {
  PromptsModuleUnavailableError,
  getBotSystemPrompts,
  probeBotSystemPromptsModule,
  setBotSystemPrompt,
  subscribeToBotSystemPrompts,
  toBotSystemPrompts,
} from '../index';
import { BadResponseError, poke, scry, subscribe } from '../client/urbit';

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
  vi.mocked(subscribe).mockReset();
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
    'SOUL.md': {
      text: 'be kind',
      updated: '~2026.8.26..12.00.00..0000',
      edited: true,
    },
    'AGENTS.md': { text: 'do things', updated: 'not-a-da', edited: false },
  });
  expect(prompts.map((p) => p.name)).toEqual(['AGENTS.md', 'SOUL.md']);
  expect(prompts[1].text).toBe('be kind');
  expect(prompts[1].edited).toBe(true);
  expect(prompts[0].edited).toBe(false);
  expect(prompts[1].updatedAt).toBeGreaterThan(0);
  // unparseable @da degrades to 0 rather than throwing
  expect(prompts[0].updatedAt).toBe(0);
});

test('getBotSystemPrompts scries the mirror and maps entries', async () => {
  vi.mocked(scry).mockResolvedValue({
    prompts: {
      bot: '~zod',
      prompts: {
        'SOUL.md': {
          text: 'be kind',
          updated: '~2026.8.26..12.00.00..0000',
          edited: true,
        },
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

test('subscribeToBotSystemPrompts forwards the authoritative set (null when emptied)', async () => {
  // Probe scry succeeds → subscription proceeds.
  vi.mocked(scry).mockResolvedValue({ prompts: { bot: '~zod', prompts: {} } });
  let eventHandler: ((event: unknown) => void) | undefined;
  vi.mocked(subscribe).mockImplementation(async (_spec, handler) => {
    eventHandler = handler as (event: unknown) => void;
    return 1;
  });
  const seen: Array<[string, unknown]> = [];
  await subscribeToBotSystemPrompts((bot, prompts) => {
    seen.push([bot, prompts]);
  });
  eventHandler?.({
    prompts: {
      bot: '~zod',
      prompts: {
        'SOUL.md': {
          text: 'be kind',
          updated: '~2026.8.26..12.00.00..0000',
          edited: true,
        },
      },
    },
  });
  // An emptied mirror (untrust / owner revocation) arrives as null so
  // callers can clear their cache without a refetch.
  eventHandler?.({ prompts: { bot: '~zod', prompts: {} } });
  // %set facts are for the bot's own gateway, not clients.
  eventHandler?.({
    set: {
      name: 'SOUL.md',
      prompt: { text: 'x', updated: '~x', edited: true },
    },
  });
  expect(seen).toEqual([
    ['~zod', [expect.objectContaining({ name: 'SOUL.md', text: 'be kind' })]],
    ['~zod', null],
  ]);
});

test('subscribeToBotSystemPrompts forwards the onQuit and onError handlers', async () => {
  vi.mocked(scry).mockResolvedValue({ prompts: { bot: '~zod', prompts: {} } });
  let seenOpts:
    | { onQuit?: () => void; onError?: (error: unknown) => void }
    | undefined;
  vi.mocked(subscribe).mockImplementation(async (_spec, _handler, opts) => {
    seenOpts = opts;
    return 1;
  });
  const onQuit = vi.fn();
  const onError = vi.fn();
  await subscribeToBotSystemPrompts(() => {}, { onQuit, onError });
  seenOpts?.onQuit?.();
  seenOpts?.onError?.(new Error('nacked after registration'));
  expect(onQuit).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledTimes(1);
});

test('probeBotSystemPromptsModule resolves when the module answers', async () => {
  vi.mocked(scry).mockResolvedValue({ prompts: { bot: '~zod', prompts: {} } });
  await expect(probeBotSystemPromptsModule()).resolves.toBe(true);
  expect(scry).toHaveBeenCalledWith({ app: 'steward', path: '/v1/prompts' });
});

test('probeBotSystemPromptsModule rejects distinguishably on a 404', async () => {
  // The 404 is ambiguous (no module, or %steward restarting), so it must
  // reject rather than resolve false: callers retry it a bounded number of
  // times and only an exhausted probe means the module is really absent.
  vi.mocked(scry).mockRejectedValue(new BadResponseError(404, 'nope'));
  await expect(probeBotSystemPromptsModule()).rejects.toBeInstanceOf(
    PromptsModuleUnavailableError
  );
});

test('probeBotSystemPromptsModule passes other failures through', async () => {
  const failure = new Error('offline');
  vi.mocked(scry).mockRejectedValue(failure);
  await expect(probeBotSystemPromptsModule()).rejects.toBe(failure);
});
