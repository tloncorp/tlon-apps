import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithSsrFGuard } from 'openclaw/plugin-sdk/ssrf-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_IMAGE_BYTES } from 'openclaw/plugin-sdk/media-runtime';

import {
  MAX_BLOB_DOWNLOAD_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MEDIA_FETCH_TIMEOUTS,
  downloadBlobAttachments,
  downloadMedia,
  downloadMessageImages,
  formatInboundMediaBody,
  formatBlobAnnotations,
  formatBlobForHistory,
  hasAttachmentBlob,
  parseBlobData,
} from './media.js';
import { shouldEngageInGroup } from './utils.js';

vi.mock('openclaw/plugin-sdk/ssrf-runtime', () => ({
  fetchWithSsrFGuard: vi.fn(),
}));

vi.mock('../urbit/context.js', () => ({
  getDefaultSsrFPolicy: vi.fn(() => ({})),
}));

const mockedFetchWithSsrFGuard = vi.mocked(fetchWithSsrFGuard);

describe('parseBlobData', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseBlobData(null)).toBeNull();
    expect(parseBlobData(undefined)).toBeNull();
    expect(parseBlobData('')).toBeNull();
  });

  it('returns an unknown sentinel for invalid JSON', () => {
    expect(parseBlobData('not json')).toEqual([{ type: 'unknown' }]);
  });

  it('returns null for empty array', () => {
    expect(parseBlobData('[]')).toBeNull();
  });

  it('parses a file blob', () => {
    const blob = JSON.stringify([
      {
        type: 'file',
        version: 1,
        fileUri: 'https://storage.example.com/report.pdf',
        mimeType: 'application/pdf',
        name: 'report.pdf',
        size: 245760,
      },
    ]);
    const result = parseBlobData(blob);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      type: 'file',
      fileUri: 'https://storage.example.com/report.pdf',
      name: 'report.pdf',
    });
  });

  it('parses a voice memo blob', () => {
    const blob = JSON.stringify([
      {
        type: 'voicememo',
        version: 1,
        fileUri: 'https://storage.example.com/memo.m4a',
        size: 51200,
        duration: 12.5,
        transcription: 'Hey check this out',
      },
    ]);
    const result = parseBlobData(blob);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      type: 'voicememo',
      transcription: 'Hey check this out',
    });
  });

  it('parses a video blob', () => {
    const blob = JSON.stringify([
      {
        type: 'video',
        version: 1,
        fileUri: 'https://storage.example.com/clip.mp4',
        mimeType: 'video/mp4',
        name: 'clip.mp4',
        size: 5242880,
        duration: 30,
      },
    ]);
    const result = parseBlobData(blob);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({ type: 'video', name: 'clip.mp4' });
  });

  it('parses multiple entries', () => {
    const blob = JSON.stringify([
      {
        type: 'file',
        version: 1,
        fileUri: 'https://example.com/a.pdf',
        size: 100,
      },
      {
        type: 'voicememo',
        version: 1,
        fileUri: 'https://example.com/b.m4a',
        size: 200,
        duration: 5,
      },
    ]);
    const result = parseBlobData(blob);
    expect(result).toHaveLength(2);
  });

  it('skips unknown blob types', () => {
    const blob = JSON.stringify([
      { type: 'unknown_future_type', version: 99 },
      {
        type: 'file',
        version: 1,
        fileUri: 'https://example.com/a.pdf',
        size: 100,
      },
    ]);
    const result = parseBlobData(blob);
    expect(result).toHaveLength(2);
    expect(result![0]).toMatchObject({ type: 'unknown' });
    expect(result![1]).toMatchObject({ type: 'file' });
  });

  it('parses context lens blobs without treating them as media', () => {
    const blob = JSON.stringify([
      { type: 'tlon-context-lens', version: 1, lensId: 'lens-123' },
      {
        type: 'file',
        version: 1,
        fileUri: 'https://example.com/a.pdf',
        size: 100,
      },
    ]);
    const result = parseBlobData(blob);
    expect(result).toHaveLength(2);
    // recognized as its own entry type (not a media type), so the downloader's
    // allowlist skips it — see isDownloadableBlobEntry
    expect(result![0]).toMatchObject({ type: 'tlon-context-lens' });
    expect(result![1]).toMatchObject({ type: 'file' });
  });
});

describe('formatBlobAnnotations', () => {
  it('formats a file annotation', () => {
    const text = formatBlobAnnotations([
      {
        type: 'file',
        version: 1,
        fileUri: 'https://storage.example.com/report.pdf',
        mimeType: 'application/pdf',
        name: 'report.pdf',
        size: 245760,
      },
    ]);
    expect(text).toContain('📎');
    expect(text).toContain('report.pdf');
    expect(text).toContain('application/pdf');
    expect(text).toContain('240KB');
    expect(text).toContain('https://storage.example.com/report.pdf');
  });

  it('formats a voice memo with transcription', () => {
    const text = formatBlobAnnotations([
      {
        type: 'voicememo',
        version: 1,
        fileUri: 'https://storage.example.com/memo.m4a',
        size: 51200,
        duration: 12.5,
        transcription: 'Hey check this out',
      },
    ]);
    expect(text).toContain('🎙️');
    expect(text).toContain('13s');
    expect(text).toContain('"Hey check this out"');
  });

  it('formats a video annotation', () => {
    const text = formatBlobAnnotations([
      {
        type: 'video',
        version: 1,
        fileUri: 'https://storage.example.com/clip.mp4',
        mimeType: 'video/mp4',
        name: 'clip.mp4',
        size: 5242880,
      },
    ]);
    expect(text).toContain('🎬');
    expect(text).toContain('clip.mp4');
    expect(text).toContain('video/mp4');
    expect(text).toContain('5.0MB');
  });

  it('returns empty string for unknown-only entries', () => {
    const text = formatBlobAnnotations([{ type: 'unknown' }]);
    expect(text).toBe('');
  });

  it('formats multiple entries on separate lines', () => {
    const text = formatBlobAnnotations([
      {
        type: 'file',
        version: 1,
        fileUri: 'https://example.com/a.pdf',
        name: 'a.pdf',
        size: 1024,
      },
      {
        type: 'voicememo',
        version: 1,
        fileUri: 'https://example.com/b.m4a',
        size: 2048,
        duration: 5,
      },
    ]);
    const lines = text.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toContain('📎');
    expect(lines[1]).toContain('🎙️');
  });
});

describe('formatBlobForHistory', () => {
  it('renders a file compactly', () => {
    const text = formatBlobForHistory([
      {
        type: 'file',
        version: 1,
        name: 'report.pdf',
        fileUri: 'https://example.com/report.pdf',
        size: 245760,
      },
    ]);
    expect(text).toBe('[📎 report.pdf]');
  });

  it('renders a voice memo with transcription prominently', () => {
    const text = formatBlobForHistory([
      {
        type: 'voicememo',
        version: 1,
        duration: 12.5,
        transcription: 'Hey check this out',
        fileUri: 'https://example.com/memo.m4a',
        size: 51200,
      },
    ]);
    expect(text).toBe('[🎙️ voice memo: "Hey check this out"]');
  });

  it('renders a voice memo without transcription', () => {
    const text = formatBlobForHistory([
      {
        type: 'voicememo',
        version: 1,
        duration: 12.5,
        fileUri: 'https://example.com/memo.m4a',
        size: 51200,
      },
    ]);
    expect(text).toBe('[🎙️ voice memo, 13s]');
  });

  it('renders a voice memo without duration or transcription', () => {
    const text = formatBlobForHistory([
      {
        type: 'voicememo',
        version: 1,
        fileUri: 'https://example.com/memo.m4a',
        size: 51200,
      },
    ]);
    expect(text).toBe('[🎙️ voice memo]');
  });

  it('renders a video compactly', () => {
    const text = formatBlobForHistory([
      {
        type: 'video',
        version: 1,
        name: 'clip.mp4',
        fileUri: 'https://example.com/clip.mp4',
        size: 5242880,
      },
    ]);
    expect(text).toBe('[🎬 clip.mp4]');
  });

  it('skips unknown types', () => {
    const text = formatBlobForHistory([{ type: 'unknown' }]);
    expect(text).toBe('');
  });

  it('renders multiple entries on separate lines', () => {
    const text = formatBlobForHistory([
      {
        type: 'file',
        version: 1,
        name: 'a.pdf',
        fileUri: 'https://example.com/a.pdf',
        size: 1024,
      },
      {
        type: 'voicememo',
        version: 1,
        duration: 5,
        transcription: 'Hello',
        fileUri: 'https://example.com/b.m4a',
        size: 2048,
      },
    ]);
    expect(text).toBe('[📎 a.pdf]\n[🎙️ voice memo: "Hello"]');
  });
});

describe('blob download limits', () => {
  let mediaDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'tlon-media-test-'));
  });

  afterEach(async () => {
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('skips oversized blob attachments before fetching when blob metadata is over the cap', async () => {
    const result = await downloadBlobAttachments(
      [
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/large-report.pdf',
          mimeType: 'application/pdf',
          name: 'large-report.pdf',
          size: 101 * 1024 * 1024,
        },
      ],
      mediaDir
    );

    expect(mockedFetchWithSsrFGuard).not.toHaveBeenCalled();
    expect(result.attachments).toEqual([]);
    expect(result.notices).toEqual([
      '[blob not downloaded: large-report.pdf is 101.0MB, over the 100.0MB limit]',
    ]);
  });

  it('ignores metadata-only context lens blobs when downloading attachments', async () => {
    const result = await downloadBlobAttachments(
      [{ type: 'tlon-context-lens', version: 1, lensId: 'lens-123' }],
      mediaDir
    );

    expect(mockedFetchWithSsrFGuard).not.toHaveBeenCalled();
    expect(result).toEqual({ attachments: [], notices: [] });
  });

  it('skips oversized blob attachments when content-length exceeds the cap', async () => {
    mockedFetchWithSsrFGuard.mockResolvedValue({
      response: new Response('ignored', {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-length': String(101 * 1024 * 1024),
        },
      }),
      release: vi.fn().mockResolvedValue(undefined),
    } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>);

    const result = await downloadBlobAttachments(
      [
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/header-sized.pdf',
          mimeType: 'application/pdf',
          name: 'header-sized.pdf',
        },
      ],
      mediaDir
    );

    expect(mockedFetchWithSsrFGuard).toHaveBeenCalledTimes(1);
    expect(result.attachments).toEqual([]);
    expect(result.notices).toEqual([
      '[blob not downloaded: header-sized.pdf is 101.0MB, over the 100.0MB limit]',
    ]);
    expect(await readdir(mediaDir)).toEqual([]);
  });

  it('aborts downloads that exceed the cap mid-stream when size was not declared', async () => {
    const onTooLarge = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.enqueue(new Uint8Array(4));
        controller.close();
      },
    });

    mockedFetchWithSsrFGuard.mockResolvedValue({
      response: new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
        },
      }),
      release: vi.fn().mockResolvedValue(undefined),
    } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>);

    const downloaded = await downloadMedia(
      'https://storage.example.com/streamed.bin',
      mediaDir,
      {
        maxBytes: 5,
        onTooLarge,
      }
    );

    expect(downloaded).toBeNull();
    expect(onTooLarge).toHaveBeenCalledWith({ observedSizeBytes: 8 });
    expect(await readdir(mediaDir)).toEqual([]);
  });

  it('downloads blob attachments under the cap', async () => {
    mockedFetchWithSsrFGuard.mockResolvedValue({
      response: new Response('small blob', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-length': '10',
        },
      }),
      release: vi.fn().mockResolvedValue(undefined),
    } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>);

    const result = await downloadBlobAttachments(
      [
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/small.txt',
          mimeType: 'text/plain',
          name: 'small.txt',
          size: 10,
        },
      ],
      mediaDir
    );

    expect(result.notices).toEqual([]);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.contentType).toBe('text/plain');
    const saved = await stat(result.attachments[0].path);
    expect(saved.size).toBe(10);
    expect(result.attachments[0].path.startsWith(mediaDir)).toBe(true);
    expect(MAX_BLOB_DOWNLOAD_BYTES).toBe(100 * 1024 * 1024);
  });
});

describe('guard invocation', () => {
  let mediaDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'tlon-media-ua-test-'));
  });

  afterEach(async () => {
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('sends the descriptive User-Agent', async () => {
    mockedFetchWithSsrFGuard.mockResolvedValue({
      response: new Response('small blob', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
      release: vi.fn().mockResolvedValue(undefined),
    } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>);

    await downloadMedia('https://storage.example.com/x.png', mediaDir);

    const guardArg = mockedFetchWithSsrFGuard.mock.calls[0][0] as {
      init?: { headers?: Record<string, string> };
    };
    expect(guardArg.init?.headers?.['User-Agent']).toMatch(
      /^TlonBot\/\S+ \(https:\/\/tlon\.io; support@tlon\.io\) openclaw-tlon\/\S+$/
    );
  });
});

describe('media download logging', () => {
  const url = 'https://storage.example.com/private/photo.png?sig=abc123';
  let mediaDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mediaDir = await mkdtemp(path.join(tmpdir(), 'tlon-media-log-test-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(mediaDir, { recursive: true, force: true });
  });

  function loggedText(): string {
    return JSON.stringify([
      vi.mocked(console.warn).mock.calls,
      vi.mocked(console.error).mock.calls,
    ]);
  }

  it('logs only the host when a download throws', async () => {
    mockedFetchWithSsrFGuard.mockRejectedValue(
      new TypeError(`fetch failed for ${url}`)
    );

    expect(await downloadMedia(url, mediaDir)).toBeNull();
    const logged = loggedText();
    expect(logged).toContain('storage.example.com');
    expect(logged).toContain('TypeError');
    expect(logged).not.toContain('/private/photo.png');
    expect(logged).not.toContain('sig=abc123');
  });

  it('logs only the host on a failed status', async () => {
    mockedFetchWithSsrFGuard.mockResolvedValue({
      response: new Response('denied', { status: 403 }),
      release: vi.fn().mockResolvedValue(undefined),
    } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>);

    expect(await downloadMedia(url, mediaDir)).toBeNull();
    const logged = loggedText();
    expect(logged).toContain('403');
    expect(logged).not.toContain('/private/photo.png');
    expect(logged).not.toContain('sig=abc123');
  });

  it('does not log the contents of a non-http URL', async () => {
    const dataUrl = 'data:image/png;base64,cHJpdmF0ZQ==';
    expect(await downloadMedia(dataUrl, mediaDir)).toBeNull();
    expect(mockedFetchWithSsrFGuard).not.toHaveBeenCalled();
    expect(loggedText()).not.toContain('cHJpdmF0ZQ==');
  });
});

describe('downloadMessageImages', () => {
  let mediaDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'tlon-media-test-'));
  });

  afterEach(async () => {
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('counts images that fail to download', async () => {
    mockedFetchWithSsrFGuard
      .mockResolvedValueOnce({
        response: new Response('missing', { status: 404 }),
        release: vi.fn().mockResolvedValue(undefined),
      } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>)
      .mockResolvedValueOnce({
        response: new Response('png', {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
        release: vi.fn().mockResolvedValue(undefined),
      } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>);

    const result = await downloadMessageImages(
      [
        { block: { image: { src: 'https://storage.example.com/gone.png' } } },
        { block: { image: { src: 'https://storage.example.com/ok.png' } } },
      ],
      mediaDir
    );

    expect(result.unavailableCount).toBe(1);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].contentType).toBe('image/png');
  });

  it('downloads at most eight images and reports the rest unavailable', async () => {
    mockedFetchWithSsrFGuard.mockImplementation(
      async () =>
        ({
          response: new Response('png', {
            status: 200,
            headers: { 'content-type': 'image/png' },
          }),
          release: vi.fn().mockResolvedValue(undefined),
        }) as Awaited<ReturnType<typeof fetchWithSsrFGuard>>
    );
    const content = Array.from({ length: 11 }, (_, i) => ({
      block: { image: { src: `https://storage.example.com/${i}.png` } },
    }));

    const result = await downloadMessageImages(content, mediaDir);

    expect(MAX_IMAGES_PER_MESSAGE).toBe(8);
    expect(mockedFetchWithSsrFGuard).toHaveBeenCalledTimes(8);
    expect(result.attachments).toHaveLength(8);
    expect(result.unavailableCount).toBe(3);
  });

  it('skips an image over the image byte cap and counts it unavailable', async () => {
    mockedFetchWithSsrFGuard.mockResolvedValueOnce({
      response: new Response('big', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(MAX_IMAGE_BYTES + 1),
        },
      }),
      release: vi.fn().mockResolvedValue(undefined),
    } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>);

    const result = await downloadMessageImages(
      [{ block: { image: { src: 'https://storage.example.com/big.png' } } }],
      mediaDir
    );

    expect(result.attachments).toEqual([]);
    expect(result.unavailableCount).toBe(1);
    expect(await readdir(mediaDir)).toEqual([]);
  });

  it('puts the unavailable-image notice in the agent body', () => {
    const attachment = { path: '/m/ok.png', contentType: 'image/png' };
    expect(formatInboundMediaBody('look', [attachment], 1)).toBe(
      '[media attached: /m/ok.png (image/png) | /m/ok.png]\n' +
        '[tlon attachment unavailable]\nlook'
    );
    expect(formatInboundMediaBody('look', [], 2)).toBe(
      '[tlon 2 attachments unavailable]\nlook'
    );
    expect(formatInboundMediaBody('look', [], 0)).toBe('look');
  });

  it('builds BodyForAgent from the download result', () => {
    // monitorTlonProvider is not unit-testable, so the wiring is pinned.
    const monitorSource = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './index.ts'),
      'utf8'
    );
    expect(monitorSource).toContain(
      'unavailableImageCount = unavailableCount;'
    );
    expect(monitorSource).toMatch(
      /let bodyWithAttachments = formatInboundMediaBody\(\s*messageText,\s*attachments,\s*unavailableImageCount\s*\);/
    );
    expect(monitorSource).toContain('BodyForAgent: bodyWithAttachments,');
  });
});

describe('media download deadlines', () => {
  let mediaDir: string;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mediaDir = await mkdtemp(path.join(tmpdir(), 'tlon-media-deadline-'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(async () => {
    vi.useRealTimers();
    errorSpy.mockRestore();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('gives up on a server that never sends headers', async () => {
    let fetchStarted!: () => void;
    const started = new Promise<void>((resolve) => (fetchStarted = resolve));
    mockedFetchWithSsrFGuard.mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          fetchStarted();
          signal?.addEventListener('abort', () => reject(signal?.reason));
        })
    );
    let settled = false;
    const pending = downloadMedia(
      'https://storage.example.com/stall.png',
      mediaDir
    ).finally(() => (settled = true));
    await started;

    await vi.advanceTimersByTimeAsync(
      MEDIA_FETCH_TIMEOUTS.responseHeaderTimeoutMs - 1
    );
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(settled).toBe(true));

    expect(await pending).toBeNull();
    expect(MEDIA_FETCH_TIMEOUTS.responseHeaderTimeoutMs).toBe(120_000);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('MediaTimeoutError')
    );
  });

  it('gives up on a body that never starts after the headers', async () => {
    let fetchStarted!: () => void;
    const started = new Promise<void>((resolve) => (fetchStarted = resolve));
    mockedFetchWithSsrFGuard.mockImplementation(async ({ signal }) => {
      fetchStarted();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener('abort', () =>
            controller.error(signal?.reason)
          );
        },
      });
      return {
        response: new Response(body, {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
        release: vi.fn().mockResolvedValue(undefined),
      } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>;
    });
    let settled = false;
    const pending = downloadMedia(
      'https://storage.example.com/silent.png',
      mediaDir
    ).finally(() => (settled = true));
    await started;

    await vi.advanceTimersByTimeAsync(
      MEDIA_FETCH_TIMEOUTS.readIdleTimeoutMs - 1
    );
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(settled).toBe(true));

    expect(await pending).toBeNull();
  });

  it('gives up on a body that stops arriving, and applies to blob downloads', async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    let fetchStarted!: () => void;
    const started = new Promise<void>((resolve) => (fetchStarted = resolve));
    mockedFetchWithSsrFGuard.mockImplementation(async ({ signal }) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
          signal?.addEventListener('abort', () =>
            controller.error(signal?.reason)
          );
        },
      });
      fetchStarted();
      return {
        response: new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
        release: vi.fn().mockResolvedValue(undefined),
      } as Awaited<ReturnType<typeof fetchWithSsrFGuard>>;
    });
    let settled = false;
    const pending = downloadBlobAttachments(
      [
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/stall.pdf',
          mimeType: 'application/pdf',
          name: 'stall.pdf',
          size: 10,
        },
      ],
      mediaDir
    ).finally(() => (settled = true));
    await started;

    // Steady progress keeps the download alive past one idle window.
    const step = MEDIA_FETCH_TIMEOUTS.readIdleTimeoutMs / 2;
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(step);
      streamController.enqueue(new Uint8Array(4));
    }
    await vi.advanceTimersByTimeAsync(step);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(step);
    await vi.waitFor(() => expect(settled).toBe(true));
    expect((await pending).attachments).toEqual([]);
    expect(MEDIA_FETCH_TIMEOUTS.readIdleTimeoutMs).toBe(30_000);
    expect(await readdir(mediaDir)).toEqual([]);
  });
});

describe('hasAttachmentBlob', () => {
  const metadata = (version: number) => ({
    type: 'metadata',
    version,
    data: { 'tlon.client': { version: 1, rendererRevision: 1 } },
  });
  const file = {
    type: 'file',
    version: 1,
    fileUri: 'https://storage.example.com/report.pdf',
    mimeType: 'application/pdf',
    name: 'report.pdf',
    size: 1024,
  };

  it('treats a metadata-only blob as no attachment', () => {
    expect(hasAttachmentBlob(JSON.stringify([metadata(1)]))).toBe(false);
    expect(hasAttachmentBlob(JSON.stringify([metadata(1), metadata(1)]))).toBe(
      false
    );
  });

  it('treats metadata of any version as metadata', () => {
    expect(hasAttachmentBlob(JSON.stringify([metadata(2)]))).toBe(false);
    expect(hasAttachmentBlob(JSON.stringify([{ type: 'metadata' }]))).toBe(
      false
    );
  });

  it('counts metadata mixed with an attachment', () => {
    expect(hasAttachmentBlob(JSON.stringify([metadata(1), file]))).toBe(true);
  });

  it('counts any non-metadata entry', () => {
    expect(hasAttachmentBlob(JSON.stringify([file]))).toBe(true);
    expect(
      hasAttachmentBlob(JSON.stringify([{ type: 'some-future-type' }]))
    ).toBe(true);
    expect(hasAttachmentBlob(JSON.stringify([metadata(1), 'metadata']))).toBe(
      true
    );
  });

  it('is false for a missing or empty blob', () => {
    expect(hasAttachmentBlob(undefined)).toBe(false);
    expect(hasAttachmentBlob(null)).toBe(false);
    expect(hasAttachmentBlob('')).toBe(false);
  });

  it('keeps counting blobs it cannot prove are metadata-only', () => {
    expect(hasAttachmentBlob('[]')).toBe(true);
    expect(hasAttachmentBlob('not json')).toBe(true);
    expect(hasAttachmentBlob(JSON.stringify(metadata(1)))).toBe(true);
    expect(hasAttachmentBlob('"metadata"')).toBe(true);
  });

  // Pinned so the Hermes helper's JSON.parse-parity cases stay in agreement.
  it('parses numeric literals the way the Hermes helper does', () => {
    const metadataWith = (literal: string) =>
      `[{"type":"metadata","version":1,"data":{"x":${literal}}}]`;
    for (const constant of ['NaN', 'Infinity', '-Infinity']) {
      expect(hasAttachmentBlob(metadataWith(constant))).toBe(true);
    }
    expect(hasAttachmentBlob(metadataWith('9'.repeat(5000)))).toBe(false);
    expect(hasAttachmentBlob(metadataWith('1e5000'))).toBe(false);
  });

  it('gates the owner-blob trigger in a third-party-hosted channel', () => {
    const engage = (blob: string) =>
      shouldEngageInGroup({
        mentioned: false,
        inParticipatedThread: false,
        isOwnerBlob: hasAttachmentBlob(blob),
        isOwnerCommand: false,
        senderShip: '~zod',
        ownerShip: '~zod',
        botShipName: '~bus',
        channelNest: 'chat/~nec/lounge',
        groupHost: '~nec',
        ownerListenEnabled: true,
        ownerListenDisabledChannels: new Set<string>(),
      });
    expect(engage(JSON.stringify([metadata(1)]))).toEqual({
      engage: false,
      reason: 'skip',
    });
    expect(engage(JSON.stringify([metadata(1), file]))).toEqual({
      engage: true,
      reason: 'owner-blob',
    });
  });

  it('decides channel and DM blob presence with it', () => {
    // monitorTlonProvider is not unit-testable, so the wiring is pinned.
    const monitorSource = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './index.ts'),
      'utf8'
    );
    expect(monitorSource).toContain(
      'const hasBlob = hasAttachmentBlob(content.blob);\n        if (!rawText.trim() && !hasBlob) {'
    );
    expect(monitorSource).toContain(
      'const hasBlob = hasAttachmentBlob(dmContent.blob);\n        if (!rawText.trim() && !hasBlob) {'
    );
    expect(monitorSource).toContain(
      'const isOwnerBlob = hasBlob && isOwner(senderShip);'
    );
    expect(monitorSource).not.toMatch(
      /const hasBlob = Boolean\((content|dmContent)\.blob\)/
    );
  });
});
