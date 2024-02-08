import * as db from '@db';
import {YStack} from '@ochre';
import React, {useMemo} from 'react';
import {PostList} from './ObjectList';
import * as specialPosts from '../fixtures/posts';
import posts from '../fixtures/posts.json';

const data = [...Object.values(specialPosts), ...posts] as unknown as db.Post[];

export default () => {
  const settings: db.TabSettings = useMemo(() => {
    return {
      icon: {
        type: 'icon',
        value: 'Messages',
        color: 'transparent',
      },
      query: {
        inChannels: [],
        groupBy: 'post',
      },
      view: {
        showAuthor: true,
        showChannel: true,
        showGroup: true,
        showTime: true,
        showReplyCount: true,
        showContent: true,
      },
    };
  }, []);

  return (
    <YStack height={400} overflow="hidden">
      <PostList data={data} settings={settings} />
    </YStack>
  );
};
