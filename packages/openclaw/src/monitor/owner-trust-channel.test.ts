import { readFileSync } from 'node:fs';
import { compileFunction } from 'node:vm';
import { transformWithOxc } from 'vite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { engagementTokens } from '../commands-registry.js';
import {
  OWNER_PRIVILEGE_ELSEWHERE_TEXT,
  channelMessageOrigin,
  channelPrivilegeWithheldReason,
  channelRevisionState,
  isOwnerPrivilegeTrusted,
  ownerTrustSourceFor,
  resolveSenderRole,
} from '../owner-trust.js';
import { isDmNest, normalizeShip, parseChannelNest } from '../targets.js';
import { resolveDeliverParentId } from './deliver-parent.js';
import {
  isOwnerListenSlashCommand,
  isRegisteredCommandText,
  prepareInboundText,
  resolveCommandBody,
  shouldEngageInGroup,
} from './utils.js';

// Runs the monitor's real owner-trust closures and channel firehose handler
// (see joined-channels-monitor.test.ts for the technique). Everything past
// the trust decisions is stubbed: processMessage is the observation point for
// what reaches the model, and campaign/onboarding/sendChannelPost for owner
// privilege and refusals.
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

const sliceBetween = (start: string, end: string, include = false) => {
  const from = source.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  const to = source.indexOf(end, from + start.length);
  expect(to, end).toBeGreaterThan(from);
  return source.slice(from, include ? to + end.length : to);
};

type Harness = {
  handleChannelsFirehose(event: unknown): Promise<void>;
  senderRoleFor(ship: string, conversation: string, origin: string): string;
};
let makeHarness: (stubs: Record<string, unknown>) => Harness;

beforeAll(async () => {
  const closures = sliceBetween(
    'function isOwner(ship: string): boolean {',
    '\n    const processMessage = async'
  );
  const { code } = await transformWithOxc(
    `
    function createHarness(stubs) {
      with (stubs) {
        ${sliceBetween('function extractAuthorShip(', '\n}\n', true)}
        ${closures}
        ${sliceBetween(
          'const handleChannelsFirehose = async',
          '\n    const handleChatFirehose = async'
        )}
        return { handleChannelsFirehose, senderRoleFor };
      }
    }
    `,
    'owner-trust-channel.ts',
    { lang: 'ts', target: 'es2022' }
  );
  makeHarness = compileFunction(`${code}\nreturn createHarness(stubs);`, [
    'stubs',
  ]) as typeof makeHarness;
});

const OWNER = '~zod';
const BOT = '~nec';

function setup() {
  const processMessage = vi.fn(
    async (_params: Record<string, unknown>) => true
  );
  const sendChannelPost = vi.fn(
    async (_params: Record<string, unknown>) => ({})
  );
  const campaign = {
    inbound: vi.fn(async () => false),
    replyContext: vi.fn(async () => undefined),
    inboundInConversation: vi.fn(async () => false),
  };
  const handleAgentOnboardingRequest = vi.fn(
    async (_context: Record<string, unknown>) => false
  );
  const marked = new Set<string>();
  const log = vi.fn((_message: string) => {});
  const stubs: Record<string, unknown> = {
    // trust
    effectiveOwnerShip: OWNER,
    botShipName: BOT,
    normalizeShip,
    isOwnerPrivilegeTrusted,
    ownerTrustSourceFor,
    resolveSenderRole,
    channelMessageOrigin,
    channelPrivilegeWithheldReason,
    channelRevisionState,
    OWNER_PRIVILEGE_ELSEWHERE_TEXT,
    // handler plumbing
    joinedChannels: { observe: () => 'unchanged' },
    watchedChannels: new Set<string>(),
    unwatchedByLeave: new Set<string>(),
    clearAgentOnboardingRetry: () => {},
    rewatchAfterRejoin: () => {},
    onboardingCatchUp: { reconcile: async () => true },
    runtime: {
      log,
      error: (message: string) => {
        throw new Error(message);
      },
    },
    processedTracker: {
      mark: (id: string) => (marked.has(id) ? false : (marked.add(id), true)),
    },
    channelToGroup: new Map<string, string>(),
    refreshChannelGroups: async () => {},
    activityReads: { begin: () => () => {} },
    channelReadKey: (nest: string) => nest,
    prepareInboundText,
    cacheMessage: () => {},
    sharedOwnerToolPostLedger: () => ({ match: () => undefined }),
    channelInboundPost: () => ({}),
    knownBotShips: new Set<string>(),
    campaign,
    isStopTips: () => false,
    isDmNest,
    api: {},
    opts: {},
    account: { accountId: 'test' },
    getBotProfile: () => undefined,
    handleAgentOnboardingRequest,
    trackOnboardingStep: () => () => {},
    markBootstrapComplete: async () => {},
    enrollCampaign: async () => {},
    computingPresence: { refreshRun: () => {}, stopRun: () => {} },
    scheduleAgentOnboardingRetry: () => {},
    parseChannelNest,
    isOwnerListenSlashCommand,
    isRegisteredCommandText,
    engagementTokens,
    shouldEngageInGroup,
    participatedThreads: new Set<string>(),
    effectiveOwnerListenEnabled: true,
    effectiveOwnerListenDisabled: new Set<string>(),
    consecutiveBotMessages: new Map<string, number>(),
    maxBotResponses: 0,
    cfg: {},
    currentSettings: {},
    resolveChannelAuthorization: () => ({ mode: 'open', allowedShips: [] }),
    isChannelRestricted: () => false,
    resolveCommandBody,
    resolveDeliverParentId,
    sendChannelPost,
    markdownToStory: (text: string) => text,
    withCampaignContext: (_context: unknown, text: string) => text,
    resolveCitedContent: async () => undefined,
    processMessage,
    botNickname: null,
  };
  const harness = makeHarness(stubs);
  return {
    harness,
    stubs,
    processMessage,
    sendChannelPost,
    campaign,
    handleAgentOnboardingRequest,
    log,
  };
}

const withheldLogs = (log: ReturnType<typeof vi.fn>) =>
  log.mock.calls
    .map(([message]) => String(message))
    .filter((message) => message.includes('runs without owner privilege'));

let seq = 0;
function post(
  nest: string,
  author: string,
  text: string,
  options: { revision?: string; reply?: boolean } = {}
) {
  const id = `170.${++seq}`;
  const essay = {
    author,
    sent: 1_000,
    content: [{ inline: [text] }],
  };
  const set = {
    seal: { id },
    ...(options.revision === undefined ? {} : { revision: options.revision }),
  };
  return {
    nest,
    response: {
      post: options.reply
        ? {
            id: '170.1',
            'r-post': {
              reply: {
                id,
                'r-reply': { set: { ...set, 'reply-essay': essay } },
              },
            },
          }
        : { id, 'r-post': { set: { ...set, essay } } },
    },
  };
}

const ownerHosted = 'chat/~zod/general';
const botHosted = 'chat/~nec/general';
const foreign = 'chat/~bus/general';

describe('senderRoleFor (real monitor closure)', () => {
  it.each([
    [OWNER, OWNER, 'create', 'owner'],
    ['~bus', '~bus', 'create', 'user'],
    [OWNER, ownerHosted, 'create', 'owner'],
    [OWNER, botHosted, 'create', 'owner'],
    [OWNER, foreign, 'create', 'user'],
    [OWNER, botHosted, 'edit', 'user'],
    [OWNER, ownerHosted, 'edit', 'user'],
    ['~bus', ownerHosted, 'create', 'user'],
  ])('%s in %s (%s) → %s', (ship, conversation, origin, role) => {
    const { harness } = setup();
    expect(harness.senderRoleFor(ship, conversation, origin)).toBe(role);
  });
});

describe('channel firehose owner trust (real handler)', () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });
  const mention = `${BOT} hello there`;

  it('dispatches a new owner post in an owner- or bot-hosted channel with owner privilege', async () => {
    for (const nest of [ownerHosted, botHosted]) {
      await env.harness.handleChannelsFirehose(
        post(nest, OWNER, mention, { revision: '0' })
      );
    }
    expect(env.processMessage).toHaveBeenCalledTimes(2);
    for (const [params] of env.processMessage.mock.calls) {
      expect(params).toMatchObject({
        senderShip: OWNER,
        messageOrigin: 'create',
      });
    }
    expect(env.campaign.replyContext).toHaveBeenCalledTimes(2);
    expect(env.handleAgentOnboardingRequest.mock.calls[0][0].ownerShip).toBe(
      OWNER
    );
  });

  it('dispatches a foreign-hosted owner post without owner privilege, past the allowlist', async () => {
    env.stubs.resolveChannelAuthorization = () => ({
      mode: 'restricted',
      allowedShips: [],
    });
    env.stubs.isChannelRestricted = () => true;
    env = { ...env, harness: makeHarness(env.stubs) };
    await env.harness.handleChannelsFirehose(
      post(foreign, OWNER, mention, { revision: '0' })
    );
    expect(env.processMessage).toHaveBeenCalledOnce();
    expect(env.processMessage.mock.calls[0][0]).toMatchObject({
      senderShip: OWNER,
      channelNest: foreign,
    });
    expect(env.campaign.replyContext).not.toHaveBeenCalled();
    expect(env.campaign.inbound).not.toHaveBeenCalled();
    expect(env.handleAgentOnboardingRequest.mock.calls[0][0].ownerShip).toBe(
      null
    );
    expect(env.sendChannelPost).not.toHaveBeenCalled();
    expect(withheldLogs(env.log)).toEqual([
      `[tlon] Owner-attributed message in ${foreign} runs without owner privilege: host is neither the owner nor this bot`,
    ]);
  });

  it('treats an owner-attributed edited reply in a bot-hosted channel as an edit', async () => {
    await env.harness.handleChannelsFirehose(
      post(botHosted, OWNER, mention, { revision: '1', reply: true })
    );
    expect(env.processMessage).toHaveBeenCalledOnce();
    expect(env.processMessage.mock.calls[0][0]).toMatchObject({
      senderShip: OWNER,
      messageOrigin: 'edit',
    });
    expect(env.campaign.replyContext).not.toHaveBeenCalled();
    expect(env.handleAgentOnboardingRequest.mock.calls[0][0].ownerShip).toBe(
      null
    );
    expect(withheldLogs(env.log)).toEqual([
      `[tlon] Owner-attributed message in ${botHosted} runs without owner privilege: edit`,
    ]);
  });

  it('treats a post without a revision as an edit and logs it as a missing revision', async () => {
    await env.harness.handleChannelsFirehose(post(botHosted, OWNER, mention));
    expect(env.processMessage.mock.calls[0][0]).toMatchObject({
      messageOrigin: 'edit',
    });
    expect(withheldLogs(env.log)).toEqual([
      `[tlon] Owner-attributed message in ${botHosted} runs without owner privilege: missing revision`,
    ]);
  });

  it('logs nothing about withheld privilege for a trusted owner post', async () => {
    await env.harness.handleChannelsFirehose(
      post(ownerHosted, OWNER, mention, { revision: '0' })
    );
    expect(withheldLogs(env.log)).toEqual([]);
  });

  it('refuses an owner command where owner privilege is withheld', async () => {
    await env.harness.handleChannelsFirehose(
      post(foreign, OWNER, '/owner-listen on', { revision: '0' })
    );
    await env.harness.handleChannelsFirehose(
      post(botHosted, OWNER, `${BOT} /tlon-version`, {
        revision: '2',
        reply: true,
      })
    );
    expect(env.processMessage).not.toHaveBeenCalled();
    expect(env.sendChannelPost).toHaveBeenCalledTimes(2);
    for (const [params] of env.sendChannelPost.mock.calls) {
      expect(params.story).toBe(OWNER_PRIVILEGE_ELSEWHERE_TEXT);
    }
  });

  it.each([
    `${BOT} What does /etc/hosts do?`,
    `${BOT} Explain the !important CSS rule`,
  ])(
    'passes ordinary owner text to the model as a user turn: %s',
    async (text) => {
      await env.harness.handleChannelsFirehose(
        post(foreign, OWNER, text, { revision: '0' })
      );
      expect(env.sendChannelPost).not.toHaveBeenCalled();
      expect(env.processMessage).toHaveBeenCalledOnce();
    }
  );

  it('does not refuse an owner command where owner privilege is trusted', async () => {
    await env.harness.handleChannelsFirehose(
      post(ownerHosted, OWNER, `${BOT} /tlon-version`, { revision: '0' })
    );
    expect(env.sendChannelPost).not.toHaveBeenCalled();
    expect(env.processMessage).toHaveBeenCalledOnce();
  });
});
