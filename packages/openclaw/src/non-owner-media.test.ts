import { afterEach, describe, expect, it } from 'vitest';

import { activeTurnForbidsMedia } from './non-owner-media.js';
import { _testing as sessionRoles, setSessionRole } from './session-roles.js';
import type { SenderRole } from './session-roles.js';
import {
  _testing as turnIdentity,
  getRecordedRunRole,
  noteInboundDispatching,
  observeRun,
} from './turn-identity.js';
import { startTlonAgentTurn } from './turn-recorder.js';

const SESSION = 'agent:main:tlon:group:chat/~zod/general';

function turnFor(runId: string, senderRole: SenderRole) {
  return startTlonAgentTurn(
    {
      accountId: 'hosted',
      agentId: 'main',
      destinationKind: 'channel',
      inputMessageId: '~nec/1',
      runId,
      sessionKey: SESSION,
      ship: '~zod',
      trigger: 'channel',
      senderRole,
    },
    {
      observer: {
        recordStarted: () => undefined,
        recordTerminal: () => undefined,
      },
    }
  );
}

afterEach(() => {
  turnIdentity.clearAll();
  sessionRoles.clearAll();
});

describe('activeTurnForbidsMedia', () => {
  it('is false outside a Tlon turn', () => {
    expect(activeTurnForbidsMedia()).toBe(false);
  });

  it('is true for a non-owner sender', () => {
    expect(turnFor('media-user', 'user').run(activeTurnForbidsMedia)).toBe(
      true
    );
  });

  it("keeps an owner's in-flight turn when another member's post changes the session role", () => {
    setSessionRole(SESSION, 'owner');
    observeRun({ runId: 'media-owner', sessionKey: SESSION });
    expect(getRecordedRunRole('media-owner')).toBe('owner');
    setSessionRole(SESSION, 'user');
    expect(turnFor('media-owner', 'owner').run(activeTurnForbidsMedia)).toBe(
      false
    );
  });

  it('is true for an owner turn whose run was demoted', () => {
    setSessionRole(SESSION, 'owner');
    observeRun({ runId: 'media-demoted', sessionKey: SESSION });
    noteInboundDispatching({ sessionKeys: [SESSION], role: 'user' });
    expect(getRecordedRunRole('media-demoted')).toBe('user');
    expect(turnFor('media-demoted', 'owner').run(activeTurnForbidsMedia)).toBe(
      true
    );
  });
});
