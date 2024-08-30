import { makePrettyShortDate } from '@tloncorp/shared/dist';
import { useCallback, useMemo } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { View } from 'tamagui';

import AuthorRow from '../AuthorRow';
import {
  NotebookPostFrame,
  NotebookPostHeroImage,
  NotebookPostTitle,
} from '../NotebookPost/NotebookPost';
import { ContentRenderer } from '../PostContent';
import { Text } from '../TextV2';
import { DetailView, DetailViewProps } from './DetailView';

export default function NotebookDetailView({
  post,
  editingPost,
  setEditingPost,
  editPost,
  sendReply,
  groupMembers,
  posts,
  onPressImage,
  storeDraft,
  clearDraft,
  getDraft,
  goBack,
  onPressRetry,
  onPressDelete,
}: DetailViewProps) {
  const handleImagePressed = useCallback(() => {
    if (post.image) {
      onPressImage?.(post, post.image);
    }
  }, [post, onPressImage]);

  const date = useMemo(() => {
    return makePrettyShortDate(new Date(post.receivedAt));
  }, [post.receivedAt]);

  if (!post) {
    return null;
  }

  return (
    <DetailView
      post={post}
      editingPost={editingPost}
      setEditingPost={setEditingPost}
      editPost={editPost}
      sendReply={sendReply}
      groupMembers={groupMembers}
      posts={posts}
      onPressImage={onPressImage}
      storeDraft={storeDraft}
      clearDraft={clearDraft}
      getDraft={getDraft}
      goBack={goBack}
      onPressRetry={onPressRetry}
      onPressDelete={onPressDelete}
    >
      <View>
        <NotebookPostFrame>
          {post.image && (
            <TouchableOpacity onPress={handleImagePressed} activeOpacity={0.9}>
              <NotebookPostHeroImage
                source={{
                  uri: post.image,
                }}
              />
            </TouchableOpacity>
          )}

          {post.title && <NotebookPostTitle>{post.title}</NotebookPostTitle>}

          <Text size="$body" color="$tertiaryText">
            {date}
          </Text>

          <AuthorRow
            authorId={post.authorId}
            author={post.author}
            sent={post.sentAt}
            type={post.type}
          />
        </NotebookPostFrame>
        <View
          paddingHorizontal="$xl"
          paddingBottom="$l"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <ContentRenderer viewMode="note" post={post} />
        </View>
      </View>
    </DetailView>
  );
}
