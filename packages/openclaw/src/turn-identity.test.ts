import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _testing as boundaryTesting,
  rememberTlonSessionRunSurface,
  setTlonSessionSurface,
} from './onboarding-tool-boundary.js';
import { _testing as rolesTesting, setSessionRole } from './session-roles.js';
import {
  RUN_ACTIVE_TTL_MS,
  RUN_TOMBSTONE_TTL_MS,
  _testing,
  canonicalSessionKey,
  getRecordedRunRole,
  noteCrossSessionSend,
  noteInboundDispatching,
  observeRun,
  resolveTurnIdentity,
} from './turn-identity.js';

const SESSION = 'agent:main:tlon:group:chat/~h/general';
const THREAD = `${SESSION}:thread:170.1`;
const OTHER = 'agent:main:tlon:group:chat/~h/other';
const MINUTE = 60 * 1000;

/** An inbound Tlon message as the monitor records it, before dispatch. */
function inbound(role: 'owner' | 'user', runId: string, sessionKey = SESSION) {
  setSessionRole(sessionKey, role);
  setTlonSessionSurface(sessionKey, {
    kind: 'group',
    senderRole: role,
    messageId: `${role}/${runId}`,
  });
  noteInboundDispatching({ sessionKeys: [sessionKey], role });
  rememberTlonSessionRunSurface(runId, sessionKey, { senderRole: role });
}

const identity = (runId: string, sessionKey = SESSION) =>
  resolveTurnIdentity({ runId, sessionKey });

describe('turn identity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    _testing.clearAll();
    boundaryTesting.clearAll();
    rolesTesting.clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
    _testing.clearAll();
    boundaryTesting.clearAll();
    rolesTesting.clearAll();
  });

  describe('classification', () => {
    it('acts as the owner for a run answering an owner message', () => {
      inbound('owner', 'run-1');
      expect(identity('run-1')).toBe('owner');
      expect(getRecordedRunRole('run-1')).toBe('owner');
    });

    it('acts as the bot for a run answering a non-owner message', () => {
      inbound('user', 'run-1');
      expect(identity('run-1')).toBe('bot');
      expect(getRecordedRunRole('run-1')).toBe('user');
    });

    it("acts as the bot for the owner's queued follow-up (no snapshot)", () => {
      inbound('owner', 'run-1');
      expect(identity('follow-1')).toBe('bot');
      // The veto role is the session's role at first sight.
      expect(getRecordedRunRole('follow-1')).toBe('owner');
    });

    it('acts as the bot without a runId', () => {
      expect(resolveTurnIdentity({ sessionKey: SESSION })).toBe('bot');
    });

    it('keeps the first decision when a snapshot appears later', () => {
      observeRun({ runId: 'run-1', sessionKey: SESSION });
      inbound('owner', 'run-1');
      expect(identity('run-1')).toBe('bot');
    });
  });

  describe('demotion', () => {
    it('demotes an owner run when a non-owner message reaches its session', () => {
      inbound('owner', 'run-1');
      expect(identity('run-1')).toBe('owner');
      inbound('user', 'run-2');
      inbound('owner', 'run-3');
      expect(identity('run-1')).toBe('bot');
      expect(identity('run-3')).toBe('owner');
      expect(getRecordedRunRole('run-1')).toBe('user');
      expect(getRecordedRunRole('run-3')).toBe('owner');
    });

    it('demotes an owner run not yet seen by any hook', () => {
      inbound('owner', 'run-1');
      inbound('user', 'run-2');
      expect(identity('run-1')).toBe('bot');
    });

    it('does not demote runs on other sessions', () => {
      inbound('owner', 'run-1');
      inbound('user', 'run-2', OTHER);
      expect(identity('run-1')).toBe('owner');
    });

    it('applies thread messages to the parent session and back', () => {
      expect(canonicalSessionKey(THREAD)).toBe(SESSION);
      inbound('owner', 'run-1');
      inbound('owner', 'run-2', THREAD);
      inbound('user', 'run-3', THREAD);
      expect(identity('run-1')).toBe('bot');
      expect(identity('run-2', THREAD)).toBe('bot');
    });

    it('never promotes a demoted run', () => {
      inbound('owner', 'run-1');
      inbound('user', 'run-2');
      inbound('owner', 'run-1');
      expect(identity('run-1')).toBe('bot');
    });
  });

  describe('lifetime', () => {
    it('keeps an active owner run the owner past an hour while it is bumped', () => {
      inbound('owner', 'run-1');
      for (let step = 0; step < 4; step += 1) {
        vi.advanceTimersByTime(30 * MINUTE);
        expect(identity('run-1')).toBe('owner');
      }
    });

    it('tombstones a run quiet for an hour as a vetoed bot turn', () => {
      inbound('owner', 'owner-run');
      observeRun({ runId: 'owner-run', sessionKey: SESSION });
      inbound('user', 'user-run', OTHER);
      observeRun({ runId: 'user-run', sessionKey: OTHER });
      vi.advanceTimersByTime(RUN_ACTIVE_TTL_MS + MINUTE);
      inbound('owner', 'owner-run');
      expect(identity('owner-run')).toBe('bot');
      expect(getRecordedRunRole('owner-run')).toBe('user');
      expect(getRecordedRunRole('user-run')).toBe('user');
      expect(identity('user-run', OTHER)).toBe('bot');
    });

    it('keeps tombstones for seven days, then drops them', () => {
      inbound('owner', 'run-1');
      observeRun({ runId: 'run-1', sessionKey: SESSION });
      vi.advanceTimersByTime(RUN_ACTIVE_TTL_MS + MINUTE);
      observeRun({ runId: 'probe' });
      expect(_testing.sizes()).toEqual({ active: 1, tombstones: 1 });
      vi.advanceTimersByTime(RUN_TOMBSTONE_TTL_MS);
      observeRun({ runId: 'probe-2' });
      expect(getRecordedRunRole('run-1')).toBeUndefined();
    });

    it('sweeps only expired entries, oldest first', () => {
      for (let index = 0; index < 5; index += 1) {
        observeRun({ runId: `run-${index}` });
        vi.advanceTimersByTime(20 * MINUTE);
      }
      // At 100 min, run-0..run-2 have been quiet for an hour or more.
      observeRun({ runId: 'run-4' });
      expect(_testing.sizes()).toEqual({ active: 2, tombstones: 3 });
    });
  });

  describe('sessions_send', () => {
    it("demotes nothing for an owner-directed caller's own sessions_send", () => {
      inbound('owner', 'owner-caller');
      inbound('owner', 'run-2', OTHER);
      expect(identity('owner-caller')).toBe('owner');
      noteCrossSessionSend({ label: 'helper', message: 'hi' }, 'owner-caller');
      expect(identity('owner-caller')).toBe('owner');
      expect(identity('run-2', OTHER)).toBe('owner');
    });

    it.each([
      ['a non-owner caller', 'user-caller'],
      ['a roleless caller', 'roleless-caller'],
      ['an unseen caller', 'never-seen'],
    ])('demotes every tracked session for %s', (_label, caller) => {
      inbound('user', 'user-caller', 'agent:main:tlon:direct:~mug');
      identity('user-caller', 'agent:main:tlon:direct:~mug');
      observeRun({
        runId: 'roleless-caller',
        sessionKey: 'agent:main:subagent:x',
      });
      inbound('owner', 'run-1');
      inbound('owner', 'run-2', OTHER);
      noteCrossSessionSend({ label: 'helper', message: 'hi' }, caller);
      expect(identity('run-1')).toBe('bot');
      expect(identity('run-2', OTHER)).toBe('bot');
      expect(getRecordedRunRole('run-1')).toBe('user');
    });

    it('demotes owner runs on a tracked target session only', () => {
      inbound('owner', 'run-1');
      inbound('owner', 'run-2', OTHER);
      noteCrossSessionSend({ sessionKey: SESSION, message: 'hi' });
      expect(identity('run-1')).toBe('bot');
      expect(identity('run-2', OTHER)).toBe('owner');
    });

    it.each([
      [{ label: 'main' }],
      [{ sessionKey: 'current' }],
      [{ sessionKey: '6f0c2a1e-session-id' }],
      [{ agentId: 'main' }],
    ])('demotes every owner run for an unresolved target %o', (params) => {
      inbound('owner', 'run-1');
      inbound('owner', 'run-2', OTHER);
      noteCrossSessionSend(params);
      expect(identity('run-1')).toBe('bot');
      expect(identity('run-2', OTHER)).toBe('bot');
    });
  });
});
