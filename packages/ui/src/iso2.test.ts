import { test, expect } from 'vitest';
import { createDevLogger } from '@tloncorp/shared';
test('shared loads', () => { expect(createDevLogger).toBeTruthy(); });
