import {
  convertContent,
  type LinkBlockData,
} from '@tloncorp/api/client/postContent';
import { describe, expect, it } from 'vitest';

import { browserSessionLinkCard } from './browserSessionLinkCard';

const url =
  'https://browser-session-ovh-test-1.test.tlon.systems/s/payload.signature';
const meta = {
  siteName: 'Browser session',
  title: 'Open browser',
  description: 'View and control the shared browser.',
};

describe('browser share link cards', () => {
  it('routes the shipped command payload directly to the viewer action', () => {
    const [block] = convertContent(
      [{ block: { link: { url, meta } } }],
      undefined
    );
    const card = browserSessionLinkCard(block, 'share');
    expect(card).toEqual({
      type: 'browser-card',
      card: { type: 'browser-session', version: 1, viewerUrl: url },
    });
  });

  it('leaves old masked inline links unchanged', () => {
    const [block] = convertContent(
      [{ inline: [{ link: { href: url, content: 'NASCAR.com' } }] }],
      undefined
    );
    expect(browserSessionLinkCard(block, 'old')).toBe(block);
  });

  it.each([
    { url: 'https://example.com/s/payload.signature' },
    {
      url: 'https://browser-session.tlon.network.attacker.example/s/payload.signature',
    },
    { url: 'http://browser-session.tlon.network/s/payload.signature' },
    { url: 'https://browser-session.tlon.network/s/incomplete' },
    { siteName: 'Ordinary link' },
    { title: 'Some other page' },
  ])('leaves unrelated or untrusted link cards unchanged: %j', (overrides) => {
    const block: LinkBlockData = { type: 'link', url, ...meta, ...overrides };
    expect(browserSessionLinkCard(block, 'other')).toBe(block);
  });
});
