import type * as ub from '@tloncorp/api/urbit';
import { describe, expect, it } from 'vitest';

import { renderActivityEventPreview } from './index';

const key = { id: '~zod/170.141.184.500', time: '170.141.184.500' };
const content: ub.Story = [{ inline: ['hello'] }];

function readSourceFor(event: ub.ActivityEvent) {
  return renderActivityEventPreview({ event })?.readSource;
}

describe('renderActivityEventPreview readSource', () => {
  it('reads the channel a post arrived in', () => {
    expect(
      readSourceFor({
        notified: true,
        post: {
          key,
          group: '~zod/test-group',
          channel: 'chat/~zod/test-channel',
          content,
          mention: false,
        },
      })
    ).toEqual({
      channel: { nest: 'chat/~zod/test-channel', group: '~zod/test-group' },
    });
  });

  it('reads the thread a reply arrived in, not its channel', () => {
    const parent = { id: '~zod/170.141.184.400', time: '170.141.184.400' };
    expect(
      readSourceFor({
        notified: true,
        reply: {
          parent,
          key,
          group: '~zod/test-group',
          channel: 'chat/~zod/test-channel',
          content,
          mention: false,
        },
      })
    ).toEqual({
      thread: {
        key: parent,
        channel: 'chat/~zod/test-channel',
        group: '~zod/test-group',
      },
    });
  });

  it('reads the dm a message arrived in', () => {
    expect(
      readSourceFor({
        notified: true,
        'dm-post': { key, whom: { ship: '~zod' }, content, mention: false },
      })
    ).toEqual({ dm: { ship: '~zod' } });
  });

  it('reads the note itself, not its notebook', () => {
    const note = {
      id: '170.141.184.500',
      folder: '',
      notebook: '~zod/test-notebook',
      group: '~zod/test-group',
      title: 'A note',
      author: '~zod',
    };
    expect(readSourceFor({ notified: true, 'note-create': note })).toEqual({
      note: {
        id: '170.141.184.500',
        notebook: '~zod/test-notebook',
        group: '~zod/test-group',
      },
    });
    expect(readSourceFor({ notified: true, 'note-edit': note })).toEqual({
      note: {
        id: '170.141.184.500',
        notebook: '~zod/test-notebook',
        group: '~zod/test-group',
      },
    });
  });

  it('reads the group a group event arrived in', () => {
    expect(
      readSourceFor({
        notified: true,
        'group-join': { group: '~zod/test-group', ship: '~bus' },
      })
    ).toEqual({ group: '~zod/test-group' });
  });

  // reading `base` would clear every unread on the ship, so events with no
  // source of their own must not offer a "mark as read" action at all
  it('leaves sourceless events without a read target', () => {
    expect(
      readSourceFor({
        notified: true,
        contact: {
          who: '~bus',
          update: { nickname: { type: 'text', value: 'bus' } },
        },
      })
    ).toBeUndefined();
  });
});

describe('renderActivityEventPreview names', () => {
  const nickname = (ship: string, fallback: string) => ({
    type: 'userNickname',
    ship,
    fallback,
  });

  it('gives a DM sender their ship number to fall back on', () => {
    const preview = renderActivityEventPreview({
      event: {
        notified: true,
        'dm-post': {
          key: {
            id: '~sampel-palnet/170.141.184.500',
            time: '170.141.184.500',
          },
          whom: { ship: '~sampel-palnet' },
          content,
          mention: false,
        },
      },
    });
    expect(preview?.message?.senderFallbackName).toBe('1.624.961.343');
    expect(preview?.message?.conversationTitle).toEqual(
      nickname('~sampel-palnet', '1.624.961.343')
    );
  });

  it('turns mentions in a post body into name nodes', () => {
    const preview = renderActivityEventPreview({
      event: {
        notified: true,
        post: {
          key,
          group: '~zod/test-group',
          channel: 'chat/~zod/test-channel',
          content: [{ inline: ['hi ', { ship: '~ten' }, '!'] }],
          mention: true,
        },
      },
    });
    const body = {
      type: 'concatenateStrings',
      first: {
        type: 'concatenateStrings',
        first: { type: 'stringLiteral', content: 'hi ' },
        second: nickname('~ten', '160'),
      },
      second: { type: 'stringLiteral', content: '!' },
    };
    expect(preview?.notification.body).toEqual(body);
    expect(preview?.message?.messageText).toEqual(body);
  });

  it('keeps typed mention markers around a non-ship as text', () => {
    const preview = renderActivityEventPreview({
      event: {
        notified: true,
        post: {
          key,
          group: '~zod/test-group',
          channel: 'chat/~zod/test-channel',
          content: [{ inline: ['hello'] }],
          mention: false,
        },
      },
    });
    expect(preview?.notification.body).toEqual({
      type: 'stringLiteral',
      content: 'hello',
    });
  });

  it('gives event actors their ship number to fall back on', () => {
    const preview = renderActivityEventPreview({
      event: {
        notified: true,
        'group-join': { group: '~zod/test-group', ship: '~bus' },
      },
    });
    expect(preview?.notification.body).toMatchObject({
      first: { first: nickname('~bus', '182') },
    });
  });
});
