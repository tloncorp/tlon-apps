import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'tamagui';

import {
  AppDataContextProvider,
  GalleryPost,
  RequestsProvider,
  View,
} from '../ui';
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
          usePost={content.usePost}
          useApp={content.useApp}
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

const GalleryPostSpecimen = ({
  label,
  post,
  onPressRetry,
}: {
  label: string;
  post: db.Post;
  onPressRetry?: (post: db.Post) => Promise<void>;
}) => {
  return (
    <View padding="$m" gap="$m" backgroundColor="$secondaryBackground">
      <Text size="$label/s">{label}</Text>
      <View backgroundColor="$background" borderRadius="$l" aspectRatio={1}>
        <GalleryPost post={post} onPressRetry={onPressRetry} />
      </View>
    </View>
  );
};

const PostVariantsFixture = ({ post }: { post: db.Post }) => {
  const insets = useSafeAreaInsets();
  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider contacts={Object.values(content.exampleContacts)}>
        <RequestsProvider
          usePost={content.usePost}
          useApp={content.useApp}
          useChannel={content.useChannel}
          useGroup={content.useGroup}
          usePostReference={content.usePostReference}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top,
              paddingHorizontal: 12,
              paddingBottom: insets.bottom,
              gap: 12,
            }}
          >
            <GalleryPostSpecimen label="Default" post={post} />
            <GalleryPostSpecimen
              label="Pending"
              post={{ ...post, deliveryStatus: 'pending' }}
            />
            <GalleryPostSpecimen
              label="Failed"
              post={{ ...post, deliveryStatus: 'failed' }}
              onPressRetry={async (p) => {
                alert(`Retry triggered for post: ${p.id}`);
              }}
            />
            <GalleryPostSpecimen
              label="Sent"
              post={{ ...post, deliveryStatus: 'sent' }}
            />
            <GalleryPostSpecimen
              label="Edited"
              post={{ ...post, isEdited: true }}
            />
          </ScrollView>
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
  DeliveryStates: <PostVariantsFixture post={postWithImage} />,
};
