import { describe, expect, it } from 'vitest';

import {
  TLON_CHAT_PROGRESS_SYSTEM_CONTEXT,
  buildTlonChatProgressSystemContext,
  buildTlonChatProgressTurnContext,
  isClearlyMultiActionTlonRequest,
  shouldInjectTlonChatProgress,
} from './chat-progress-guidance.js';

describe('Tlon chat progress guidance', () => {
  it('defines the public task-plan contract for Tlon turns', () => {
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain('2–6');
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain('MUST');
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain('user-facing');
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain('update_plan');
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'before commentary or tools for the next step'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'never mark unperformed work completed'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'Never collapse that plan to only the question'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'Asking the question does not complete the confirmation/input step'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'call tlon_request_input with the exact required question'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'Never call tlon_request_input for banter'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'never invent a confirmation turn'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'omit the resolved gate'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'Never run the tlon CLI through Bash or exec'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain(
      'Plan only the outcomes the user requested'
    );
    expect(TLON_CHAT_PROGRESS_SYSTEM_CONTEXT).toContain('narrow mobile chat');
  });

  it('injects the contract only for Tlon-originated turns', () => {
    expect(shouldInjectTlonChatProgress({ messageProvider: 'tlon' })).toBe(
      true
    );
    expect(shouldInjectTlonChatProgress({ channelId: 'TLON' })).toBe(true);
    expect(shouldInjectTlonChatProgress({ messageProvider: 'discord' })).toBe(
      false
    );
    expect(shouldInjectTlonChatProgress({})).toBe(false);
  });

  it('makes the first plan call explicit for clearly multi-action requests', () => {
    const prompt =
      'Check Madrid and Dublin, compare rain, then recommend one for lunch.';

    expect(isClearlyMultiActionTlonRequest(prompt)).toBe(true);
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'Before doing anything else, call update_plan'
    );
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'At every step boundary, update the plan'
    );
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'leave it in progress until the user supplies the input'
    );
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'use the registered tlon tool'
    );
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'Include only outcomes the user requested'
    );
  });

  it('keeps genuinely simple requests on the adaptive path', () => {
    const prompt = 'What time is it in Lisbon?';

    expect(isClearlyMultiActionTlonRequest(prompt)).toBe(false);
    expect(buildTlonChatProgressSystemContext()).toBe(
      TLON_CHAT_PROGRESS_SYSTEM_CONTEXT
    );
    expect(buildTlonChatProgressTurnContext(prompt)).toBeUndefined();
  });

  it('treats a direct multi-action imperative as authorization to start', () => {
    const context = buildTlonChatProgressTurnContext(
      'Create a cows group, add a gallery, then share the reference.'
    );

    expect(context).toContain('already authorizes the ordinary actions');
    expect(context).toContain('do not invent a confirmation turn');
  });

  it('requires a durable multi-step plan when work pauses for user input', () => {
    const prompt =
      'Ask me to confirm the exact group name first, and leave the remaining creation work not started until I answer.';

    expect(isClearlyMultiActionTlonRequest(prompt)).toBe(true);
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'never publish only the question'
    );
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'all future steps pending'
    );
    expect(buildTlonChatProgressTurnContext(prompt)).toContain(
      'call tlon_request_input with the exact question'
    );
  });
});
