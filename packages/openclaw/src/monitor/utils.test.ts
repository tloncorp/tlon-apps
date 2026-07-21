import { describe, expect, it } from 'vitest';

import { extractMessageText } from './utils.js';

function citeVerse(chan: { nest: string; where?: string }) {
  return { block: { cite: { chan } } };
}

describe('extractMessageText cite rendering', () => {
  it('renders chat message cites with author', () => {
    const text = extractMessageText([
      citeVerse({ nest: 'chat/~zod/general', where: '/msg/~nec/170.141' }),
    ]);
    expect(text).toContain('> [quoted: ~nec in chat/~zod/general]');
  });

  it('renders a %notes note cite as an actionable tlon notes pointer', () => {
    const text = extractMessageText([
      citeVerse({ nest: 'notes/~zod/plans', where: '/note/12' }),
    ]);
    expect(text).toContain(
      "> [note reference: notes/~zod/plans note 12 — read it via the tlon tool: 'notes note notes/~zod/plans 12']"
    );
  });

  it('renders a %notes cite without a note id as a notebook pointer', () => {
    const text = extractMessageText([citeVerse({ nest: 'notes/~zod/plans' })]);
    expect(text).toContain(
      "> [notebook reference: notes/~zod/plans — browse it via the tlon tool: 'notes notes notes/~zod/plans']"
    );
  });

  it('keeps the generic fallback for other unmatched chan cites', () => {
    const text = extractMessageText([
      citeVerse({ nest: 'heap/~zod/gallery', where: '/curio/99' }),
    ]);
    expect(text).toContain('> [quoted from heap/~zod/gallery]');
  });
});
