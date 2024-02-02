import * as db from '@db';
import {YStack} from '@ochre';
import React, {useMemo} from 'react';
import {PostList} from './ObjectList';
import * as specialPosts from './posts';
import posts from './posts.json';

const data = [...Object.values(specialPosts), ...posts];

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
