import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@tloncorp/api', () => ({ setConversationPresence: vi.fn() }));
import { publishCampaignView } from './campaignPresence';
afterEach(() => {
  vi.useRealTimers();
});
it('keeps a view alive only for the bot and closes after an in-flight open', async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const publish = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          release = r;
        })
    )
    .mockResolvedValue(undefined);
  const stop = publishCampaignView({
    conversationId: '~bot',
    bot: '~bot',
    token: 'focus-1',
    timezone: 'America/New_York',
    reportError: vi.fn(),
    publish,
  });
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(60_000);
  const done = stop();
  release();
  await done;
  expect(publish).toHaveBeenCalledTimes(2);
  const [open, close] = publish.mock.calls.map(([value]) => value);
  expect(open.disclose).toEqual(['~bot']);
  expect(JSON.parse(open.display.blob)).toMatchObject({
    open: true,
    token: 'focus-1',
  });
  expect(JSON.parse(close.display.blob)).toMatchObject({
    open: false,
    token: 'focus-1',
  });
  expect(vi.getTimerCount()).toBe(0);
});
it('refreshes visibility every 30 seconds without generating a new open', async () => {
  vi.useFakeTimers();
  const publish = vi.fn().mockResolvedValue(undefined);
  const stop = publishCampaignView({
    conversationId: '~bot',
    bot: '~bot',
    token: 'focus-2',
    timezone: 'UTC',
    reportError: vi.fn(),
    publish,
  });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(publish).toHaveBeenCalledTimes(3);
  expect(
    new Set(
      publish.mock.calls.map(([value]) => JSON.parse(value.display.blob).token)
    )
  ).toEqual(new Set(['focus-2']));
  await stop();
});
