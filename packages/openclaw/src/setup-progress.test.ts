import { describe, expect, it } from 'vitest';

import {
  WAITING_FOR_NOTEBOOK_LINE,
  armSetupProgress,
  disarmSetupProgress,
  isSetupProgressLine,
  noteToolCallForSetupProgress,
  setupProgressLabelFor,
} from './setup-progress.js';

describe('setupProgressLabelFor', () => {
  it('maps the recognizable build steps to status lines', () => {
    // No line for a channel create: the notebook is the owner's channel, so
    // a build that makes one is misbehaving, and announcing it would dress
    // a bug up as progress.
    expect(
      setupProgressLabelFor('tlon', {
        command: 'channels create ~zod/g "Daily Digest" --kind notes',
      })
    ).toBeNull();
    expect(
      setupProgressLabelFor('tlon', {
        command: 'notes note-create notes/~zod/d root "Today" --markdown x.md',
      })
    ).toBe('Writing the first entry…');
    // The config write is what causes the owner's app to create the
    // notebook, so it lands well before the first entry — its line must not
    // read as the last step, or the owner sees a finished-sounding setup
    // over an empty notebook.
    expect(
      setupProgressLabelFor('tlon', {
        command: 'groups update ~zod/g --description $(cat /tmp/config.json)',
      })
    ).toBe('Setting up your group…');
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

  it('reflects every recognized call into presence, without the ellipsis', () => {
    const presenceCalls: Array<[string, string]> = [];
    armSetupProgress('agent:main:presence', {
      post: async () => {},
      presence: (toolName, label) => {
        presenceCalls.push([toolName, label]);
      },
    });
    noteToolCallForSetupProgress('agent:main:presence', 'web_search', {});
    // Presence repeats per call (the tracker dedupes); the posted line
    // does not.
    noteToolCallForSetupProgress('agent:main:presence', 'web_search', {});
    noteToolCallForSetupProgress('agent:main:presence', 'image', {});
    expect(presenceCalls).toEqual([
      ['web_search', 'Searching the web'],
      ['web_search', 'Searching the web'],
      ['image', 'Generating the group icon'],
    ]);
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

describe('isSetupProgressLine', () => {
  it('recognizes every plugin-authored line, including the sweep’s own', () => {
    // The setup-survival check counts bot posts to decide whether a
    // directive turn died. A status line it failed to recognize would read
    // as "the bot replied", so a dead build would never be retried — and
    // the waiting line is posted by the sweep rather than by a tool call,
    // which is exactly the kind of line that gets forgotten here.
    for (const line of [
      'Setting up your group…',
      'Writing the first entry…',
      'Scheduling the daily job…',
      'Searching the web…',
      'Generating the group icon…',
      WAITING_FOR_NOTEBOOK_LINE,
    ]) {
      expect(isSetupProgressLine(line)).toBe(true);
      expect(isSetupProgressLine(`  ${line}  `)).toBe(true);
    }
    expect(isSetupProgressLine('Your daily digest is ready.')).toBe(false);
    expect(isSetupProgressLine('')).toBe(false);
  });
});
