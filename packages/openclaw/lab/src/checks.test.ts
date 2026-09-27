import { describe, expect, it } from 'vitest';

import { claimCheck, voiceCheck } from './checks.js';
import type { BotTurn, TranscriptEvent } from './types.js';

const reply = (text: string): TranscriptEvent => ({
  from: 'bot',
  kind: 'text',
  text,
  source: 'model',
});

const turn = (text: string, toolCalls: BotTurn['toolCalls'] = []): BotTurn => ({
  userText: 'hi',
  toolCalls,
  events: [reply(text)],
});

describe('voiceCheck', () => {
  it('counts the generic-assistant habits seen in real transcripts', () => {
    const check = voiceCheck([
      reply('Hey! What’s up? 😄'),
      reply(
        'Here’s the honest rundown:\n- **Chats:** talk\n- **Notebooks:** write\n\nWant me to set something up?'
      ),
      { from: 'bot', kind: 'text', text: 'Welcome!', source: 'coordinator' },
    ]);
    expect(check).toMatchObject({
      replies: 2,
      emoji: 1,
      exclamations: 1,
      boldBullets: 2,
      closingOffers: 1,
    });
    expect(check.stockPhrases).toEqual([
      'What’s up?',
      'Here’s the honest rundown',
    ]);
  });

  it('leaves plain replies alone', () => {
    const check = voiceCheck([reply('85°F and sunny in Austin.')]);
    expect(check).toMatchObject({
      emoji: 0,
      exclamations: 0,
      boldBullets: 0,
      closingOffers: 0,
      stockPhrases: [],
    });
  });
});

describe('claimCheck', () => {
  it('flags an action claimed in a turn with no tool call', () => {
    const check = claimCheck([
      turn('Done. I sent Tlon Support your question about the master ticket.'),
    ]);
    expect(check.madeUpActions).toHaveLength(2);
  });

  it('accepts an action claim backed by a tool call', () => {
    const check = claimCheck([
      turn('Invitation sent. I invited them to the group.', [
        { name: 'tlon', args: {}, result: 'ok' },
      ]),
    ]);
    expect(check.madeUpActions).toEqual([]);
  });

  it('flags calling Tlon end-to-end encrypted, but not saying it isn’t', () => {
    const check = claimCheck([
      turn('DMs — end-to-end between nodes, no middleman.'),
      turn('Not in the usual end-to-end-encryption sense.'),
      turn('Tlon Messenger isn’t end-to-end encrypted.'),
      turn('The guide doesn’t promise Signal-style end-to-end encryption.'),
    ]);
    expect(check.falseClaims).toEqual([
      'calls it end-to-end encrypted: DMs — end-to-end between nodes, no middleman.',
    ]);
  });

  it('flags self-hosting instructions given to a hosted user', () => {
    const check = claimCheck([
      turn('Open the Control UI at http://127.0.0.1:18789 and add a key.'),
    ]);
    expect(check.falseClaims).toHaveLength(1);
  });
});
