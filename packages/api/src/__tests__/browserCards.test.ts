import { describe, expect, it } from 'vitest';
import { appendToPostBlob, parsePostBlob } from '../client/content-helpers';
import { convertContent } from '../client/postContent';

const viewerUrl = 'https://browser-session.tlon.network/s/payload.signature';
describe('browser post blobs', () => {
  it.each(['browser-session', 'browser-secure-entry'] as const)(
    'round trips %s through the normal post pipeline',
    (type) => {
      const entry = { type, version: 1 as const, viewerUrl };
      const blob = appendToPostBlob(undefined, entry);
      expect(parsePostBlob(blob)).toEqual([entry]);
      expect(convertContent([], blob)).toEqual([
        { type: 'browser-card', card: entry },
      ]);
    }
  );
  it.each([
    { version: 2 },
    { viewerUrl: 'invalid' },
    { presentation: { purpose: 'payment', site: 'example.com' } },
    { presentation: { purpose: 'otp', site: '' } },
    { loginApproval: { record: { id: 'bad', revision: 0 } } },
    { password: 'must-not-be-in-a-post' },
  ])('rejects malformed or credential-bearing entries: %j', (patch) => {
    const blob = JSON.stringify([
      { type: 'browser-secure-entry', version: 1, viewerUrl, ...patch },
    ]);
    expect(parsePostBlob(blob)).toEqual([{ type: 'unknown' }]);
    expect(convertContent([], blob)[0].type).toBe('blockquote');
  });
  it('preserves only the site/purpose presentation and saved-login pointer', () => {
    const entry = {
      type: 'browser-secure-entry' as const,
      version: 1 as const,
      viewerUrl,
      presentation: { purpose: 'login' as const, site: 'wikipedia.org' },
      loginApproval: {
        record: { id: '8e40b5f5-fd41-4851-8922-b9545e470d6e', revision: 1 },
      },
    };
    expect(parsePostBlob(appendToPostBlob(undefined, entry))).toEqual([entry]);
  });
});
