import { describe, expect, it } from 'vitest';

import { resolveDeliverParentId } from './deliver-parent.js';

describe('resolveDeliverParentId', () => {
  it('keeps chat top-level replies top-level', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'chat/~zod/general',
        messageId: '170141184507123',
      })
    ).toBeNull();
  });

  it('anchors chat thread replies to the thread parent', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'chat/~zod/general',
        messageId: '170141184507456',
        parentId: '170141184507123',
        isThreadReply: true,
      })
    ).toBe('170141184507123');
  });

  it('anchors top-level heap replies to the triggering post', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'heap/~zod/gallery',
        messageId: '170141184507123',
      })
    ).toBe('170141184507123');
  });

  it('keeps heap comment-thread replies anchored to the comment parent', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'heap/~zod/gallery',
        messageId: '170141184507456',
        parentId: '170141184507123',
        isThreadReply: true,
      })
    ).toBe('170141184507123');
  });

  it('lets the reaction replyParentId win over the heap fallback', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'heap/~zod/gallery',
        messageId: 'react-170141184507123',
        replyParentId: '170141184507123',
      })
    ).toBe('170141184507123');
  });

  it('prefers replyParentId when both replyParentId and parentId are set', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'heap/~zod/gallery',
        messageId: '170141184507789',
        parentId: '170141184507123',
        replyParentId: '170141184507456',
      })
    ).toBe('170141184507456');
  });

  it('does not synthesize a heap anchor when messageId is empty', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'heap/~zod/gallery',
        messageId: '',
      })
    ).toBeNull();
  });

  it('does not synthesize a heap anchor for degraded retries', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'heap/~zod/gallery',
        messageId: 'react-170141184507123',
        degraded: true,
      })
    ).toBeNull();
  });

  it('does not synthesize an anchor for a thread reply without a parent', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'heap/~zod/gallery',
        messageId: '170141184507456',
        parentId: null,
        isThreadReply: true,
      })
    ).toBeNull();
  });

  it('keeps diary top-level replies top-level', () => {
    expect(
      resolveDeliverParentId({
        isGroup: true,
        channelNest: 'diary/~zod/notes',
        messageId: '170141184507123',
      })
    ).toBeNull();
  });

  it('preserves DM anchoring with and without replyParentId', () => {
    expect(
      resolveDeliverParentId({
        isGroup: false,
        messageId: '170141184507123',
      })
    ).toBeNull();
    // isGroup gates the fallback even if a heap-shaped nest is present.
    expect(
      resolveDeliverParentId({
        isGroup: false,
        channelNest: 'heap/~zod/gallery',
        messageId: '170141184507123',
      })
    ).toBeNull();
    expect(
      resolveDeliverParentId({
        isGroup: false,
        messageId: '170141184507456',
        replyParentId: '~bot/170.141.184.507.123',
      })
    ).toBe('~bot/170.141.184.507.123');
  });
});
