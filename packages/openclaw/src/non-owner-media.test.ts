import { afterEach, describe, expect, it } from 'vitest';

import {
  activeTurnMediaGate,
  isNonOwnerMediaAllowed,
} from './non-owner-media.js';
import { _testing as sessionRoles, setSessionRole } from './session-roles.js';
import type { SenderRole } from './session-roles.js';
import {
  _testing as turnIdentity,
  getRecordedRunRole,
  noteInboundDispatching,
  observeRun,
} from './turn-identity.js';
import { startTlonAgentTurn } from './turn-recorder.js';

const cfg = {
  channels: {
    tlon: {
      url: 'https://Zod.Tlon.Network.',
      accounts: { second: { url: 'nec.example.net:8443' } },
    },
  },
} as never;

describe('isNonOwnerMediaAllowed', () => {
  it.each([
    'https://example.com/x.png',
    '  https://example.com/x.png  ',
    'HTTPS://EXAMPLE.COM/x.png',
    'https://cdn.example.org:8443/a/b.jpg?w=1#frag',
    'https://xn--bcher-kva.example/x.png',
    'https://bücher.example/x.png',
  ])('allows %s', (ref) => {
    expect(isNonOwnerMediaAllowed(ref, { cfg })).toBe(true);
  });

  it.each([
    'http://example.com/x.png',
    'data:image/png;base64,iVBORw0KGgo=',
    'file:///etc/passwd',
    '/workspace/x.png',
    '~/x.png',
    './x.png',
    'x.png',
    'MEDIA: https://example.com/x.png',
    'https:example.com/x.png',
    'https:/example.com/x.png',
    'https:///example.com/x.png',
    'https://u:p@example.com/x.png',
    'https://u@example.com/x.png',
    'https://@example.com/x.png',
    'https://localhost/x.png',
    'https://localhost./x.png',
    'https://app.localhost/x.png',
    'https://127.0.0.1/x.png',
    'https://2130706433/x.png',
    'https://0x7f.1/x.png',
    'https://10.0.0.5/x.png',
    'https://[::1]/x.png',
    'https://[::ffff:127.0.0.1]/x.png',
    'https://printer.local/x.png',
    'https://api.cluster.local/x.png',
    'https://metadata.google.internal/x.png',
    'https://foo.svc/x.png',
    'https://FOO.SVC./x.png',
    'https://zod-0/x.png',
    'https://zod.tlon.network/x.png',
    'https://ZOD.tlon.network./x.png',
    'https://zod.tlon.network:443/~/scry/x.png',
    'https://nec.example.net/x.png',
  ])('refuses %s', (ref) => {
    expect(isNonOwnerMediaAllowed(ref, { cfg })).toBe(false);
  });

  it('refuses everything without a config', () => {
    expect(
      isNonOwnerMediaAllowed('https://example.com/x.png', { cfg: undefined })
    ).toBe(false);
  });
});

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

// The turn's gate refuses media that fails the non-owner rule only inside a
// non-owner turn.
function forbidsMedia(): boolean {
  return !activeTurnMediaGate({ cfg })('/x.png');
}

describe('activeTurnMediaGate', () => {
  it('is false outside a Tlon turn', () => {
    expect(forbidsMedia()).toBe(false);
  });

  it('is true for a non-owner sender', () => {
    expect(turnFor('media-user', 'user').run(forbidsMedia)).toBe(true);
  });

  it("keeps an owner's in-flight turn when another member's post changes the session role", () => {
    setSessionRole(SESSION, 'owner');
    observeRun({ runId: 'media-owner', sessionKey: SESSION });
    expect(getRecordedRunRole('media-owner')).toBe('owner');
    setSessionRole(SESSION, 'user');
    expect(turnFor('media-owner', 'owner').run(forbidsMedia)).toBe(false);
  });

  it('is true for an owner turn whose run was demoted', () => {
    setSessionRole(SESSION, 'owner');
    observeRun({ runId: 'media-demoted', sessionKey: SESSION });
    noteInboundDispatching({ sessionKeys: [SESSION], role: 'user' });
    expect(getRecordedRunRole('media-demoted')).toBe('user');
    expect(turnFor('media-demoted', 'owner').run(forbidsMedia)).toBe(true);
  });
});
