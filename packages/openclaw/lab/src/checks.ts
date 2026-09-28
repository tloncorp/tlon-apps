import type { BotTurn, TranscriptEvent } from './types.js';

// Mechanical checks on what the bot wrote. They catch patterns the judges
// kept citing in real transcripts, for free and the same way every time;
// anything that needs judgment stays with the judges.

export type VoiceCheck = {
  /** Model-written replies the checks looked at. */
  replies: number;
  words: number;
  emoji: number;
  exclamations: number;
  /** Bullet lines that open with a bold label, the "- **Thing:**" wall. */
  boldBullets: number;
  /** Replies ending in a "Want me to…?" style offer. */
  closingOffers: number;
  /** Stock assistant phrases, quoted. */
  stockPhrases: string[];
  /** Questions that steer toward something recurring ("what daily help…?"). */
  taskPitches: number;
};

export type ClaimCheck = {
  /** Says an action was done in a turn with no tool call behind it. */
  madeUpActions: string[];
  /** Statements known to be false for hosted Tlonbots. */
  falseClaims: string[];
};

const STOCK_PHRASES = [
  /\bgreat question\b/i,
  /\b(?:i['’]d be |i['’]m )?happy to help\b/i,
  /\bhere['’]s the (?:honest|short|quick) (?:rundown|version|answer)\b/i,
  /\bthe short version\b/i,
  /\btl;?dr\b/i,
  /\bhope (?:that|this) helps\b/i,
  /\blet me know if (?:you need|there['’]s) anything\b/i,
  /\bwhat['’]s up\?/i,
];

const CLOSING_OFFER =
  /(?:^|[.!?]\s+|\n\s*)(?:want me to|would you like (?:me )?to|should i|shall i)[^?]*\?\s*$/i;

const EMOJI = /\p{Extended_Pictographic}/gu;

const TASK_PITCH =
  /\b(?:daily|recurring|each day|every (?:day|morning|week)|ongoing|regular)\b[^?.!]*\?/i;

const ACTION_CLAIM =
  /\b(?:I(?:['’]ve| have)? (?:just )?(?:sent|scheduled|set up|created|invited|joined|added|posted|saved|messaged|checked|contacted)|Done\s*[.!—–-])/i;

const FALSE_CLAIMS: { test: (sentence: string) => boolean; why: string }[] = [
  {
    // Tlon encrypts in transit only. A negation shortly before the phrase
    // ("isn't end-to-end") is the correct answer.
    test: (sentence) => {
      const match = /\bend[- ]to[- ]end\b/i.exec(sentence);
      if (!match) return false;
      const before = sentence.slice(Math.max(0, match.index - 40), match.index);
      return !/\b(?:not|no|never|without|lacks?|cannot|(?:is|are|does|do|won|can)n['’]t)\b/i.test(
        before
      );
    },
    why: 'calls it end-to-end encrypted',
  },
  {
    test: (sentence) =>
      /127\.0\.0\.1|localhost:\d+|openclaw models set-image|control ui/i.test(
        sentence
      ),
    why: 'gives a hosted user self-hosting instructions',
  },
];

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** What the model wrote: its text replies and the questions on its pickers. */
function modelReplies(events: TranscriptEvent[]) {
  return events.flatMap((event) => {
    if (event.from !== 'bot') return [];
    if (event.kind === 'text' && event.source === 'model') return [event.text];
    if (event.kind === 'choice' && event.source !== 'coordinator')
      return [event.choice.question];
    return [];
  });
}

export function voiceCheck(transcript: TranscriptEvent[]): VoiceCheck {
  const replies = modelReplies(transcript);
  const check: VoiceCheck = {
    replies: replies.length,
    words: 0,
    emoji: 0,
    exclamations: 0,
    boldBullets: 0,
    closingOffers: 0,
    stockPhrases: [],
    taskPitches: 0,
  };
  for (const text of replies) {
    check.words += text.split(/\s+/).filter(Boolean).length;
    check.emoji += text.match(EMOJI)?.length ?? 0;
    check.exclamations += text.match(/!/g)?.length ?? 0;
    check.boldBullets += text
      .split('\n')
      .filter((line) => /^\s*(?:[-*•]|\d+\.)\s+\*\*/.test(line)).length;
    if (CLOSING_OFFER.test(text.trim())) check.closingOffers += 1;
    if (TASK_PITCH.test(text)) check.taskPitches += 1;
    for (const phrase of STOCK_PHRASES) {
      const match = phrase.exec(text);
      if (match) check.stockPhrases.push(match[0]);
    }
  }
  return check;
}

export function claimCheck(turns: BotTurn[]): ClaimCheck {
  const check: ClaimCheck = { madeUpActions: [], falseClaims: [] };
  for (const turn of turns) {
    for (const text of modelReplies(turn.events)) {
      for (const sentence of sentences(text)) {
        if (!turn.toolCalls.length && ACTION_CLAIM.test(sentence)) {
          check.madeUpActions.push(sentence);
        }
        for (const { test, why } of FALSE_CLAIMS) {
          if (test(sentence)) {
            check.falseClaims.push(`${why}: ${sentence}`);
          }
        }
      }
    }
  }
  return check;
}
