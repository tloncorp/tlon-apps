import { useCallback } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { getTokenValue } from 'tamagui';

import { Image, Text, View } from '../../core';
import ContentRenderer from '../ContentRenderer';
import { DetailView, DetailViewProps } from './DetailView';

const IMAGE_HEIGHT = 268;

export default function NotebookDetailView({
  post,
  currentUserId,
  editingPost,
  setEditingPost,
  editPost,
  sendReply,
  groupMembers,
  posts,
  onPressImage,
  uploadInfo,
  storeDraft,
  clearDraft,
  getDraft,
  goBack,
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
      currentUserId={currentUserId}
      editingPost={editingPost}
      setEditingPost={setEditingPost}
      editPost={editPost}
      sendReply={sendReply}
      groupMembers={groupMembers}
      posts={posts}
      onPressImage={onPressImage}
      uploadInfo={uploadInfo}
      storeDraft={storeDraft}
      clearDraft={clearDraft}
      getDraft={getDraft}
      goBack={goBack}
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
