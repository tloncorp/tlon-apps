import { describe, expect, it } from 'vitest';

import {
  armSetupProgress,
  disarmSetupProgress,
  noteToolCallForSetupProgress,
  setupProgressLabelFor,
} from './setup-progress.js';

describe('setupProgressLabelFor', () => {
  it('maps the recognizable build steps to status lines', () => {
    expect(
      setupProgressLabelFor('tlon', {
        command: 'channels create ~zod/g "Daily Digest" --kind notes',
      })
    ).toBe('Creating the notebook channel…');
    expect(
      setupProgressLabelFor('tlon', {
        command: 'notes note-create notes/~zod/d root "Today" --stdin',
      })
    ).toBe('Writing the first entry…');
    expect(
      setupProgressLabelFor('tlon', {
        command: 'groups update ~zod/g --description $(cat /tmp/config.json)',
      })
    ).toBe('Saving the setup…');
    expect(setupProgressLabelFor('cron', {})).toBe('Scheduling the daily job…');
    expect(setupProgressLabelFor('web_search', { query: 'x' })).toBe(
      'Searching the web…'
    );
    expect(setupProgressLabelFor('image', { prompt: 'x' })).toBe(
      'Generating the group icon…'
    );
  });

  it('stays quiet for steps not worth a message', () => {
    // A rename is over in a breath; narrating it is noise.
    expect(
      setupProgressLabelFor('tlon', {
        command: 'groups update ~zod/g --title "Coffee"',
      })
    ).toBeNull();
    expect(
      setupProgressLabelFor('tlon', { command: 'groups list' })
    ).toBeNull();
    expect(setupProgressLabelFor('message', {})).toBeNull();
    expect(setupProgressLabelFor('read', { path: '/x' })).toBeNull();
  });
});

describe('noteToolCallForSetupProgress', () => {
  it('posts each label once, only for armed sessions, until disarmed', async () => {
    const posted: string[] = [];
    const post = async (text: string) => {
      posted.push(text);
    };
    const call = () =>
      noteToolCallForSetupProgress('agent:main:test', 'cron', {});

    // Not armed: silence.
    call();
    expect(posted).toEqual([]);

    armSetupProgress('agent:main:test', { post });
    call();
    call(); // Same step again — no duplicate line.
    noteToolCallForSetupProgress('agent:main:test', 'web_search', {});
    await Promise.resolve();
    expect(posted).toEqual(['Scheduling the daily job…', 'Searching the web…']);

    disarmSetupProgress('agent:main:test');
    call();
    await Promise.resolve();
    expect(posted).toHaveLength(2);
  });

  it('expires an armed session after its TTL', async () => {
    const posted: string[] = [];
    armSetupProgress('agent:main:ttl', {
      post: async (text) => {
        posted.push(text);
      },
    });
    noteToolCallForSetupProgress(
      'agent:main:ttl',
      'cron',
      {},
      Date.now() + 21 * 60_000
    );
    await Promise.resolve();
    expect(posted).toEqual([]);
  });

  it('never lets a failing post surface', () => {
    armSetupProgress('agent:main:err', {
      post: async () => {
        throw new Error('channel unavailable');
      },
    });
    expect(() =>
      noteToolCallForSetupProgress('agent:main:err', 'cron', {})
    ).not.toThrow();
  });
});
