import {
  DurableClient,
  configureDurableClient,
} from '@tloncorp/api/client/durable';
import { expect, test } from 'vitest';

import { backendPublishesNotes } from './notesPublishSupport';

test('only a ship publishes notes', () => {
  expect(backendPublishesNotes()).toBe(true);
  configureDurableClient(new DurableClient('token'));
  expect(backendPublishesNotes()).toBe(false);
});
