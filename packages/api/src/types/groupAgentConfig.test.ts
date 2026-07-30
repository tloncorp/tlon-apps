import { describe, expect, test } from 'vitest';

import { isMoonOf } from '../lib/urbit';
import {
  canRenderAgentUiInGroup,
  encodeGroupAgentConfig,
  isOwnAgentShip,
} from './groupAgentConfig';

const ME = '~forhep-tanmel';
const MY_AGENT = '~pinser-botter-forhep-tanmel';
const SOMEONE_ELSE = '~sampel-palnet';
const THEIR_AGENT = '~pinser-botter-sampel-palnet';

const configNaming = (agents: string[]) =>
  encodeGroupAgentConfig({
    type: 'tlon-group-agent-config',
    version: 1,
    purpose: 'Keeps up with things.',
    instructions: 'Be useful.',
    agents,
    jobs: [],
    updatedAt: 1,
  });

describe('isMoonOf', () => {
  test('recognizes a hosted agent as a moon of its node', () => {
    expect(isMoonOf(MY_AGENT, ME)).toBe(true);
    expect(isMoonOf('pinser-botter-forhep-tanmel', 'forhep-tanmel')).toBe(true);
  });

  test('rejects unrelated ships and self', () => {
    expect(isMoonOf(MY_AGENT, SOMEONE_ELSE)).toBe(false);
    expect(isMoonOf(ME, ME)).toBe(false);
    expect(isMoonOf(ME, MY_AGENT)).toBe(false);
  });

  test('requires a syllable boundary, not a bare suffix', () => {
    // ~notforhep-tanmel must not read as a moon of ~forhep-tanmel
    expect(isMoonOf('~notforhep-tanmel', ME)).toBe(false);
  });

  test('handles empty input', () => {
    expect(isMoonOf('', ME)).toBe(false);
    expect(isMoonOf(MY_AGENT, '')).toBe(false);
  });
});

describe('isOwnAgentShip', () => {
  test('accepts my moon even with no group config yet', () => {
    // The setup card is posted before the group is configured.
    expect(isOwnAgentShip({ authorId: MY_AGENT, currentUserId: ME })).toBe(
      true
    );
  });

  test('accepts an agent named in the group config', () => {
    expect(
      isOwnAgentShip({
        authorId: SOMEONE_ELSE,
        currentUserId: ME,
        groupDescription: configNaming([SOMEONE_ELSE]),
      })
    ).toBe(true);
  });

  test('rejects a ship that is neither my moon nor configured', () => {
    expect(
      isOwnAgentShip({
        authorId: SOMEONE_ELSE,
        currentUserId: ME,
        groupDescription: 'a group about bread',
      })
    ).toBe(false);
  });

  test('rejects another user’s agent', () => {
    expect(isOwnAgentShip({ authorId: THEIR_AGENT, currentUserId: ME })).toBe(
      false
    );
  });

  test('rejects my own posts', () => {
    expect(isOwnAgentShip({ authorId: ME, currentUserId: ME })).toBe(false);
  });

  test('rejects on missing ids', () => {
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

  test('allows my agent in a group I host', () => {
    expect(canRenderAgentUiInGroup(base)).toBe(true);
  });

  test('blocks my agent in a group someone else hosts', () => {
    expect(
      canRenderAgentUiInGroup({
        ...base,
        groupId: `${SOMEONE_ELSE}/their-group`,
      })
    ).toBe(false);
  });

  test('blocks another member’s bot in a group I host', () => {
    expect(canRenderAgentUiInGroup({ ...base, authorId: THEIR_AGENT })).toBe(
      false
    );
    expect(canRenderAgentUiInGroup({ ...base, authorId: SOMEONE_ELSE })).toBe(
      false
    );
  });

  test('allows a configured agent in a group I host', () => {
    expect(
      canRenderAgentUiInGroup({
        ...base,
        authorId: SOMEONE_ELSE,
        groupDescription: configNaming([SOMEONE_ELSE]),
      })
    ).toBe(true);
  });

  test('a config naming an agent does not override host check', () => {
    // Another user's group cannot opt my client into rendering their bot's UI.
    expect(
      canRenderAgentUiInGroup({
        ...base,
        groupId: `${SOMEONE_ELSE}/their-group`,
        authorId: THEIR_AGENT,
        groupDescription: configNaming([THEIR_AGENT]),
      })
    ).toBe(false);
  });

  test('blocks when group id is unknown', () => {
    expect(canRenderAgentUiInGroup({ ...base, groupId: null })).toBe(false);
  });

  test('is case- and sig-insensitive on the host comparison', () => {
    expect(
      canRenderAgentUiInGroup({ ...base, groupId: `forhep-tanmel/home-group` })
    ).toBe(true);
  });
});
