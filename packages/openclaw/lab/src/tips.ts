import { randomUUID } from 'node:crypto';
import { createCampaign } from '../../src/monitor/campaign/runner.js';
import { DAY, CAMPAIGN_CHECK_INTERVAL_MS, VERSION, type CampaignState, type CampaignTask } from '../../src/monitor/campaign/model.js';
import { buildPersonalizationPrompt, acceptPersonalization, type TipDraft } from '../../src/monitor/campaign/personalize.js';
import { isStopTips } from '../../src/monitor/campaign/templates.js';
import type { CampaignStore } from '../../src/monitor/campaign/store.js';
import { type LabConfig, OWNER_SHIP } from './config.js';
import { chat, type CostMeter } from './openrouter.js';
import { nextTipMove } from './user.js';
import type { Persona, TranscriptEvent } from './types.js';

export function createLabCampaign(input: {
  limit: number;
  startedAt: Date;
  timezone: string;
  persona: Persona;
  config: LabConfig;
  meter: CostMeter;
  transcript: TranscriptEvent[];
  policy?: string;
  userPolicy?: string;
  tipMovePolicy?: string;
  botTurn: (text: string, context?: string) => Promise<void>;
  onHandled?: (text: string) => void;
  personalize?: (draft: TipDraft) => Promise<string | undefined>;
  tipMove?: (events: TranscriptEvent[]) => Promise<{ action: 'ignore' | 'reply' | 'opt-out'; text?: string }>;
}) {
  let virtualNow = input.startedAt.getTime();
  const owner = `${OWNER_SHIP}:lab-${randomUUID()}`;
  const states = new Map<string, CampaignState>();
  const markers = new Map<string, number>();
  const trace: { action: string; step?: string; reason?: string; at: string }[] = [];
  const tipQueue: { step: string; text: string }[] = [];
  let task: CampaignTask | undefined;
  let delivered = 0;
  const store: CampaignStore = {
    async lookup(key) {
      const state = states.get(key);
      return state ? structuredClone(state) : undefined;
    },
    async save(state) {
      states.set(state.owner, structuredClone(state));
    },
  };
  const campaign = createCampaign({
    owner,
    now: () => virtualNow,
    config: () => ({ enabled: true, enrollAfter: new Date(input.startedAt.getTime() - DAY).toISOString() }),
    store: () => store,
    task: async () => task,
    busy: () => false,
    destination: async () => OWNER_SHIP,
    context: async () => ({ topic: input.persona.wants, purpose: input.persona.who }),
    readMarker: async (key) => markers.get(key),
    personalize: async (draft: TipDraft) => {
      if (input.personalize) return input.personalize(draft);
      try {
        const result = await chat({
          key: input.config.openrouterKey,
          model: input.config.models.bot,
          messages: [{ role: 'user', content: buildPersonalizationPrompt(draft, input.policy) }],
          maxTokens: 220,
          meter: input.meter,
        });
        return acceptPersonalization(draft, result.content ?? undefined);
      } catch {
        return;
      }
    },
    send: async (text, key) => {
      if (!key) {
        input.transcript.push({ from: 'bot', kind: 'text', text, source: 'coordinator' });
        return;
      }
      markers.set(key, virtualNow);
      delivered++;
      const step = key.replace(/^campaign-v\d+-/, '');
      input.transcript.push({ from: 'bot', kind: 'tip', step, text, at: new Date(virtualNow).toISOString() });
      tipQueue.push({ step, text });
    },
    report: (event) => {
      if (event.action === 'deferred') return;
      const item = { action: event.action, ...(event.step ? { step: event.step } : {}), ...(event.reason ? { reason: event.reason } : {}), at: new Date(virtualNow).toISOString() };
      trace.push(item);
      input.transcript.push({ from: 'system', kind: 'campaign', ...item });
    },
    error: (error) => { throw error; },
  });

  async function ordinaryReply(text: string) {
    if (isStopTips(text) && await campaign.inboundInConversation(text, OWNER_SHIP)) {
      input.onHandled?.(text);
      return;
    }
    const context = await campaign.replyContext(OWNER_SHIP);
    const handled = await campaign.inboundInConversation(text, OWNER_SHIP);
    if (!handled) await input.botTurn(text, context);
    else input.onHandled?.(text);
  }

  return {
    now: () => new Date(virtualNow),
    async enroll() {
      await campaign.enroll({ isFirstGroup: true, campaignVersion: VERSION, timezone: input.timezone, introPostedAt: virtualNow });
    },
    async ownerMessage(text: string) {
      const stop = isStopTips(text);
      if (stop && await campaign.inboundInConversation(text, OWNER_SHIP)) return { handled: true };
      const context = await campaign.replyContext(OWNER_SHIP);
      const handled = await campaign.inboundInConversation(text, OWNER_SHIP);
      return { handled, context };
    },
    async taskCreated() { await campaign.taskCreated(); },
    taskResult(ok: boolean) {
      task = { id: 'job-1', name: 'First recurring task', enabled: true, ...(ok ? { deliveredAt: virtualNow } : { failedAt: virtualNow }) };
      trace.push({ action: 'task-result', reason: ok ? 'delivered' : 'failed', at: new Date(virtualNow).toISOString() });
    },
    async advanceWeek() {
      const end = input.startedAt.getTime() + 7 * DAY;
      while (virtualNow <= end && delivered < input.limit) {
        virtualNow = Math.min(virtualNow + CAMPAIGN_CHECK_INTERVAL_MS, end);
        await campaign.check();
        while (tipQueue.length) {
          const tip = tipQueue.shift()!;
          const move = input.tipMove ? await input.tipMove(input.transcript) : await nextTipMove({ persona: input.persona, events: input.transcript, config: input.config, meter: input.meter, policy: input.userPolicy, tipPolicy: input.tipMovePolicy });
          if (move.action === 'ignore') {
            input.transcript.push({ from: 'user', kind: 'tip-ignored', step: tip.step });
            trace.push({ action: 'ignored', step: tip.step, at: new Date(virtualNow).toISOString() });
          } else {
            const text = move.action === 'opt-out' ? '/stop-tips' : move.text!;
            input.transcript.push({ from: 'user', kind: 'type', text });
            await ordinaryReply(text);
          }
        }
        if (states.get(owner)?.status === 'opted-out' || states.get(owner)?.status === 'completed' || virtualNow === end) break;
      }
    },
    snapshot: () => ({ trace, final: states.get(owner) }),
  };
}
