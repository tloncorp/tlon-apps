import { expect, test } from 'vitest';
import { createLabCampaign } from './tips.js';
import { renderForJudge } from './judge.js';
import { renderForUser } from './user.js';
import type { LabConfig } from './config.js';
import type { Persona, TranscriptEvent } from './types.js';

const startedAt = new Date('2026-09-21T14:00:00.000Z');
const persona: Persona = { id: 'test', who: 'A curious owner', wants: 'Useful help', expectPlan: 'either', timezone: 'America/New_York' };
const config: LabConfig = { tlonbotDir: '', openrouterKey: '', search: false, models: { bot: 'b', user: 'u', judge: 'j' } };

function harness(limit: number, move: 'ignore' | 'reply' | 'opt-out') {
  const transcript: TranscriptEvent[] = [];
  const replies: { text: string; context?: string }[] = [];
  const campaign = createLabCampaign({
    limit, startedAt, timezone: persona.timezone!, persona, config, meter: { usd: 0 }, transcript,
    personalize: async () => undefined,
    tipMove: async () => ({ action: move, text: move === 'reply' ? 'Tell me more about that' : undefined }),
    botTurn: async (text, context) => { replies.push({ text, context }); },
  });
  return { campaign, transcript, replies };
}

test('real campaign sends task feedback, and reply context is read before inbound', async () => {
  const { campaign, transcript, replies } = harness(2, 'reply');
  await campaign.enroll();
  await campaign.ownerMessage('I want a daily reminder');
  await campaign.taskCreated();
  campaign.taskResult(true);
  await campaign.advanceWeek();
  const snapshot = campaign.snapshot();
  expect(snapshot.trace.some((event) => event.action === 'task-result' && event.reason === 'delivered')).toBe(true);
  expect(snapshot.final?.sent[0].step).toBe('task-feedback');
  expect(replies[0].context).toContain('Your most recent onboarding tip');
  expect(snapshot.trace.some((event) => event.action === 'reply')).toBe(true);
  expect(renderForUser(transcript)).toContain('onboarding tip');
  expect(renderForJudge({ transcript, turns: [], secondResult: undefined } as never)).toContain('BOT onboarding tip');
});

test('ignored tips are visible and the production unanswered rule skips later slots', async () => {
  const { campaign, transcript } = harness(5, 'ignore');
  await campaign.enroll();
  await campaign.advanceWeek();
  const snapshot = campaign.snapshot();
  expect(snapshot.trace.some((event) => event.action === 'ignored')).toBe(true);
  expect(snapshot.trace.some((event) => event.action === 'skipped' && event.reason === 'unanswered')).toBe(true);
  expect(transcript.some((event) => event.kind === 'tip-ignored')).toBe(true);
});

test('opt-out stops later tips and uses production confirmation', async () => {
  const { campaign, transcript } = harness(5, 'opt-out');
  await campaign.enroll();
  await campaign.advanceWeek();
  expect(campaign.snapshot().final?.status).toBe('opted-out');
  expect(campaign.snapshot().final?.sent).toHaveLength(1);
  expect(transcript.some((event) => event.kind === 'text' && event.text.includes('stopped the onboarding tips'))).toBe(true);
});

test('real production policy never sends more than five tips', async () => {
  const { campaign } = harness(5, 'reply');
  await campaign.enroll();
  await campaign.advanceWeek();
  expect(campaign.snapshot().final?.sent).toHaveLength(5);
  expect(campaign.snapshot().trace.filter((event) => event.action === 'sent')).toHaveLength(5);
});
