import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// monitorTlonProvider is not unit-testable (see bot-info.test.ts), so the
// ledger's call sites are pinned at the source level. Moving a check past a
// command or engagement gate, or dropping it, would pass every other test.
const here = path.dirname(fileURLToPath(import.meta.url));
const monitorSource = fs.readFileSync(path.resolve(here, './index.ts'), 'utf8');
const onboardingSource = fs.readFileSync(
  path.resolve(here, './agent-onboarding.ts'),
  'utf8'
);

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  const to = source.indexOf(end, from + start.length);
  expect(to, end).toBeGreaterThan(from);
  return source.slice(from, to);
}

const channelHandler = between(
  monitorSource,
  'const handleChannelsFirehose = async',
  'const handleChatFirehose = async'
);
const chatHandler = between(
  monitorSource,
  'const handleChatFirehose = async',
  '\n    };\n'
);

describe('owner tool posts in the channel firehose', () => {
  // The live-message branch: from the bot-self skip to the first dispatch.
  const live = between(
    channelHandler,
    'if (senderShip === botShipName) {',
    'await processMessage({'
  );

  it('returns on a ledger hit before any owner, command or engagement handling', () => {
    const check = live.indexOf(
      'sharedOwnerToolPostLedger().match(\n          channelInboundPost(nest, response, senderShip, rawText)\n        );'
    );
    expect(check).toBeGreaterThan(-1);
    expect(live.slice(check)).toMatch(
      /^sharedOwnerToolPostLedger\(\)\.match\([^;]*\);\s*if \(ownerToolPost\) \{\s*runtime\.log\?\.\([^;]*\);\s*return;\s*\}/
    );
    expect(channelHandler.indexOf('activityReads.begin(')).toBeLessThan(
      channelHandler.indexOf(live)
    );
    for (const later of [
      // An owner --bot send has a bot-profile author; it must not mark the
      // owner's ship as a bot for the process lifetime.
      'knownBotShips.add(senderShip)',
      'campaign',
      'handleAgentOnboardingRequest(',
      'isOwnerListenSlashCommand(',
      'isRegisteredCommandText(',
      'shouldEngageInGroup(',
    ]) {
      expect(live.indexOf(later), later).toBeGreaterThan(check);
    }
  });

  it('skips owner reactions the tool made and marks reaction dispatches', () => {
    const reactions = between(
      channelHandler,
      'handleReaction: async',
      'enqueueSystemEvent:'
    );
    const check = reactions.indexOf('sharedOwnerToolPostLedger().match(');
    expect(check).toBeGreaterThan(-1);
    expect(reactions.slice(check)).toMatch(
      /^[^]*?reaction: reactEmoji,[^]*?return;/
    );
    // A reply reaction carries its thread's top-level post, which a reply
    // reaction entry is recorded under.
    expect(reactions.slice(check)).toMatch(
      /^sharedOwnerToolPostLedger\(\)\.match\(\{[^}]*postId,\s*\.\.\.\(rootPostId \? \{ parentId: rootPostId \} : \{\}\),/
    );
    expect(reactions.indexOf('await handleChannelReaction(')).toBeGreaterThan(
      check
    );
    expect(reactions).toMatch(/trigger: 'reaction',\s*fromReaction: true,/);
  });
});

describe('owner tool posts in the chat firehose', () => {
  const live = between(
    chatHandler,
    'if (authorShip === botShipName) {',
    'await processMessage({'
  );

  it('returns on a ledger hit before the owner DM path', () => {
    const check = live.indexOf(
      'sharedOwnerToolPostLedger().match(\n          chatInboundPost(event, authorShip, botShipName)\n        );'
    );
    expect(check).toBeGreaterThan(-1);
    expect(live.slice(check)).toMatch(
      /^sharedOwnerToolPostLedger\(\)\.match\([^;]*\);\s*if \(ownerToolPost\) \{\s*runtime\.log\?\.\([^;]*\);\s*return;\s*\}/
    );
    expect(chatHandler.indexOf('activityReads.begin(dmReadKey')).toBeLessThan(
      chatHandler.indexOf(live)
    );
    expect(live.indexOf('isOwner(senderShip)')).toBeGreaterThan(check);
  });

  it('skips owner reactions and removals the tool made and marks reaction dispatches', () => {
    const reactions = between(
      chatHandler,
      "const dmAddReact = response?.['add-react'];",
      '// Extract reply-essay from DM thread reply'
    );
    const check = reactions.indexOf('sharedOwnerToolPostLedger().match(');
    expect(check).toBeGreaterThan(-1);
    // Checked for add-react and del-react alike (no isAdd gate), with a
    // removal record for del-react; a hit returns before approvals, the
    // reaction dispatch and the removal's system event.
    expect(reactions.slice(0, check)).toMatch(/if \(\s*reactAuthor &&\s*$/);
    expect(reactions.slice(check)).toMatch(
      /^sharedOwnerToolPostLedger\(\)\.match\(\{[^}]*receivingShip: botShipName,[^}]*\.\.\.\(isAdd\s*\?\s*\{ reaction: reactEmoji \}\s*:\s*\{ reactionRemoved: true as const \}\),\s*\}\)\s*\)\s*\{\s*runtime\.log\?\.\([^;]*\);\s*return;\s*\}/
    );
    expect(reactions.indexOf('emojiToApprovalAction(')).toBeGreaterThan(check);
    expect(reactions.indexOf('await processMessage({')).toBeGreaterThan(check);
    expect(reactions.indexOf('enqueueSystemEvent(')).toBeGreaterThan(check);
    expect(reactions).toMatch(/trigger: 'reaction',\s*fromReaction: true,/);
  });
});

describe('reaction provenance in command authorization', () => {
  it('builds no command body or authorization for reaction text', () => {
    expect(monitorSource).toMatch(
      /const commandBody = params\.fromReaction\s*\?\s*undefined\s*:\s*resolveCommandBody\(/
    );
    expect(monitorSource).toMatch(
      /const shouldComputeAuth =\s*commandBody !== undefined &&\s*core\.channel\.commands\.shouldComputeCommandAuthorized\(/
    );
  });

  it('takes every command-facing dispatch field from inboundCommandFields', () => {
    const payload = between(
      monitorSource,
      'core.channel.reply.finalizeInboundContext({',
      '\n      });\n'
    );
    expect(payload).toContain("OriginatingChannel: 'tlon'");
    expect(payload).toMatch(
      /\.\.\.\(commandBody === undefined\s*\?\s*inboundCommandFields\(\{ fromReaction: true \}\)\s*:\s*inboundCommandFields\(/
    );
    for (const field of [
      'RawBody',
      'CommandBody',
      'BodyForCommands',
      'CommandAuthorized',
      'CommandSource',
      'CommandTurn',
    ]) {
      expect(payload, field).not.toMatch(new RegExp(`\\b${field}:`));
    }
  });

  it('dispatches a reaction with an empty command allowlist', () => {
    const dispatch = between(
      monitorSource,
      '.dispatchReplyWithBufferedBlockDispatcher({',
      'replyOptions,'
    );
    expect(dispatch).toMatch(
      /cfg:\s*commandBody === undefined\s*\?\s*reactionDispatchConfig\(cfg\)\s*:\s*cfg,/
    );
  });

  it('carries reaction provenance through the retry seed and dispatch', () => {
    expect(monitorSource).toMatch(
      /fromReaction: Boolean\(params\.fromReaction\),/
    );
    expect(monitorSource).toMatch(/fromReaction: dispatch\.fromReaction,/);
  });
});

describe('restart replay', () => {
  it('replays through both live handlers, so the ledger checks apply', () => {
    const replay = between(
      monitorSource,
      'replayMissedMessages:',
      'establishActivityReadBaseline:'
    );
    expect(replay).toMatch(/await handleChannelsFirehose\(/);
    expect(replay).toMatch(/await handleChatFirehose\(/);
  });
});

describe('conversation context', () => {
  it('drops ledger hits from the channel summary history', () => {
    expect(monitorSource).toMatch(
      /loadHistory: async \(\) =>\s*withoutOwnerToolPosts\(\s*await getChannelHistory\(api, groupChannel, 50, runtime\),\s*groupChannel,\s*botShipName\s*\),/
    );
    expect(monitorSource.match(/getChannelHistory\(/g)).toHaveLength(1);
  });

  it('caches a channel reply with the parent the ledger matches it under', () => {
    // getChannelHistory serves this cache once it holds a full page, so a
    // reply cached without its parent never matches a reply edit entry.
    expect(channelHandler).toMatch(
      /const threadRootId = isThreadReply \? response\?\.post\?\.id : undefined;\s*cacheMessage\(nest, \{[^}]*\.\.\.\(threadRootId \? \{ parentId: threadRootId \} : \{\}\),/
    );
    expect(channelHandler.match(/cacheMessage\(/g)).toHaveLength(1);
  });

  it('drops ledger hits from fetched channel and thread context', () => {
    expect(monitorSource).toMatch(
      /const threadContextHistory = withoutOwnerToolPosts\(\s*await fetchThreadContextHistory\([^)]*\),\s*groupChannel,\s*botShipName\s*\);/
    );
    expect(monitorSource).toMatch(
      /const recentHistory = withoutOwnerToolPosts\(\s*await fetchChannelHistory\([^)]*\),\s*groupChannel,\s*botShipName\s*\);/
    );
    expect(
      monitorSource.match(/await fetchThreadContextHistory\(/g)
    ).toHaveLength(1);
    expect(monitorSource.match(/await fetchChannelHistory\(/g)).toHaveLength(1);
  });
});

describe('onboarding history scans', () => {
  it('select owner requests through the ledger-aware filter', () => {
    expect(onboardingSource.match(/ownerRequestEntries\(/g)).toHaveLength(3);
    expect(onboardingSource).not.toMatch(
      /\.filter\(\(entry\) => entry\.author === context\.ownerShip && entry\.blob\)/
    );
  });
});
