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
    function ownerOn(accountId: string | undefined, runId: string) {
      setSessionRole(SESSION, 'owner');
      setTlonSessionSurface(SESSION, {
        kind: 'group',
        senderRole: 'owner',
        messageId: `owner/${runId}`,
      });
      noteInboundDispatching({
        sessionKeys: [SESSION],
        role: 'owner',
        ...(accountId ? { accountId } : {}),
      });
      rememberTlonSessionRunSurface(runId, SESSION, {
        senderRole: 'owner',
        ...(accountId ? { accountId } : {}),
      });
    }

    it("demotes an owner run when another account's owner message reaches its session", () => {
      ownerOn('a', 'run-a');
      expect(identity('run-a')).toBe('owner');
      ownerOn('b', 'run-b');
      expect(identity('run-a')).toBe('bot');
      expect(getRecordedRunRole('run-a')).toBe('user');
      expect(identity('run-b')).toBe('owner');
    });

    it('keeps an owner run when its own account sends another owner message', () => {
      ownerOn('a', 'run-a');
      expect(identity('run-a')).toBe('owner');
      ownerOn('a', 'run-a2');
      expect(identity('run-a')).toBe('owner');
      expect(getRecordedRunRole('run-a')).toBe('owner');
    });

    it('leaves a no-account run alone on an owner message, demotes it on a non-owner message', () => {
      ownerOn(undefined, 'run-none');
      expect(identity('run-none')).toBe('owner');
      ownerOn('a', 'run-a');
      expect(identity('run-none')).toBe('owner');
      expect(getRecordedRunRole('run-none')).toBe('owner');
      noteInboundDispatching({
        sessionKeys: [SESSION],
        role: 'user',
        accountId: 'a',
      });
      expect(identity('run-none')).toBe('bot');
      expect(getRecordedRunRole('run-none')).toBe('user');
    });

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
    /** An owner run recorded on `accountId` (none when undefined). */
    function ownerRun(
      runId: string,
      sessionKey: string,
      accountId: string | undefined
    ) {
      setSessionRole(sessionKey, 'owner');
      setTlonSessionSurface(sessionKey, {
        kind: 'group',
        senderRole: 'owner',
        messageId: `owner/${runId}`,
      });
      rememberTlonSessionRunSurface(runId, sessionKey, {
        senderRole: 'owner',
        ...(accountId ? { accountId } : {}),
      });
      expect(identity(runId, sessionKey)).toBe('owner');
    }

    it('leaves a same-account owner target alone for a same-account owner caller', () => {
      ownerRun('caller', SESSION, 'a');
      ownerRun('target', OTHER, 'a');
      noteCrossSessionSend({ sessionKey: OTHER, message: 'hi' }, 'caller');
      expect(identity('target', OTHER)).toBe('owner');
      expect(getRecordedRunRole('target')).toBe('owner');
    });

    it.each([
      ['a cross-account owner caller', 'b', 'a'],
      ['an owner caller with no recorded account', undefined, 'a'],
    ])('demotes the target for %s', (_label, callerAccount, targetAccount) => {
      ownerRun('caller', SESSION, callerAccount);
      ownerRun('target', OTHER, targetAccount);
      noteCrossSessionSend({ sessionKey: OTHER, message: 'hi' }, 'caller');
      expect(identity('target', OTHER)).toBe('bot');
      expect(getRecordedRunRole('target')).toBe('user');
    });

    it('leaves a target with no recorded account alone for an owner caller with an account', () => {
      ownerRun('caller', SESSION, 'a');
      observeRun({ runId: 'subagent', sessionKey: OTHER });
      noteCrossSessionSend({ sessionKey: OTHER, message: 'hi' }, 'caller');
      // Untouched: no veto role was recorded.
      expect(getRecordedRunRole('subagent')).toBeNull();
    });

    it.each([
      ['a non-owner caller', 'user'],
      ['an owner caller with no recorded account', undefined],
    ])('demotes a target with no recorded account for %s', (_label, kind) => {
      if (kind === 'user') inbound('user', 'caller', SESSION);
      else ownerRun('caller', SESSION, undefined);
      observeRun({ runId: 'subagent', sessionKey: OTHER });
      noteCrossSessionSend({ sessionKey: OTHER, message: 'hi' }, 'caller');
      expect(identity('subagent', OTHER)).toBe('bot');
      expect(getRecordedRunRole('subagent')).toBe('user');
    });

    it('demotes every tracked session for a label target from a cross-account owner caller', () => {
      ownerRun('caller', SESSION, 'b');
      ownerRun('target', OTHER, 'a');
      noteCrossSessionSend({ label: 'helper', message: 'hi' }, 'caller');
      expect(identity('target', OTHER)).toBe('bot');
      expect(identity('caller')).toBe('owner');
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
