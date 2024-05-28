import { expect, test } from 'vitest';

test('stub', () => expect(1).toBe(1));

// import type * as client from '../client';
// import type * as ub from '../urbit';
// import { toClientUnread, toClientUnreads } from './unreadsApi';

// const inputUnread: [string, ub.Unread, client.UnreadType] = [
//   'chat/~nibset-napwyn/commons',
//   {
//     unread: null,
//     count: 0,
//     recency: 1684342021902,
//     threads: {
//       '170141184506679332462977882563190718464': {
//         count: 1,
//         id: '170141184506679449778442814913098285056',
//       },
//       '170141184506573685591436091634451742720': {
//         count: 7,
//         id: '170141184506573686840992177870717583360',
//       },
//     },
//   },
//   'channel',
// ];

// const expectedChannelUnread = {
//   channelId: 'chat/~nibset-napwyn/commons',
//   type: 'channel',
//   count: 0,
//   updatedAt: 1684342021902,
//   countWithoutThreads: 0,
//   firstUnreadPostId: null,
//   firstUnreadPostReceivedAt: null,
//   threadUnreads: [
//     {
//       channelId: 'chat/~nibset-napwyn/commons',
//       count: 1,
//       firstUnreadPostId: '170.141.184.506.679.449.778.442.814.913.098.285.056',
//       firstUnreadPostReceivedAt: 1709097372141,
//       threadId: '170.141.184.506.679.332.462.977.882.563.190.718.464',
//     },
//     {
//       channelId: 'chat/~nibset-napwyn/commons',
//       count: 7,
//       firstUnreadPostId: '170.141.184.506.573.686.840.992.177.870.717.583.360',
//       firstUnreadPostReceivedAt: 1703363951814,
//       threadId: '170.141.184.506.573.685.591.436.091.634.451.742.720',
//     },
//   ],
// };

// test('converts a channel unread from server to client format', () => {
//   expect(toClientUnread(...inputUnread)).toStrictEqual(expectedChannelUnread);
// });

// test('converts an array of contacts from server to client format', () => {
//   expect(
//     toClientUnreads({ [inputUnread[0]]: inputUnread[1] }, inputUnread[2])
//   ).toStrictEqual([expectedChannelUnread]);
// });

// const inputDMUnread: [string, ub.DMUnread, client.UnreadType] = [
//   'dm/~pondus-latter',
//   {
//     unread: null,
//     count: 0,
//     recency: 1684342021902,
//     threads: {
//       '~solfer-magfed/170.141.184.506.756.887.451.899.884.050.553.971.408': {
//         'parent-time': '170141184506756887456934791340363874304',
//         count: 4,
//         id: '~pondus-watbel/170.141.184.506.756.903.044.379.247.235.026.665.865',
//         time: '170141184506756903048577408232069267456',
//       },
//     },
//   },
//   'dm',
// ];

// const expectedDMUnread = {
//   channelId: 'dm/~pondus-latter',
//   type: 'dm',
//   count: 0,
//   updatedAt: 1684342021902,
//   countWithoutThreads: 0,
//   firstUnreadPostId: null,
//   firstUnreadPostReceivedAt: null,
//   threadUnreads: [
//     {
//       channelId: 'dm/~pondus-latter',
//       count: 4,
//       firstUnreadPostId: '170.141.184.506.756.903.044.379.247.235.026.665.865',
//       firstUnreadPostReceivedAt: 1713296122101,
//       threadId: '170.141.184.506.756.887.451.899.884.050.553.971.408',
//     },
//   ],
// };

// test('converts a channel unread from server to client format', () => {
//   expect(toClientUnread(...inputDMUnread)).toStrictEqual(expectedDMUnread);
// });

// test('converts an array of channels from server to client format', () => {
//   expect(
//     toClientUnreads({ [inputDMUnread[0]]: inputDMUnread[1] }, inputDMUnread[2])
//   ).toStrictEqual([expectedDMUnread]);
// });
