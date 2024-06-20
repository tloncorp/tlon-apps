import { expect, test } from 'vitest';

import * as db from '../db';
import dmFeed from '../test/activityDmFeed.json';
import dmReplyFeed from '../test/activityDmReplyFeed.json';
import initActivityFeeds from '../test/activityInitFeeds.json';
import channelPostFeed from '../test/activityPostFeed.json';
import replyPostFeed from '../test/activityReplyPostFeed.json';
import {
  fromFeedToActivityEvents,
  fromInitFeedToBucketedActivityEvents,
} from './activityApi';

// const dmFeed: ub.ActivityFeed = await import('../test/activityDmFeed.json');

const expectedDmEvent: db.ActivityEvent = {
  id: '170.141.184.506.853.323.579.606.989.072.752.443.392',
  sourceId: 'ship/~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  channelId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  authorId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  isMention: false,
  postId: '170.141.184.506.853.323.576.871.214.428.711.452.409',
  shouldNotify: true,
  type: 'post',
  bucketId: 'all',
  timestamp: 1718523089789,
  content: [
    {
      inline: [
        'how are you?',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a DM activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(dmFeed, 'all');
  expect(events.length).toBe(1);
  expect(events[0]).toStrictEqual(expectedDmEvent);
});

const expectedPostEvent: db.ActivityEvent = {
  id: '170.141.184.506.853.155.647.879.036.981.225.717.760',
  sourceId:
    'channel/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  groupId:
    '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
  channelId:
    'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  authorId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  isMention: false,
  postId: '170.141.184.506.853.155.647.879.036.981.225.717.760',
  shouldNotify: true,
  type: 'post',
  bucketId: 'all',
  timestamp: 1718513986192,
  content: [
    {
      inline: [
        'sorry, i was trying it out',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a post activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(channelPostFeed, 'all');
  expect(events.length).toBe(6);
  expect(events[0]).toStrictEqual(expectedPostEvent);
});

const expectedReplyEvent: db.ActivityEvent = {
  id: '170.141.184.506.852.591.480.642.042.887.720.140.800',
  sourceId:
    'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.591.089.314.701.116.289.581.056',
  groupId:
    '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
  channelId:
    'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  authorId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  isMention: false,
  postId: '170.141.184.506.852.591.480.642.042.887.720.140.800',
  parentId: '170.141.184.506.852.591.089.314.701.116.289.581.056',
  parentAuthorId: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod',
  shouldNotify: true,
  type: 'reply',
  bucketId: 'replies',
  timestamp: 1718483402625,
  content: [
    {
      inline: [
        'definitely needs an upgrade. Maybe some floor lamps with warmer light?',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a reply activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(replyPostFeed, 'replies');
  expect(events.length).toBe(1);
  expect(events[0]).toStrictEqual(expectedReplyEvent);
});

const expectedDmReplyEvent: db.ActivityEvent = {
  id: '170.141.184.506.854.078.982.999.616.565.792.473.088',
  sourceId:
    'dm-thread/~pondus-watbel/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
  channelId: '~pondus-watbel',
  authorId: '~pondus-watbel',
  isMention: false,
  postId: '170.141.184.506.854.078.980.633.339.753.179.094.450',
  parentId: '170.141.184.506.854.078.840.401.191.304.839.083.065',
  parentAuthorId: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod',
  shouldNotify: true,
  type: 'reply',
  bucketId: 'replies',
  timestamp: 1718564040289,
  content: [
    {
      inline: [
        'how are you today?',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a dm reply activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(dmReplyFeed, 'replies');
  expect(events.length).toBe(1);
  expect(events[0]).toStrictEqual(expectedDmReplyEvent);
});

test('converts activity init feeds from server to client format', () => {
  const events = fromInitFeedToBucketedActivityEvents(initActivityFeeds);
  const numAllEvents = 12;
  const numMentionEvents = 1;
  const numReplyEvents = 3;
  const numAllSources = 6;

  expect(events.filter((event) => event.bucketId === 'all').length).toBe(
    numAllEvents
  );
  expect(events.filter((event) => event.bucketId === 'mentions').length).toBe(
    numMentionEvents
  );
  expect(events.filter((event) => event.bucketId === 'replies').length).toBe(
    numReplyEvents
  );

  const sourceSet = new Set<string>();
  events
    .filter((event) => event.bucketId === 'all')
    .forEach((event) => sourceSet.add(event.sourceId));
  expect(sourceSet.size).toBe(numAllSources);
});
