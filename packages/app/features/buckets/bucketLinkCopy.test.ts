import { Platform } from 'react-native';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { bucketLinkCopiedMessage, copyPendingText } from './bucketLinkCopy';

const setStringAsync = vi.hoisted(() => vi.fn());
vi.mock('expo-clipboard', () => ({ setStringAsync }));

class FakeClipboardItem {
  constructor(public items: Record<string, Promise<Blob>>) {}
}

function stubAsyncClipboard(write: (items: FakeClipboardItem[]) => unknown) {
  const spy = vi.fn(write);
  vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  vi.stubGlobal('navigator', { clipboard: { write: spy } });
  return spy;
}

function stubExecCommand(result: boolean) {
  const copied: string[] = [];
  const execCommand = vi.fn(() => result);
  let field = { value: '' };
  vi.stubGlobal('document', {
    createElement: () => {
      field = { value: '', style: {}, select: () => {} } as never;
      return field;
    },
    body: {
      appendChild: () => {},
      removeChild: () => copied.push(field.value),
    },
    execCommand,
  });
  return { copied, execCommand };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setStringAsync.mockReset();
  Platform.OS = 'web';
});

describe('copyPendingText on web', () => {
  test('starts the write before the text arrives', async () => {
    let resolveText!: (value: string) => void;
    const text = new Promise<string>((resolve) => {
      resolveText = resolve;
    });
    const write = stubAsyncClipboard(async () => {});

    const copied = copyPendingText(text);
    // Called synchronously, while the gesture that allows it is still live.
    expect(write).toHaveBeenCalledTimes(1);

    resolveText('https://memex.example/object?sig=abc');
    await copied;
    const blob = await write.mock.calls[0][0][0].items['text/plain'];
    expect(await blob.text()).toBe('https://memex.example/object?sig=abc');
  });

  test('reports why the text failed, not the clipboard error it caused', async () => {
    stubAsyncClipboard(async (items) => {
      await items[0].items['text/plain'];
    });
    const { execCommand } = stubExecCommand(true);

    await expect(
      copyPendingText(Promise.reject(new Error('This file is not ready')))
    ).rejects.toThrow('This file is not ready');
    expect(execCommand).not.toHaveBeenCalled();
  });

  test('falls back when the browser refuses the async write', async () => {
    stubAsyncClipboard(async () => {
      throw new DOMException('Write permission denied.', 'NotAllowedError');
    });
    const { copied } = stubExecCommand(true);

    await copyPendingText(Promise.resolve('https://memex.example/a'));
    expect(copied).toEqual(['https://memex.example/a']);
  });

  test('uses execCommand where there is no async clipboard', async () => {
    const { copied } = stubExecCommand(true);

    await copyPendingText(Promise.resolve('https://memex.example/a'));
    expect(copied).toEqual(['https://memex.example/a']);
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  test('says so when the browser refuses every copy', async () => {
    stubExecCommand(false);

    await expect(
      copyPendingText(Promise.resolve('https://memex.example/a'))
    ).rejects.toThrow('Your browser did not allow copying the link');
  });
});

describe('copyPendingText on native', () => {
  test('writes the text once it arrives', async () => {
    Platform.OS = 'ios';
    setStringAsync.mockResolvedValue(true);

    await copyPendingText(Promise.resolve('https://memex.example/a'));
    expect(setStringAsync).toHaveBeenCalledWith('https://memex.example/a');
  });

  test('passes on a failure to fetch the text', async () => {
    Platform.OS = 'ios';

    await expect(
      copyPendingText(Promise.reject(new Error('This file is not ready')))
    ).rejects.toThrow('This file is not ready');
    expect(setStringAsync).not.toHaveBeenCalled();
  });
});

describe('bucketLinkCopiedMessage', () => {
  const now = Date.parse('2026-10-05T14:00:00.000Z');

  test('counts down to the expiry the broker sent', () => {
    // UTCTime serializes with picosecond precision.
    expect(
      bucketLinkCopiedMessage('2026-10-05T14:10:00.123456789012Z', now)
    ).toBe('Link copied. It expires in 10 minutes.');
  });

  test('uses the singular for a minute', () => {
    expect(bucketLinkCopiedMessage('2026-10-05T14:01:00Z', now)).toBe(
      'Link copied. It expires in 1 minute.'
    );
  });

  test('never promises less than a minute, whatever the clocks say', () => {
    expect(bucketLinkCopiedMessage('2026-10-05T13:59:00Z', now)).toBe(
      'Link copied. It expires in 1 minute.'
    );
  });

  test('falls back to words when the expiry cannot be read', () => {
    expect(bucketLinkCopiedMessage('soon', now)).toBe(
      'Link copied. It expires in a few minutes.'
    );
  });
});
