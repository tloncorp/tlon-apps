import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  appendToPostBlob,
  parsePostBlob,
  type PostBlobDataEntry,
} from '../client/content-helpers';

const logger = vi.hoisted(() => ({ warn: vi.fn(), trackError: vi.fn() }));
vi.mock('../lib/logger', () => ({ createDevLogger: () => logger }));

const viewerUrl = 'https://browser-session.tlon.network/s/private.signature';
const fillUrl =
  'https://browser-session.tlon.network/credential-fills/private-handle';
function handoffEntry() {
  return {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'login', catalogId: 'tlon.a2ui.basic.v2' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'login',
          root: 'open',
          components: [
            {
              id: 'open',
              component: 'Button',
              child: 'label',
              action: {
                event: {
                  name: 'tlon.navigate',
                  context: {
                    target: {
                      type: 'screen',
                      screen: 'browserCredentialHandoff',
                      viewerUrl,
                    },
                  },
                },
              },
            },
            { id: 'label', component: 'Text', text: 'Open secure login' },
          ],
        },
      },
    ],
  };
}

describe('post blob diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('warns on unsupported entries and redacts nested capabilities without changing other fields', () => {
    const entry = {
      ...handoffEntry(),
      version: 999,
      future: [{ fillUrl }],
      imageUrl: 'https://example.com/image.png',
    };
    const original = JSON.stringify(entry);
    expect(parsePostBlob(JSON.stringify([entry]))).toEqual([
      { type: 'unknown' },
    ]);
    expect(logger.trackError).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to parse PostBlobDataEntry',
      {
        entry: JSON.parse(
          original
            .replace(viewerUrl, '[REDACTED]')
            .replace(fillUrl, '[REDACTED]')
        ),
      }
    );
    expect(JSON.stringify(entry)).toBe(original);
  });

  test('preserves usable handoff capabilities in parsed data without logging them', () => {
    const entry = handoffEntry();
    expect(parsePostBlob(JSON.stringify([entry]))).toEqual([entry]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.trackError).not.toHaveBeenCalled();
  });

  test('warns and preserves known entries alongside new blob types', () => {
    const known = {
      type: 'file',
      version: 1,
      fileUri: 'https://example.com/file.txt',
      name: 'file.txt',
      mimeType: 'text/plain',
      size: 3,
    };
    const unknown = { type: 'future-entry', version: 2, target: { viewerUrl } };
    expect(parsePostBlob(JSON.stringify([known, unknown]))).toEqual([
      known,
      { type: 'unknown' },
    ]);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.trackError).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'private.signature'
    );
  });

  test.each([
    `[{"viewerUrl":"${viewerUrl}",`,
    JSON.stringify({ viewerUrl }),
    JSON.stringify(viewerUrl),
  ])('omits raw payloads for malformed or non-array blobs (%s)', (blob) => {
    expect(parsePostBlob(blob)).toEqual([{ type: 'unknown' }]);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.trackError).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'private.signature'
    );
  });

  test('keeps invalid outgoing entries as errors but redacts capabilities', () => {
    const entry = { ...handoffEntry(), version: 999 };
    expect(() =>
      appendToPostBlob(undefined, entry as PostBlobDataEntry)
    ).toThrow('Invalid PostBlobDataEntry');
    expect(logger.trackError).toHaveBeenCalledOnce();
    expect(JSON.stringify(logger.trackError.mock.calls)).not.toContain(
      'private.signature'
    );
    expect(logger.trackError.mock.calls[0][1]).toMatchObject({
      issueCodes: ['invalid_union'],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
