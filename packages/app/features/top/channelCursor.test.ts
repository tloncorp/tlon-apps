import { describe, expect, it } from 'vitest';

import { postCursorFor } from './channelCursor';

const notesNest = 'notes/~zod/journal';
const chatNest = 'chat/~zod/general';

describe('postCursorFor', () => {
  it('ignores a selected note id in a notes channel', () => {
    expect(postCursorFor(notesNest, '170.141.184.507', undefined)).toBe(
      undefined
    );
  });

  it('ignores the unread cursor in a notes channel', () => {
    expect(postCursorFor(notesNest, undefined, '170.141.184.508')).toBe(
      undefined
    );
  });

  it('uses the selected post in a chat channel', () => {
    expect(postCursorFor(chatNest, 'selected', 'unread')).toBe('selected');
  });

  it('falls back to the unread cursor when the selection is empty', () => {
    expect(postCursorFor(chatNest, '', 'unread')).toBe('unread');
  });

  it('has no cursor in a chat channel without selection or unread', () => {
    expect(postCursorFor(chatNest, undefined, undefined)).toBe(undefined);
  });
});
