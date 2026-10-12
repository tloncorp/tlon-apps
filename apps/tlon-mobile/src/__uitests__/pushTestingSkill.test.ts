import { describe, expect, it } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { parseNotificationPayload } from '../lib/notificationPayload';

const helper = path.resolve(
  __dirname,
  '../../../../.agents/skills/tlon-push-testing/scripts/send-push.mjs'
);
const parent = '~zod/170.141.184.506.854.078.840.401.191.304.839.083.065';
const postId = parent.split('/')[1];
const club = '0v4.00000.qd4p2.it253.qs53q.s53qs';
type Fixture = {
  scenario: string;
  inputs: Record<string, string>;
  expected: object | null;
};
const fixtures: Fixture[] = [];
const channelTarget = (channelId: string, thread = false) => ({
  channelId,
  postInfo: thread ? { id: postId, authorId: '~zod', isDm: false } : null,
});

for (const channelId of ['~zod', club]) {
  for (const scenario of [
    'dm-post',
    'dm-post-mention',
    'dm-reply',
    'dm-reply-mention',
    'dm-react',
    'dm-react-reply',
  ]) {
    const thread = scenario.includes('reply');
    fixtures.push({
      scenario,
      inputs: {
        'channel-id': channelId,
        ...(thread ? { 'parent-id': parent } : {}),
      },
      expected: channelTarget(channelId, thread),
    });
  }
  fixtures.push({
    scenario: 'dm-invite',
    inputs: { 'channel-id': channelId },
    expected: {
      type: 'dmInvite',
      channelId,
      whomType: channelId === club ? 'club' : 'ship',
    },
  });
}
for (const scenario of [
  'post',
  'post-mention',
  'reply',
  'reply-mention',
  'react',
  'react-reply',
  'flag-post',
  'flag-reply',
]) {
  const thread = scenario.includes('reply') || scenario === 'flag-post';
  fixtures.push({
    scenario,
    inputs: {
      'channel-id': 'chat/~zod/test',
      ...(scenario === 'flag-post'
        ? { 'post-id': parent }
        : thread
          ? { 'parent-id': parent }
          : {}),
    },
    expected: channelTarget('chat/~zod/test', thread),
  });
}
for (const scenario of [
  'group-ask',
  'group-invite',
  'group-join',
  'group-kick',
  'group-role',
]) {
  fixtures.push({
    scenario,
    inputs: {
      'group-id': '~zod/test',
      ...(scenario === 'group-kick' ? { ship: '~nec' } : {}),
    },
    expected: {
      groupId: '~zod/test',
      type:
        scenario === 'group-ask'
          ? 'groupJoinRequest'
          : scenario === 'group-invite'
            ? 'groupInvite'
            : 'groupMembers',
      ...(scenario === 'group-kick' ? { ship: '~nec' } : {}),
    },
  });
}
for (const scenario of ['note-create', 'note-edit'])
  fixtures.push({
    scenario,
    inputs: { 'channel-id': 'notes/~zod/journal', 'note-id': '123.456' },
    expected: {
      channelId: 'notes/~zod/journal',
      postInfo: null,
      selectedPostId: '123456',
    },
  });
for (const scenario of ['contact', 'contact-matched'])
  fixtures.push({
    scenario,
    inputs: { 'contact-id': '~nec' },
    expected: { type: 'contactMatched', contactId: '~nec' },
  });
fixtures.push({
  scenario: 'contacts-matched',
  inputs: {},
  expected: { type: 'contactsMatched' },
});
for (const scenario of [
  'malformed-activity',
  'unknown-activity',
  'missing-event',
])
  fixtures.push({ scenario, inputs: {}, expected: null });
for (const scenario of [
  'message',
  'native-message',
  'unrecognized',
  'native-notify',
  'node-resume-nudge',
  'dismiss',
])
  fixtures.push({
    scenario,
    inputs:
      scenario === 'dismiss'
        ? {
            uid: '0v2',
            'notification-id': '123',
            'dismiss-source': '~zod',
            'notify-count': '0',
          }
        : scenario === 'native-notify'
          ? { uid: '0v2' }
          : scenario === 'node-resume-nudge'
            ? { ship: '~zod' }
            : {},
    expected: { type: 'unrecognized' },
  });

describe('push testing skill payloads against the real app parser', () => {
  it('covers every named mock', () => {
    const names = execFileSync(process.execPath, [helper, '--list'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n');
    expect(new Set(fixtures.map((fixture) => fixture.scenario))).toEqual(
      new Set(names)
    );
  });

  it.each(fixtures)(
    '$scenario $inputs routes as documented',
    ({ scenario, inputs, expected }) => {
      const args = Object.entries(inputs).flatMap(([key, value]) => [
        `--${key}`,
        value,
      ]);
      const payload = JSON.parse(
        execFileSync(
          process.execPath,
          [helper, '--scenario', scenario, ...args],
          { encoding: 'utf8' }
        )
      );
      const result = parseNotificationPayload(payload);
      if (expected === null) expect(result).toBeNull();
      else
        expect(result).toEqual({
          meta: { errorsFromExtension: undefined },
          ...expected,
        });
      if (scenario.endsWith('-mention')) {
        const event = JSON.parse(payload.activityEventJsonString).event;
        expect(event[scenario.replace('-mention', '')].mention).toBe(true);
      }
    }
  );

  it('forwards extension errors without losing the destination', () => {
    const payload = JSON.parse(
      execFileSync(
        process.execPath,
        [
          helper,
          '--scenario',
          'dm-post',
          '--channel-id',
          '~zod',
          '--extension-error',
          'Synthetic fetch failure',
        ],
        { encoding: 'utf8' }
      )
    );
    expect(parseNotificationPayload(payload)).toMatchObject({
      channelId: '~zod',
      meta: { errorsFromExtension: ['Synthetic fetch failure'] },
    });
  });
});
