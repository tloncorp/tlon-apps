import * as db from '@tloncorp/shared/dist/db';
import { View } from '@tloncorp/ui';
import {
  GroupReference,
  PostReference,
} from '@tloncorp/ui/src/components/ContentReference';
import { PropsWithChildren } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';
import { ScrollView } from 'react-native-gesture-handler';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePost, group } from './fakeData';

const fakePost = createFakePost();

const chatRef: db.Post = {
  ...fakePost,
  channelId: 'chat/~solfer-magfed/another',
  groupId: '~solfer-magfed/boko',
  type: 'chat',
  content: [{ inline: ['okokok', { break: null }] }],
};

const galleryRef: db.Post = {
  ...fakePost,
  channelId: 'heap/~solfer-magfed/gg-',
  groupId: '~solfer-magfed/boko',
  type: 'block',
  content: [
    { inline: [] },
    {
      block: {
        image: {
          width: 1170,
          alt: 'heap image',
          src: 'https://dans-gifts.s3.amazonaws.com/dans-gifts/solfer-magfed/2023.12.15..22.37.52..1fbe.76c8.b439.5810-IMG_5907.png',
          height: 2532,
        },
      },
    },
  ],
} as const;

const notebookRef: db.Post = {
  ...fakePost,
  channelId: 'diary/~solfer-magfed/bofto',
  groupId: '~solfer-magfed/boko',
  type: 'note',
  title: 'A Quote About Something',
  image:
    'https://dans-gifts.s3.amazonaws.com/dans-gifts/solfer-magfed/2023.12.7..16.54.32..7999.9999.9999.9999-IMG_FBD440716632-1.jpeg',
  content: [
    { block: { header: { content: ['Whats8-'], tag: 'h1' } } },
    { inline: ['Ok, goodbye.', { break: null }] },
  ],
};

function Wrapper({ children }: PropsWithChildren) {
  return (
    <FixtureWrapper fillWidth>
      <ScrollView>
        <View flex={1} paddingVertical={100} paddingHorizontal="$l" gap="$l">
          {children}
        </View>
      </ScrollView>
    </FixtureWrapper>
  );
}

function RefList(props: {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  hasData: boolean;
  onPress: () => void;
}) {
  const [viewMode, setViewMode] = useFixtureSelect('Viewmode', {
    options: ['chat', 'block', 'note', 'activity', 'attachment'],
    defaultValue: 'chat',
  });
  return (
    <Wrapper>
      {[chatRef, galleryRef, notebookRef].map((p, i) => {
        return (
          <PostReference
            key={i}
            channelId={p.channelId}
            post={props.hasData ? p : null}
            viewMode={viewMode}
            {...props}
          />
        );
      })}
      <GroupReference
        data={props.hasData ? group : null}
        {...props}
        viewMode={viewMode}
      />
    </Wrapper>
  );
}

export default (
  <RefList
    isLoading={false}
    isError={false}
    errorMessage={''}
    hasData={true}
    onPress={() => {}}
  />
);
