// Scripted conversation displayed on the splash "This is a group" pane.
// Modeled after the broccoli-gardening exchange on tlon.io's marketing page,
// with a second group member joining in.

export type MockSender = 'user' | 'bot' | 'friend';

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
    sender: 'friend',
    text: 'ooh piggybacking — can I plant my tomatoes out yet? nights are still chilly here',
  },
  {
    sender: 'bot',
    text:
      'Tomatoes are fussier than broccoli — they want warm soil, 60°F and up. Give it another week or two, or cover the bed with black plastic to speed things up.',
  },
  {
    sender: 'user',
    text: 'set a reminder for me to move the broccoli next week',
  },
  {
    sender: 'bot',
    text: "Sure thing! I'll remind you next week to move your broccoli seedlings outside.",
  },
  {
    sender: 'friend',
    text: "thanks tlonbot 🙌",
  },
];

// Progressive-reveal timing. Base delay between messages + a small jitter to
// avoid a mechanical cadence.
export const MESSAGE_REVEAL_DELAY_MS = 1600;
export const MESSAGE_REVEAL_JITTER_MS = 600;
// Initial messages to show on mount — bot greeting + first user question.
export const INITIAL_VISIBLE_COUNT = 2;
