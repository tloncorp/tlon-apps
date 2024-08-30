import * as db from '@tloncorp/shared/dist/db';
import {
  AppDataContextProvider,
  GalleryPost,
  RequestsProvider,
  View,
} from '@tloncorp/ui';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FixtureWrapper } from './FixtureWrapper';
import * as content from './contentHelpers';

const {
  postWithChatReference,
  postWithGalleryReference,
  postWithNotebookReference,
  postWithCode,
  postWithImage,
  postWithVideo,
  postWithBlockquote,
  postWithGroupReference,
  postWithGroupReferenceNoAvatar,
  postWithImageAndText,
  postWithList,
  postWithMention,
  postWithText,
  postWithDeleted,
  postWithHidden,
  postWithLink,
} = content;

// unsupported

const GalleryPostFixture = ({ posts }: { posts: db.Post[] }) => {
  const insets = useSafeAreaInsets();
  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider contacts={Object.values(content.exampleContacts)}>
        <RequestsProvider
          useChannel={content.useChannel}
          useGroup={content.useGroup}
          usePostReference={content.usePostReference}
        >
          <FlatList
            data={posts}
            renderItem={({ item }) => (
              <View flex={0.5} aspectRatio={1}>
                <GalleryPost post={item} />
              </View>
            )}
            numColumns={2}
            columnWrapperStyle={{ gap: 12, width: '100%' }}
            contentContainerStyle={{
              paddingTop: insets.top,
              paddingHorizontal: 12,
              paddingBottom: insets.bottom,
              gap: 12,
            }}
          />
        </RequestsProvider>
      </AppDataContextProvider>
    </FixtureWrapper>
  );
};

export default {
  All: (
    <GalleryPostFixture
      posts={[
        postWithLink,
        postWithChatReference,
        postWithGalleryReference,
        postWithNotebookReference,
        postWithCode,
        postWithImage,
        postWithVideo,
        postWithBlockquote,
        postWithGroupReference,
        postWithGroupReferenceNoAvatar,
        postWithImageAndText,
        postWithList,
        postWithMention,
        postWithText,
        postWithHidden,
        postWithDeleted,
      ]}
    />
  ),
  ChatReference: <GalleryPostFixture posts={[postWithChatReference]} />,
  GalleryReference: <GalleryPostFixture posts={[postWithGalleryReference]} />,
  NotebookReference: <GalleryPostFixture posts={[postWithNotebookReference]} />,
  Code: <GalleryPostFixture posts={[postWithCode]} />,
  Image: <GalleryPostFixture posts={[postWithImage]} />,
  Video: <GalleryPostFixture posts={[postWithVideo]} />,
  Blockquote: <GalleryPostFixture posts={[postWithBlockquote]} />,
  GroupReference: <GalleryPostFixture posts={[postWithGroupReference]} />,
  ImageAndText: <GalleryPostFixture posts={[postWithImageAndText]} />,
  List: <GalleryPostFixture posts={[postWithList]} />,
  Mention: <GalleryPostFixture posts={[postWithMention]} />,
  Text: <GalleryPostFixture posts={[postWithText]} />,
  Link: <GalleryPostFixture posts={[postWithLink]} />,
};
