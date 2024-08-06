import { useCallback } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Text, View, getTokenValue } from 'tamagui';

import ContentRenderer from '../ContentRenderer';
import { Image } from '../Image';
import { DetailView, DetailViewProps } from './DetailView';

const IMAGE_HEIGHT = 268;

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
      <DetailView.Header replyCount={post.replyCount ?? 0}>
        {post.image && (
          <TouchableOpacity onPress={handleImagePressed} activeOpacity={0.9}>
            <View marginHorizontal={-getTokenValue('$2xl')} alignItems="center">
              <Image
                source={{
                  uri: post.image,
                }}
                width="100%"
                height={IMAGE_HEIGHT}
              />
            </View>
          </TouchableOpacity>
        )}
        {post.title && (
          <Text color="$primaryText" fontSize={24} fontWeight={'500'}>
            {post.title}
          </Text>
        )}
        <DetailView.MetaData post={post} />
        <ContentRenderer post={post} />
      </DetailView.Header>
    </DetailView>
  );
}
