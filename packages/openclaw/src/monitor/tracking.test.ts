import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createParticipatedThreadTracker } from './tracking.js';

describe('createParticipatedThreadTracker', () => {
  it('evicts the least recently used thread at the limit', () => {
    const tracker = createParticipatedThreadTracker(3);
    tracker.add('touched');
    tracker.add('untouched');
    tracker.add('recent');

    // has() must refresh recency, so the oldest entry survives once touched.
    expect(tracker.has('touched')).toBe(true);
    tracker.add('newest');

    expect(tracker.has('untouched')).toBe(false);
    expect(tracker.has('touched')).toBe(true);
    expect(tracker.has('recent')).toBe(true);
    expect(tracker.has('newest')).toBe(true);
  });
});

// monitorTlonProvider is not unit-testable (see owner-tool-posts-wiring), so
// the thread wiring is pinned at the source level.
describe('participated thread wiring', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.resolve(here, './index.ts'), 'utf8');

  it('bounds participated threads', () => {
    expect(source).toMatch(
      /const participatedThreads = createParticipatedThreadTracker\(\);/
    );
  });
});
