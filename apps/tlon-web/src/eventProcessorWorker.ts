/// <reference lib="webworker" />

/* eslint-disable no-restricted-globals */
import { ChannelsSubscribeResponse } from '@tloncorp/shared/dist/urbit/channel';
import { decToUd, udToDec } from '@urbit/api';

interface EventData {
  type: 'post' | 'reply' | 'hiddenPosts';
  data: (string | ChannelsSubscribeResponse)[];
  nest?: string;
}

interface Update {
  [key: string]: EventData;
}

self.addEventListener('message', (event) => {
  console.log('eventProcessorWorker.ts: message event received.', event.data);

  try {
    const { events } = event.data;
    const updates = processEvents(events);

    self.postMessage({ updates });
    console.log('eventProcessorWorker.ts: updates:', updates);
  } catch (e) {
    console.error('Error processing events', e);
    self.postMessage({ error: e });
  }
});

type App = 'chat' | 'heap' | 'diary';

// these helper functions are defined here to avoid having vite
// bundle unnecessary dependencies in the worker bundle
function nestToFlag(nest: string): [App, string] {
  const [app, ...rest] = nest.split('/');

  return [app as App, rest.join('/')];
}

const infinitePostsKey = (nest: string) => {
  const [han, flag] = nestToFlag(nest);
  return [han, 'posts', flag, 'infinite'];
};

const postKey = (nest: string, id: string) => {
  const [han, flag] = nestToFlag(nest);
  return [han, 'posts', flag, udToDec(id)];
};

function processEvents(events: ChannelsSubscribeResponse[]): Update {
  const updates = events.reduce<Update>((accumulator, event) => {
    if ('hide' in event || 'show' in event) {
      const key = ['channels', 'hidden'].toString();
      const newData = event.hide || event.show;
      return {
        ...accumulator,
        [key]: {
          type: 'hiddenPosts',
          data: [...(accumulator[key] ? accumulator[key].data : []), newData],
        },
      };
    }
    if ('response' in event && 'post' in (event as any).response) {
      const { post } = (event as any).response;
      const isReply = 'reply' in post['r-post'];
      const nestKey = isReply
        ? postKey((event as any).nest, decToUd(post.id)).join()
        : infinitePostsKey((event as any).nest).join();
      return {
        ...accumulator,
        [nestKey]: {
          type: isReply ? 'reply' : 'post',
          data: [
            ...(accumulator[nestKey] ? accumulator[nestKey].data : []),
            event,
          ],
          nest: (event as any).nest,
        },
      };
    }
    return accumulator;
  }, {});
  return updates;
}
