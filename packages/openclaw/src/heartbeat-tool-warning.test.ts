import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isHeartbeatToolFailureWarning,
  noteAgentTurnEnd,
  noteAgentTurnStart,
  resetHeartbeatToolWarningStateForTest,
} from './heartbeat-tool-warning.js';

const SESSION = 'agent:main:main';

describe('isHeartbeatToolFailureWarning', () => {
  beforeEach(() => {
    resetHeartbeatToolWarningStateForTest();
  });

  it.each([
    '⚠️ Grep blocked',
    '⚠️ Web Search failed',
    '⚠️ Exec failed (exit 1)',
    '⚠️ Process failed (signal SIGKILL). Use /verbose full for complete output.',
    '⚠️ Read: notes/todo.md failed: ENOENT',
  ])('matches core warning %j during a heartbeat', (text) => {
    noteAgentTurnStart(SESSION, true);
    expect(isHeartbeatToolFailureWarning(SESSION, text)).toBe(true);
  });

  it.each([
    '⚠️ Your deploy failed last night; want me to retry it?',
    "⚠️ I couldn't run your scheduled task: this month's included credits are used up.",
    '⚠️ API provider returned a billing error — check your account.',
    'Grep blocked',
  ])('keeps %j', (text) => {
    noteAgentTurnStart(SESSION, true);
    expect(isHeartbeatToolFailureWarning(SESSION, text)).toBe(false);
  });

  it('keeps the warning outside a heartbeat session', () => {
    noteAgentTurnStart(SESSION, false);
    expect(isHeartbeatToolFailureWarning(SESSION, '⚠️ Grep blocked')).toBe(
      false
    );
  });

  it('covers delivery for a window after the heartbeat ends', () => {
    noteAgentTurnStart(SESSION, true, 0);
    noteAgentTurnEnd(SESSION, 1_000);
    expect(
      isHeartbeatToolFailureWarning(SESSION, '⚠️ Grep blocked', 60_999)
    ).toBe(true);
    expect(
      isHeartbeatToolFailureWarning(SESSION, '⚠️ Grep blocked', 61_000)
    ).toBe(false);
  });

  it('a later non-heartbeat turn on the session clears the mark', () => {
    noteAgentTurnStart(SESSION, true);
    noteAgentTurnStart(SESSION, false);
    expect(isHeartbeatToolFailureWarning(SESSION, '⚠️ Grep blocked')).toBe(
      false
    );
  });

  it('a mark from a separately loaded instance reaches the delivery check', async () => {
    const turn = await import('./heartbeat-tool-warning.js');
    vi.resetModules();
    const gateway = await import('./heartbeat-tool-warning.js');
    expect(gateway).not.toBe(turn);
    turn.noteAgentTurnStart(SESSION, true);
    expect(
      gateway.isHeartbeatToolFailureWarning(SESSION, '⚠️ Grep blocked')
    ).toBe(true);
  });
});
