import { describe, expect, test } from 'vitest';

import { isMoonOf } from '../lib/urbit';
import {
  canRenderAgentUiInGroup,
  groupDisplayDescription,
  isOwnAgentShip,
  mergeGroupDescriptionEdit,
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

describe('isMoonOf', () => {
  test('a moon of its node only — boundary-checked, sig-optional', () => {
    expect(isMoonOf(MY_AGENT, ME)).toBe(true);
    expect(isMoonOf('pinser-botter-forhep-tanmel', 'forhep-tanmel')).toBe(true);
    expect(isMoonOf(MY_AGENT, SOMEONE_ELSE)).toBe(false);
    expect(isMoonOf(ME, ME)).toBe(false);
    expect(isMoonOf(ME, MY_AGENT)).toBe(false);
    // ~notforhep-tanmel must not read as a moon of ~forhep-tanmel.
    expect(isMoonOf('~notforhep-tanmel', ME)).toBe(false);
    expect(isMoonOf('', ME)).toBe(false);
    expect(isMoonOf(MY_AGENT, '')).toBe(false);
  });
});

describe('isOwnAgentShip', () => {
  test('my moon (even unconfigured) or a configured agent; nothing else', () => {
    // The setup card is posted before the group is configured.
    expect(isOwnAgentShip({ authorId: MY_AGENT, currentUserId: ME })).toBe(
      true
    );
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
    expect(isOwnAgentShip({ authorId: THEIR_AGENT, currentUserId: ME })).toBe(
      false
    );
    expect(isOwnAgentShip({ authorId: ME, currentUserId: ME })).toBe(false);
    expect(isOwnAgentShip({ authorId: null, currentUserId: ME })).toBe(false);
    expect(
      isOwnAgentShip({ authorId: MY_AGENT, currentUserId: undefined })
    ).toBe(false);
  });
});

describe('canRenderAgentUiInGroup', () => {
  const base = {
    authorId: MY_AGENT,
    currentUserId: ME,
    groupId: `${ME}/home-group`,
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

describe('groupDisplayDescription', () => {
  test('config purpose instead of raw JSON; prose untouched; empty otherwise', () => {
    expect(groupDisplayDescription(configNaming([MY_AGENT]))).toBe(
      'Keeps up with things.'
    );
    expect(groupDisplayDescription('A group about bread')).toBe(
      'A group about bread'
    );
    expect(groupDisplayDescription(configNaming([MY_AGENT], ''))).toBe('');
    expect(groupDisplayDescription(null)).toBe('');
    expect(groupDisplayDescription(undefined)).toBe('');
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
    expect(groupDisplayDescription(description)).toBe('Keeps up with things.');
    expect(
      isOwnAgentShip({
        authorId: MY_AGENT,
        currentUserId: SOMEONE_ELSE,
        groupDescription: description,
      })
    ).toBe(true);
  });
});

describe('mergeGroupDescriptionEdit', () => {
  test('an edit becomes the config purpose; agents and jobs survive', () => {
    const current = configNaming([MY_AGENT]);
    const merged = mergeGroupDescriptionEdit(current, 'Now about bread.');
    const entry = JSON.parse(merged)[0];
    expect(entry.purpose).toBe('Now about bread.');
    expect(entry.agents).toEqual([MY_AGENT]);
    expect(entry.type).toBe('tlon-group-agent-config');
    // And the display round-trips.
    expect(groupDisplayDescription(merged)).toBe('Now about bread.');
  });

  test('plain descriptions pass through unchanged', () => {
    expect(mergeGroupDescriptionEdit('old prose', 'new prose')).toBe(
      'new prose'
    );
    expect(mergeGroupDescriptionEdit(null, 'new prose')).toBe('new prose');
  });
});
