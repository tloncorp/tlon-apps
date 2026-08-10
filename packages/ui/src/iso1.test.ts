import { test, expect } from 'vitest';
import EmojiData from '@emoji-mart/data';
test('emoji-mart loads', () => { expect(EmojiData).toBeTruthy(); });
