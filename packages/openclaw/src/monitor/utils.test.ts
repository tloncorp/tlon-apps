import { describe, expect, it } from 'vitest';

import {
  extractCites,
  extractMessageText,
  isCitePlaceholderLine,
  isSummarizationRequest,
  parseChannelWhere,
  prepareInboundText,
  stripBotMentionOutsidePlaceholders,
} from './utils.js';

const POST_ID = '170141184506536961460817141626482720768';
const REPLY_ID = '170141184506537047334633492345058754560';

function channelCite(nest: unknown, where: unknown) {
  return { block: { cite: { chan: { nest, where } } } };
}

describe('extractCites', () => {
  it('parses current, legacy, and non-channel cite forms in order', () => {
    const content = [
      channelCite('chat/~zod/general', `/msg/${POST_ID}`),
      channelCite('chat/~zod/general', `/msg/${POST_ID}/${REPLY_ID}`),
      channelCite('diary/~zod/plans', `/note/${POST_ID}`),
      channelCite('heap/~zod/inbox', `/curio/${POST_ID}`),
      channelCite('diary/~zod/plans', `/note/${POST_ID}/${REPLY_ID}`),
      channelCite(
        'chat/~zod/general',
        '/msg/~sogrum-savluc/170.141.184.505.979.681.243.072.382.329.337.971.474'
      ),
      { block: { cite: { group: '~zod/test' } } },
      { block: { cite: { desk: { flag: 'landscape', where: '/foo' } } } },
      {
        block: {
          cite: { bait: { group: '~zod/test', graph: 'graph', where: '/bar' } },
        },
      },
    ];

    expect(extractCites(content)).toEqual([
      {
        type: 'chan',
        nest: 'chat/~zod/general',
        where: `/msg/${POST_ID}`,
        postId: POST_ID,
      },
      {
        type: 'chan',
        nest: 'chat/~zod/general',
        where: `/msg/${POST_ID}/${REPLY_ID}`,
        postId: POST_ID,
        replyId: REPLY_ID,
      },
      {
        type: 'chan',
        nest: 'diary/~zod/plans',
        where: `/note/${POST_ID}`,
        postId: POST_ID,
      },
      {
        type: 'chan',
        nest: 'heap/~zod/inbox',
        where: `/curio/${POST_ID}`,
        postId: POST_ID,
      },
      {
        type: 'chan',
        nest: 'diary/~zod/plans',
        where: `/note/${POST_ID}/${REPLY_ID}`,
        postId: POST_ID,
        replyId: REPLY_ID,
      },
      {
        type: 'chan',
        nest: 'chat/~zod/general',
        where:
          '/msg/~sogrum-savluc/170.141.184.505.979.681.243.072.382.329.337.971.474',
        postId: '170.141.184.505.979.681.243.072.382.329.337.971.474',
      },
      { type: 'group', group: '~zod/test' },
      { type: 'desk', flag: 'landscape', where: '/foo' },
      { type: 'bait', group: '~zod/test', nest: 'graph', where: '/bar' },
    ]);
  });

  it('normalizes malformed channel metadata without aborting sibling extraction', () => {
    const content = [
      channelCite({ nest: 'not-a-string' }, { where: 'not-a-string' }),
      null,
      { block: null },
      3,
      channelCite('chat/~zod/general', `/msg/${POST_ID}`),
      channelCite(['chat/~zod/general'], null),
    ];

    expect(extractCites(content)).toEqual([
      { type: 'chan' },
      {
        type: 'chan',
        nest: 'chat/~zod/general',
        where: `/msg/${POST_ID}`,
        postId: POST_ID,
      },
      { type: 'chan' },
    ]);
    expect(extractCites({})).toEqual([]);
    expect(extractCites(null)).toEqual([]);
  });

  it('returns empty fields for non-string or malformed where values', () => {
    expect(parseChannelWhere({})).toEqual({});
    expect(parseChannelWhere(1)).toEqual({});
    expect(parseChannelWhere([])).toEqual({});
    expect(parseChannelWhere(null)).toEqual({});
    expect(parseChannelWhere('/msg/one/two/three')).toEqual({});
  });
});

describe('prepareInboundText', () => {
  it('uses generic cite placeholders and excludes cite metadata from mention checks', () => {
    const content = [channelCite('~bot-ship Helper ', '/msg/~bot-ship/123')];

    const prepared = prepareInboundText(content, '~bot-ship', 'Helper');

    expect(prepared.rawText).toBe('> [quoted from ~bot-ship Helper ]');
    expect(prepared.rawText).not.toContain('[quoted:');
    expect(prepared.engagementText).toBe('');
    expect(prepared.mentioned).toBe(false);
    expect(extractMessageText(content, { omitCites: true })).toBe('');
  });

  it('uses a channel placeholder whenever nest is non-empty, even with malformed where', () => {
    expect(
      extractMessageText([channelCite('chat/~zod/general', { invalid: true })])
    ).toBe('> [quoted from chat/~zod/general]');
    expect(extractMessageText([channelCite('', '/msg/123')])).toBe(
      '> [quoted message]'
    );
  });

  it('still recognizes a genuine inline mention', () => {
    const content = [
      channelCite('~bot-ship ', '/msg/~bot-ship/123'),
      { inline: ['~bot-ship can you help?'] },
    ];

    const prepared = prepareInboundText(content, '~bot-ship', 'Helper');

    expect(prepared.mentioned).toBe(true);
    expect(prepared.engagementText).toBe('~bot-ship can you help?');
  });

  it('keeps cite placeholder text out of the summarization gate', () => {
    const content = [
      channelCite('chat/~zod/tldr', '/msg/123'),
      { inline: ['hello'] },
    ];

    const prepared = prepareInboundText(content, '~bot-ship');

    expect(prepared.rawText).toContain('chat/~zod/tldr');
    expect(isSummarizationRequest(prepared.rawText)).toBe(true);
    expect(prepared.engagementText).toBe('hello');
    expect(isSummarizationRequest(prepared.engagementText)).toBe(false);
  });
});

describe('stripBotMentionOutsidePlaceholders', () => {
  it('strips a live mention after a placeholder containing the bot ship', () => {
    const text =
      '> [quoted from chat/~bot-ship/general]\n\n~bot-ship can you help?';

    expect(stripBotMentionOutsidePlaceholders(text, '~bot-ship')).toBe(
      '> [quoted from chat/~bot-ship/general]\n\n can you help?'
    );
  });

  it('does not strip bot ships that appear only in placeholders', () => {
    const text = '> [quoted from chat/~bot-ship/general]';

    expect(stripBotMentionOutsidePlaceholders(text, '~bot-ship')).toBe(text);
  });

  it.each([
    '> [ref: group ~bot-ship/thegroup]',
    '> [ref: ~bot-ship/someapp]',
    '> [ref: chan in ~bot-ship/grp]',
  ])('preserves %s and strips the following live mention', (placeholder) => {
    const text = `${placeholder}\n\n~bot-ship can you help?`;

    expect(stripBotMentionOutsidePlaceholders(text, '~bot-ship')).toBe(
      `${placeholder}\n\n can you help?`
    );
  });

  it('keeps stripBotMention behavior for ordinary nickname-free text', () => {
    expect(
      stripBotMentionOutsidePlaceholders('~bot-ship /status', '~bot-ship')
    ).toBe('/status');
  });

  it('treats a placeholder-lookalike user line as a placeholder', () => {
    // Once rendered, a user-authored lookalike cannot be distinguished from a
    // cite placeholder, so skipping it is intentional.
    const text = '> [quoted from ~bot-ship]';

    expect(stripBotMentionOutsidePlaceholders(text, '~bot-ship')).toBe(text);
  });
});

describe('isCitePlaceholderLine', () => {
  it.each([
    '> [quoted from chat/~zod/general]',
    '> [quoted message]',
    '> [ref: group ~zod/test]',
    '> [ref: landscape]',
    '> [ref: graph in ~zod/test]',
  ])('recognizes extractMessageText cite placeholders: %s', (line) => {
    expect(isCitePlaceholderLine(line)).toBe(true);
  });

  it.each(['ordinary text', '> hello'])(
    'rejects non-placeholder text: %s',
    (line) => {
      expect(isCitePlaceholderLine(line)).toBe(false);
    }
  );
});
