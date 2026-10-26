import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import {
  resolveCommandAuthorization,
  shouldHandleTextCommands,
} from 'openclaw/plugin-sdk/command-auth';
import { finalizeInboundContext } from 'openclaw/plugin-sdk/reply-dispatch-runtime';
import { describe, expect, it } from 'vitest';

import {
  NON_COMMAND_BODY,
  extractCites,
  extractDmPartnerShip,
  extractMessageText,
  inboundCommandFields,
  isCitePlaceholderLine,
  isDirectDmWhom,
  isDmPartnerAuthorized,
  isSummarizationRequest,
  parseChannelWhere,
  prepareInboundText,
  reactionDispatchConfig,
  resolveCommandBody,
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

describe('resolveCommandBody', () => {
  it('uses the original slash command when agent context is prepended', () => {
    expect(
      resolveCommandBody({
        messageText:
          '[First-week onboarding context]\n\n[Current owner message]\n/status',
        originalCommandText: '/status',
        isGroup: false,
        botShipName: '~bot-ship',
      })
    ).toBe('/status');
  });

  it('strips the bot mention from an original channel command', () => {
    expect(
      resolveCommandBody({
        messageText:
          '[First-week onboarding context]\n\n[Current owner message]\n~bot-ship /new',
        originalCommandText: '~bot-ship /new',
        isGroup: true,
        botShipName: '~bot-ship',
      })
    ).toBe('/new');
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

describe('inboundCommandFields', () => {
  const REACTION_TEXT = '/owner-listen all off (reacting to: "hi")';

  // The inbound payload as the monitor hands it to core, finalized by core's
  // own normalizer so the command fields are the ones its parsers read.
  function finalize(fields: ReturnType<typeof inboundCommandFields>) {
    return finalizeInboundContext({
      Body: `[Tlon ~zod [owner] Mon 2026-10-19 12:00] ${REACTION_TEXT}`,
      BodyForAgent: REACTION_TEXT,
      ...fields,
      From: 'tlon:~zod',
      To: 'tlon:~bot',
      SessionKey: 'agent:main:tlon:direct:~zod',
      ChatType: 'direct',
      SenderId: '~zod',
      Provider: 'tlon',
      Surface: 'tlon',
    });
  }

  it('gives a reaction no command-facing text, even one that starts with /', () => {
    const ctx = finalize(inboundCommandFields({ fromReaction: true }));

    expect(ctx.CommandTurn).toMatchObject({
      kind: 'normal',
      source: 'message',
      authorized: false,
    });
    expect(ctx.CommandTurn?.commandName).toBeUndefined();
    expect(ctx.CommandAuthorized).toBe(false);
    expect(ctx.CommandSource).toBeUndefined();
    // Core's command parsers read these chains, with `??` or blank-skipping.
    const nullish = ctx.BodyForCommands ?? ctx.CommandBody ?? ctx.RawBody;
    const nonBlank = [ctx.CommandBody, ctx.BodyForCommands, ctx.RawBody].find(
      (value) => value?.trim()
    );
    for (const source of [nullish, nonBlank]) {
      expect(source).toBeDefined();
      expect(source).not.toContain('owner-listen');
      expect(source?.trim().startsWith('/')).toBe(false);
    }
    // Only the agent-facing bodies carry the reaction text.
    const carriers = Object.entries(ctx)
      .filter(
        ([, value]) =>
          typeof value === 'string' && value.includes('/owner-listen')
      )
      .map(([key]) => key)
      .sort();
    expect(carriers).toEqual(['Body', 'BodyForAgent', 'agentText']);
    expect(ctx.commandText).toBe(NON_COMMAND_BODY);
    expect(ctx.rawText).toBe(NON_COMMAND_BODY);
    expect(ctx.CommandTurn?.body).toBe(NON_COMMAND_BODY);
  });

  it('keeps a typed message a text command', () => {
    const ctx = finalize(
      inboundCommandFields({
        fromReaction: false,
        rawBody: REACTION_TEXT,
        commandBody: REACTION_TEXT,
        commandAuthorized: true,
      })
    );

    expect(ctx.CommandTurn).toMatchObject({
      kind: 'text-slash',
      authorized: true,
      commandName: 'owner-listen',
    });
    expect(ctx.BodyForCommands).toBe(REACTION_TEXT);
  });
});

describe('reactionDispatchConfig', () => {
  // Core runs an inline /help, /commands, /whoami or /id from the agent body
  // when `allowTextCommands && command.isAuthorizedSender` (get-reply), and
  // command.isAuthorizedSender is resolveCommandAuthorization's verdict. The
  // inline extractor itself is not exported, so this pins the gate it runs
  // behind, computed by core from the reaction payload and dispatch config.
  const reactionCtx = finalizeInboundContext({
    Body: '[Tlon ~zod [owner] Mon 2026-10-19 12:00] /whoami (reacting to: "hi")',
    BodyForAgent: '/whoami (reacting to: "hi")',
    ...inboundCommandFields({ fromReaction: true }),
    From: 'tlon:~zod',
    To: 'tlon:~bot',
    SessionKey: 'agent:main:tlon:direct:~zod',
    ChatType: 'direct',
    SenderId: '~zod',
    AccountId: 'default',
    Provider: 'tlon',
    Surface: 'tlon',
  });

  it.each([
    ['the tlon key', { tlon: ['~zod'] }],
    ['the * key', { '*': ['~zod'] }],
    ['a wildcard', { tlon: ['*'] }],
  ])(
    'authorizes no inline command from a reaction by a sender on %s',
    (_label, allowFrom) => {
      const cfg = { commands: { allowFrom } } as OpenClawConfig;
      const gate = (config: OpenClawConfig) =>
        shouldHandleTextCommands({
          cfg: config,
          surface: 'tlon',
          commandSource: reactionCtx.CommandSource,
        }) &&
        resolveCommandAuthorization({
          ctx: reactionCtx,
          cfg: config,
          commandAuthorized: false,
        }).isAuthorizedSender;

      // Under the configured list the sender passes despite
      // CommandAuthorized: false, so the inline command would run.
      expect(gate(cfg)).toBe(true);
      expect(gate(reactionDispatchConfig(cfg))).toBe(false);
    }
  );

  it('changes nothing but the command allowlist', () => {
    const cfg = {
      commands: { allowFrom: { tlon: ['~zod'] }, ownerAllowFrom: ['~zod'] },
      session: { dmScope: 'main' },
    } as OpenClawConfig;

    expect(reactionDispatchConfig(cfg)).toEqual({
      commands: {
        allowFrom: { tlon: [], '*': [] },
        ownerAllowFrom: ['~zod'],
      },
      session: { dmScope: 'main' },
    });
    expect(cfg.commands?.allowFrom).toEqual({ tlon: ['~zod'] });
  });
});

describe('isDirectDmWhom', () => {
  it('accepts a ship with or without ~ and a { ship } object', () => {
    expect(isDirectDmWhom('~zod')).toBe(true);
    expect(isDirectDmWhom('sampel-palnet')).toBe(true);
    expect(isDirectDmWhom({ ship: '~sampel-palnet' })).toBe(true);
    expect(extractDmPartnerShip('Sampel-Palnet')).toBe('~sampel-palnet');
  });

  it('rejects a club id, empty, garbage and non-strings', () => {
    expect(isDirectDmWhom('0v3.abcde.fghij.klmno.pqrst')).toBe(false);
    expect(isDirectDmWhom({ club: '0v3.abcde' })).toBe(false);
    expect(isDirectDmWhom('')).toBe(false);
    expect(isDirectDmWhom('~')).toBe(false);
    expect(isDirectDmWhom('~zod/chat')).toBe(false);
    expect(isDirectDmWhom('chat/~zod/general')).toBe(false);
    expect(isDirectDmWhom(undefined)).toBe(false);
    expect(isDirectDmWhom(null)).toBe(false);
    expect(isDirectDmWhom(42)).toBe(false);
    expect(isDirectDmWhom({ ship: 42 })).toBe(false);
  });
});

describe('isDmPartnerAuthorized', () => {
  it('allows the owner and allowlisted ships', () => {
    expect(isDmPartnerAuthorized('~zod', '~zod', [])).toBe(true);
    expect(isDmPartnerAuthorized('zod', '~zod', undefined)).toBe(true);
    expect(isDmPartnerAuthorized('~bus', '~zod', ['bus'])).toBe(true);
    expect(isDmPartnerAuthorized('~bus', undefined, ['~bus'])).toBe(true);
  });

  it('drops a ship that is neither owner nor allowlisted', () => {
    expect(isDmPartnerAuthorized('~bus', '~zod', ['~ten'])).toBe(false);
    expect(isDmPartnerAuthorized('~bus', '~zod', undefined)).toBe(false);
    expect(isDmPartnerAuthorized('~bus', null, [])).toBe(false);
    expect(isDmPartnerAuthorized('', '', [])).toBe(false);
  });
});
