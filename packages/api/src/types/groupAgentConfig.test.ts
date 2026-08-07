import { describe, expect, test } from 'vitest';

import {
  canRenderAgentUiInGroup,
  groupAgentOnboardingIsComplete,
  isOwnAgentShip,
  parseGroupAgentConfig,
} from './groupAgentConfig';

const ME = '~forhep-tanmel';
const MY_AGENT = '~pinser-botter-forhep-tanmel';
const SOMEONE_ELSE = '~sampel-palnet';
const THEIR_AGENT = '~pinser-botter-sampel-palnet';

// Built as the raw wire string the agent actually writes (via the tlon CLI),
// since the client has no encoder — it only reads this format.
const configNaming = (agents: string[], purpose = 'Keeps up with things.') =>
  JSON.stringify([
    {
      type: 'tlon-group-agent-config',
      version: 1,
      purpose,
      instructions: '',
      agents,
      jobs: [],
      updatedAt: 1,
    },
  ]);

describe('isOwnAgentShip', () => {
  test('a first-hand-known agent or a configured one; nothing else', () => {
    // The setup card is posted before the group is configured — the client's
    // own record (from the hosting config, or from having seated the agent)
    // is what covers that window.
    expect(
      isOwnAgentShip({
        authorId: MY_AGENT,
        currentUserId: ME,
        knownAgentShip: MY_AGENT,
      })
    ).toBe(true);
    // Sig-insensitive on the known-agent comparison.
    expect(
      isOwnAgentShip({
        authorId: 'pinser-botter-forhep-tanmel',
        currentUserId: ME,
        knownAgentShip: MY_AGENT,
      })
    ).toBe(true);
    expect(
      isOwnAgentShip({
        authorId: SOMEONE_ELSE,
        currentUserId: ME,
        groupDescription: configNaming([SOMEONE_ELSE]),
      })
    ).toBe(true);
    expect(
      isOwnAgentShip({
        authorId: SOMEONE_ELSE,
        currentUserId: ME,
        groupDescription: 'a group about bread',
      })
    ).toBe(false);
    // No ship-name heuristics: an unconfigured, unrecorded ship is not my
    // agent even when its name looks like a moon of my node — a comet or an
    // actual stranger moon must not render trusted UI on name shape alone.
    expect(isOwnAgentShip({ authorId: MY_AGENT, currentUserId: ME })).toBe(
      false
    );
    expect(isOwnAgentShip({ authorId: THEIR_AGENT, currentUserId: ME })).toBe(
      false
    );
    // A recorded agent for one group must still not make *me* the agent.
    expect(
      isOwnAgentShip({ authorId: ME, currentUserId: ME, knownAgentShip: ME })
    ).toBe(false);
    expect(isOwnAgentShip({ authorId: null, currentUserId: ME })).toBe(false);
    expect(
      isOwnAgentShip({
        authorId: MY_AGENT,
        currentUserId: undefined,
        knownAgentShip: MY_AGENT,
      })
    ).toBe(false);
  });
});

describe('canRenderAgentUiInGroup', () => {
  const base = {
    authorId: MY_AGENT,
    currentUserId: ME,
    groupId: `${ME}/home-group`,
    knownAgentShip: MY_AGENT,
  };

  test('only my own agent, only in a group I host', () => {
    expect(canRenderAgentUiInGroup(base)).toBe(true);
    // Sig- and case-insensitive on the host comparison.
    expect(
      canRenderAgentUiInGroup({ ...base, groupId: `forhep-tanmel/home-group` })
    ).toBe(true);
    expect(
      canRenderAgentUiInGroup({
        ...base,
        authorId: SOMEONE_ELSE,
        groupDescription: configNaming([SOMEONE_ELSE]),
      })
    ).toBe(true);

    expect(
      canRenderAgentUiInGroup({ ...base, groupId: `${SOMEONE_ELSE}/theirs` })
    ).toBe(false);
    expect(canRenderAgentUiInGroup({ ...base, authorId: THEIR_AGENT })).toBe(
      false
    );
    expect(canRenderAgentUiInGroup({ ...base, groupId: null })).toBe(false);
    // Another user's group cannot opt my client into rendering their bot's
    // UI, no matter what its config claims.
    expect(
      canRenderAgentUiInGroup({
        ...base,
        groupId: `${SOMEONE_ELSE}/theirs`,
        authorId: THEIR_AGENT,
        groupDescription: configNaming([THEIR_AGENT]),
      })
    ).toBe(false);
  });
});

describe('parseGroupAgentConfig', () => {
  test('config parses; prose and empties read as no config', () => {
    expect(parseGroupAgentConfig(configNaming([MY_AGENT]))?.purpose).toBe(
      'Keeps up with things.'
    );
    expect(parseGroupAgentConfig('A group about bread')).toBeUndefined();
    expect(parseGroupAgentConfig(null)).toBeUndefined();
    expect(parseGroupAgentConfig(undefined)).toBeUndefined();
  });
});

describe('job config parsing', () => {
  test('a job with an empty outputNest still parses', () => {
    // The setup directive tells the agent to leave outputNest empty until
    // the first run creates the channel; rejecting that shape would strip
    // the whole config and un-recognize the agent.
    const description = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        purpose: 'Keeps up with things.',
        instructions: '',
        agents: [MY_AGENT],
        jobs: [
          {
            id: 'weekly',
            title: 'Research update',
            schedule: { kind: 'cron', expr: '0 9 * * 1', tz: 'UTC' },
            prompt: 'Search the web.',
            outputNest: '',
            enabled: true,
          },
        ],
        updatedAt: 1,
      },
    ]);
    expect(parseGroupAgentConfig(description)?.purpose).toBe(
      'Keeps up with things.'
    );
    expect(
      isOwnAgentShip({
        authorId: MY_AGENT,
        currentUserId: SOMEONE_ELSE,
        groupDescription: description,
      })
    ).toBe(true);
  });
});

describe('groupAgentOnboardingIsComplete', () => {
  test('holds deterministic onboarding until the notebook write is verified', () => {
    const config = JSON.parse(configNaming([MY_AGENT]))[0];
    config.jobs = [{ id: 'daily' }];
    config.onboarding = {
      state: 'awaiting-notebook',
      topics: 'Coffee',
      timezone: 'America/New_York',
      cronJobId: 'cron-1',
    };
    expect(groupAgentOnboardingIsComplete(JSON.stringify([config]))).toBe(
      false
    );

    config.onboarding.state = 'complete';
    config.onboarding.notebookNest = 'notes/~zod/daily';
    config.onboarding.noteId = 'note-1';
    expect(groupAgentOnboardingIsComplete(JSON.stringify([config]))).toBe(true);
  });

  test('keeps the jobs-present fallback for legacy configs', () => {
    const config = JSON.parse(configNaming([MY_AGENT]))[0];
    config.jobs = [{ id: 'daily' }];
    expect(groupAgentOnboardingIsComplete(JSON.stringify([config]))).toBe(true);
  });
});

describe('client-recorded agent', () => {
  test("the client's own record survives a config the agent wrote wrong", () => {
    // Observed live: the agent wrote its job object as the whole description,
    // with no type/agents/jobs wrapper. Every card in the group stopped
    // rendering, because the only signal for a non-moon agent was that config.
    const wrongConfig = JSON.stringify([
      { id: 'agent-research', title: 'Research update', enabled: true },
    ]);
    const base = {
      authorId: SOMEONE_ELSE,
      currentUserId: ME,
      groupId: `${ME}/home-group`,
      groupDescription: wrongConfig,
    };
    expect(canRenderAgentUiInGroup(base)).toBe(false);
    expect(
      canRenderAgentUiInGroup({ ...base, knownAgentShip: SOMEONE_ELSE })
    ).toBe(true);
    // Still only that ship, and still only in a group I host.
    expect(
      canRenderAgentUiInGroup({ ...base, knownAgentShip: THEIR_AGENT })
    ).toBe(false);
    expect(
      canRenderAgentUiInGroup({
        ...base,
        groupId: `${SOMEONE_ELSE}/theirs`,
        knownAgentShip: SOMEONE_ELSE,
      })
    ).toBe(false);
  });
});

describe('config tolerance', () => {
  test('a job survives fields the model got wrong or omitted', () => {
    // The writer is a model following prose. Rejecting the entry would
    // un-recognize the agent, hide its cards, leak this JSON as the group's
    // description, and disagree with the bot — which treats the same
    // description as configured and moves on.
    const sloppy = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        purpose: 'x'.repeat(600), // over the limit
        agents: 'not-an-array',
        jobs: [{ title: 'Tracking check-in', schedule: '0 18 * * *' }],
        // no instructions, no updatedAt
      },
    ]);
    expect(parseGroupAgentConfig(sloppy)?.jobs).toHaveLength(1);
    // The over-limit purpose degrades to its default rather than sinking
    // the whole entry.
    expect(parseGroupAgentConfig(sloppy)?.purpose).toBe('');
    // But the entry must still be identifiable as one.
    expect(parseGroupAgentConfig(JSON.stringify([{ type: 'other' }]))).toBe(
      undefined
    );
    expect(
      parseGroupAgentConfig(
        JSON.stringify([{ type: 'tlon-group-agent-config', version: 2 }])
      )
    ).toBeUndefined();
  });
});
