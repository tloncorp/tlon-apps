import { afterEach, expect, test, vi } from 'vitest';
import { DurableRoomSync } from './durableRoomSync';

afterEach(() => {
  vi.useRealTimers();
});

function fixture() {
  const streams: {
    onopen: (() => void) | null;
    onmessage: (() => void) | null;
    onerror: (() => void) | null;
    close: ReturnType<typeof vi.fn>;
  }[] = [];
  const read = vi.fn(async (after: number) => ({
    cursor: after + 1,
    more: false,
  }));
  const apply = vi.fn(async (_page: { cursor: number; more: boolean }) => {});
  const status = vi.fn();
  const error = vi.fn();
  const sync = new DurableRoomSync({
    read,
    apply,
    status,
    error,
    connect: () => {
      const stream = {
        onopen: null,
        onmessage: null,
        onerror: null,
        close: vi.fn(),
      };
      streams.push(stream);
      return stream;
    },
  });
  return { sync, streams, read, apply, status, error };
}

test('recreates a failed event stream and catches up from the committed cursor', async () => {
  vi.useFakeTimers();
  const { sync, streams, read, status } = fixture();
  await sync.start();
  expect(read).toHaveBeenLastCalledWith(0);
  streams[0].onerror!();
  expect(streams[0].close).toHaveBeenCalledOnce();
  expect(status).toHaveBeenLastCalledWith('reconnecting');
  await vi.advanceTimersByTimeAsync(2000);
  expect(streams).toHaveLength(2);
  streams[1].onerror!();
  await vi.advanceTimersByTimeAsync(2000);
  expect(streams).toHaveLength(3);
  streams[2].onopen!();
  await vi.advanceTimersByTimeAsync(0);
  expect(read).toHaveBeenLastCalledWith(1);
  expect(status).toHaveBeenLastCalledWith('active');
  sync.stop();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(streams).toHaveLength(3);
});

test('retries a failed cache write without advancing past missing messages', async () => {
  vi.useFakeTimers();
  const { sync, streams, read, apply, error } = fixture();
  await sync.start();
  apply.mockRejectedValueOnce(new Error('temporary cache failure'));
  streams[0].onmessage!();
  await vi.advanceTimersByTimeAsync(0);
  expect(error).toHaveBeenLastCalledWith(expect.any(Error));
  await vi.advanceTimersByTimeAsync(2000);
  expect(read.mock.calls.map((call) => call[0])).toEqual([0, 1, 1]);
  expect(error).toHaveBeenLastCalledWith(null);
  sync.stop();
});

test('drains multiple pages and suppresses late responses after cleanup', async () => {
  const { sync, streams, read, apply } = fixture();
  read.mockResolvedValueOnce({ cursor: 200, more: true });
  await sync.start();
  expect(read.mock.calls.map((call) => call[0])).toEqual([0, 200]);
  let resolve!: (page: { cursor: number; more: boolean }) => void;
  read.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  streams[0].onmessage!();
  sync.stop();
  resolve({ cursor: 202, more: false });
  await Promise.resolve();
  await Promise.resolve();
  expect(apply).toHaveBeenCalledTimes(2);
});
