import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fetchWithSsrFGuard } from 'openclaw/plugin-sdk/ssrf-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_BLOB_DOWNLOAD_BYTES,
  downloadBlobAttachments,
  downloadMedia,
  formatBlobAnnotations,
  formatBlobForHistory,
  parseBlobData,
} from './media.js';

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
    const saved = await stat(result.attachments[0]!.path);
    expect(saved.size).toBe(10);
    expect(result.attachments[0]!.path.startsWith(mediaDir)).toBe(true);
    expect(MAX_BLOB_DOWNLOAD_BYTES).toBe(100 * 1024 * 1024);
  });
});
