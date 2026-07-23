import { describe, expect, test } from 'vitest';

import { TlonRouter } from './routing.js';

function router() {
  return new TlonRouter({
    botShip: 'bot',
    ownerShip: 'zod',
    allowedDmShips: ['nec'],
    allowedChannelShips: ['nec'],
    channels: ['chat/~zod/general'],
  });
}

describe('TlonRouter', () => {
  test('accepts allowlisted DMs and rejects bot echoes', () => {
    const accepted = router().parseChat({
      whom: '~nec',
      id: 'nec/1',
      response: {
        add: {
          essay: {
            author: '~nec',
            content: [{ inline: ['hello'] }],
          },
        },
      },
    });
    expect(accepted).toMatchObject({
      key: 'dm:nec',
      sender: 'nec',
      text: 'hello',
    });

    expect(
      router().parseChat({
        whom: '~zod',
        id: 'bot/1',
        response: {
          add: {
            essay: {
              author: '~bot',
              content: [{ inline: ['echo'] }],
            },
          },
        },
      })
    ).toBeNull();
  });

  test('requires a bot mention for allowlisted channel users', () => {
    expect(
      router().parseChannel({
        nest: 'chat/~zod/general',
        response: {
          post: {
            id: 'post-1',
            'r-post': {
              set: {
                essay: {
                  author: '~nec',
                  content: [{ inline: ['background chatter'] }],
                },
              },
            },
          },
        },
      })
    ).toBeNull();

    expect(
      router().parseChannel({
        nest: 'chat/~zod/general',
        response: {
          post: {
            id: 'post-2',
            'r-post': {
              set: {
                essay: {
                  author: '~nec',
                  content: [{ inline: ['~bot help me'] }],
                },
              },
            },
          },
        },
      })
    ).toMatchObject({ text: 'help me', key: 'channel:chat/~zod/general' });
  });

  test('lets the owner speak without a mention in an owned channel', () => {
    expect(
      router().parseChannel({
        nest: 'chat/~zod/general',
        response: {
          post: {
            id: 'post-3',
            'r-post': {
              set: {
                essay: {
                  author: '~zod',
                  content: [{ inline: ['do the thing'] }],
                },
              },
            },
          },
        },
      })
    ).toMatchObject({ text: 'do the thing' });
  });
});
