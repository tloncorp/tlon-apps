import { describe, expect, it } from 'vitest';

import {
  MAX_TOOL_PARAM_DETAIL_CHARS,
  detailToolParams,
  elideToolParamValues,
  withoutEmptyToolParamValues,
} from './context-lens-tool-params.js';

// A `message action=send` call as gpt-5.6-luna actually issues it: every
// optional parameter in the tool schema filled in with a default. Captured from
// a tlonbot e2e run (108 keys); trimmed here to the shape that matters.
function paddedMessageParams(): Record<string, unknown> {
  const padding: Record<string, unknown> = {};
  for (const key of [
    'activityName',
    'activityState',
    'activityType',
    'activityUrl',
    'after',
    'around',
    'authorId',
    'before',
    'buffer',
    'caption',
    'categoryId',
    'channelId',
    'chatId',
    'contentType',
    'desc',
    'effect',
    'effectId',
    'emoji',
    'emojiName',
    'endTime',
    'eventName',
    'eventType',
    'fileId',
    'filePath',
    'filename',
    'gatewayToken',
    'gatewayUrl',
    'groupId',
    'guildId',
    'image',
    'kind',
    'location',
    'media',
    'memberId',
    'mimeType',
    'name',
    'openId',
    'pageToken',
    'parentId',
    'participant',
    'path',
    'pollId',
    'pollOptionId',
    'pollQuestion',
    'query',
    'quoteText',
    'reason',
    'replyTo',
    'roleId',
    'scope',
    'startTime',
    'status',
    'stickerDesc',
    'stickerName',
    'stickerTags',
    'targetAuthor',
    'threadId',
    'threadName',
    'topic',
    'unionId',
    'until',
    'userId',
  ]) {
    padding[key] = '';
  }
  for (const key of [
    'appliedTags',
    'attachments',
    'authorIds',
    'channelIds',
    'pollOption',
    'roleIds',
    'stickerId',
    'targets',
  ]) {
    padding[key] = [];
  }
  for (const key of [
    'asDocument',
    'asVoice',
    'clearParent',
    'dryRun',
    'forceDocument',
    'fromMe',
    'gifPlayback',
    'includeArchived',
    'includeMembers',
    'members',
    'nsfw',
    'pollMulti',
    'remove',
    'silent',
    'trackToolCalls',
  ]) {
    padding[key] = false;
  }
  for (const [key, value] of Object.entries({
    autoArchiveMin: 1,
    channelType: 0,
    deleteDays: 0,
    durationMin: 0,
    limit: 1,
    pageSize: 1,
    pollDurationHours: 1,
    pollOptionIndex: 1,
    position: 0,
    rateLimitPerUser: 0,
    timeoutMs: 10_000,
  })) {
    padding[key] = value;
  }
  return {
    action: 'send',
    channel: 'tlon',
    target: 'chat/~zod/gjkydolns-general',
    accountId: 'default',
    message: 'hello from the test suite',
    ...padding,
  };
}

function parsed(detail: string | undefined): Record<string, unknown> {
  expect(detail).toBeTypeOf('string');
  return JSON.parse(detail as string) as Record<string, unknown>;
}

describe('detailToolParams', () => {
  it('returns undefined for nullish params', () => {
    expect(detailToolParams(null)).toBeUndefined();
    expect(detailToolParams(undefined)).toBeUndefined();
  });

  it('keeps a schema-padded call parseable, with its identifying args intact', () => {
    // The regression this guards: pretty-printing pushed this payload over the
    // budget, it was sliced mid-key, and consumers saw no arguments at all.
    const detail = detailToolParams(paddedMessageParams());
    expect(detail!.length).toBeLessThanOrEqual(MAX_TOOL_PARAM_DETAIL_CHARS);
    const args = parsed(detail);
    expect(args.action).toBe('send');
    expect(args.target).toBe('chat/~zod/gjkydolns-general');
    expect(args.message).toBe('hello from the test suite');
  });

  it('serializes compactly', () => {
    expect(detailToolParams({ command: 'groups list' })).toBe(
      '{"command":"groups list"}'
    );
  });

  it('keeps values verbatim when the real params already fit', () => {
    // Eliding is a concession to the budget; paying it early would replace the
    // exact `message` a fixture matches on with a placeholder.
    const message = 'x'.repeat(300);
    const args = parsed(
      detailToolParams({
        action: 'send',
        target: 'chat/~zod/x-general',
        message,
      })
    );
    expect(args.message).toBe(message);
  });

  it('drops padding before clamping a real value', () => {
    // Over budget only because of the empty optional keys: the body must
    // survive exactly, since dropping padding costs a consumer nothing and
    // clamping the message costs it the predicate it matches on.
    const message = 'y'.repeat(500);
    const args = parsed(
      detailToolParams({ ...paddedMessageParams(), message })
    );
    expect(args.message).toBe(message);
    expect(args.action).toBe('send');
    expect(args.__emptyKeysOmitted__).toBeTypeOf('number');
  });

  it('elides a long value instead of the document', () => {
    const args = parsed(
      detailToolParams({
        action: 'send',
        target: 'chat/~zod/x-general',
        message: 'x'.repeat(5_000),
      })
    );
    expect(args.action).toBe('send');
    expect(args.target).toBe('chat/~zod/x-general');
    expect(args.message).toMatch(/^x+… \[5000 chars\]$/);
  });

  it('caps long arrays and says how many were dropped', () => {
    const args = parsed(
      detailToolParams({
        targets: Array.from({ length: 500 }, (_, i) => `~ship-${i}`),
      })
    );
    expect(args.targets).toHaveLength(11);
    expect((args.targets as unknown[])[10]).toBe('[+490 more items]');
  });

  it('drops empty padding when the elided document still overflows', () => {
    const params = {
      action: 'send',
      target: 'chat/~zod/x-general',
      ...Object.fromEntries(
        Array.from({ length: 400 }, (_, i) => [`padKey${i}`, ''])
      ),
    };
    const detail = detailToolParams(params);
    expect(detail!.length).toBeLessThanOrEqual(MAX_TOOL_PARAM_DETAIL_CHARS);
    const args = parsed(detail);
    expect(args.action).toBe('send');
    expect(args.target).toBe('chat/~zod/x-general');
    expect(args.__emptyKeysOmitted__).toBe(400);
  });

  it('falls back to a shape summary when nothing fits, still as valid JSON', () => {
    const params = Object.fromEntries(
      Array.from({ length: 600 }, (_, i) => [`realKey${i}`, `value-${i}`])
    );
    const detail = detailToolParams(params);
    expect(detail!.length).toBeLessThanOrEqual(MAX_TOOL_PARAM_DETAIL_CHARS);
    const args = parsed(detail);
    expect(args.__tooLarge__).toBeTypeOf('number');
    expect(args.keys).toHaveLength(40);
  });

  it('keeps the shape summary within budget when key names are huge', () => {
    // An oversized summary would be sliced again downstream by ship-sync's own
    // truncation, recreating the unparseable record this module prevents.
    const params = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [
        `absurdlyLongParameterName${'x'.repeat(300)}${i}`,
        `value-${i}`,
      ])
    );
    const detail = detailToolParams(params);
    expect(detail!.length).toBeLessThanOrEqual(MAX_TOOL_PARAM_DETAIL_CHARS);
    const args = parsed(detail);
    expect(args.__tooLarge__).toBeTypeOf('number');
    expect(args.keyCount).toBe(200);
  });

  it('survives a circular payload — the depth cap breaks the cycle', () => {
    const circular: Record<string, unknown> = { action: 'send' };
    circular.self = circular;
    const args = parsed(detailToolParams(circular));
    expect(args.action).toBe('send');
    expect(JSON.stringify(args)).toContain('[object 2 keys]');
  });

  it('never emits unparseable JSON', () => {
    for (const params of [
      {},
      { a: { b: { c: { d: { e: { f: 'deep' } } } } } },
      { list: [{ nested: ['x', { deeper: true }] }] },
      paddedMessageParams(),
      { message: 'x'.repeat(50_000) },
      Object.fromEntries(
        Array.from({ length: 300 }, (_, i) => [`k${'y'.repeat(200)}${i}`, 'v'])
      ),
      Array.from({ length: 400 }, (_, i) => `item-${i}`),
    ]) {
      const detail = detailToolParams(params);
      expect(() => JSON.parse(detail as string)).not.toThrow();
      expect(detail!.length).toBeLessThanOrEqual(MAX_TOOL_PARAM_DETAIL_CHARS);
    }
  });
});

describe('withoutEmptyToolParamValues', () => {
  it('drops "" / [] / null but keeps false and 0', () => {
    expect(
      withoutEmptyToolParamValues({
        action: 'send',
        caption: '',
        targets: [],
        replyTo: null,
        dryRun: false,
        limit: 0,
      })
    ).toEqual({ action: 'send', dryRun: false, limit: 0 });
  });
});

describe('elideToolParamValues', () => {
  it('summarizes past the depth limit rather than recursing forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
    expect(JSON.stringify(elideToolParamValues(deep))).toContain(
      '[object 1 keys]'
    );
  });
});
