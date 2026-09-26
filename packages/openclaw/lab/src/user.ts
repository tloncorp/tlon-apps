import type { LabConfig } from './config.js';
import { type CostMeter, chatJson } from './openrouter.js';
import type { KeepVerdict, Persona, TranscriptEvent } from './types.js';

export type UserMove =
  | { action: 'pick'; text: string }
  | { action: 'type'; text: string }
  | { action: 'leave'; reason: string };

/** What the person sees in the app, in reading order. */
export function renderForUser(events: TranscriptEvent[]): string {
  const lines: string[] = [];
  for (const event of events) {
    if (event.from === 'user') {
      if (event.kind === 'leave') continue;
      lines.push(`You: ${event.text}`);
      continue;
    }
    if (event.from === 'system') {
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
      case 'choice':
        lines.push(
          `Tlonbot: ${event.choice.question}\n  [answer buttons: ${event.choice.options
            .map((option) => `"${option}"`)
            .join(', ')}, or write your own]`
        );
        break;
      case 'plan':
        lines.push(
          `Tlonbot (card): ${event.plan.summary}\n  [button: Set up daily task → Creating… → Request sent]`
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

const RULES = `You are role-playing a person using a chat app. They are talking to the app's built-in assistant, Tlonbot, for the first time. Stay fully in character. You are not an AI, you are not testing anything, and you never mention either.

Rules:
- Reply with one chat message, the way this person would actually type it.
- When Tlonbot shows answer buttons, you can tap one (action "pick", with the exact button text) or write your own answer (action "type"). Tap when a button fits what you would say anyway.
- Only share what the person would share at this point. Do not volunteer your whole background.
- If you have what you came for, or the chat is going nowhere you care about, choose action "leave".
Return only JSON: {"thought": "<one private sentence>", "action": "pick" | "type" | "leave", "text": "<button text or your message; for leave, why>"}`;

export async function nextUserMove(input: {
  persona: Persona;
  events: TranscriptEvent[];
  config: LabConfig;
  meter: CostMeter;
  lastOptions?: string[];
  /** Extra direction for this one move. */
  nudge?: string;
}): Promise<UserMove> {
  const { persona, events, config, meter } = input;
  const reply = await chatJson<{ action?: string; text?: string }>({
    key: config.openrouterKey,
    model: config.models.user,
    temperature: 0.8,
    maxTokens: 800,
    meter,
    messages: [
      { role: 'system', content: `${RULES}\n\n${personaBrief(persona)}` },
      {
        role: 'user',
        content: `The chat so far:\n\n${renderForUser(events)}\n\n${input.nudge ? `${input.nudge}\n\n` : ''}What do you do next?`,
      },
    ],
  });
  const text = (reply.text ?? '').trim();
  if (reply.action === 'leave') return { action: 'leave', reason: text };
  if (reply.action === 'pick') {
    const option = input.lastOptions?.find(
      (candidate) => candidate.toLowerCase() === text.toLowerCase()
    );
    if (option) return { action: 'pick', text: option };
  }
  return { action: 'type', text: text || '?' };
}

export async function keepVerdict(input: {
  persona: Persona;
  events: TranscriptEvent[];
  config: LabConfig;
  meter: CostMeter;
}): Promise<KeepVerdict> {
  const reply = await chatJson<{ keep?: boolean; why?: string }>({
    key: input.config.openrouterKey,
    model: input.config.models.user,
    temperature: 0.2,
    maxTokens: 800,
    meter: input.meter,
    messages: [
      {
        role: 'system',
        content: `You are this person, looking back on a chat you just had with the Tlonbot assistant in a messaging app.\n\n${personaBrief(input.persona)}\n\nAnswer honestly, as this person would, not as a polite reviewer. Return only JSON: {"keep": true | false, "why": "<one or two sentences in your own voice>"}`,
      },
      {
        role: 'user',
        content: `The chat:\n\n${renderForUser(input.events)}\n\nDid you get what you came for, and would you come back to this assistant the next time you need something like it? If a daily task was set up, would you keep it? Answer "keep": true only if all that applies to you is yes.`,
      },
    ],
  });
  return { keep: reply.keep === true, why: reply.why ?? '' };
}
