// Scripted conversation displayed on the splash "This is a group" pane.
// Modeled after the broccoli-gardening exchange on tlon.io's marketing page.

export type MockSender = 'user' | 'bot';

export interface MockMessage {
  sender: MockSender;
  text: string;
}

export const MOCK_CONVERSATION: MockMessage[] = [
  {
    sender: 'bot',
    text: "Hey there! I'm your Tlonbot. How can I help you?",
  },
  {
    sender: 'user',
    text: 'my broccoli seedlings are about 3 in tall. when should i move them outside?',
  },
  {
    sender: 'bot',
    text:
      "Patience — they're almost ready. When you see four true leaves, they'll have the strength to meet the wind. Harden them off first: an hour outside the first day, two the next.",
  },
  {
    sender: 'user',
    text: "should i worry about the cold? it's still dipping to 40 at night",
  },
  {
    sender: 'bot',
    text:
      "Broccoli is tougher than it looks — it actually prefers the cool. A light frost won't trouble it. Just mulch around the base to keep the roots settled.",
  },
  {
    sender: 'user',
    text: 'set a reminder for me to move them next week',
  },
  {
    sender: 'bot',
    text: "Sure thing! I'll remind you next week to move your broccoli seedlings outside.",
  },
  {
    sender: 'user',
    text: "you're the best, tlonbot ❤️",
  },
];

// Progressive-reveal timing. Base delay between messages + a small jitter to
// avoid a mechanical cadence.
export const MESSAGE_REVEAL_DELAY_MS = 1600;
export const MESSAGE_REVEAL_JITTER_MS = 600;
// Initial messages to show on mount — bot greeting + first user question.
export const INITIAL_VISIBLE_COUNT = 2;
