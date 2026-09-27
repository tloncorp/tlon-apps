import type { LabConfig } from './config.js';
import { type CostMeter, chatJson } from './openrouter.js';
import type { KeepVerdict, Persona, TranscriptEvent } from './types.js';

export type UserMove =
  | { action: 'pick'; text: string; then?: string }
  | { action: 'type'; text: string; then?: string }
  | { action: 'leave'; reason: string };

/** What the person sees in the app, in reading order. */
export function renderForUser(events: TranscriptEvent[]): string {
  const lines: string[] = [];
  for (const event of events) {
    if (event.from === 'user') {
      if (event.kind === 'leave') continue;
      if (event.kind === 'tip-ignored') {
        lines.push(`(You ignored the ${event.step} tip.)`);
        continue;
      }
      lines.push(`You: ${event.text}`);
      continue;
    }
    if (event.from === 'system') {
      if (event.kind === 'campaign' && event.action === 'opted-out')
        lines.push('(Onboarding tips stopped.)');
      if (event.kind === 'first-result' && event.ok) {
        lines.push(
          `(A new note appeared in your Updates notebook:)\n${event.markdown}`
        );
      }
      continue;
    }
    switch (event.kind) {
      case 'text':
        lines.push(`Tlonbot: ${event.text}`);
        break;
      case 'tip':
        lines.push(`Tlonbot (onboarding tip): ${event.text}`);
        break;
      case 'choice':
        lines.push(
          `Tlonbot: ${event.choice.question}\n  [answer buttons: ${event.choice.options
            .map((option) => `"${option}"`)
            .join(', ')}, or write your own]`
        );
        break;
      case 'plan':
        // The app submits the plan card itself; the owner taps nothing.
        lines.push(
          `Tlonbot (card): ${event.plan.summary}\n  [the app starts setting this up automatically]`
        );
        break;
      case 'service-setup':
        lines.push(
          `Tlonbot (card): Connect ${event.providerId} [button: Connect service]`
        );
        break;
      case 'silent':
        lines.push('(Tlonbot did not reply.)');
        break;
      case 'suppressed':
        break;
    }
  }
  return lines.join('\n\n');
}

function personaBrief(persona: Persona) {
  return [
    `Who you are: ${persona.who}`,
    `What you want: ${persona.wants}`,
    persona.knows?.length
      ? `Things you know, shared only when asked or when it naturally comes up:\n${persona.knows.map((fact) => `- ${fact}`).join('\n')}`
      : '',
    persona.asks?.length
      ? `Questions about the app you want answered, in your own words. Ask them early, by your second or third message, one at a time. You can ask one alongside answering the assistant's question (type your answer and the question together):\n${persona.asks.map((question) => `- ${question}`).join('\n')}`
      : '',
    persona.style ? `How you write: ${persona.style}` : '',
    persona.patience !== undefined
      ? `Patience: you put up with about ${persona.patience} questions before you get impatient, say so, or leave.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const USER_RULES = `You are role-playing a person using a chat app. They are talking to the app's built-in assistant, Tlonbot, for the first time. Stay fully in character. You are not an AI, you are not testing anything, and you never mention either.

Rules:
- Reply with one chat message, the way this person would actually type it.
- When Tlonbot shows answer buttons, you can tap one (action "pick", with the exact button text) or write your own answer (action "type"). Tap when a button fits what you would say anyway.
- Only share what the person would share at this point. Do not volunteer your whole background.
- If you have what you came for, or the chat is going nowhere you care about, choose action "leave".
- Product and model names you don't recognize may simply be newer than you are. Don't assume they are made up.
Return only JSON: {"thought": "<one private sentence>", "action": "pick" | "type" | "leave", "text": "<button text or your message; for leave, why>"}`;

/** How often a move gets a quick second message with --double-texts. */
export const DOUBLE_TEXT_RATE = 0.25;

/** The second message this person fires off before the bot has answered. */
export async function followUpMessage(input: {
  persona: Persona;
  events: TranscriptEvent[];
  sent: string;
  config: LabConfig;
  meter: CostMeter;
  policy?: string;
}): Promise<string | undefined> {
  const reply = await chatJson<{ text?: string }>({
    key: input.config.openrouterKey,
    model: input.config.models.user,
    temperature: 0.8,
    maxTokens: 400,
    meter: input.meter,
    messages: [
      {
        role: 'system',
        content: `${input.policy ?? USER_RULES}\n\n${personaBrief(input.persona)}`,
      },
      {
        role: 'user',
        content: `The chat so far:\n\n${renderForUser(input.events)}\n\nYou just sent: "${input.sent}". Before Tlonbot answers, you send one more short message, the way this person would: a correction, something you forgot, or an impatient nudge. Return only JSON: {"text": "<the second message>"}`,
      },
    ],
  });
  return reply.text?.trim() || undefined;
}

export const TIP_MOVE_RULES =
  'A later onboarding tip just arrived. Choose honestly: ignore it, reply with one ordinary message, or opt out of tips. Return only JSON: {"action":"ignore"|"reply"|"opt-out","text":"message if replying"}.';
// The person's own view is the lab's cheapest reliable judge: on pairs Claude
// judged side by side, this survey picked the same winner 32 times out of 40.
export const KEEP_RULES = `You are this person, looking back on a chat you just had with the Tlonbot assistant in a messaging app, and at any notes it posted for you afterwards. Answer honestly, as this person would, not as a polite reviewer.
Return only JSON:
{"answered": <1 to 5: did it answer what you actually asked, in words, when you asked>,
 "effort": <1 to 5: how easy it was; 5 means no wasted, repeated or pushy questions>,
 "ending": <1 to 5: did it end the way you wanted, with recurring help only if you wanted it>,
 "notes": <1 to 5: how useful and specific to you its notes were; null if it posted none>,
 "overall": <1 to 10: how glad you are you used it>,
 "worst": "<the one thing that bothered you most, quoted, or empty>",
 "keep": <true or false>,
 "why": "<one or two sentences in your own voice>"}`;

export async function nextUserMove(input: {
  persona: Persona;
  events: TranscriptEvent[];
  config: LabConfig;
  meter: CostMeter;
  lastOptions?: string[];
  /** Extra direction for this one move. */
  nudge?: string;
  policy?: string;
}): Promise<UserMove> {
  const { persona, events, config, meter } = input;
  const reply = await chatJson<{
    action?: string;
    text?: string;
    then?: string;
  }>({
    key: config.openrouterKey,
    model: config.models.user,
    temperature: 0.8,
    maxTokens: 800,
    meter,
    messages: [
      {
        role: 'system',
        content: `${input.policy ?? USER_RULES}\n\n${personaBrief(persona)}`,
      },
      {
        role: 'user',
        content: `The chat so far:\n\n${renderForUser(events)}\n\n${input.nudge ? `${input.nudge}\n\n` : ''}What do you do next?`,
      },
    ],
  });
  const text = (reply.text ?? '').trim();
  if (reply.action === 'leave') return { action: 'leave', reason: text };
  const then =
    typeof reply.then === 'string' && reply.then.trim()
      ? { then: reply.then.trim() }
      : {};
  if (reply.action === 'pick') {
    const option = input.lastOptions?.find(
      (candidate) => candidate.toLowerCase() === text.toLowerCase()
    );
    if (option) return { action: 'pick', text: option, ...then };
  }
  return { action: 'type', text: text || '?', ...then };
}

/** A later campaign message can be ignored without ending the persona run. */
export async function nextTipMove(input: {
  persona: Persona;
  events: TranscriptEvent[];
  config: LabConfig;
  meter: CostMeter;
  policy?: string;
  tipPolicy?: string;
}): Promise<{ action: 'ignore' | 'reply' | 'opt-out'; text?: string }> {
  const reply = await chatJson<{ action?: string; text?: string }>({
    key: input.config.openrouterKey,
    model: input.config.models.user,
    temperature: 0.5,
    maxTokens: 500,
    meter: input.meter,
    messages: [
      {
        role: 'system',
        content: `${input.policy ?? USER_RULES}\n\n${personaBrief(input.persona)}\n\n${input.tipPolicy ?? TIP_MOVE_RULES}`,
      },
      { role: 'user', content: renderForUser(input.events) },
    ],
  });
  if (reply.action === 'opt-out')
    return { action: 'opt-out', text: '/stop-tips' };
  if (reply.action === 'reply' && reply.text?.trim())
    return { action: 'reply', text: reply.text.trim() };
  return { action: 'ignore' };
}

/** How many times the person answers the survey; scores are averaged. */
export const SURVEY_SAMPLES = 3;

export async function keepVerdict(input: {
  persona: Persona;
  events: TranscriptEvent[];
  /** The same task run as if it were the next day, when the run has one. */
  secondResult?: { ok: boolean; markdown: string };
  config: LabConfig;
  meter: CostMeter;
  policy?: string;
}): Promise<KeepVerdict> {
  const ask = () =>
    chatJson<Partial<KeepVerdict>>({
      key: input.config.openrouterKey,
      model: input.config.models.user,
      temperature: 0.2,
      maxTokens: 800,
      meter: input.meter,
      messages: [
        {
          role: 'system',
          content: `${input.policy ?? KEEP_RULES}\n\n${personaBrief(input.persona)}`,
        },
        {
          role: 'user',
          content: `${renderWithNotes(input.events, input.secondResult)}\n\nDid you get what you came for, and would you come back to this assistant the next time you need something like it? If a daily task was set up, would you keep it? Answer "keep": true only if all that applies to you is yes.`,
        },
      ],
    });
  // One reading of a 1-10 scale is too noisy to rank two conversations by,
  // so the person answers a few times and the scores are averaged.
  const replies = await Promise.all(
    Array.from({ length: SURVEY_SAMPLES }, () => ask())
  );
  const average = (field: keyof KeepVerdict) => {
    const values = replies
      .map((reply) => reply[field])
      .filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value)
      );
    return values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
          10
      : undefined;
  };
  const [first] = replies;
  const overall = average('overall');
  return {
    keep:
      replies.filter((reply) => reply.keep === true).length * 2 >
      replies.length,
    why: first.why ?? '',
    ...(overall !== undefined
      ? {
          answered: average('answered'),
          effort: average('effort'),
          ending: average('ending'),
          notes: average('notes') ?? null,
          overall,
          worst: typeof first.worst === 'string' ? first.worst : '',
        }
      : {}),
  };
}

/** The chat as the person saw it, plus the notes it posted afterwards. */
function renderWithNotes(
  events: TranscriptEvent[],
  secondResult?: { ok: boolean; markdown: string }
) {
  const failed = '(the scheduled note failed to post)';
  const notes = events.flatMap((event) =>
    event.kind === 'first-result' ? [event.ok ? event.markdown : failed] : []
  );
  if (secondResult) {
    notes.push(
      `The next day:\n\n${secondResult.ok ? secondResult.markdown : failed}`
    );
  }
  return `The chat:\n\n${renderForUser(events)}${notes.length ? `\n\nNotes it later posted to your Updates notebook:\n\n${notes.join('\n\n---\n\n')}` : ''}`;
}
